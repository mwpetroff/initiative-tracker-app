import type { Department } from "@workspace/api-client-react";
import { localizedName } from "@/lib/localized-name";

export interface DepartmentGroup {
  department: Department;
  children: Department[];
}

export function buildDepartmentGroups(
  departments: Department[] | undefined,
  language: string,
): DepartmentGroup[] {
  if (!departments) return [];
  const collator = new Intl.Collator(language.startsWith("ja") ? "ja" : "en");
  const byName = (a: Department, b: Department) =>
    collator.compare(localizedName(a, language) ?? a.name, localizedName(b, language) ?? b.name);

  const topLevel = departments.filter((d) => d.parentId == null).sort(byName);
  const childrenOf = new Map<number, Department[]>();
  for (const dept of departments) {
    if (dept.parentId != null) {
      const list = childrenOf.get(dept.parentId) ?? [];
      list.push(dept);
      childrenOf.set(dept.parentId, list);
    }
  }
  for (const list of childrenOf.values()) list.sort(byName);

  return topLevel.map((department) => ({
    department,
    children: childrenOf.get(department.id) ?? [],
  }));
}

export function departmentDisplayName(
  department: Department,
  departments: Department[] | undefined,
  language: string,
): string {
  const own = localizedName(department, language) ?? department.name;
  if (department.parentId == null || !departments) return own;
  const parent = departments.find((d) => d.id === department.parentId);
  if (!parent) return own;
  return `${localizedName(parent, language) ?? parent.name} – ${own}`;
}
