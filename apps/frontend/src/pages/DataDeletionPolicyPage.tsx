
import { useTranslation } from "react-i18next";

export function DataDeletionPolicyPage() {
  const { t } = useTranslation();
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">{t("data_deletion_policy.title")}</h1>

      <div className="space-y-6 text-gray-700 dark:text-gray-300">
        <section>
          <h2 className="text-xl font-semibold mb-3">{t("data_deletion_policy.sections.deletion_right.title")}</h2>
          <p>
            {t("data_deletion_policy.sections.deletion_right.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("data_deletion_policy.sections.deletable_information.title")}</h2>
          <p>{t("data_deletion_policy.sections.deletable_information.content")}</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>{t("data_deletion_policy.sections.deletable_information.items.account_info")}</li>
            <li>{t("data_deletion_policy.sections.deletable_information.items.created_content")}</li>
            <li>{t("data_deletion_policy.sections.deletable_information.items.usage_history")}</li>
            <li>{t("data_deletion_policy.sections.deletable_information.items.communications")}</li>
            <li>{t("data_deletion_policy.sections.deletable_information.items.preferences")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("data_deletion_policy.sections.deletion_exceptions.title")}</h2>
          <p>{t("data_deletion_policy.sections.deletion_exceptions.content")}</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>{t("data_deletion_policy.sections.deletion_exceptions.items.legal_compliance")}</li>
            <li>{t("data_deletion_policy.sections.deletion_exceptions.items.transaction_completion")}</li>
            <li>{t("data_deletion_policy.sections.deletion_exceptions.items.security_incidents")}</li>
            <li>{t("data_deletion_policy.sections.deletion_exceptions.items.legal_claims")}</li>
            <li>{t("data_deletion_policy.sections.deletion_exceptions.items.anonymized_data")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("data_deletion_policy.sections.request_methods.title")}</h2>
          <p className="mb-3">{t("data_deletion_policy.sections.request_methods.content")}</p>

          <h3 className="text-lg font-medium mb-2">{t("data_deletion_policy.sections.request_methods.methods.account_settings.title")}</h3>
          <ol className="list-decimal pl-6 space-y-1">
            <li>{t("data_deletion_policy.sections.request_methods.methods.account_settings.steps.login")}</li>
            <li>{t("data_deletion_policy.sections.request_methods.methods.account_settings.steps.navigate")}</li>
            <li>{t("data_deletion_policy.sections.request_methods.methods.account_settings.steps.select")}</li>
            <li>{t("data_deletion_policy.sections.request_methods.methods.account_settings.steps.confirm")}</li>
          </ol>

          <h3 className="text-lg font-medium mb-2 mt-4">{t("data_deletion_policy.sections.request_methods.methods.support_email.title")}</h3>
          <p>
            {t("data_deletion_policy.sections.request_methods.methods.support_email.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("data_deletion_policy.sections.verification.title")}</h2>
          <p>
            {t("data_deletion_policy.sections.verification.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("data_deletion_policy.sections.processing_time.title")}</h2>
          <p>
            {t("data_deletion_policy.sections.processing_time.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("data_deletion_policy.sections.ai_training_data.title")}</h2>
          <p>
            {t("data_deletion_policy.sections.ai_training_data.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("data_deletion_policy.sections.third_party_services.title")}</h2>
          <p>
            {t("data_deletion_policy.sections.third_party_services.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("data_deletion_policy.sections.backup_recovery.title")}</h2>
          <p>
            {t("data_deletion_policy.sections.backup_recovery.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("data_deletion_policy.sections.account_vs_data.title")}</h2>
          <p>
            {t("data_deletion_policy.sections.account_vs_data.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("data_deletion_policy.sections.deletion_reversal.title")}</h2>
          <p>
            {t("data_deletion_policy.sections.deletion_reversal.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("data_deletion_policy.sections.policy_changes.title")}</h2>
          <p>
            {t("data_deletion_policy.sections.policy_changes.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("data_deletion_policy.sections.contact.title")}</h2>
          <p>
            {t("data_deletion_policy.sections.contact.content")}
          </p>
        </section>

        <section className="text-sm text-gray-500 pt-4 border-t">
          <p>{t("data_deletion_policy.last_updated")} {new Date().toLocaleDateString()}</p>
        </section>
      </div>
    </div>
  );
}
