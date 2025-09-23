
import { useTranslation } from "react-i18next";

export function DataDeletionPolicyPage() {
  const { t } = useTranslation();
  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold">{t("data_deletion_policy.title")}</h1>
      <p className="mt-4">{t("data_deletion_policy.description")}</p>
    </div>
  );
}
