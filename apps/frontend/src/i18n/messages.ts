import { locale } from "@/composables/useLocale";

const messages = {
  nl: {
    "legend.title": "Neerslagintensiteit",
    "legend.light": "Licht",
    "legend.heavy": "Zwaar",
  },
  en: {
    "legend.title": "Rain intensity",
    "legend.light": "Light",
    "legend.heavy": "Heavy",
  },
} as const;

type MessageKey = keyof (typeof messages)["en"];

export function useI18n() {
  function t(key: MessageKey): string {
    return messages[locale.value][key];
  }
  return { t };
}
