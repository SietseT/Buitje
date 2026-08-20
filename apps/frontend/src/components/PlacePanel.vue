<script setup lang="ts">
import { computed } from "vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import PlaceHeadline from "@/components/PlaceHeadline.vue";
import RainChart from "@/components/RainChart.vue";
import PlacesList from "@/components/PlacesList.vue";
import EmptyState from "@/components/EmptyState.vue";
import type { Place } from "@/composables/usePlaces";
import type { PointSample } from "@/composables/usePointSeries";
import type { RadarFrame } from "@/composables/useRadarFrames";
import { formatFrameTime } from "@/lib/time";
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

const latest = computed(() => {
  const frame = props.frames[props.frames.length - 1];
  return frame ? formatFrameTime(frame.timestamp) : "--:--";
});
</script>

<template>
  <aside
    class="flex w-[380px] shrink-0 flex-col gap-5 rounded-2xl border border-border bg-card p-6 xl:w-[440px]"
  >
    <div class="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" class="size-5.5" />
      <span class="text-base font-semibold tracking-tight">Buitje</span>
      <div class="flex-1" />
      <ThemeToggle />
    </div>

    <!-- Lives here rather than floating over the map: the user is about to
         click the map, so nothing should be covering it. -->
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

    <template v-else>
      <PlaceHeadline :label="selectedPlace?.label ?? ''" :points="points" />
      <RainChart :points="points" />
      <div class="h-px bg-border" />
      <PlacesList
        :places="places"
        :selected-id="selectedPlace?.id ?? selectedId"
        :frames="frames"
        @add="emit('add')"
        @select="(id) => emit('select', id)"
        @remove="(id) => emit('remove', id)"
      />
    </template>

    <div class="flex-1" />

    <div class="flex items-center justify-between gap-2 text-[11px] leading-4 text-muted-foreground">
      <span>{{ t("source.knmi") }}</span>
      <span class="font-mono tabular-nums">{{ latest }}</span>
    </div>
  </aside>
</template>
