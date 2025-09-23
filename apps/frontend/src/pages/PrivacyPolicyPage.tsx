
import { useTranslation } from "react-i18next";

export function PrivacyPolicyPage() {
  const { t } = useTranslation();
  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold">{t("privacy_policy.title")}</h1>
      <p className="mt-4">{t("privacy_policy.description")}</p>
    </div>
  );
}
