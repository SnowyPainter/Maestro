
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <Select value={i18n.language} onValueChange={changeLanguage}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={t("languages.en")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">{t("languages.en")}</SelectItem>
        <SelectItem value="zh">{t("languages.zh")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
