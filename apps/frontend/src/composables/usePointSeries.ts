import { ref, watch, type Ref } from "vue";
import type { RadarFrame } from "@/composables/useRadarFrames";

export interface PointSample {
  timestamp: string;
  /** null where the radar has no reading - draw a gap, not a dry value. */
  dbz: number | null;
}

/**
 * Reflectivity over the cached timeline at one coordinate, from
 * GET /api/point. The frontend only ever receives colorized PNGs, so this is
 * the only way it can say anything about a specific place.
 *
 * Refetches when the place changes or when a new frame lands (watching the
 * newest timestamp rather than the array identity, so the 60s poll returning
 * an unchanged list doesn't cause a refetch).
 */
export function usePointSeries(
  target: Ref<{ lat: number; lng: number } | null>,
  frames: Ref<RadarFrame[]>,
) {
  const points = ref<PointSample[]>([]);
  const loading = ref(false);

  // Switching places fast fires overlapping fetches that can resolve out of
  // order; only the most recently requested one may apply its result. Same
  // guard as RadarMap.vue's overlayRequestId.
  let requestId = 0;

  async function refresh(): Promise<void> {
    const place = target.value;
    if (!place || frames.value.length === 0) {
      points.value = [];
      return;
    }

    const id = ++requestId;
    loading.value = true;
    try {
      const res = await fetch(`/api/point?lat=${place.lat}&lon=${place.lng}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const { points: next } = (await res.json()) as { points: PointSample[] };
      if (id !== requestId) return; // superseded
      points.value = next;
    } catch {
      // Mirrors useRadarFrames: a failed fetch must never reject, or the
      // caller's setup stops at the await and the panel stays broken until a
      // manual reload. The next frame or place change retries naturally, and
      // App.vue's connection banner already covers a down backend.
      if (id === requestId) points.value = [];
    } finally {
      if (id === requestId) loading.value = false;
    }
  }

  watch(
    [target, () => frames.value[frames.value.length - 1]?.timestamp],
    refresh,
    { immediate: true },
  );

  return { points, loading };
}
