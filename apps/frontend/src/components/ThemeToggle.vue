<script setup lang="ts">
import { Sun, Moon } from "@lucide/vue";
import { theme } from "@/composables/useTheme";
import { useI18n } from "@/i18n/messages";

// Theme sits with the app identity, not on the map rail: it changes the
// appearance of the app itself, not what the map is showing. Same segmented
// anatomy the app has always used for its two-way choices.
const { t } = useI18n();
</script>

<template>
  <div class="flex gap-1 rounded-lg bg-muted p-1">
    <button
      type="button"
      class="flex h-6 w-7 items-center justify-center rounded-md transition-colors"
      :class="theme === 'light' ? 'bg-primary text-primary-foreground' : 'hover:bg-background/60'"
      :aria-label="t('theme.light')"
      :aria-pressed="theme === 'light'"
      @click="theme = 'light'"
    >
      <Sun class="size-3.5" />
    </button>
    <button
      type="button"
      class="flex h-6 w-7 items-center justify-center rounded-md transition-colors"
      :class="theme === 'dark' ? 'bg-primary text-primary-foreground' : 'hover:bg-background/60'"
      :aria-label="t('theme.dark')"
      :aria-pressed="theme === 'dark'"
      @click="theme = 'dark'"
    >
      <Moon class="size-3.5" />
    </button>
  </div>
</template>
