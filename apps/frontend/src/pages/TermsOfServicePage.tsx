
import { useTranslation } from "react-i18next";

export function TermsOfServicePage() {
  const { t } = useTranslation();
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">{t("terms_of_service.title")}</h1>

      <div className="space-y-6 text-gray-700 dark:text-gray-300">
        <section>
          <h2 className="text-xl font-semibold mb-3">{t("terms_of_service.sections.acceptance.title")}</h2>
          <p>
            {t("terms_of_service.sections.acceptance.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("terms_of_service.sections.service_description.title")}</h2>
          <p>
            {t("terms_of_service.sections.service_description.content")}
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>{t("terms_of_service.sections.service_description.features.ai_content")}</li>
            <li>{t("terms_of_service.sections.service_description.features.scheduling")}</li>
            <li>{t("terms_of_service.sections.service_description.features.email_workflow")}</li>
            <li>{t("terms_of_service.sections.service_description.features.multi_platform")}</li>
            <li>{t("terms_of_service.sections.service_description.features.comment_analysis")}</li>
            <li>{t("terms_of_service.sections.service_description.features.trend_analysis")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("terms_of_service.sections.user_responsibilities.title")}</h2>
          <p>
            {t("terms_of_service.sections.user_responsibilities.content")}
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>{t("terms_of_service.sections.user_responsibilities.items.law_compliance")}</li>
            <li>{t("terms_of_service.sections.user_responsibilities.items.security")}</li>
            <li>{t("terms_of_service.sections.user_responsibilities.items.content_review")}</li>
            <li>{t("terms_of_service.sections.user_responsibilities.items.ip_respect")}</li>
            <li>{t("terms_of_service.sections.user_responsibilities.items.legal_compliance")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("terms_of_service.sections.ai_content.title")}</h2>
          <p>
            {t("terms_of_service.sections.ai_content.content")}
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>{t("terms_of_service.sections.ai_content.items.editorial_control")}</li>
            <li>{t("terms_of_service.sections.ai_content.items.inaccuracies")}</li>
            <li>{t("terms_of_service.sections.ai_content.items.review_required")}</li>
            <li>{t("terms_of_service.sections.ai_content.items.liability")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("terms_of_service.sections.data_privacy.title")}</h2>
          <p>
            {t("terms_of_service.sections.data_privacy.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("terms_of_service.sections.intellectual_property.title")}</h2>
          <p>
            {t("terms_of_service.sections.intellectual_property.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("terms_of_service.sections.service_availability.title")}</h2>
          <p>
            {t("terms_of_service.sections.service_availability.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("terms_of_service.sections.liability.title")}</h2>
          <p>
            {t("terms_of_service.sections.liability.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("terms_of_service.sections.terms_changes.title")}</h2>
          <p>
            {t("terms_of_service.sections.terms_changes.content")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("terms_of_service.sections.contact.title")}</h2>
          <p>
            {t("terms_of_service.sections.contact.content")}
          </p>
        </section>

        <section className="text-sm text-gray-500 pt-4 border-t">
          <p>{t("terms_of_service.last_updated")} {new Date().toLocaleDateString()}</p>
        </section>
      </div>
    </div>
  );
}
