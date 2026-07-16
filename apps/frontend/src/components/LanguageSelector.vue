<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { locale, type Locale } from "@/composables/useLocale";

const options: { value: Locale; label: string }[] = [
  { value: "nl", label: "NL" },
  { value: "en", label: "EN" },
];
</script>

<template>
  <div class="flex w-40 gap-1 rounded-md bg-muted p-1">
    <Button
      v-for="opt in options"
      :key="opt.value"
      size="sm"
      class="flex-1 font-mono"
      :variant="locale === opt.value ? 'default' : 'ghost'"
      @click="locale = opt.value"
    >
      {{ opt.label }}
    </Button>
  </div>
</template>
