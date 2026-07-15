import { locale } from "@/composables/useLocale";

const messages = {
  nl: {
    "legend.title": "Neerslagintensiteit",
    "legend.light": "Licht",
    "legend.heavy": "Zwaar",
    "markers.panelTitle": "Markeringen",
    "markers.add": "Markering toevoegen",
    "markers.empty": "Nog geen markeringen",
    "markers.delete": "Verwijderen",
    "markers.namePlaceholder": "Naam",
    "markers.defaultLabel": "Markering {n}",
    "markers.placingHint": "Tik op de kaart om een markering te plaatsen",
    "markers.placingCancel": "Annuleren",
    "location.deniedHint":
      "Kon je locatie niet ophalen — geen probleem, voeg gewoon een markering handmatig toe.",
  },
  en: {
    "legend.title": "Rain intensity",
    "legend.light": "Light",
    "legend.heavy": "Heavy",
    "markers.panelTitle": "Markers",
    "markers.add": "Add marker",
    "markers.empty": "No markers yet",
    "markers.delete": "Delete",
    "markers.namePlaceholder": "Name",
    "markers.defaultLabel": "Marker {n}",
    "markers.placingHint": "Tap the map to place a marker",
    "markers.placingCancel": "Cancel",
    "location.deniedHint":
      "Couldn't get your location — that's all good, just add a marker manually instead.",
  },
} as const;

type MessageKey = keyof (typeof messages)["en"];

export function useI18n() {
  function t(key: MessageKey, params?: Record<string, string | number>): string {
    const template = messages[locale.value][key];
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name) =>
      name in params ? String(params[name]) : match,
    );
  }
  return { t };
}
