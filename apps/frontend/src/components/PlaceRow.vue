<script setup lang="ts">
import { computed, toRef } from "vue";
import { X } from "@lucide/vue";
import { usePointSeries } from "@/composables/usePointSeries";
import type { RadarFrame } from "@/composables/useRadarFrames";
import type { Place } from "@/composables/usePlaces";
import { classify } from "@/lib/intensity";
import { useI18n } from "@/i18n/messages";

const props = defineProps<{
  place: Place;
  frames: RadarFrame[];
  selected: boolean;
}>();

const emit = defineEmits<{
  select: [];
  remove: [];
}>();

const { t } = useI18n();

// Each row reads its own series. The responses are small and carry a 30s
// cache, so a handful of places costs a handful of cheap requests per frame.
const { points } = usePointSeries(
  computed(() => ({ lat: props.place.lat, lng: props.place.lng })),
  toRef(props, "frames"),
);

const status = computed(() => {
  const current = points.value[points.value.length - 1]?.dbz ?? null;
  const intensity = classify(current);
  return intensity ? t(`intensity.${intensity}`) : "–";
});

// A 2-hour glance: enough to tell "just passed" from "still going" without
// any numbers. Same non-scaling-stroke trick as RainChart.
const sparkline = computed(() => {
  const values = points.value;
  if (values.length === 0) return "";
  return values
    .map((point, index) => {
      const px = (index / Math.max(values.length - 1, 1)) * 76;
      const level = Math.min(Math.max(point.dbz ?? 0, 0) / 50, 1);
      const py = 18 - level * 15;
      return `${index === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join("");
});
</script>

<template>
  <li class="group flex items-center gap-2 rounded-xl" :class="selected ? 'bg-muted' : 'hover:bg-muted/60'">
    <button
      type="button"
      class="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
      @click="emit('select')"
    >
      <span class="min-w-0 flex-1 truncate text-sm" :class="selected && 'font-medium'">
        {{ place.label }}
      </span>
      <svg width="76" height="20" viewBox="0 0 76 20" class="shrink-0" aria-hidden="true">
        <path
          :d="sparkline"
          fill="none"
          class="stroke-muted-foreground"
          :class="selected && 'stroke-foreground'"
          stroke-width="1.5"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      </svg>
      <span class="w-16 shrink-0 text-right text-xs text-muted-foreground">{{ status }}</span>
    </button>

    <!-- The location entry isn't a saved marker, so there's nothing to delete. -->
    <button
      v-if="!place.isLocation"
      type="button"
      class="mr-1 shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
      :aria-label="t('markers.delete')"
      @click="emit('remove')"
    >
      <X class="size-3.5" />
    </button>
  </li>
</template>
