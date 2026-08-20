<script setup lang="ts">
import RadarMap from "@/components/RadarMap.vue";
import Timeline from "@/components/Timeline.vue";
import { useRadarFrames } from "@/composables/useRadarFrames";
import { locationFailed } from "@/composables/useUserLocation";
import { fatalError } from "@/composables/useFatalError";
import { useI18n } from "@/i18n/messages";

const {
  frames,
  bounds,
  selectedIndex,
  currentFrame,
  playing,
  speed,
  connected,
  togglePlay,
  selectIndex,
  setSpeed,
} = useRadarFrames();

const { t } = useI18n();

function reload() {
  window.location.reload();
}
</script>

<template>
  <div class="relative flex h-full w-full flex-col bg-background lg:gap-4 lg:p-4">
    <div
      v-if="fatalError"
      class="absolute inset-x-0 top-0 z-30 flex items-center justify-center gap-3 bg-destructive px-4 py-2 text-sm text-white"
    >
      <span>{{ t("error.fatal") }}</span>
      <button type="button" class="font-medium underline underline-offset-2" @click="reload">
        {{ t("error.reload") }}
      </button>
    </div>

    <div v-if="!connected" class="absolute inset-x-0 top-4 z-20 flex justify-center px-4 lg:top-6">
      <div class="rounded-xl bg-card px-4 py-2 text-sm shadow-lg ring-1 ring-foreground/10">
        {{ t("connection.lost") }}
      </div>
    </div>
    <div v-else-if="locationFailed" class="absolute inset-x-0 top-4 z-20 flex justify-center px-4 lg:top-6">
      <div class="rounded-xl bg-card px-4 py-2 text-sm shadow-lg ring-1 ring-foreground/10">
        {{ t("location.deniedHint") }}
      </div>
    </div>

    <div class="relative min-h-0 flex-1 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border">
      <RadarMap :frame="currentFrame" :bounds="bounds" />
    </div>

    <div class="shrink-0 border-t border-border bg-card px-4 py-3 lg:mx-auto lg:w-full lg:max-w-3xl lg:rounded-2xl lg:border lg:px-5">
      <Timeline
        :frames="frames"
        :selected-index="selectedIndex"
        :playing="playing"
        :speed="speed"
        @select="selectIndex"
        @toggle-play="togglePlay"
        @set-speed="setSpeed"
      />
    </div>
  </div>
</template>
