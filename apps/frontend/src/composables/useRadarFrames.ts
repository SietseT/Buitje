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
const RECONNECT_INTERVAL_MS = 5_000;
// Halved from 600 so each speed tier maps to what used to be one tier
// faster (0.5x now plays at the old 1x rate, 1x at the old 2x rate), with
// 2x landing at twice the old 2x rate.
const BASE_PLAYBACK_INTERVAL_MS = 300;
const PAUSE_AT_END_MS = 2000;

export const PLAYBACK_SPEEDS = [0.5, 1, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export function useRadarFrames() {
  const frames = ref<RadarFrame[]>([]);
  const bounds = ref<RadarBounds | null>(null);
  const selectedIndex = ref(0);
  const playing = ref(false);
  const speed = ref<PlaybackSpeed>(1);
  // Surfaced to the UI so a temporarily-unreachable backend is visible
  // instead of the map just silently going stale with no explanation.
  const connected = ref(true);

  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let playbackTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const currentFrame = computed(() => frames.value[selectedIndex.value]);
  const isLatest = computed(
    () => selectedIndex.value === frames.value.length - 1,
  );

  // Retries sooner than the normal POLL_INTERVAL_MS while disconnected, so
  // the app recovers quickly once the backend is reachable again instead of
  // waiting up to a full minute for the next scheduled poll.
  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = undefined;
      await Promise.all([refreshFrames(), refreshBounds()]);
    }, RECONNECT_INTERVAL_MS);
  }

  async function refreshFrames() {
    try {
      const res = await fetch("/api/frames");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const next: RadarFrame[] = await res.json();
      connected.value = true;
      if (next.length === 0) return;

      const hadNoFrames = frames.value.length === 0;
      const wasAtLatest = isLatest.value || hadNoFrames;
      frames.value = next;
      if (wasAtLatest) {
        selectedIndex.value = frames.value.length - 1;
      } else {
        selectedIndex.value = Math.min(selectedIndex.value, frames.value.length - 1);
      }
      // Covers both the normal first load and recovering from a previous
      // total failure - either way, frames just went from none to some.
      if (hadNoFrames) play();
    } catch {
      connected.value = false;
      scheduleReconnect();
    }
  }

  async function refreshBounds() {
    if (bounds.value) return;
    try {
      const res = await fetch("/api/frames/bounds");
      if (!res.ok) throw new Error(`status ${res.status}`);
      bounds.value = await res.json();
      connected.value = true;
    } catch {
      connected.value = false;
      scheduleReconnect();
    }
  }

  // The extra dwell only applies when playback organically arrives at the
  // last frame on its own. A manual play/pause (or speed change) always
  // resumes at normal speed, even if parked on the last frame - it
  // shouldn't re-apply a pause the user just took control past.
  function scheduleNextFrame(allowEndPause: boolean) {
    const atLastFrame = selectedIndex.value === frames.value.length - 1;
    const delay = atLastFrame && allowEndPause ? PAUSE_AT_END_MS : BASE_PLAYBACK_INTERVAL_MS / speed.value;
    playbackTimer = setTimeout(() => {
      selectedIndex.value = (selectedIndex.value + 1) % frames.value.length;
      scheduleNextFrame(true);
    }, delay);
  }

  function play() {
    if (frames.value.length <= 1) return;
    playing.value = true;
    clearTimeout(playbackTimer);
    scheduleNextFrame(false);
  }

  function pause() {
    playing.value = false;
    clearTimeout(playbackTimer);
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
    // Neither call throws anymore (failures are caught internally and
    // retried via scheduleReconnect), so this always resolves and playback
    // setup always runs - even if the very first fetch fails.
    await Promise.all([refreshFrames(), refreshBounds()]);
    pollTimer = setInterval(refreshFrames, POLL_INTERVAL_MS);
  });

  onUnmounted(() => {
    clearInterval(pollTimer);
    clearTimeout(playbackTimer);
    clearTimeout(reconnectTimer);
  });

  return {
    frames,
    bounds,
    selectedIndex,
    currentFrame,
    isLatest,
    playing,
    speed,
    connected,
    play,
    pause,
    togglePlay,
    selectIndex,
    setSpeed,
  };
}
