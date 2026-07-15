import { ref, computed, onMounted, onUnmounted } from "vue";

export interface RadarFrame {
  timestamp: string;
  url: string;
}

export interface RadarBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

const POLL_INTERVAL_MS = 60_000;
const BASE_PLAYBACK_INTERVAL_MS = 600;

export const PLAYBACK_SPEEDS = [1, 2, 3] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export function useRadarFrames() {
  const frames = ref<RadarFrame[]>([]);
  const bounds = ref<RadarBounds | null>(null);
  const selectedIndex = ref(0);
  const playing = ref(false);
  const speed = ref<PlaybackSpeed>(1);

  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let playbackTimer: ReturnType<typeof setInterval> | undefined;

  const currentFrame = computed(() => frames.value[selectedIndex.value]);
  const isLatest = computed(
    () => selectedIndex.value === frames.value.length - 1,
  );

  async function refreshFrames() {
    const res = await fetch("/api/frames");
    if (!res.ok) return;
    const next: RadarFrame[] = await res.json();
    if (next.length === 0) return;

    const wasAtLatest = isLatest.value || frames.value.length === 0;
    frames.value = next;
    if (wasAtLatest) {
      selectedIndex.value = frames.value.length - 1;
    } else {
      selectedIndex.value = Math.min(selectedIndex.value, frames.value.length - 1);
    }
  }

  async function refreshBounds() {
    if (bounds.value) return;
    const res = await fetch("/api/frames/bounds");
    if (!res.ok) return;
    bounds.value = await res.json();
  }

  function play() {
    if (frames.value.length <= 1) return;
    playing.value = true;
    clearInterval(playbackTimer);
    playbackTimer = setInterval(() => {
      selectedIndex.value = (selectedIndex.value + 1) % frames.value.length;
    }, BASE_PLAYBACK_INTERVAL_MS / speed.value);
  }

  function pause() {
    playing.value = false;
    clearInterval(playbackTimer);
  }

  function togglePlay() {
    if (playing.value) pause();
    else play();
  }

  function setSpeed(next: PlaybackSpeed) {
    speed.value = next;
    if (playing.value) play(); // restart the timer at the new interval
  }

  function selectIndex(index: number) {
    pause();
    selectedIndex.value = index;
  }

  onMounted(async () => {
    await Promise.all([refreshFrames(), refreshBounds()]);
    pollTimer = setInterval(refreshFrames, POLL_INTERVAL_MS);
  });

  onUnmounted(() => {
    clearInterval(pollTimer);
    clearInterval(playbackTimer);
  });

  return {
    frames,
    bounds,
    selectedIndex,
    currentFrame,
    isLatest,
    playing,
    speed,
    play,
    pause,
    togglePlay,
    selectIndex,
    setSpeed,
  };
}
