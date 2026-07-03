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
