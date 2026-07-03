function getPgErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const direct = (err as { code?: string }).code;
  if (direct) return direct;
  const cause = (err as { cause?: { code?: string } }).cause;
  if (cause && typeof cause === "object" && "code" in cause) {
    return (cause as { code?: string }).code;
  }
  return undefined;
}

export function isUniqueViolation(err: unknown): boolean {
  return getPgErrorCode(err) === "23505";
}

export function isForeignKeyViolation(err: unknown): boolean {
  return getPgErrorCode(err) === "23503";
}
