import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, departmentsTable, initiativesTable, dependenciesTable, riskCategoriesTable } from "@workspace/db";
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
  const highRiskDependencies = dependencies.filter(
    (d) => d.riskLevel === "high" || d.riskLevel === "critical",
  ).length;

  const departmentBreakdown = departments.map((dept) => {
    const deptInitiatives = initiatives.filter((i) => i.departmentId === dept.id);
    return {
      departmentId: dept.id,
      departmentName: dept.name,
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
      id: initiativesTable.id,
      title: initiativesTable.title,
      status: initiativesTable.status,
      updatedAt: initiativesTable.updatedAt,
      departmentName: departmentsTable.name,
    })
    .from(initiativesTable)
    .innerJoin(departmentsTable, eq(initiativesTable.departmentId, departmentsTable.id))
    .orderBy(desc(initiativesTable.updatedAt))
    .limit(10);

  const summary = {
    totalInitiatives,
    activeInitiatives,
    blockedInitiatives,
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

  const usedRiskCategoryIds = new Set(
    dependencies
      .map((d) => d.dependsOnRiskCategoryId)
      .filter((id): id is number => id !== null && id !== undefined),
  );
  const usedRiskCategories = riskCategories.filter((c) => usedRiskCategoryIds.has(c.id));

  const columns = [
    ...departments.map((d) => ({ key: `dept-${d.id}`, label: d.name, isExternal: false })),
    ...usedRiskCategories.map((c) => ({ key: `cat-${c.id}`, label: c.name, isExternal: true })),
  ];

  const cellMap = new Map<string, { dependencyCount: number; maxRiskLevel: string | null }>();

  for (const dep of dependencies) {
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
    const existing = cellMap.get(mapKey) ?? { dependencyCount: 0, maxRiskLevel: null };
    existing.dependencyCount += 1;
    if (
      existing.maxRiskLevel === null ||
      RISK_ORDER.indexOf(dep.riskLevel) > RISK_ORDER.indexOf(existing.maxRiskLevel)
    ) {
      existing.maxRiskLevel = dep.riskLevel;
    }
    cellMap.set(mapKey, existing);
  }

  const cells = Array.from(cellMap.entries()).map(([mapKey, value]) => {
    const [rowDepartmentIdStr, columnKey] = mapKey.split("::");
    return {
      rowDepartmentId: Number(rowDepartmentIdStr),
      columnKey,
      dependencyCount: value.dependencyCount,
      maxRiskLevel: value.maxRiskLevel,
      riskScore: value.maxRiskLevel ? RISK_SCORE[value.maxRiskLevel] * value.dependencyCount : 0,
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
