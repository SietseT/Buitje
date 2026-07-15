<script setup lang="ts">
import RadarMap from "@/components/RadarMap.vue";
import Timeline from "@/components/Timeline.vue";
import Legend from "@/components/Legend.vue";
import LanguageSelector from "@/components/LanguageSelector.vue";
import { useRadarFrames } from "@/composables/useRadarFrames";

const {
  frames,
  bounds,
  selectedIndex,
  currentFrame,
  playing,
  speed,
  togglePlay,
  selectIndex,
  setSpeed,
} = useRadarFrames();
</script>

<template>
  <div class="relative h-full w-full">
    <RadarMap :frame="currentFrame" :bounds="bounds" />

    <div class="absolute top-4 left-4">
      <LanguageSelector />
    </div>

    <div class="absolute inset-x-0 bottom-6 flex items-center justify-center gap-2 px-4">
      <Timeline
        :frames="frames"
        :selected-index="selectedIndex"
        :playing="playing"
        :speed="speed"
        @select="selectIndex"
        @toggle-play="togglePlay"
        @set-speed="setSpeed"
      />
      <Legend />
    </div>
  </div>
</template>
