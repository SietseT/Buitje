<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { PLAYBACK_SPEEDS, BASE_PLAYBACK_INTERVAL_MS } from "@/composables/useRadarFrames";
import type { RadarBounds, RadarFrame } from "@/composables/useRadarFrames";
import { geolocateGranted } from "@/composables/useGeolocatePreference";
import { smoothColorRamp } from "@/composables/useSmoothColorRamp";
import { showLightning } from "@/composables/useLightningToggle";
import { theme } from "@/composables/useTheme";
import { githubUrl } from "@/composables/useGithubLink";
import { locating, locationFailed, registerLocateTrigger, requestLocate } from "@/composables/useUserLocation";
import { useI18n } from "@/i18n/messages";
import MapControls from "@/components/MapControls.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";

const { t } = useI18n();

const props = defineProps<{
  frame: RadarFrame | undefined;
  bounds: RadarBounds | null;
}>();

const mapContainer = ref<HTMLDivElement | null>(null);
const map = shallowRef<maplibregl.Map | null>(null);
let resizeObserver: ResizeObserver | null = null;

const RADAR_SOURCE_ID = "radar-frame";
const RADAR_LAYER_ID = "radar-frame-layer";
const LIGHTNING_SOURCE_ID = "lightning-strikes";
const LIGHTNING_LAYER_ID = "lightning-strikes-layer";

// Netherlands' own bounding box (roughly 3.2-7.35°E, 50.72-53.68°N),
// independent of the async /api/frames/bounds fetch (which resolves after
// mount and covers a wider area - NL plus a sliver of BE/DE). Passed as the
// initial `bounds` constructor option so MapLibre computes the zoom that
// fits it to the container's actual size - this naturally zooms out further
// on narrow mobile viewports instead of cropping the country, without
// needing any JS viewport-width check.
const NETHERLANDS_BOUNDS: maplibregl.LngLatBoundsLike = [
  [3.2, 50.72],
  [7.35, 53.68],
];

// OpenFreeMap's styles prefer the English name ("name_en") over the local
// OSM "name" for every label layer, whenever one exists. We always want
// local (Dutch) place names on the map, so rewrite that expression on every
// symbol layer's text-field rather than hardcoding layer ids.
//
// Positron buries it deeper than Liberty did - the whole text-field is
// `["case", ["has","name:nonlatin"], ..., ["coalesce", ["get","name_en"],
// ["get","name"]]]` - which is exactly why this recurses through the
// expression tree instead of pattern-matching a known top-level shape.
function withLocalNames(expr: unknown): unknown {
  if (Array.isArray(expr)) {
    if (expr[0] === "get" && expr[1] === "name_en") return ["get", "name"];
    return expr.map(withLocalNames);
  }
  return expr;
}

function applyLocalLabelLanguage() {
  const m = map.value;
  if (!m) return;
  for (const layer of m.getStyle().layers) {
    if (layer.type === "symbol" && layer.layout && "text-field" in layer.layout) {
      m.setLayoutProperty(layer.id, "text-field", withLocalNames(layer.layout["text-field"]));
    }
  }
}

// OpenFreeMap's "dark" style draws country borders (admin_level 2) at
// hsl(0,0%,23%) against a background of rgb(12,12,12) - practically
// invisible, unlike "positron" which draws them at hsl(0,0%,70%) against a
// near-white background. Width/opacity/blur are otherwise comparable to the
// light style at the same zoom, so only the color needs boosting. Provincial
// borders (admin_level 4, "boundary_state") are left as the style drew them -
// this is specifically about the country outline going missing.
const DARK_COUNTRY_BORDER_LAYER_IDS = ["boundary_country_z0-4", "boundary_country_z5-"];

function boostDarkCountryBorders() {
  const m = map.value;
  if (!m || theme.value !== "dark") return;
  for (const id of DARK_COUNTRY_BORDER_LAYER_IDS) {
    if (m.getLayer(id)) m.setPaintProperty(id, "line-color", "hsl(0, 0%, 55%)");
  }
}

// OpenFreeMap "Positron" style: a minimal, low-contrast vector basemap that
// stays out of the way of the radar overlay, unlike raw OSM Mapnik tiles.
// Chosen over Liberty for its plainer look, which lets the precipitation
// colours carry the map; it is also a lot lighter (55 layers / 19 symbol
// layers vs Liberty's ~150 / ~50), and MapLibre repaints every layer on each
// radar frame swap. Genuinely free, no API key/account/rate limit (unlike
// CARTO's basemap CDN, which per their own docs requires being a registered
// "grantee" for free use).
//
// "dark" is OpenFreeMap's own Positron counterpart (47 layers, background
// rgb(12,12,12)) - staying inside OpenFreeMap rather than reaching for
// another provider, whose terms would need re-checking (see CLAUDE.md).
function styleUrlFor(value: "light" | "dark"): string {
  return `https://tiles.openfreemap.org/styles/${value === "dark" ? "dark" : "positron"}`;
}

