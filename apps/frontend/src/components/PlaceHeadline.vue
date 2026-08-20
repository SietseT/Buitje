<script setup lang="ts">
import { computed } from "vue";
import { MapPin } from "@lucide/vue";
import { classify } from "@/lib/intensity";
import type { PointSample } from "@/composables/usePointSeries";
import { useI18n } from "@/i18n/messages";

const props = withDefaults(
  defineProps<{
    label: string;
    points: PointSample[];
    /** Larger type for the desktop panel; the sheet has less room. */
    compact?: boolean;
    /** The sheet puts the place name in its own header row already. */
    showLabel?: boolean;
  }>(),
  { showLabel: true },
);

const { t } = useI18n();

// The newest frame is the last entry, matching /api/frames' ordering. Note
// this is deliberately NOT the frame the timeline happens to be scrubbed to:
// the headline answers "what is it doing now", not "what was on screen at
// 14:05" - the chart below covers the history.
const current = computed(() => props.points[props.points.length - 1]?.dbz ?? null);

const headline = computed(() => {
  if (props.points.length === 0) return t("place.noData");
  const intensity = classify(current.value);
  if (intensity === null) return t("place.noData");
  return t(`place.${intensity}`);
});
</script>

<template>
  <div class="flex flex-col gap-1">
    <span v-if="showLabel" class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      <MapPin class="size-3.5 shrink-0 text-red-600" />
      <span class="truncate">{{ label }}</span>
    </span>
    <span
      class="font-semibold tracking-tight text-pretty"
      :class="compact ? 'text-2xl leading-tight' : 'text-4xl leading-tight'"
    >
      {{ headline }}
    </span>
  </div>
</template>
