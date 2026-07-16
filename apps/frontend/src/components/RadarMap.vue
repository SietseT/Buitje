<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RadarBounds, RadarFrame } from "@/composables/useRadarFrames";
import type { Marker } from "@/composables/useMarkers";
import { useI18n } from "@/i18n/messages";

const props = defineProps<{
  frame: RadarFrame | undefined;
  bounds: RadarBounds | null;
  markers: Marker[];
  placingMarker: boolean;
}>();

const emit = defineEmits<{
  placeMarker: [lng: number, lat: number];
  renameMarker: [id: string, label: string];
  deleteMarker: [id: string];
  cancelPlacing: [];
  geolocateError: [];
}>();

const { t } = useI18n();

const mapContainer = ref<HTMLDivElement | null>(null);
const map = shallowRef<maplibregl.Map | null>(null);
let resizeObserver: ResizeObserver | null = null;

const RADAR_SOURCE_ID = "radar-frame";
const RADAR_LAYER_ID = "radar-frame-layer";

// OpenFreeMap's Liberty style prefers the English name ("name_en") over the
// local OSM "name" for every label layer, whenever one exists. We always
// want local (Dutch) place names on the map, so rewrite that expression on
// every symbol layer's text-field rather than hardcoding layer ids.
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

// OpenFreeMap "Liberty" style: a decluttered vector basemap that stays out
// of the way of the radar overlay, unlike raw OSM Mapnik tiles. Genuinely
// free, no API key/account/rate limit (unlike CARTO's basemap CDN, which
// per their own docs requires being a registered "grantee" for free use).
const style = "https://tiles.openfreemap.org/styles/liberty";

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

function applyOverlay(frame: RadarFrame, bounds: RadarBounds) {
  const m = map.value;
  if (!m) return;

  const coordinates = coordinatesFromBounds(bounds);
  const existing = m.getSource(RADAR_SOURCE_ID) as maplibregl.ImageSource | undefined;

  if (existing) {
    existing.updateImage({ url: frame.url, coordinates });
    return;
  }

  m.addSource(RADAR_SOURCE_ID, {
    type: "image",
    url: frame.url,
    coordinates,
  });
  m.addLayer({
    id: RADAR_LAYER_ID,
    type: "raster",
    source: RADAR_SOURCE_ID,
    paint: { "raster-opacity": 0.85 },
  });
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
  img.src = frame.url;
}

// MapLibre's default teardrop pin looks dated next to the rest of the
// app's flat, lucide-icon UI - build the marker element from the same
// "map-pin" glyph used on the panel button instead, filled in a color
// distinct from both the radar palette and the GeolocateControl's blue
// dot. Popup content is built with plain DOM calls, matching this file's
// existing all-imperative style (no child Vue components get mounted into
// the map).
const MARKER_COLOR = "#dc2626";

// Path data from @lucide/vue's "map-pin" icon (24x24 viewBox), kept as a
// literal so this stays a plain DOM element rather than mounting a Vue
// component into the map.
const MARKER_PIN_SVG = `
  <svg width="30" height="30" viewBox="0 0 24 24" fill="${MARKER_COLOR}" stroke="white" stroke-width="1.25" stroke-linejoin="round" style="filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.4))">
    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
    <circle cx="12" cy="10" r="3" fill="white" stroke="none" />
  </svg>
`;

function createMarkerElement(): HTMLElement {
  const el = document.createElement("div");
  el.className = "cursor-pointer";
  el.innerHTML = MARKER_PIN_SVG;
  return el;
}

interface MarkerInstance {
  marker: maplibregl.Marker;
  input: HTMLInputElement;
}

const markerInstances = new Map<string, MarkerInstance>();

