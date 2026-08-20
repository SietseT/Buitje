import { computed, ref, watch } from "vue";
import { useMarkers, type Marker } from "@/composables/useMarkers";
import { userLocation } from "@/composables/useUserLocation";

export interface Place {
  id: string;
  label: string;
  lat: number;
  lng: number;
  /** The browser-reported position rather than a saved marker. */
  isLocation: boolean;
}

/** Reserved id for the location pseudo-place; never a real marker id (UUIDs). */
export const LOCATION_PLACE_ID = "location";

const STORAGE_KEY = "buitje:selected-place";

const selectedId = ref<string | null>(localStorage.getItem(STORAGE_KEY));

watch(selectedId, (value) => {
  if (value) localStorage.setItem(STORAGE_KEY, value);
  else localStorage.removeItem(STORAGE_KEY);
});

function toPlace(marker: Marker): Place {
  return { id: marker.id, label: marker.label, lat: marker.lat, lng: marker.lng, isLocation: false };
}

/**
 * The panel's subject list: the user's own position (when a fix has come in)
 * followed by their saved markers. The location entry is deliberately not
 * persisted as a marker - it moves, and it disappears again if permission is
 * revoked.
 */
export function usePlaces(locationLabel: () => string) {
  const { markers } = useMarkers();

  const places = computed<Place[]>(() => {
    const list = markers.value.map(toPlace);
    if (userLocation.value) {
      list.unshift({
        id: LOCATION_PLACE_ID,
        label: locationLabel(),
        lat: userLocation.value.lat,
        lng: userLocation.value.lng,
        isLocation: true,
      });
    }
    return list;
  });

  // Falls back to the first available place rather than showing an empty
  // panel when the stored selection is gone - a marker can be deleted, and
  // the location entry vanishes when permission is withdrawn.
  const selectedPlace = computed<Place | null>(() => {
    if (places.value.length === 0) return null;
    return places.value.find((p) => p.id === selectedId.value) ?? places.value[0];
  });

  function select(id: string): void {
    selectedId.value = id;
  }

  return { places, selectedPlace, selectedId, select };
}
