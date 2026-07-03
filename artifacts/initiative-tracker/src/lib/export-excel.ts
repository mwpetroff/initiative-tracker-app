import ExcelJS from "exceljs";
import type { Initiative, Department } from "@workspace/api-client-react";

export interface ExportLabels {
  sheetName: string;
  headers: {
    title: string;
    department: string;
    status: string;
    priority: string;
    owner: string;
    progress: string;
    startDate: string;
    targetDate: string;
    quarterGoal: string;
    quarterGoalTarget: string;
    description: string;
  };
  status: Record<string, string>;
  priority: Record<string, string>;
  unknown: string;
}

const DEFAULT_LABELS: ExportLabels = {
  sheetName: "Initiative Status",
  headers: {
    title: "Title",
    department: "Department",
    status: "Status",
    priority: "Priority",
    owner: "Owner",
    progress: "Progress",
    startDate: "Start Date",
    targetDate: "Target Date",
    quarterGoal: "Quarter Goal",
    quarterGoalTarget: "Quarter Goal Target",
    description: "Description",
  },
  status: {
    planning: "Planning",
    in_progress: "In Progress",
    blocked: "Blocked",
    completed: "Completed",
    on_hold: "On Hold",
  },
  priority: {
    low: "Low",
    medium: "Medium",
    high: "High",
  },
  unknown: "Unknown",
};

function toDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`);
}

function downloadWorkbookBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportInitiativesToExcel(
  initiatives: Initiative[],
  departments: Department[] | undefined,
  filename = `initiative-status-${new Date().toISOString().slice(0, 10)}.xlsx`,
  labels: ExportLabels = DEFAULT_LABELS,
) {
  const departmentName = (id: number) => departments?.find((d) => d.id === id)?.name ?? labels.unknown;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Initiative Tracker";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(labels.sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: labels.headers.title, key: "title", width: 32 },
    { header: labels.headers.department, key: "department", width: 18 },
    { header: labels.headers.status, key: "status", width: 14 },
    { header: labels.headers.priority, key: "priority", width: 12 },
    { header: labels.headers.owner, key: "owner", width: 18 },
    { header: labels.headers.progress, key: "progress", width: 12 },
    { header: labels.headers.startDate, key: "startDate", width: 14 },
    { header: labels.headers.targetDate, key: "targetDate", width: 14 },
    { header: labels.headers.quarterGoal, key: "quarterGoal", width: 30 },
    { header: labels.headers.quarterGoalTarget, key: "quarterGoalTarget", width: 18 },
    { header: labels.headers.description, key: "description", width: 40 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF94A3B8" } },
      bottom: { style: "thin", color: { argb: "FF94A3B8" } },
      left: { style: "thin", color: { argb: "FF94A3B8" } },
      right: { style: "thin", color: { argb: "FF94A3B8" } },
    };
  });
  headerRow.height = 20;

  for (const initiative of initiatives) {
    const row = sheet.addRow({
      title: initiative.title,
      department: departmentName(initiative.departmentId),
      status: labels.status[initiative.status] ?? initiative.status,
      priority: labels.priority[initiative.priority] ?? initiative.priority,
      owner: initiative.owner,
      progress: initiative.progress / 100,
      startDate: toDate(initiative.startDate),
      targetDate: toDate(initiative.targetDate),
      quarterGoal: initiative.quarterGoal ?? "",
      quarterGoalTarget:
        initiative.quarterGoalTarget !== null && initiative.quarterGoalTarget !== undefined
          ? initiative.quarterGoalTarget / 100
          : "",
      description: initiative.description ?? "",
    });

    row.getCell("progress").numFmt = "0%";
    row.getCell("startDate").numFmt = "yyyy-mm-dd";
    row.getCell("targetDate").numFmt = "yyyy-mm-dd";
    if (row.getCell("quarterGoalTarget").value !== "") {
      row.getCell("quarterGoalTarget").numFmt = "0%";
    }

    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle", wrapText: false };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  downloadWorkbookBuffer(buffer, filename);
}
