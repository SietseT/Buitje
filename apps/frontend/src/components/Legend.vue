<script setup lang="ts">
// Mirrors the color ramp in apps/backend/src/knmi/colorize.ts (STOPS).
// Keep these in sync if that ramp changes.
const STOPS = [
  { dbz: 0, r: 100, g: 180, b: 255, a: 0 },
  { dbz: 5, r: 100, g: 180, b: 255, a: 140 },
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
  <div
    class="w-40 rounded-xl bg-white/90 px-3 py-2.5 shadow-lg backdrop-blur dark:bg-neutral-900/90"
  >
    <p class="mb-1.5 text-xs font-medium text-muted-foreground">Rain intensity</p>
    <div class="h-2.5 w-full rounded-full" :style="{ background: gradient }" />
    <div class="mt-1 flex justify-between text-[10px] text-muted-foreground">
      <span>Light</span>
      <span>Heavy</span>
    </div>
  </div>
</template>
