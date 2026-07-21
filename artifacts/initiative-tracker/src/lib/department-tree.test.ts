import { describe, it, expect } from "vitest";
import type { Department } from "@workspace/api-client-react";
import { buildDepartmentGroups, departmentMemberIds } from "./department-tree";

const dept = (id: number, name: string, parentId: number | null = null): Department =>
  ({ id, name, nameJa: null, colorHex: "#000000", parentId }) as Department;

const departments: Department[] = [
  dept(1, "Delivery"),
  dept(2, "AI", 1),
  dept(3, "Modern Work", 1),
  dept(10, "BTO"),
  dept(11, "Managed Services", 10),
];

describe("departmentMemberIds", () => {
  it("returns parent plus direct children for a top-level department", () => {
    expect(departmentMemberIds(1, departments).sort()).toEqual([1, 2, 3]);
  });

  it("returns only the department itself for a leaf subdepartment", () => {
    expect(departmentMemberIds(2, departments)).toEqual([2]);
  });

  it("does not leak members across unrelated groups", () => {
    const ids = departmentMemberIds(10, departments);
    expect(ids).toEqual([10, 11]);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(2);
  });

  it("falls back to the id alone when departments are not loaded", () => {
    expect(departmentMemberIds(5, undefined)).toEqual([5]);
  });
});

describe("buildDepartmentGroups", () => {
  it("groups children under their parent and sorts top-level groups", () => {
    const groups = buildDepartmentGroups(departments, "en");
    expect(groups.map((g) => g.department.name)).toEqual(["BTO", "Delivery"]);
    const delivery = groups.find((g) => g.department.id === 1);
    expect(delivery?.children.map((c) => c.name)).toEqual(["AI", "Modern Work"]);
  });

  it("returns an empty list when departments are undefined", () => {
    expect(buildDepartmentGroups(undefined, "en")).toEqual([]);
  });
});
