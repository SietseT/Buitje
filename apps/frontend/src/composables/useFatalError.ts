import { ref } from "vue";

// Module-level (not per-component) since it's set from Vue's global
// app.config.errorHandler in main.ts, outside any component instance.
export const fatalError = ref(false);

export function reportFatalError(err: unknown, info?: string): void {
  console.error("[fatal]", err, info);
  fatalError.value = true;
}
