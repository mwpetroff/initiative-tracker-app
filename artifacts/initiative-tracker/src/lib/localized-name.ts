export function localizedName(
  entity: { name: string; nameJa?: string | null } | null | undefined,
  language: string,
): string | undefined {
  if (!entity) return undefined;
  if (language.startsWith("ja") && entity.nameJa) {
    return entity.nameJa;
  }
  return entity.name;
}

export function localizedLabel(
  label: string,
  labelJa: string | null | undefined,
  language: string,
): string {
  if (language.startsWith("ja") && labelJa) {
    return labelJa;
  }
  return label;
}

export function compareLocalized(a: string, b: string, language: string): number {
  return a.localeCompare(b, language.startsWith("ja") ? "ja" : language);
}

export function sortByLocalizedName<T extends { name: string; nameJa?: string | null }>(
  items: readonly T[] | null | undefined,
  language: string,
): T[] {
  return [...(items ?? [])].sort((a, b) =>
    compareLocalized(
      localizedName(a, language) ?? a.name,
      localizedName(b, language) ?? b.name,
      language,
    ),
  );
}
