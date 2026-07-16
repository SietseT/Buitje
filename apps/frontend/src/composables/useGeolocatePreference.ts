import { ref, watch } from "vue";

const STORAGE_KEY = "buitje:geolocate-granted";

function readInitial(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export const geolocateGranted = ref(readInitial());

watch(geolocateGranted, (value) => localStorage.setItem(STORAGE_KEY, String(value)));
