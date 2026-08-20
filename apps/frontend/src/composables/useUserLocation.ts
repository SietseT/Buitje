import { ref } from "vue";

/**
 * Module-level refs rather than props, shared between RadarMap (which owns
 * MapLibre's GeolocateControl and drives these) and MapControls/App.vue
 * (which read them for the spinner and the denied-permission banner).
 */

/** True between pressing the locate button and a fix or an error arriving. */
export const locating = ref(false);

/**
 * Set when a fix fails for any reason, not just an outright denial - a
 * timeout and a refusal both mean the same thing to the user. GeolocateControl
 * is given an explicit 10s timeout in RadarMap, so this can't hang
 * indefinitely.
 */
export const locationFailed = ref(false);

// RadarMap registers MapLibre's trigger here so MapControls' button can start
// a fix without needing a reference to the map or the control.
let trigger: (() => boolean) | null = null;

export function registerLocateTrigger(fn: (() => boolean) | null): void {
  trigger = fn;
}

export function requestLocate(): void {
  if (!trigger) return;
  locationFailed.value = false;
  locating.value = true;
  // GeolocateControl.trigger() returns false when the control never set
  // itself up - which is what happens where the Geolocation API is
  // unavailable, notably on a non-secure origin (a phone hitting the dev
  // server over the LAN on plain HTTP). No error event is emitted in that
  // case, so without this the spinner would spin forever.
  if (!trigger()) {
    locating.value = false;
    locationFailed.value = true;
  }
}
