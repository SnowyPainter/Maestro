
import { useTranslation } from "react-i18next";

export function TermsOfServicePage() {
  const { t } = useTranslation();
  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold">{t("terms_of_service.title")}</h1>
      <p className="mt-4">{t("terms_of_service.description")}</p>
    </div>
  );
}
