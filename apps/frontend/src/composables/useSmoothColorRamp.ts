import { ref, watch } from "vue";

const STORAGE_KEY = "buitje:smooth-color-ramp";

function readInitial(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== "false";
}

export const smoothColorRamp = ref(readInitial());

watch(smoothColorRamp, (value) => localStorage.setItem(STORAGE_KEY, String(value)));
