<script setup lang="ts">
import { useI18n } from "@/i18n/messages";

const { t } = useI18n();

// Mirrors the color ramp in apps/backend/src/knmi/colorize.ts (STOPS).
// Keep these in sync if that ramp changes.
const STOPS = [
  { dbz: 0, r: 100, g: 180, b: 255, a: 0 },
  { dbz: 7, r: 100, g: 180, b: 255, a: 0 },
  { dbz: 15, r: 60, g: 140, b: 245, a: 200 },
  { dbz: 25, r: 60, g: 200, b: 90, a: 220 },
  { dbz: 35, r: 240, g: 220, b: 40, a: 235 },
  { dbz: 45, r: 250, g: 140, b: 30, a: 245 },
  { dbz: 55, r: 230, g: 30, b: 30, a: 255 },
  { dbz: 65, r: 200, g: 30, b: 200, a: 255 },
] as const;

const maxDbz = STOPS[STOPS.length - 1].dbz;

const gradient = `linear-gradient(to right, ${STOPS.map(
  (s) => `rgba(${s.r}, ${s.g}, ${s.b}, ${(s.a / 255).toFixed(2)}) ${((s.dbz / maxDbz) * 100).toFixed(1)}%`,
).join(", ")})`;
</script>

<template>
  <div class="flex items-center gap-2 rounded-xl bg-white/90 px-4 py-3 shadow-lg backdrop-blur dark:bg-neutral-900/90">
    <span class="shrink-0 text-[10px] text-muted-foreground">{{ t("legend.light") }}</span>
    <div class="h-2.5 w-20 shrink-0 rounded-full" :style="{ background: gradient }" />
    <span class="shrink-0 text-[10px] text-muted-foreground">{{ t("legend.heavy") }}</span>
  </div>
</template>
