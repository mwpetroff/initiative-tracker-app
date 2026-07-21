import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  departmentsTable,
  initiativesTable,
  dependenciesTable,
  riskCategoriesTable,
  initiativeHistoryTable,
  initiativeUpdatesTable,
} from "@workspace/db";
import { GetDashboardSummaryResponse, GetDependencyHeatmapResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const RISK_SCORE: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const RISK_ORDER = ["low", "medium", "high", "critical"];

router.get("/insights/dashboard", async (_req, res): Promise<void> => {
  const departments = await db.select().from(departmentsTable).orderBy(departmentsTable.name);
  const initiatives = await db.select().from(initiativesTable);
  const dependencies = await db.select().from(dependenciesTable);

  const totalInitiatives = initiatives.length;
  const activeInitiatives = initiatives.filter((i) => i.status === "in_progress").length;
  const blockedInitiatives = initiatives.filter((i) => i.status === "blocked").length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueInitiatives = initiatives.filter(
    (i) => i.status !== "completed" && new Date(i.targetDate) < today,
  ).length;
  const highRiskDependencies = dependencies.filter(
    (d) => !d.resolved && (d.riskLevel === "high" || d.riskLevel === "critical"),
  ).length;

  const departmentBreakdown = departments.map((dept) => {
    const deptInitiatives = initiatives.filter((i) => i.departmentId === dept.id);
    return {
      departmentId: dept.id,
      departmentName: dept.name,
      departmentNameJa: dept.nameJa,
      colorHex: dept.colorHex,
      total: deptInitiatives.length,
      planning: deptInitiatives.filter((i) => i.status === "planning").length,
      inProgress: deptInitiatives.filter((i) => i.status === "in_progress").length,
      blocked: deptInitiatives.filter((i) => i.status === "blocked").length,
      completed: deptInitiatives.filter((i) => i.status === "completed").length,
      onHold: deptInitiatives.filter((i) => i.status === "on_hold").length,
    };
  });

  const statusChangeRows = await db
    .select({
      id: initiativeHistoryTable.id,
      initiativeId: initiativeHistoryTable.initiativeId,
      title: initiativesTable.title,
      departmentName: departmentsTable.name,
      departmentNameJa: departmentsTable.nameJa,
      oldStatus: initiativeHistoryTable.oldStatus,
      newStatus: initiativeHistoryTable.newStatus,
      changedAt: initiativeHistoryTable.changedAt,
    })
    .from(initiativeHistoryTable)
    .innerJoin(initiativesTable, eq(initiativeHistoryTable.initiativeId, initiativesTable.id))
    .innerJoin(departmentsTable, eq(initiativesTable.departmentId, departmentsTable.id))
    .orderBy(desc(initiativeHistoryTable.changedAt))
    .limit(10);

  const createdRows = await db
    .select({
      id: initiativesTable.id,
      title: initiativesTable.title,
      departmentName: departmentsTable.name,
      departmentNameJa: departmentsTable.nameJa,
      createdAt: initiativesTable.createdAt,
    })
    .from(initiativesTable)
    .innerJoin(departmentsTable, eq(initiativesTable.departmentId, departmentsTable.id))
    .orderBy(desc(initiativesTable.createdAt))
    .limit(10);

  const updatePostRows = await db
    .select({
      id: initiativeUpdatesTable.id,
      initiativeId: initiativeUpdatesTable.initiativeId,
      content: initiativeUpdatesTable.content,
      author: initiativeUpdatesTable.author,
      createdAt: initiativeUpdatesTable.createdAt,
      title: initiativesTable.title,
      departmentName: departmentsTable.name,
      departmentNameJa: departmentsTable.nameJa,
    })
    .from(initiativeUpdatesTable)
    .innerJoin(initiativesTable, eq(initiativeUpdatesTable.initiativeId, initiativesTable.id))
    .innerJoin(departmentsTable, eq(initiativesTable.departmentId, departmentsTable.id))
    .orderBy(desc(initiativeUpdatesTable.createdAt))
    .limit(10);

  const recentActivityRows = [
    ...statusChangeRows.map((r) => ({
      id: `history-${r.id}`,
      activityType: "status_change" as const,
      initiativeId: r.initiativeId,
      title: r.title,
      departmentName: r.departmentName,
      departmentNameJa: r.departmentNameJa,
      oldStatus: r.oldStatus,
      newStatus: r.newStatus,
      summary: null,
      changedAt: r.changedAt,
    })),
    ...createdRows.map((r) => ({
      id: `created-${r.id}`,
      activityType: "created" as const,
      initiativeId: r.id,
      title: r.title,
      departmentName: r.departmentName,
      departmentNameJa: r.departmentNameJa,
      oldStatus: null,
      newStatus: null,
      summary: null,
      changedAt: r.createdAt,
    })),
    ...updatePostRows.map((r) => ({
      id: `update-${r.id}`,
      activityType: "update_posted" as const,
      initiativeId: r.initiativeId,
      title: r.title,
      departmentName: r.departmentName,
      departmentNameJa: r.departmentNameJa,
      oldStatus: null,
      newStatus: null,
      summary: r.content.length > 120 ? `${r.content.slice(0, 120)}…` : r.content,
      changedAt: r.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
    .slice(0, 10);

  const summary = {
    totalInitiatives,
    activeInitiatives,
    blockedInitiatives,
    overdueInitiatives,
    highRiskDependencies,
    departmentBreakdown,
    recentActivity: recentActivityRows,
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

router.get("/insights/heatmap", async (req, res): Promise<void> => {
  const VALID_STATUSES = ["planning", "in_progress", "blocked", "completed", "on_hold"];
  const statusFilter =
    typeof req.query.status === "string" && VALID_STATUSES.includes(req.query.status)
      ? req.query.status
      : null;

  const departments = await db.select().from(departmentsTable).orderBy(departmentsTable.name);
  const initiatives = await db.select().from(initiativesTable);
  const allDependencies = await db.select().from(dependenciesTable);
  const riskCategories = await db.select().from(riskCategoriesTable).orderBy(riskCategoriesTable.name);

  const matchingInitiativeIds = new Set(
    initiatives.filter((i) => statusFilter === null || i.status === statusFilter).map((i) => i.id),
  );
  const dependencies = statusFilter
    ? allDependencies.filter((d) => matchingInitiativeIds.has(d.initiativeId))
    : allDependencies;

  const initiativeDeptMap = new Map(initiatives.map((i) => [i.id, i.departmentId]));
  const initiativeTitleMap = new Map(initiatives.map((i) => [i.id, i.title]));

  const usedRiskCategoryIds = new Set(
    dependencies
      .filter((d) => !d.resolved)
      .map((d) => d.dependsOnRiskCategoryId)
      .filter((id): id is number => id !== null && id !== undefined),
  );
  const usedRiskCategories = riskCategories.filter((c) => usedRiskCategoryIds.has(c.id));

  const columns = [
    ...departments.map((d) => ({ key: `dept-${d.id}`, label: d.name, labelJa: d.nameJa, isExternal: false })),
    ...usedRiskCategories.map((c) => ({ key: `cat-${c.id}`, label: c.name, labelJa: c.nameJa, isExternal: true })),
  ];

  interface CellDependency {
    dependencyId: number;
    initiativeId: number;
    initiativeTitle: string;
    riskLevel: string;
    notes: string;
  }

  const cellMap = new Map<
    string,
    { dependencyCount: number; maxRiskLevel: string | null; dependencies: CellDependency[] }
  >();

  for (const dep of dependencies) {
    if (dep.resolved) continue;
    const rowDeptId = initiativeDeptMap.get(dep.initiativeId);
    if (rowDeptId === undefined) continue;

    const columnKey =
      dep.dependsOnDepartmentId !== null
        ? `dept-${dep.dependsOnDepartmentId}`
        : dep.dependsOnRiskCategoryId !== null
          ? `cat-${dep.dependsOnRiskCategoryId}`
          : null;
    if (columnKey === null) continue;

    const mapKey = `${rowDeptId}::${columnKey}`;
    const existing = cellMap.get(mapKey) ?? { dependencyCount: 0, maxRiskLevel: null, dependencies: [] };
    existing.dependencyCount += 1;
    existing.dependencies.push({
      dependencyId: dep.id,
      initiativeId: dep.initiativeId,
      initiativeTitle: initiativeTitleMap.get(dep.initiativeId) ?? "Unknown initiative",
      riskLevel: dep.riskLevel,
      notes: dep.notes ?? "",
    });
    if (
      existing.maxRiskLevel === null ||
      RISK_ORDER.indexOf(dep.riskLevel) > RISK_ORDER.indexOf(existing.maxRiskLevel)
    ) {
      existing.maxRiskLevel = dep.riskLevel;
    }
    cellMap.set(mapKey, existing);
  }

  const RISK_SORT_DESC = [...RISK_ORDER].reverse();

  const cells = Array.from(cellMap.entries()).map(([mapKey, value]) => {
    const [rowDepartmentIdStr, columnKey] = mapKey.split("::");
    return {
      rowDepartmentId: Number(rowDepartmentIdStr),
      columnKey,
      dependencyCount: value.dependencyCount,
      maxRiskLevel: value.maxRiskLevel,
      riskScore: value.maxRiskLevel ? RISK_SCORE[value.maxRiskLevel] * value.dependencyCount : 0,
      dependencies: value.dependencies.sort(
        (a, b) => RISK_SORT_DESC.indexOf(a.riskLevel) - RISK_SORT_DESC.indexOf(b.riskLevel),
      ),
    };
  });

  const heatmap = {
    rows: departments,
    columns,
    cells,
  };

  res.json(GetDependencyHeatmapResponse.parse(heatmap));
});

export default router;
