import { ref, watch } from "vue";

const STORAGE_KEY = "buitje:show-lightning";

function readInitial(): boolean {
  // Default OFF, unlike smoothColorRamp's default-on - this is a secondary,
  // ToS-sensitive overlay from an unofficial source, so opt-in avoids
  // surprising every visitor.
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export const showLightning = ref(readInitial());

watch(showLightning, (value) => localStorage.setItem(STORAGE_KEY, String(value)));
