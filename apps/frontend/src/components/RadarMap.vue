<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RadarBounds, RadarFrame } from "@/composables/useRadarFrames";

const props = defineProps<{
  frame: RadarFrame | undefined;
  bounds: RadarBounds | null;
}>();

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
  map.value.addControl(new maplibregl.AttributionControl({ compact: true }), "top-right");
  map.value.on("load", () => {
    updateOverlay();
    applyLocalLabelLanguage();
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
  map.value?.remove();
  map.value = null;
});

watch([() => props.frame, () => props.bounds], () => {
  if (map.value?.loaded()) updateOverlay();
});
</script>

<template>
  <div ref="mapContainer" class="h-full w-full" />
</template>
