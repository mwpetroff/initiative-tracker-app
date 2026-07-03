export interface FiscalQuarterInfo {
  quarterNumber: number;
  year: number;
  label: string;
  startDate: Date;
  endDate: Date;
}

export type QuarterLocale = "en" | "ja";

export function formatQuarterLabel(quarterNumber: number, year: number, locale: QuarterLocale = "en"): string {
  if (locale === "ja") {
    return `${year}年 第${quarterNumber}四半期`;
  }
  return `Q${quarterNumber} ${year}`;
}

export function getFiscalQuarter(
  anchor: Date,
  reference: Date = new Date(),
  locale: QuarterLocale = "en",
): FiscalQuarterInfo {
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
    label: formatQuarterLabel(quarterIndex + 1, startDate.getUTCFullYear(), locale),
    startDate,
    endDate,
  };
}

export function formatDateRange(start: Date, end: Date, locale: QuarterLocale = "en"): string {
  const intlLocale = locale === "ja" ? "ja-JP" : "en-US";
  const startStr = new Intl.DateTimeFormat(intlLocale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(start);
  const endStr = new Intl.DateTimeFormat(intlLocale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(end);
  return `${startStr} – ${endStr}`;
}
