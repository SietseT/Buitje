<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "@/i18n/messages";
import { smoothColorRamp } from "@/composables/useSmoothColorRamp";
import { rampGradient } from "@/lib/colorRamp";

const { t } = useI18n();

// Mirrors whichever transition mode the user picked on the map rail
// (useSmoothColorRamp, the same preference that decides which cached PNG
// variant RadarMap requests), so the legend always describes the image
// actually on screen.
const gradient = computed(() => rampGradient(smoothColorRamp.value));
</script>

<template>
  <div class="flex items-center gap-2">
    <span class="shrink-0 text-[10px] leading-3 text-muted-foreground">{{ t("legend.light") }}</span>
    <div class="h-2.5 flex-1 rounded-full lg:w-32 lg:flex-none" :style="{ background: gradient }" />
    <span class="shrink-0 text-[10px] leading-3 text-muted-foreground">{{ t("legend.heavy") }}</span>
  </div>
</template>
