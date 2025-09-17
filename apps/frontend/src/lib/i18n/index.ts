import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./resources/en.json";
import zh from "./resources/zh.json";
import ko from "./resources/ko.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
      ko: { translation: ko },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "zh", "ko"],
    interpolation: { escapeValue: false },
  });

export default i18n;
