<script setup lang="ts">
import { LocateFixed, Zap, Blend, LoaderCircle } from "@lucide/vue";
import { smoothColorRamp } from "@/composables/useSmoothColorRamp";
import { showLightning } from "@/composables/useLightningToggle";
import { locating } from "@/composables/useUserLocation";
import { useI18n } from "@/i18n/messages";

// Everything on this rail changes what the MAP shows, which is why it lives
// on the map rather than in the app shell: locate moves the view, lightning
// and smoothing are overlay/render choices. Zoom is left to pinch/scroll -
// see CLAUDE.md. Time controls live in the Timeline, and the theme sits with
// the app name in the top-left pill (RadarMap.vue).
const emit = defineEmits<{
  locate: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="flex flex-col items-end gap-2">
    <button
      type="button"
      class="flex size-10 items-center justify-center rounded-xl bg-white/90 shadow-lg backdrop-blur hover:bg-white dark:bg-neutral-900/90 dark:hover:bg-neutral-900"
      :aria-label="t('map.locate')"
      @click="emit('locate')"
    >
      <LoaderCircle v-if="locating" class="size-4 animate-spin" />
      <LocateFixed v-else class="size-4" />
    </button>

    <div
      class="flex flex-col gap-1 rounded-xl bg-white/90 p-1 shadow-lg backdrop-blur dark:bg-neutral-900/90"
    >
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-lg transition-colors"
        :class="
          showLightning
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-muted'
        "
        :aria-label="t('lightning.label')"
        :aria-pressed="showLightning"
        @click="showLightning = !showLightning"
      >
        <Zap class="size-4" />
      </button>
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-lg transition-colors"
        :class="
          smoothColorRamp
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-muted'
        "
        :aria-label="t('colorRamp.label')"
        :aria-pressed="smoothColorRamp"
        @click="smoothColorRamp = !smoothColorRamp"
      >
        <Blend class="size-4" />
      </button>
    </div>
  </div>
</template>
