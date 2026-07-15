import { ref, watch } from "vue";

export type Locale = "nl" | "en";

const STORAGE_KEY = "buitje:locale";

function readInitial(): Locale {
  return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "nl";
}

export const locale = ref<Locale>(readInitial());

watch(locale, (value) => localStorage.setItem(STORAGE_KEY, value));
