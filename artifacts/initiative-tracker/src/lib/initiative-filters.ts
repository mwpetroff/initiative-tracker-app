import type { Initiative } from "@workspace/api-client-react";

export interface InitiativeQuarterLookup {
  (initiative: Initiative): string | null;
}

export interface FilterInitiativesOptions {
  statusFilter: string;
  quarterFilter: string;
  searchQuery: string;
  getQuarterKey: InitiativeQuarterLookup;
  departmentIds?: number[] | null;
  overdueOnly?: boolean;
}

export function filterInitiatives(
  initiatives: Initiative[],
  { statusFilter, quarterFilter, searchQuery, getQuarterKey, departmentIds, overdueOnly }: FilterInitiativesOptions,
): Initiative[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return initiatives.filter((initiative) => {
    if (statusFilter !== "all" && initiative.status !== statusFilter) return false;
    if (quarterFilter !== "all" && getQuarterKey(initiative) !== quarterFilter) return false;
    if (departmentIds && departmentIds.length > 0 && !departmentIds.includes(initiative.departmentId)) return false;
    if (overdueOnly && !isInitiativeOverdue(initiative)) return false;
    if (normalizedQuery) {
      const haystack = `${initiative.title} ${initiative.owner}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  });
}

export function isInitiativeOverdue(
  initiative: Pick<Initiative, "status" | "targetDate">,
  now: Date = new Date(),
): boolean {
  if (initiative.status === "completed") return false;
  const target = new Date(initiative.targetDate);
  if (Number.isNaN(target.getTime())) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return target < today;
}

export interface PaginationResult<T> {
  items: T[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
}

export function paginate<T>(items: T[], page: number, pageSize: number): PaginationResult<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    totalPages,
    currentPage,
    totalItems,
  };
}