function coordinatesFromBounds(bounds: RadarBounds): [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] {
  return [
    [bounds.west, bounds.north],
    [bounds.east, bounds.north],
    [bounds.east, bounds.south],
    [bounds.west, bounds.south],
  ];
}

// The radar overlay only covers the KNMI composite grid (NL + a sliver of
// BE/DE) - unrestricted, a user can pan/zoom the basemap out to see the
// whole world or scroll over to Spain, where there's no radar data and the
// map stops making sense. Pad the radar's own bounds a bit so panning stops
// just beyond the data edge rather than exactly at it.
function padBounds(bounds: RadarBounds, factor: number): maplibregl.LngLatBoundsLike {
  const lngPad = (bounds.east - bounds.west) * factor;
  const latPad = (bounds.north - bounds.south) * factor;
  return [
    bounds.west - lngPad,
    bounds.south - latPad,
    bounds.east + lngPad,
    bounds.north + latPad,
  ];
}

// updateImage() loads its image asynchronously. Scrubbing the timeline
// fast fires many overlapping updateOverlay() calls, and network/decode
// responses can resolve out of order - whichever finishes last (in wall
// clock time, not request order) would otherwise win, sometimes leaving
// the wrong frame shown once the user stops. Preload with a plain Image()
// first, guarded by a request id, so only the result of the most
// recently requested frame is ever applied.
let overlayRequestId = 0;

// The backend caches both a smooth and a hard-banded PNG per frame (see
// colorize.ts's `smooth` param) - which one to request is a per-user
// localStorage preference (useSmoothColorRamp), not something the backend
// can bake into frame.url itself. The query string also gives the two
// variants distinct cache keys, since /api/frames/<timestamp>.png is
// served with a 5-minute immutable Cache-Control.
function frameImageUrl(frame: RadarFrame): string {
  return `${frame.url}?smooth=${smoothColorRamp.value}`;
}

function applyOverlay(frame: RadarFrame, bounds: RadarBounds) {
  const m = map.value;
  if (!m) return;

  const coordinates = coordinatesFromBounds(bounds);
  const url = frameImageUrl(frame);
  const existing = m.getSource(RADAR_SOURCE_ID) as maplibregl.ImageSource | undefined;

  if (existing) {
    existing.updateImage({ url, coordinates });
    return;
  }

  m.addSource(RADAR_SOURCE_ID, {
    type: "image",
    url,
    coordinates,
  });
  m.addLayer(
    {
      id: RADAR_LAYER_ID,
      type: "raster",
      source: RADAR_SOURCE_ID,
      paint: { "raster-opacity": 0.85 },
    },
    // Lightning strikes must always render above precipitation. Layer order
    // otherwise depends on which of updateOverlay()/updateLightning() wins
    // the race after a style reload (setStyle re-adds both from scratch) -
    // whichever's addLayer() runs last ends up on top. Explicitly inserting
    // the radar layer below the lightning layer (when present) makes the
    // stacking deterministic regardless of that race.
    m.getLayer(LIGHTNING_LAYER_ID) ? LIGHTNING_LAYER_ID : undefined,
  );
}

function updateOverlay() {
  if (!map.value || !props.frame || !props.bounds) return;
  const frame = props.frame;
  const bounds = props.bounds;
  const requestId = ++overlayRequestId;

  const img = new Image();
  img.onload = () => {
    if (requestId === overlayRequestId) applyOverlay(frame, bounds);
  };
  img.src = frameImageUrl(frame);
}

interface LightningStrike {
  lat: number;
  lon: number;
  timeMs: number;
  polarity: number | null;
}

function strikesToGeoJSON(strikes: LightningStrike[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: strikes.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: {},
    })),
  };
}

function addLightningSource(data: GeoJSON.FeatureCollection<GeoJSON.Point>) {
  const m = map.value;
  if (!m) return;
  m.addSource(LIGHTNING_SOURCE_ID, {
    type: "geojson",
    data,
    // Mandatory per Blitzortung's terms - tying it to the source means it
    // only ever shows up in the AttributionControl while lightning data is
    // actually being displayed (source only exists while showLightning is
    // true, see removeLightningLayer()).
    attribution: "Lightning data by Blitzortung.org and contributors",
  });
  m.addLayer({
    id: LIGHTNING_LAYER_ID,
    type: "circle",
    source: LIGHTNING_SOURCE_ID,
    paint: {
      "circle-radius": 5,
      "circle-color": "#facc15",
      "circle-stroke-color": "#78350f",
      "circle-stroke-width": 1,
      "circle-opacity": 0.85,
    },
  });
}

