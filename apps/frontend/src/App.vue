<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import RadarMap from "@/components/RadarMap.vue";
import Timeline from "@/components/Timeline.vue";
import PlacePanel from "@/components/PlacePanel.vue";
import PlaceSheet from "@/components/PlaceSheet.vue";
import { useRadarFrames } from "@/composables/useRadarFrames";
import { useMarkers } from "@/composables/useMarkers";
import { usePlaces, LOCATION_PLACE_ID } from "@/composables/usePlaces";
import { usePointSeries } from "@/composables/usePointSeries";
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

const { t } = useI18n();
const { markers, addMarker, renameMarker, removeMarker } = useMarkers();
const { places, selectedPlace, selectedId, select } = usePlaces(() => t("place.myLocation"));

const { points } = usePointSeries(
  computed(() => (selectedPlace.value
    ? { lat: selectedPlace.value.lat, lng: selectedPlace.value.lng }
    : null)),
  frames,
);

const radarMap = ref<InstanceType<typeof RadarMap> | null>(null);
const placingMarker = ref(false);

function armPlacing() {
  placingMarker.value = true;
}

function handlePlaceMarker(lng: number, lat: number) {
  placingMarker.value = false;
  const id = addMarker(lng, lat, t("markers.defaultLabel", { n: markers.value.length + 1 }));
  // A freshly placed marker becomes the panel's subject straight away -
  // placing one is a statement about what you care about.
  select(id);
  nextTick(() => radarMap.value?.openMarkerPopup(id));
}

function handleSelect(id: string) {
  select(id);
  const place = places.value.find((p) => p.id === id);
  if (place) radarMap.value?.flyTo(place.lng, place.lat);
}

function handleRemove(id: string) {
  if (id === LOCATION_PLACE_ID) return;
  removeMarker(id);
}

function reload() {
  window.location.reload();
}
</script>

<template>
  <div class="relative h-full w-full bg-background lg:flex lg:gap-4 lg:p-4">
    <div
      v-if="fatalError"
      class="absolute inset-x-0 top-0 z-30 flex items-center justify-center gap-3 bg-destructive px-4 py-2 text-sm text-white"
    >
      <span>{{ t("error.fatal") }}</span>
      <button type="button" class="font-medium underline underline-offset-2" @click="reload">
        {{ t("error.reload") }}
      </button>
    </div>

    <PlacePanel
      class="hidden lg:flex"
      :places="places"
      :selected-place="selectedPlace"
      :selected-id="selectedId"
      :points="points"
      :frames="frames"
      :placing-marker="placingMarker"
      @add="armPlacing"
      @select="handleSelect"
      @remove="handleRemove"
      @cancel-placing="placingMarker = false"
    />

    <!-- The map stays in one place in the DOM across both layouts: swapping
         it between two subtrees would tear down and re-create the MapLibre
         instance on every breakpoint crossing. -->
    <div class="absolute inset-0 lg:static lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-4">
      <div class="h-full lg:h-auto lg:flex-1 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border">
        <RadarMap
          ref="radarMap"
          :frame="currentFrame"
          :bounds="bounds"
          :markers="markers"
          :placing-marker="placingMarker"
          @place-marker="handlePlaceMarker"
          @rename-marker="renameMarker"
          @delete-marker="removeMarker"
          @cancel-placing="placingMarker = false"
        />
      </div>

      <div class="hidden shrink-0 rounded-2xl border border-border bg-card px-5 py-3 lg:block">
        <Timeline
          :frames="frames"
          :selected-index="selectedIndex"
          :playing="playing"
          :speed="speed"
          @select="selectIndex"
          @toggle-play="togglePlay"
          @set-speed="setSpeed"
        />
      </div>
    </div>

    <div v-if="!connected" class="absolute inset-x-0 top-4 z-20 flex justify-center px-4 lg:top-6">
      <div class="rounded-xl bg-card px-4 py-2 text-sm shadow-lg ring-1 ring-foreground/10">
        {{ t("connection.lost") }}
      </div>
    </div>

    <!-- Below lg the sheet is the panel, and it carries the timeline with it.
         Timeline is rendered twice (here and in the bar above) rather than
         teleported; it's presentational and fully controlled, so a hidden
         second instance costs nothing and keeps the map mounted. -->
    <PlaceSheet
      class="absolute inset-x-0 bottom-0 z-20 max-h-[85%] overflow-y-auto lg:hidden"
      :places="places"
      :selected-place="selectedPlace"
      :selected-id="selectedId"
      :points="points"
      :frames="frames"
      :placing-marker="placingMarker"
      @add="armPlacing"
      @select="handleSelect"
      @remove="handleRemove"
      @cancel-placing="placingMarker = false"
    >
      <Timeline
        :frames="frames"
        :selected-index="selectedIndex"
        :playing="playing"
        :speed="speed"
        @select="selectIndex"
        @toggle-play="togglePlay"
        @set-speed="setSpeed"
      />
    </PlaceSheet>
  </div>
</template>
