export interface FiscalQuarterInfo {
  quarterNumber: number;
  year: number;
  label: string;
  startDate: Date;
  endDate: Date;
}

export function getFiscalQuarter(anchor: Date, reference: Date = new Date()): FiscalQuarterInfo {
  const anchorMonth = anchor.getUTCMonth();
  const anchorDay = anchor.getUTCDate();

  let candidateYear = reference.getUTCFullYear();
  let candidate = new Date(Date.UTC(candidateYear, anchorMonth, anchorDay));
  if (candidate > reference) {
    candidateYear -= 1;
    candidate = new Date(Date.UTC(candidateYear, anchorMonth, anchorDay));
  }

  const monthsDiff =
    (reference.getUTCFullYear() - candidate.getUTCFullYear()) * 12 +
    (reference.getUTCMonth() - candidate.getUTCMonth());
  const quarterIndex = Math.floor(monthsDiff / 3) % 4;

  const quarterStartMonth = candidate.getUTCMonth() + quarterIndex * 3;
  const startDate = new Date(Date.UTC(candidate.getUTCFullYear(), quarterStartMonth, anchorDay));
  const endDate = new Date(Date.UTC(candidate.getUTCFullYear(), quarterStartMonth + 3, anchorDay));
  endDate.setUTCDate(endDate.getUTCDate() - 1);

  return {
    quarterNumber: quarterIndex + 1,
    year: startDate.getUTCFullYear(),
    label: `Q${quarterIndex + 1} ${startDate.getUTCFullYear()}`,
    startDate,
    endDate,
  };
}

export function formatDateRange(start: Date, end: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const startStr = formatter.format(start);
  const endStr = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(end);
  return `${startStr} – ${endStr}`;
}