function removeLightningLayer() {
  const m = map.value;
  if (!m) return;
  if (m.getLayer(LIGHTNING_LAYER_ID)) m.removeLayer(LIGHTNING_LAYER_ID);
  if (m.getSource(LIGHTNING_SOURCE_ID)) m.removeSource(LIGHTNING_SOURCE_ID);
}

// Lightning strikes are fetched per-frame (bucketed server-side into the
// same 5-minute window as the radar composite), not on an independent poll
// timer - this is what keeps the two layers moving together as the
// Timeline is scrubbed or played back. Guarded by its own request id
// (separate from overlayRequestId, since the radar PNG and lightning
// bucket are independent fetches that shouldn't gate each other).
let lightningRequestId = 0;

async function updateLightning() {
  if (!map.value) return;

  if (!showLightning.value || !props.frame) {
    removeLightningLayer();
    return;
  }

  const frame = props.frame;
  const requestId = ++lightningRequestId;
  try {
    const res = await fetch(`/api/lightning/${frame.timestamp}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const { strikes } = (await res.json()) as { strikes: LightningStrike[] };
    if (requestId !== lightningRequestId) return; // superseded by a newer request

    const m = map.value;
    if (!m) return;
    const data = strikesToGeoJSON(strikes);
    const existing = m.getSource(LIGHTNING_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      addLightningSource(data);
    }
  } catch {
    // Transient failure - left as a no-op; the next frame change or toggle
    // flip naturally retries, no dedicated reconnect loop needed here.
  }
}

onMounted(() => {
  if (!mapContainer.value) return;
  map.value = new maplibregl.Map({
    container: mapContainer.value,
    style: styleUrlFor(theme.value),
    bounds: NETHERLANDS_BOUNDS,
    // Nothing overlays the map's bottom edge any more (no bottom sheet), so
    // padding just needs to keep content off the very edge - a small
    // uniform value at every breakpoint. `top` is bumped a bit to clear the
    // app-identity pill in the template below.
    fitBoundsOptions: {
      padding: { top: 56, bottom: 48, left: 40, right: 40 },
    },
    // Rendered by MapControls.vue instead - see the rail in the template.
    attributionControl: false,
  });

  // Attribution goes top-left, alongside the app-identity pill (see
  // style.css for the margin that keeps them from overlapping).
  map.value.addControl(new maplibregl.AttributionControl({ compact: true }), "top-left");

  // Geolocation is opt-in and permission can be denied - GeolocateControl
  // already handles the browser permission prompt and draws the pulsing
  // location dot itself; we only need to surface denial/failure so the app
  // can show a banner instead of failing silently.
  const geolocateControl = new maplibregl.GeolocateControl({
    // Without an explicit timeout the Geolocation API defaults to Infinity,
    // so a stalled location fix would hang forever with no feedback.
    positionOptions: { enableHighAccuracy: false, timeout: 10000 },
    trackUserLocation: true,
    showUserLocation: true,
  });
  // GeolocateControl has no public option to show the location dot without
  // moving/zooming the camera to it - _updateCamera is the (undocumented,
  // underscore-prefixed) internal method that does the fitBounds/pan/zoom;
  // _updateMarker (which draws the dot + accuracy circle) is separate and
  // unaffected, so neutering this still shows the dot with zero camera
  // movement. This relies on MapLibre's internals and could break on a
  // future maplibre-gl upgrade - re-check this if the geolocate button stops
  // behaving after a version bump.
  geolocateControl._updateCamera = () => {};
  geolocateControl.on("geolocate", () => {
    geolocateGranted.value = true;
    locating.value = false;
    locationFailed.value = false;
  });
  geolocateControl.on("error", (error: GeolocationPositionError) => {
    // Only an explicit permission denial should un-remember a prior grant -
    // a transient POSITION_UNAVAILABLE/TIMEOUT (e.g. momentarily no GPS fix)
    // shouldn't force the user to re-click next time.
    if (error.code === error.PERMISSION_DENIED) {
      geolocateGranted.value = false;
    }
    // useUserLocation is the single place that reports this now; the app
    // shell reads locationFailed and shows a banner.
    locating.value = false;
    locationFailed.value = true;
  });
  map.value.addControl(geolocateControl, "top-right");
  // The rail's own button drives it; the control stays mounted for the
  // permission prompt and the location dot, and style.css hides its chrome.
  registerLocateTrigger(() => geolocateControl.trigger());

  // Fires on the initial load AND after every setStyle, which is exactly
  // what the radar and lightning layers need: setStyle({diff:false}) drops
  // every custom source and layer, so they have to be re-added each time.
  // applyLocalLabelLanguage and boostDarkCountryBorders have to re-run for
  // the same reason - each swap loads a fresh style with the original,
  // unpatched paint properties.
  map.value.on("style.load", () => {
    applyLocalLabelLanguage();
    boostDarkCountryBorders();
    updateOverlay();
    updateLightning();
  });

  map.value.on("load", () => {
    // Location was previously granted - re-trigger it automatically so the
    // user's location keeps showing across refreshes instead of requiring
    // them to click the geolocate button again every visit. The browser
    // won't re-prompt since permission is already granted.
    if (geolocateGranted.value) {
      requestLocate();
    }
  });

  // The container's size isn't always settled at construction time (e.g.
  // web fonts/Tailwind CSS still loading, mobile browser chrome collapsing
  // after first paint), which can leave the map stuck at a stale, wrong
  // canvas size. Keep it in sync with the container's actual size instead
  // of relying on a single measurement at mount.
  resizeObserver = new ResizeObserver(() => map.value?.resize());
  resizeObserver.observe(mapContainer.value);
});

onUnmounted(() => {
  clearTimeout(scrubDebounceTimer);
  resizeObserver?.disconnect();
  resizeObserver = null;
  registerLocateTrigger(null);
  map.value?.remove();
  map.value = null;
});

// diff:false is deliberate. MapLibre's default style diffing tries to carry
// state across, and what it preserves between two unrelated styles is not
// something to rely on; a clean reload means the style.load handler above is
// always the single place that re-adds the radar and lightning layers.
watch(theme, (value) => {
  map.value?.setStyle(styleUrlFor(value), { diff: false });
});

// Scrubbing the timeline can fire many rapid frame changes; overlayRequestId/
// lightningRequestId already discard stale *results*, but don't stop the
// requests themselves from firing - a fast drag would otherwise cost one
// radar PNG fetch and one lightning fetch per frame crossed. A short debounce
// collapses that into a single pair of requests once the user pauses.
let scrubDebounceTimer: ReturnType<typeof setTimeout> | undefined;
// Must stay below the shortest actual playback interval (fastest
// PLAYBACK_SPEEDS entry) - otherwise autoplay's own frame changes arrive
// faster than the debounce window, each one clearing the pending timer
// before it ever fires, and the radar image + lightning layer silently
// freeze while the timeline scrubber keeps advancing underneath (hit in
// practice when BASE_PLAYBACK_INTERVAL_MS was halved to 150ms - 2x playback
// then advanced every 75ms, under the old fixed 80ms debounce). Derived
// rather than hardcoded so the two constants can't drift out of sync again.
const FASTEST_PLAYBACK_INTERVAL_MS = BASE_PLAYBACK_INTERVAL_MS / Math.max(...PLAYBACK_SPEEDS);
const SCRUB_DEBOUNCE_MS = Math.min(80, FASTEST_PLAYBACK_INTERVAL_MS / 2);

watch([() => props.frame, () => props.bounds, smoothColorRamp, showLightning], () => {
  if (!map.value?.loaded()) return;
  clearTimeout(scrubDebounceTimer);
  scrubDebounceTimer = setTimeout(() => {
    updateOverlay();
    updateLightning();
  }, SCRUB_DEBOUNCE_MS);
});

// props.bounds is still null when the map is constructed in onMounted (the
// bounds fetch hasn't resolved yet), so this can't be passed as a
// constructor option - apply it as soon as it becomes available instead.
watch(
  () => props.bounds,
  (bounds) => {
    if (map.value && bounds) {
      map.value.setMaxBounds(padBounds(bounds, 0.175));
    }
  },
);
</script>

<template>
  <div class="relative h-full w-full">
    <div ref="mapContainer" class="h-full w-full" />

    <div class="absolute top-3 left-3 z-10 lg:top-4 lg:left-4">
      <div
        class="flex items-center gap-2.5 rounded-xl bg-white/90 px-3 py-2 shadow-lg backdrop-blur dark:bg-neutral-900/90"
      >
        <img src="/favicon.svg" alt="" class="size-5" />
        <span class="text-sm font-semibold tracking-tight">Buitje</span>
        <a
          v-if="githubUrl"
          :href="githubUrl"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t('github.link')"
          class="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg viewBox="0 0 16 16" class="size-4" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
            />
          </svg>
        </a>
        <ThemeToggle />
      </div>
    </div>

    <div class="absolute top-3 right-3 z-10 lg:top-4 lg:right-4">
      <MapControls @locate="requestLocate()" />
    </div>
  </div>
</template>
