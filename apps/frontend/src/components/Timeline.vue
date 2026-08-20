<script setup lang="ts">
import { computed } from "vue";
import { Play, Pause } from "@lucide/vue";
import { Slider } from "@/components/ui/slider";
import Legend from "@/components/Legend.vue";
import { formatFrameTime, parseFrameTimestamp } from "@/lib/time";
import type { RadarFrame } from "@/composables/useRadarFrames";
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from "@/composables/useRadarFrames";
import { useI18n } from "@/i18n/messages";

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

const { t } = useI18n();

const currentLabel = computed(() => {
  const frame = props.frames[props.selectedIndex];
  return frame ? formatFrameTime(frame.timestamp) : "--:--";
});

// How far behind the newest frame the scrubber is sitting. The newest KNMI
// frame already lags the clock by 5-10 minutes, so this is relative to the
// newest frame rather than to now - otherwise it would never read "0 min"
// even when parked on the latest image.
const relativeLabel = computed(() => {
  const frames = props.frames;
  const selected = frames[props.selectedIndex];
  const newest = frames[frames.length - 1];
  if (!selected || !newest) return "";
  if (selected.timestamp === newest.timestamp) return t("timeline.latest");
  const minutes = Math.round(
    (parseFrameTimestamp(newest.timestamp).getTime() -
      parseFrameTimestamp(selected.timestamp).getTime()) /
      60000,
  );
  return t("timeline.minutesAgo", { n: minutes });
});

const sliderValue = computed(() => [props.selectedIndex]);

// One tick per cached frame, so the scrubber shows how many images there
// actually are instead of reading as a continuous range.
const tickPositions = computed(() => {
  const count = props.frames.length;
  if (count <= 1) return [];
  return props.frames.map((_, i) => (i / (count - 1)) * 100);
});

const axisLabels = computed(() => {
  const frames = props.frames;
  if (frames.length === 0) return [];
  const midpoint = frames[Math.floor((frames.length - 1) / 2)];
  return [
    { text: formatFrameTime(frames[0].timestamp), align: "start" as const },
    { text: formatFrameTime(midpoint.timestamp), align: "center" as const },
    { text: formatFrameTime(frames[frames.length - 1].timestamp), align: "end" as const },
  ];
});
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
    <div class="order-1 flex items-center gap-3">
      <button
        type="button"
        class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
        :disabled="frames.length <= 1"
        :aria-label="playing ? t('timeline.pause') : t('timeline.play')"
        @click="emit('togglePlay')"
      >
        <Pause v-if="playing" class="size-4.5" />
        <Play v-else class="size-4.5" />
      </button>

      <div class="flex min-w-[104px] flex-col">
        <span class="text-xl leading-6 font-semibold tracking-tight tabular-nums">
          {{ currentLabel }}
        </span>
        <span class="text-[11px] leading-4 text-muted-foreground">
          {{ relativeLabel }}
        </span>
      </div>
    </div>

    <div class="order-3 w-full lg:order-2 lg:w-auto lg:flex-1">
      <Slider
        class="w-full"
        :model-value="sliderValue"
        :min="0"
        :max="Math.max(frames.length - 1, 0)"
        :step="1"
        @update:model-value="(v) => v && emit('select', v[0])"
      />

      <div class="relative mt-2 h-1">
        <span
          v-for="(pos, i) in tickPositions"
          :key="i"
          class="absolute top-0 h-1 w-px bg-border"
          :style="{ left: `${pos}%` }"
        />
      </div>

      <div class="mt-1 flex justify-between text-[10px] leading-3 text-muted-foreground tabular-nums">
        <span v-for="label in axisLabels" :key="label.align" :class="label.align === 'end' && 'font-semibold text-foreground'">
          {{ label.text }}
        </span>
      </div>
    </div>

    <div class="order-2 ml-auto flex shrink-0 gap-1 rounded-xl bg-muted p-1 lg:order-3 lg:ml-0">
      <button
        v-for="s in PLAYBACK_SPEEDS"
        :key="s"
        type="button"
        class="flex h-9 w-11 items-center justify-center rounded-lg font-mono text-xs font-medium transition-colors lg:h-7 lg:w-10"
        :class="speed === s ? 'bg-primary text-primary-foreground' : 'hover:bg-background/60'"
        @click="emit('setSpeed', s)"
      >
        {{ s }}x
      </button>
    </div>

    <div class="order-4 hidden h-11 w-px shrink-0 bg-border lg:block" />

    <Legend class="order-5 w-full lg:w-auto lg:shrink-0" />
  </div>
</template>
