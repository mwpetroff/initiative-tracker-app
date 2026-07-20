import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  departmentsTable,
  initiativesTable,
  dependenciesTable,
  riskCategoriesTable,
  initiativeHistoryTable,
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

  const recentActivityRows = await db
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

router.get("/insights/heatmap", async (_req, res): Promise<void> => {
  const departments = await db.select().from(departmentsTable).orderBy(departmentsTable.name);
  const initiatives = await db.select().from(initiativesTable);
  const dependencies = await db.select().from(dependenciesTable);
  const riskCategories = await db.select().from(riskCategoriesTable).orderBy(riskCategoriesTable.name);

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
