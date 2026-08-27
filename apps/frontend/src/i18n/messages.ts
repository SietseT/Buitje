import { locale } from "@/composables/useLocale";

const messages = {
  nl: {
    "legend.light": "Licht",
    "legend.heavy": "Zwaar",
    "colorRamp.label": "Vloeiende beelden",
    "lightning.label": "Bliksem",
    "theme.light": "Lichte weergave",
    "theme.dark": "Donkere weergave",
    "github.link": "Bekijk op GitHub",
    "map.locate": "Mijn locatie",
    "timeline.play": "Afspelen",
    "timeline.pause": "Pauzeren",
    "timeline.latest": "nu",
    "timeline.minutesAgo": "{n} min. geleden",
    "location.deniedHint": "Kon je locatie niet ophalen.",
    "connection.lost": "Kan de server niet bereiken — opnieuw proberen…",
    "error.fatal": "Er is iets misgegaan.",
    "error.reload": "Herladen",
  },
  en: {
    "legend.light": "Light",
    "legend.heavy": "Heavy",
    "colorRamp.label": "Radar smoothing",
    "lightning.label": "Lightning",
    "theme.light": "Light appearance",
    "theme.dark": "Dark appearance",
    "github.link": "View on GitHub",
    "map.locate": "My location",
    "timeline.play": "Play",
    "timeline.pause": "Pause",
    "timeline.latest": "now",
    "timeline.minutesAgo": "{n} min. ago",
    "location.deniedHint": "Couldn't get your location.",
    "connection.lost": "Can't reach the server — retrying…",
    "error.fatal": "Something went wrong.",
    "error.reload": "Reload",
  },
} as const;

type MessageKey = keyof (typeof messages)["en"];

export function useI18n() {
  function t(
    key: MessageKey,
    params?: Record<string, string | number>,
  ): string {
    const template = messages[locale.value][key];
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name) =>
      name in params ? String(params[name]) : match,
    );
  }
  return { t };
}
