
import { useTranslation } from "react-i18next";

export function PrivacyPolicyPage() {
  const { t } = useTranslation();
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">{t("privacy_policy.title")}</h1>

      <div className="space-y-6 text-gray-700 dark:text-gray-300">
        <section>
          <h2 className="text-xl font-semibold mb-3">{t("privacy_policy.sections.information_collection.title")}</h2>
          <p className="mb-3">
            {t("privacy_policy.sections.information_collection.content")}
          </p>

          <h3 className="text-lg font-medium mb-2">{t("privacy_policy.sections.information_collection.subsections.user_provided.title")}</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>{t("privacy_policy.sections.information_collection.subsections.user_provided.items.account_info")}</li>
            <li>{t("privacy_policy.sections.information_collection.subsections.user_provided.items.profile_info")}</li>
            <li>{t("privacy_policy.sections.information_collection.subsections.user_provided.items.content_created")}</li>
            <li>{t("privacy_policy.sections.information_collection.subsections.user_provided.items.communications")}</li>
          </ul>

          <h3 className="text-lg font-medium mb-2 mt-4">{t("privacy_policy.sections.information_collection.subsections.automatic.title")}</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>{t("privacy_policy.sections.information_collection.subsections.automatic.items.usage_data")}</li>
            <li>{t("privacy_policy.sections.information_collection.subsections.automatic.items.device_info")}</li>
            <li>{t("privacy_policy.sections.information_collection.subsections.automatic.items.log_data")}</li>
            <li>{t("privacy_policy.sections.information_collection.subsections.automatic.items.cookies")}</li>
          </ul>

          <h3 className="text-lg font-medium mb-2 mt-4">{t("privacy_policy.sections.information_collection.subsections.third_party.title")}</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>{t("privacy_policy.sections.information_collection.subsections.third_party.items.social_media")}</li>
            <li>{t("privacy_policy.sections.information_collection.subsections.third_party.items.analytics")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("privacy_policy.sections.information_usage.title")}</h2>
          <p>{t("privacy_policy.sections.information_usage.content")}</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>{t("privacy_policy.sections.information_usage.items.service_provision")}</li>
            <li>{t("privacy_policy.sections.information_usage.items.content_processing")}</li>
            <li>{t("privacy_policy.sections.information_usage.items.ai_generation")}</li>
            <li>{t("privacy_policy.sections.information_usage.items.account_management")}</li>
            <li>{t("privacy_policy.sections.information_usage.items.communication")}</li>
            <li>{t("privacy_policy.sections.information_usage.items.usage_analysis")}</li>
            <li>{t("privacy_policy.sections.information_usage.items.security")}</li>
            <li>{t("privacy_policy.sections.information_usage.items.legal_compliance")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("privacy_policy.sections.ai_machine_learning.title")}</h2>
          <p className="mb-3">
            {t("privacy_policy.sections.ai_machine_learning.content")}
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>{t("privacy_policy.sections.ai_machine_learning.items.model_training")}</li>
            <li>{t("privacy_policy.sections.ai_machine_learning.items.usage_analysis")}</li>
            <li>{t("privacy_policy.sections.ai_machine_learning.items.aggregated_data")}</li>
            <li>{t("privacy_policy.sections.ai_machine_learning.items.safeguards")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("privacy_policy.sections.information_sharing.title")}</h2>
          <p className="mb-3">{t("privacy_policy.sections.information_sharing.content")}</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>{t("privacy_policy.sections.information_sharing.items.with_consent")}</li>
            <li>{t("privacy_policy.sections.information_sharing.items.service_providers")}</li>
            <li>{t("privacy_policy.sections.information_sharing.items.legal_requirements")}</li>
            <li>{t("privacy_policy.sections.information_sharing.items.business_transfer")}</li>
            <li>{t("privacy_policy.sections.information_sharing.items.safety_security")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("privacy_policy.sections.data_security.title")}</h2>
          <p>
            {t("privacy_policy.sections.data_security.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("privacy_policy.sections.data_retention.title")}</h2>
          <p>
            {t("privacy_policy.sections.data_retention.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("privacy_policy.sections.user_rights.title")}</h2>
          <p>{t("privacy_policy.sections.user_rights.content")}</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>{t("privacy_policy.sections.user_rights.items.access")}</li>
            <li>{t("privacy_policy.sections.user_rights.items.correction")}</li>
            <li>{t("privacy_policy.sections.user_rights.items.deletion")}</li>
            <li>{t("privacy_policy.sections.user_rights.items.restriction")}</li>
            <li>{t("privacy_policy.sections.user_rights.items.portability")}</li>
            <li>{t("privacy_policy.sections.user_rights.items.objection")}</li>
            <li>{t("privacy_policy.sections.user_rights.items.consent_withdrawal")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("privacy_policy.sections.cookies.title")}</h2>
          <p>
            {t("privacy_policy.sections.cookies.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("privacy_policy.sections.third_party_services.title")}</h2>
          <p>
            {t("privacy_policy.sections.third_party_services.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("privacy_policy.sections.policy_changes.title")}</h2>
          <p>
            {t("privacy_policy.sections.policy_changes.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("privacy_policy.sections.contact.title")}</h2>
          <p>
            {t("privacy_policy.sections.contact.content")}
          </p>
        </section>

        <section className="text-sm text-gray-500 pt-4 border-t">
          <p>{t("privacy_policy.last_updated")} {new Date().toLocaleDateString()}</p>
        </section>
      </div>
    </div>
  );
}
