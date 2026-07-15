<script setup lang="ts">
import { computed } from "vue";
import { Play, Pause } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { RadarFrame } from "@/composables/useRadarFrames";
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from "@/composables/useRadarFrames";

const props = defineProps<{
  frames: RadarFrame[];
  selectedIndex: number;
  playing: boolean;
  speed: PlaybackSpeed;
}>();

const emit = defineEmits<{
  select: [index: number];
  togglePlay: [];
  setSpeed: [speed: PlaybackSpeed];
}>();

// Extracted timestamp is YYYYMMDDHHmm, in UTC (KNMI publishes filenames in UTC).
// Parse it as UTC, then format in the browser's local timezone.
function formatTime(timestamp: string): string {
  const year = Number(timestamp.slice(0, 4));
  const month = Number(timestamp.slice(4, 6)) - 1;
  const day = Number(timestamp.slice(6, 8));
  const hour = Number(timestamp.slice(8, 10));
  const minute = Number(timestamp.slice(10, 12));
  const date = new Date(Date.UTC(year, month, day, hour, minute));
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const currentLabel = computed(() => {
  const frame = props.frames[props.selectedIndex];
  return frame ? formatTime(frame.timestamp) : "--:--";
});

const sliderValue = computed({
  get: () => [props.selectedIndex],
  set: (value) => emit("select", value[0] ?? props.selectedIndex),
});
</script>

<template>
  <div
    class="flex items-center gap-3 rounded-xl bg-white/90 px-4 py-3 shadow-lg backdrop-blur dark:bg-neutral-900/90"
  >
    <Button
      size="icon"
      variant="secondary"
      class="shrink-0"
      :disabled="frames.length <= 1"
      @click="emit('togglePlay')"
    >
      <Pause v-if="playing" class="size-4" />
      <Play v-else class="size-4" />
    </Button>

    <Slider
      class="w-48 sm:w-72"
      :model-value="sliderValue"
      :min="0"
      :max="Math.max(frames.length - 1, 0)"
      :step="1"
      @update:model-value="(v) => v && emit('select', v[0])"
    />

    <span class="w-12 shrink-0 text-right font-mono text-sm tabular-nums">
      {{ currentLabel }}
    </span>

    <div class="flex shrink-0 gap-1 border-l border-border pl-3">
      <Button
        v-for="s in PLAYBACK_SPEEDS"
        :key="s"
        size="sm"
        :variant="speed === s ? 'default' : 'ghost'"
        class="px-2 font-mono"
        @click="emit('setSpeed', s)"
      >
        {{ s }}x
      </Button>
    </div>
  </div>
</template>