function createPopupContent(id: string, label: string): { element: HTMLElement; input: HTMLInputElement } {
  const container = document.createElement("div");
  container.className = "flex items-center gap-1.5";

  const input = document.createElement("input");
  input.type = "text";
  input.value = label;
  input.placeholder = t("markers.namePlaceholder");
  input.className =
    "min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-ring";
  input.addEventListener("change", () => {
    const value = input.value.trim();
    if (value) emit("renameMarker", id, value);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = t("markers.delete");
  deleteButton.className =
    "shrink-0 rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10";
  deleteButton.addEventListener("click", () => emit("deleteMarker", id));

  container.append(input, deleteButton);
  return { element: container, input };
}

function syncMarkers() {
  const m = map.value;
  if (!m) return;

  const seen = new Set<string>();
  for (const data of props.markers) {
    seen.add(data.id);
    const existing = markerInstances.get(data.id);
    if (existing) {
      existing.marker.setLngLat([data.lng, data.lat]);
      if (document.activeElement !== existing.input) existing.input.value = data.label;
      continue;
    }

    const { element, input } = createPopupContent(data.id, data.label);
    const popup = new maplibregl.Popup({
      offset: 22,
      className: "buitje-marker-popup",
      closeButton: false,
    }).setDOMContent(element);
    const marker = new maplibregl.Marker({ element: createMarkerElement(), anchor: "bottom" })
      .setLngLat([data.lng, data.lat])
      .setPopup(popup)
      .addTo(m);
    markerInstances.set(data.id, { marker, input });
  }

  for (const [id, { marker }] of markerInstances) {
    if (!seen.has(id)) {
      marker.remove();
      markerInstances.delete(id);
    }
  }
}

// Exposed so the parent can open a freshly-placed marker's popup right away
// (letting the user rename it immediately) and fly to a marker picked from
// the saved-markers list, without RadarMap needing to know about either flow.
function openMarkerPopup(id: string) {
  const entry = markerInstances.get(id);
  if (!entry) return;
  entry.marker.togglePopup();
  requestAnimationFrame(() => {
    entry.input.focus();
    entry.input.select();
  });
}

function flyTo(lng: number, lat: number) {
  const m = map.value;
  if (!m) return;
  m.flyTo({ center: [lng, lat], zoom: Math.max(m.getZoom(), 9) });
}

defineExpose({ openMarkerPopup, flyTo });

// Click-to-place: arming placement mode swaps the cursor to a crosshair and
// arms a single map click to report the clicked coordinates back up - the
// parent owns whether we're "placing" (and creates the actual marker), this
// component only ever reports where the user clicked.
let placementClickHandler: ((e: maplibregl.MapMouseEvent) => void) | null = null;

function handlePlacementEscape(e: KeyboardEvent) {
  if (e.key === "Escape") emit("cancelPlacing");
}

watch(
  () => props.placingMarker,
  (placing) => {
    const m = map.value;
    if (!m) return;

    if (placementClickHandler) {
      m.off("click", placementClickHandler);
      placementClickHandler = null;
    }
    window.removeEventListener("keydown", handlePlacementEscape);

    if (placing) {
      m.getCanvas().style.cursor = "crosshair";
      placementClickHandler = (e) => emit("placeMarker", e.lngLat.lng, e.lngLat.lat);
      m.on("click", placementClickHandler);
      window.addEventListener("keydown", handlePlacementEscape);
    } else {
      m.getCanvas().style.cursor = "";
    }
  },
);

watch(() => props.markers, syncMarkers, { deep: true });

onMounted(() => {
  if (!mapContainer.value) return;
  map.value = new maplibregl.Map({
    container: mapContainer.value,
    style,
    center: [5.3, 52.15],
    zoom: 6.7,
    // Default bottom-right attribution wraps to 2 lines on narrow viewports,
    // spanning nearly the full width and colliding with the bottom
    // timeline/legend toolbar. Move it to top-right instead, alongside the
    // zoom control, well clear of every other overlay.
    attributionControl: false,
  });
  map.value.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

  // Geolocation is opt-in and permission can be denied - GeolocateControl
  // already handles the browser permission prompt and draws the pulsing
  // location dot itself; we only need to surface denial/failure so the app
  // can point the user at the manual-marker fallback instead.
  const geolocateControl = new maplibregl.GeolocateControl({
    // Without an explicit timeout the Geolocation API defaults to Infinity,
    // so a stalled location fix would hang forever with no feedback,
    // defeating the "reject is fine, just add a marker" fallback UX below.
    positionOptions: { enableHighAccuracy: false, timeout: 10000 },
    trackUserLocation: true,
    showUserLocation: true,
    // Default fitBoundsOptions zooms in to street level - all we want here
    // is to reveal roughly where the user is, not replace the radar
    // overview with a close-up.
    fitBoundsOptions: { maxZoom: 9 },
  });
  geolocateControl.on("error", () => emit("geolocateError"));
  map.value.addControl(geolocateControl, "top-right");

  map.value.addControl(new maplibregl.AttributionControl({ compact: true }), "top-right");
  map.value.on("load", () => {
    updateOverlay();
    applyLocalLabelLanguage();
    syncMarkers();
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
  resizeObserver?.disconnect();
  resizeObserver = null;
  window.removeEventListener("keydown", handlePlacementEscape);
  map.value?.remove();
  map.value = null;
});

watch([() => props.frame, () => props.bounds], () => {
  if (map.value?.loaded()) updateOverlay();
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
  <div ref="mapContainer" class="h-full w-full" />
</template>
