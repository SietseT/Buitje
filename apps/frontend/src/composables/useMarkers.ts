import { ref, watch } from "vue";

export interface Marker {
  id: string;
  lng: number;
  lat: number;
  label: string;
}

const STORAGE_KEY = "buitje:markers";

function readInitial(): Marker[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const markers = ref<Marker[]>(readInitial());

watch(
  markers,
  (value) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)),
  { deep: true },
);

export function useMarkers() {
  function addMarker(lng: number, lat: number, label: string): string {
    const id = crypto.randomUUID();
    markers.value.push({ id, lng, lat, label });
    return id;
  }

  function renameMarker(id: string, label: string) {
    const marker = markers.value.find((m) => m.id === id);
    if (marker) marker.label = label;
  }

  function removeMarker(id: string) {
    markers.value = markers.value.filter((m) => m.id !== id);
  }

  return { markers, addMarker, renameMarker, removeMarker };
}
