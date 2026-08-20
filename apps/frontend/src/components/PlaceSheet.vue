<script setup lang="ts">
import { ref } from "vue";
import { ChevronDown, MapPin } from "@lucide/vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import PlaceHeadline from "@/components/PlaceHeadline.vue";
import RainChart from "@/components/RainChart.vue";
import PlacesList from "@/components/PlacesList.vue";
import EmptyState from "@/components/EmptyState.vue";
import type { Place } from "@/composables/usePlaces";
import type { PointSample } from "@/composables/usePointSeries";
import type { RadarFrame } from "@/composables/useRadarFrames";
import { useI18n } from "@/i18n/messages";

const props = defineProps<{
  places: Place[];
  selectedPlace: Place | null;
  selectedId: string | null;
  points: PointSample[];
  frames: RadarFrame[];
  placingMarker: boolean;
}>();

const emit = defineEmits<{
  add: [];
  select: [id: string];
  remove: [id: string];
  cancelPlacing: [];
}>();

const { t } = useI18n();

// The sheet is the panel on a phone, so the place list opens in place rather
// than in a separate modal - tapping the place name swaps the reading for the
// list and back.
const showPlaces = ref(false);

function handleSelect(id: string) {
  emit("select", id);
  showPlaces.value = false;
}

function handleAdd() {
  showPlaces.value = false;
  emit("add");
}
</script>

<template>
  <div
    class="flex flex-col gap-3.5 rounded-t-3xl bg-background/95 px-4 pt-2 pb-6 shadow-[0_-8px_24px_-6px_rgb(0_0_0/0.16)] backdrop-blur"
  >
    <div class="flex justify-center">
      <div class="h-1 w-9 rounded-full bg-border" />
    </div>

    <div class="flex items-center gap-2">
      <button
        v-if="places.length > 0"
        type="button"
        class="flex min-w-0 items-center gap-1.5 text-sm font-medium"
        @click="showPlaces = !showPlaces"
      >
        <MapPin class="size-3.5 shrink-0 text-red-600" />
        <span class="truncate">{{ selectedPlace?.label ?? "" }}</span>
        <ChevronDown
          class="size-4 shrink-0 text-muted-foreground transition-transform"
          :class="showPlaces && 'rotate-180'"
        />
      </button>
      <div class="flex-1" />
      <ThemeToggle />
    </div>

    <div
      v-if="placingMarker"
      class="flex items-center gap-3 rounded-xl bg-muted px-3 py-2.5 text-sm"
    >
      <span class="flex-1">{{ t("markers.placingHint") }}</span>
      <button type="button" class="font-medium text-primary hover:underline" @click="emit('cancelPlacing')">
        {{ t("markers.placingCancel") }}
      </button>
    </div>

    <EmptyState v-if="places.length === 0" @pick-on-map="emit('add')" />

    <PlacesList
      v-else-if="showPlaces"
      :places="places"
      :selected-id="selectedPlace?.id ?? selectedId"
      :frames="frames"
      @add="handleAdd"
      @select="handleSelect"
      @remove="(id) => emit('remove', id)"
    />

    <template v-else>
      <PlaceHeadline
        :label="selectedPlace?.label ?? ''"
        :points="points"
        compact
        :show-label="false"
      />
      <RainChart :points="points" :height="110" />
    </template>

    <slot />
  </div>
</template>
