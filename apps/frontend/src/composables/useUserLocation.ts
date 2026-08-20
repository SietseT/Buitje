import { ref } from "vue";

/**
 * The browser-reported position, shared between RadarMap (which owns
 * MapLibre's GeolocateControl, and so owns the permission prompt and the
 * location dot) and the place panel, which offers it as a selectable place
 * and needs to show locating/denied feedback.
 *
 * Module-level refs rather than props, matching how the other cross-cutting
 * state here works (locale, showLightning, smoothColorRamp).
 */
export const userLocation = ref<{ lat: number; lng: number } | null>(null);

/** True between pressing "use my location" and a fix or an error arriving. */
export const locating = ref(false);

/**
 * Set when a fix fails for any reason, not just an outright denial - from the
 * panel's point of view a timeout and a refusal need the same fallback ("pick
 * a spot on the map instead"). GeolocateControl is given an explicit 10s
 * timeout in RadarMap, so this can't hang indefinitely.
 */
export const locationFailed = ref(false);

// RadarMap registers MapLibre's trigger here so the panel's button can start
// a fix without the panel needing a reference to the map or the control.
let trigger: (() => void) | null = null;

export function registerLocateTrigger(fn: (() => void) | null): void {
  trigger = fn;
}

export function requestLocate(): void {
  if (!trigger) return;
  locationFailed.value = false;
  locating.value = true;
  trigger();
}
