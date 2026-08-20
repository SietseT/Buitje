<script setup lang="ts">
import { computed } from "vue";
import { colorForDbz } from "@/lib/colorRamp";
import type { PointSample } from "@/composables/usePointSeries";
import { useI18n } from "@/i18n/messages";

const props = withDefaults(
  defineProps<{
    points: PointSample[];
    height?: number;
  }>(),
  { height: 150 },
);

const { t } = useI18n();

// Fixed drawing space stretched to whatever width the panel has.
// preserveAspectRatio="none" would also stretch text and strokes, so the axis
// labels live outside the SVG as HTML and every stroke is marked
// non-scaling-stroke.
const VB_W = 400;
const VB_H = 100;
const BASELINE = 96;
const TOP = 6;

// Anything at or above this reads as full-height. Real surface rain sits well
// under it; the ramp's upper stops are hail territory and would otherwise
// flatten every ordinary shower into the bottom of the chart.
const CEILING_DBZ = 50;

function x(index: number, count: number): number {
  if (count <= 1) return VB_W;
  return (index / (count - 1)) * VB_W;
}

function y(dbz: number): number {
  const t = Math.min(Math.max(dbz, 0) / CEILING_DBZ, 1);
  return BASELINE - t * (BASELINE - TOP);
}

/**
 * Runs of consecutive readings, split wherever the radar has no value.
 * A gap must stay a gap: joining across it would draw a straight line
 * through missing data as though it had been measured.
 */
const segments = computed(() => {
  const count = props.points.length;
  const runs: { area: string; line: string }[] = [];
  let run: { px: number; py: number }[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const line = run.map((p, i) => `${i === 0 ? "M" : "L"}${p.px.toFixed(1)},${p.py.toFixed(1)}`).join("");
    // A single reading has no line to draw, but still deserves its column.
    const first = run[0];
    const last = run[run.length - 1];
    runs.push({
      line,
      area: `${line}L${last.px.toFixed(1)},${BASELINE}L${first.px.toFixed(1)},${BASELINE}Z`,
    });
    run = [];
  };

  props.points.forEach((point, index) => {
    if (point.dbz === null) {
      flush();
      return;
    }
    run.push({ px: x(index, count), py: y(point.dbz) });
  });
  flush();

  return runs;
});

/**
 * Marker for the newest reading, positioned as a percentage rather than an
 * SVG circle: the plot is drawn with preserveAspectRatio="none", which would
 * squash a circle into an ellipse at any width.
 */
const lastReading = computed(() => {
  for (let i = props.points.length - 1; i >= 0; i--) {
    if (props.points[i].dbz !== null) {
      return {
        left: `${((x(i, props.points.length) / VB_W) * 100).toFixed(2)}%`,
        top: `${((y(props.points[i].dbz!) / VB_H) * 100).toFixed(2)}%`,
      };
    }
  }
  return null;
});

// Tie the fill to the map's own ramp, so a tall yellow peak in the chart is
// the same yellow the map is painting at that moment.
const gradientStops = computed(() =>
  [5, 15, 25, 35, CEILING_DBZ].map((dbz) => ({
    offset: `${(((BASELINE - y(dbz)) / (BASELINE - TOP)) * 100).toFixed(1)}%`,
    color: colorForDbz(dbz, 0.55),
  })),
);

const gradientId = `rain-fill-${Math.random().toString(36).slice(2, 9)}`;
const hasData = computed(() => segments.value.length > 0);
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="relative" :style="{ height: `${height}px` }">
      <svg
        :viewBox="`0 0 ${VB_W} ${VB_H}`"
        preserveAspectRatio="none"
        class="h-full w-full"
        role="img"
        :aria-label="t('chart.label')"
      >
        <defs>
          <linearGradient :id="gradientId" x1="0" :y1="BASELINE" x2="0" :y2="TOP" gradientUnits="userSpaceOnUse">
            <stop v-for="(s, i) in gradientStops" :key="i" :offset="s.offset" :stop-color="s.color" />
          </linearGradient>
        </defs>

        <line
          :x1="0"
          :y1="BASELINE"
          :x2="VB_W"
          :y2="BASELINE"
          class="stroke-border"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
        />

        <template v-for="(seg, i) in segments" :key="i">
          <path :d="seg.area" :fill="`url(#${gradientId})`" />
          <path
            :d="seg.line"
            fill="none"
            class="stroke-foreground"
            stroke-width="1.75"
            stroke-linejoin="round"
            stroke-linecap="round"
            vector-effect="non-scaling-stroke"
          />
        </template>
      </svg>

      <span
        v-if="lastReading"
        class="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground bg-background"
        :style="lastReading"
      />

      <div
        v-if="!hasData"
        class="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground"
      >
        {{ t("chart.noData") }}
      </div>
    </div>

    <div class="flex justify-between text-[10px] leading-3 text-muted-foreground tabular-nums">
      <span>{{ t("chart.twoHoursAgo") }}</span>
      <span>{{ t("chart.oneHourAgo") }}</span>
      <span class="font-semibold text-foreground">{{ t("chart.now") }}</span>
    </div>

    <span class="text-[11px] leading-4 text-muted-foreground">{{ t("chart.noForecast") }}</span>
  </div>
</template>
