import { ref } from "vue";

export type Locale = "nl" | "en";

/**
 * Follows the browser instead of an in-app switch. There is deliberately no
 * setter and nothing in localStorage: a language picker was two taps deep in
 * a menu to change something the browser already knows.
 *
 * Trade-off, recorded on purpose: someone running an English-language browser
 * in the Netherlands can no longer force Dutch. If that ever needs undoing,
 * this is the only place to change - useI18n() reads it as a plain ref, so a
 * writable one would restore the old behaviour without touching callers.
 */
function fromBrowser(): Locale {
  return navigator.language.toLowerCase().startsWith("nl") ? "nl" : "en";
}

export const locale = ref<Locale>(fromBrowser());
