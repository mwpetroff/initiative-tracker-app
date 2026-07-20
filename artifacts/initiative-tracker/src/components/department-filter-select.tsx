import { useTranslation } from "react-i18next";
import type { Department } from "@workspace/api-client-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildDepartmentGroups } from "@/lib/department-tree";
import { localizedName } from "@/lib/localized-name";

interface DepartmentFilterSelectProps {
  departments: Department[] | undefined;
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function DepartmentFilterSelect({
  departments,
  value,
  onValueChange,
  className,
}: DepartmentFilterSelectProps) {
  const { t, i18n } = useTranslation();

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className ?? "w-[220px]"}>
        <SelectValue placeholder={t("initiatives.filterByDepartment")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t("initiatives.allDepartments")}</SelectItem>
        {buildDepartmentGroups(departments, i18n.language).map((group) =>
          group.children.length > 0 ? (
            <SelectGroup key={group.department.id}>
              <SelectLabel>{localizedName(group.department, i18n.language)}</SelectLabel>
              <SelectItem value={String(group.department.id)}>
                {t("initiatives.allOfGroup", {
                  name: localizedName(group.department, i18n.language),
                })}
              </SelectItem>
              {group.children.map((child) => (
                <SelectItem key={child.id} value={String(child.id)} className="pl-8">
                  {localizedName(child, i18n.language)}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : (
            <SelectItem key={group.department.id} value={String(group.department.id)}>
              {localizedName(group.department, i18n.language)}
            </SelectItem>
          ),
        )}
      </SelectContent>
    </Select>
  );
}
