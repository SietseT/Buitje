import { ref } from "vue";

interface MetaResponse {
  githubUrl: string | null;
}

// Server-side deployment setting (unlike smoothColorRamp/showLightning,
// which are per-browser localStorage preferences) - a self-hoster sets
// GITHUB_URL for every visitor, not per-tab, so it has to come from the
// backend rather than live in localStorage.
export const githubUrl = ref<string | null>(null);

fetch("/api/meta")
  .then((res) => (res.ok ? (res.json() as Promise<MetaResponse>) : null))
  .then((data) => {
    if (data) githubUrl.value = data.githubUrl;
  })
  .catch(() => {
    // Cosmetic-only - stays hidden on a failed/unreachable backend rather
    // than retrying like useRadarFrames does for the actual radar data.
  });
