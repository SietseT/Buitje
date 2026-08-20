/**
 * Frame timestamps are `YYYYMMDDHHmm` in **UTC** (KNMI publishes filenames in
 * UTC - confirmed against the API's own `created` field, see CLAUDE.md).
 * Parse as UTC, then format in the viewer's local timezone.
 *
 * Do not "simplify" this back to a substring slice like
 * `${ts.slice(8,10)}:${ts.slice(10,12)}` - that silently renders UTC and is
 * wrong by an hour or two for every Dutch visitor.
 *
 * Shared so the timeline and the place panel can't drift apart on it.
 */
export function parseFrameTimestamp(timestamp: string): Date {
  return new Date(
    Date.UTC(
      Number(timestamp.slice(0, 4)),
      Number(timestamp.slice(4, 6)) - 1,
      Number(timestamp.slice(6, 8)),
      Number(timestamp.slice(8, 10)),
      Number(timestamp.slice(10, 12)),
    ),
  );
}

export function formatFrameTime(timestamp: string): string {
  return parseFrameTimestamp(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
