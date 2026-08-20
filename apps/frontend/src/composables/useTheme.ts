import { ref, watch } from "vue";

export type Theme = "light" | "dark";

const STORAGE_KEY = "buitje:theme";

/**
 * Dark mode is a deliberate switch, not a permanent follow of the OS: the
 * system preference only seeds the FIRST visit. Once the user picks a side
 * it is remembered and the OS no longer overrides it - matching how every
 * other preference here behaves (useSmoothColorRamp, useLightningToggle).
 */
function readInitial(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const theme = ref<Theme>(readInitial());

// style.css declares `@custom-variant dark (&:is(.dark *))` plus a full
// `.dark` token block, so putting the class on <html> is all that's needed -
// every dark: utility and every token override keys off it.
function apply(value: Theme): void {
  document.documentElement.classList.toggle("dark", value === "dark");
}

apply(theme.value);

watch(theme, (value) => {
  localStorage.setItem(STORAGE_KEY, value);
  apply(value);
});

export function toggleTheme(): void {
  theme.value = theme.value === "dark" ? "light" : "dark";
}
