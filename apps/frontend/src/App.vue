<script setup lang="ts">
import { nextTick, onUnmounted, ref } from "vue";
import { X } from "@lucide/vue";
import RadarMap from "@/components/RadarMap.vue";
import Timeline from "@/components/Timeline.vue";
import Legend from "@/components/Legend.vue";
import ControlsMenu from "@/components/ControlsMenu.vue";
import { useRadarFrames } from "@/composables/useRadarFrames";
import { useMarkers } from "@/composables/useMarkers";
import { fatalError } from "@/composables/useFatalError";
import { useI18n } from "@/i18n/messages";

const {
  frames,
  bounds,
  selectedIndex,
  currentFrame,
  playing,
  speed,
  connected,
  togglePlay,
  selectIndex,
  setSpeed,
} = useRadarFrames();

const { markers, addMarker, renameMarker, removeMarker } = useMarkers();
const { t } = useI18n();

const radarMap = ref<InstanceType<typeof RadarMap> | null>(null);
const placingMarker = ref(false);

function armPlacing() {
  placingMarker.value = true;
}

function handlePlaceMarker(lng: number, lat: number) {
  placingMarker.value = false;
  const id = addMarker(lng, lat, t("markers.defaultLabel", { n: markers.value.length + 1 }));
  nextTick(() => radarMap.value?.openMarkerPopup(id));
}

function handleFlyTo(lng: number, lat: number) {
  radarMap.value?.flyTo(lng, lat);
}

// GeolocateControl already handles the permission prompt itself; we only
// need to react to denial/failure so the user isn't left wondering why
// nothing happened - point them at the manual-marker fallback instead.
const locationHintVisible = ref(false);
let locationHintTimer: ReturnType<typeof setTimeout> | undefined;

function handleGeolocateError() {
  locationHintVisible.value = true;
  clearTimeout(locationHintTimer);
  locationHintTimer = setTimeout(() => {
    locationHintVisible.value = false;
  }, 6000);
}

onUnmounted(() => clearTimeout(locationHintTimer));

function reload() {
  window.location.reload();
}
</script>

<template>
  <div class="relative h-full w-full">
    <div v-if="fatalError"
      class="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-3 bg-destructive px-4 py-2 text-sm text-white">
      <span>{{ t("error.fatal") }}</span>
      <button type="button" class="font-medium underline underline-offset-2" @click="reload">
        {{ t("error.reload") }}
      </button>
    </div>

    <RadarMap ref="radarMap" :frame="currentFrame" :bounds="bounds" :markers="markers" :placing-marker="placingMarker"
      @place-marker="handlePlaceMarker" @rename-marker="renameMarker" @delete-marker="removeMarker"
      @cancel-placing="placingMarker = false" @geolocate-error="handleGeolocateError" />

    <div class="absolute top-4 left-4 z-10">
      <ControlsMenu :markers="markers" @add="armPlacing" @delete-marker="removeMarker" @fly-to="handleFlyTo" />
    </div>

    <div v-if="locationHintVisible" class="absolute top-4 right-4 z-10 max-w-[calc(100vw-2rem)] sm:max-w-xs">
      <div
        class="flex items-start gap-2 rounded-xl bg-white/90 px-4 py-3 text-sm shadow-lg backdrop-blur dark:bg-neutral-900/90">
        <span class="flex-1">{{ t("location.deniedHint") }}</span>
        <button type="button" class="shrink-0 text-muted-foreground hover:text-foreground"
          @click="locationHintVisible = false">
          <X class="size-4" />
        </button>
      </div>
    </div>

    <div v-if="placingMarker" class="absolute top-4 left-1/2 z-10 -translate-x-1/2 px-4">
      <div
        class="flex items-center gap-3 rounded-xl bg-white/90 px-4 py-2 text-sm shadow-lg backdrop-blur dark:bg-neutral-900/90">
        <span>{{ t("markers.placingHint") }}</span>
        <button type="button" class="font-medium text-primary hover:underline" @click="placingMarker = false">
          {{ t("markers.placingCancel") }}
        </button>
      </div>
    </div>

    <div v-if="!connected" class="absolute inset-x-0 bottom-24 z-10 flex justify-center px-4">
      <div class="rounded-xl bg-white/90 px-4 py-2 text-sm shadow-lg backdrop-blur dark:bg-neutral-900/90">
        {{ t("connection.lost") }}
      </div>
    </div>

    <div
      class="absolute inset-x-0 bottom-3 z-10 flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:flex-row sm:items-stretch sm:justify-center">
      <Timeline class="order-2 sm:order-1" :frames="frames" :selected-index="selectedIndex" :playing="playing"
        :speed="speed" @select="selectIndex" @toggle-play="togglePlay" @set-speed="setSpeed" />
      <Legend class="order-1 sm:order-2" />
    </div>
  </div>
</template>
