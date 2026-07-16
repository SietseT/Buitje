<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Button } from "@/components/ui/button";

interface ColorStop {
  dbz: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

const stops = ref<ColorStop[]>([]);
const previewUrl = ref("");
const copyLabel = ref("Copy STOPS as TS");

function hexOf(s: ColorStop): string {
  const h = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${h(s.r)}${h(s.g)}${h(s.b)}`;
}

function setFromHex(stop: ColorStop, hex: string) {
  stop.r = parseInt(hex.slice(1, 3), 16);
  stop.g = parseInt(hex.slice(3, 5), 16);
  stop.b = parseInt(hex.slice(5, 7), 16);
}

function addStop() {
  const last = stops.value[stops.value.length - 1];
  stops.value.push(last ? { ...last, dbz: last.dbz + 5 } : { dbz: 0, r: 100, g: 180, b: 255, a: 0 });
}

function removeStop(index: number) {
  if (stops.value.length <= 2) return;
  stops.value.splice(index, 1);
}

// Stops are edited in whatever order the user added them, but preview
// rendering, the legend gradient, and the exported ramp all need them in
// ascending dBZ order (matching colorize.ts's dbzToRGBA assumptions).
const sortedStops = computed(() => [...stops.value].sort((a, b) => a.dbz - b.dbz));
const visibleStops = computed(() => sortedStops.value.filter((s) => s.a > 0));

const gradient = computed(() => {
  const vis = visibleStops.value;
  if (vis.length === 0) return "none";
  const minDbz = vis[0].dbz;
  const maxDbz = vis[vis.length - 1].dbz;
  const span = maxDbz - minDbz || 1;
  return `linear-gradient(to right, ${vis
    .map(
      (s) =>
        `rgba(${s.r}, ${s.g}, ${s.b}, ${(s.a / 255).toFixed(2)}) ${(((s.dbz - minDbz) / span) * 100).toFixed(1)}%`,
    )
    .join(", ")})`;
});

let debounceTimer: ReturnType<typeof setTimeout>;
function schedulePreviewUpdate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const query = encodeURIComponent(JSON.stringify(sortedStops.value));
    previewUrl.value = `/api/admin/colors/preview?stops=${query}`;
  }, 175);
}

watch(stops, schedulePreviewUpdate, { deep: true });

onMounted(async () => {
  const res = await fetch("/api/admin/colors/default-stops");
  stops.value = await res.json();
  schedulePreviewUpdate();
});

async function copyStops() {
  const lines = sortedStops.value
    .map((s) => `  { dbz: ${s.dbz}, r: ${s.r}, g: ${s.g}, b: ${s.b}, a: ${s.a} },`)
    .join("\n");
  await navigator.clipboard.writeText(lines);
  copyLabel.value = "Copied — paste into colorize.ts, Legend.vue and colorize.test.ts";
  setTimeout(() => (copyLabel.value = "Copy STOPS as TS"), 3000);
}
</script>

<template>
  <div class="min-h-full bg-background p-6 text-foreground">
    <div class="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 class="text-lg font-semibold">Color ramp tuner</h1>
        <p class="text-sm text-muted-foreground">
          Live preview against the fixed frame from 2026-07-16 14:30 local time. Dev-only tool — not built into
          production.
        </p>
      </header>

      <section class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div
          class="relative mx-auto flex aspect-square w-full max-w-md items-center justify-center overflow-hidden rounded-lg border border-border"
          style="background-image: repeating-conic-gradient(#88888844 0% 25%, transparent 0% 50%); background-size: 20px 20px"
        >
          <img
            v-if="previewUrl"
            :src="previewUrl"
            alt="Color ramp preview"
            class="h-full w-full object-contain"
            style="opacity: 0.85"
          />
          <span v-else class="text-sm text-muted-foreground">Loading frame…</span>
        </div>

        <div class="flex items-center justify-center gap-2">
          <span class="text-[10px] text-muted-foreground">light</span>
          <div class="h-2.5 w-32 rounded-full border border-border" :style="{ background: gradient }" />
          <span class="text-[10px] text-muted-foreground">heavy</span>
        </div>
      </section>

      <section class="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <div v-for="(stop, i) in stops" :key="i" class="flex items-center gap-3">
          <label class="flex items-center gap-1 text-xs text-muted-foreground">
            dBZ
            <input
              v-model.number="stop.dbz"
              type="number"
              class="w-16 rounded border border-border bg-background px-1.5 py-0.5 text-sm text-foreground"
            />
          </label>
          <input
            :value="hexOf(stop)"
            type="color"
            class="h-7 w-10 cursor-pointer rounded border border-border bg-background"
            @input="setFromHex(stop, ($event.target as HTMLInputElement).value)"
          />
          <label class="flex flex-1 items-center gap-2 text-xs text-muted-foreground">
            alpha
            <input v-model.number="stop.a" type="range" min="0" max="255" class="flex-1" />
            <span class="w-8 text-right tabular-nums">{{ stop.a }}</span>
          </label>
          <Button variant="ghost" size="icon-sm" :disabled="stops.length <= 2" @click="removeStop(i)">×</Button>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <Button variant="outline" size="sm" @click="addStop">Add stop</Button>
          <Button variant="secondary" size="sm" @click="copyStops">{{ copyLabel }}</Button>
        </div>
      </section>
    </div>
  </div>
</template>
