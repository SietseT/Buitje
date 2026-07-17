<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "@/i18n/messages";
import { smoothColorRamp } from "@/composables/useSmoothColorRamp";

const { t } = useI18n();

// Mirrors the color ramp in apps/backend/src/knmi/colorize.ts (STOPS).
// Keep these in sync if that ramp changes.
const STOPS = [
  { dbz: 5, r: 6, g: 232, b: 228, a: 200 },
  { dbz: 10, r: 9, g: 158, b: 242, a: 200 },
  { dbz: 15, r: 4, g: 0, b: 243, a: 200 },
  { dbz: 20, r: 0, g: 248, b: 6, a: 200 },
  { dbz: 25, r: 6, g: 194, b: 0, a: 200 },
  { dbz: 30, r: 0, g: 136, b: 0, a: 200 },
  { dbz: 35, r: 252, g: 246, b: 2, a: 200 },
  { dbz: 40, r: 215, g: 177, b: 0, a: 200 },
  { dbz: 45, r: 255, g: 148, b: 0, a: 200 },
  { dbz: 50, r: 240, g: 0, b: 0, a: 200 },
  { dbz: 55, r: 217, g: 0, b: 0, a: 215 },
  { dbz: 60, r: 164, g: 7, b: 16, a: 225 },
  { dbz: 65, r: 249, g: 0, b: 244, a: 235 },
  { dbz: 70, r: 136, g: 81, b: 201, a: 245 },
  { dbz: 75, r: 252, g: 252, b: 252, a: 255 },
] as const;

// Below the visible-rain floor nothing is drawn on the map, so a zero-alpha
// stop would render as solid white (the legend pill's own background
// showing through) and read as "white = light rain" even though white is
// never actually shown on the map. Only render stops that are actually
// visible (a > 0), so the bar starts at the palest color that really
// appears. (Currently a no-op since every stop below has a > 0, but kept as
// a guard in case a fully-transparent floor stop is reintroduced.)
const VISIBLE_STOPS = STOPS.filter((s) => s.a > 0);
const minDbz = VISIBLE_STOPS[0].dbz;
const maxDbz = VISIBLE_STOPS[VISIBLE_STOPS.length - 1].dbz;

const positions = VISIBLE_STOPS.map((s) => ((s.dbz - minDbz) / (maxDbz - minDbz)) * 100);

// Mirrors whichever transition mode the user has chosen (useSmoothColorRamp,
// a localStorage preference also used by RadarMap.vue to pick which cached
// PNG variant to request). Smooth: one color-stop per position, blending
// between them as usual. Hard: each color declared twice, once at its
// band's start % and again at its end % (the next stop's position, or 100%
// for the last), so the gradient renders as flat plateaus with a sharp jump
// at each threshold instead of blending.
const gradient = computed(() => {
  if (smoothColorRamp.value) {
    return `linear-gradient(to right, ${VISIBLE_STOPS.map(
      (s, i) => `rgba(${s.r}, ${s.g}, ${s.b}, ${(s.a / 255).toFixed(2)}) ${positions[i].toFixed(1)}%`,
    ).join(", ")})`;
  }
  return `linear-gradient(to right, ${VISIBLE_STOPS.map((s, i) => {
    const start = positions[i].toFixed(1);
    const end = (i < VISIBLE_STOPS.length - 1 ? positions[i + 1] : 100).toFixed(1);
    const color = `rgba(${s.r}, ${s.g}, ${s.b}, ${(s.a / 255).toFixed(2)})`;
    return `${color} ${start}%, ${color} ${end}%`;
  }).join(", ")})`;
});
</script>

<template>
  <div class="flex items-center gap-2 rounded-xl bg-white/90 px-4 py-3 shadow-lg backdrop-blur dark:bg-neutral-900/90">
    <span class="shrink-0 text-[10px] text-muted-foreground">{{ t("legend.light") }}</span>
    <div class="h-2.5 w-20 shrink-0 rounded-full" :style="{ background: gradient }" />
    <span class="shrink-0 text-[10px] text-muted-foreground">{{ t("legend.heavy") }}</span>
  </div>
</template>
