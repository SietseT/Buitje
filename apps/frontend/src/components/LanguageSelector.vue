<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { locale, type Locale } from "@/composables/useLocale";
import { useI18n } from "@/i18n/messages";

const { t } = useI18n();

const options: { value: Locale; label: string }[] = [
  { value: "nl", label: "NL" },
  { value: "en", label: "EN" },
];
</script>

<template>
  <div class="flex items-center justify-between gap-3">
    <span class="text-sm text-muted-foreground">{{ t("settings.language") }}</span>
    <div class="flex gap-1 rounded-md bg-muted p-1">
      <Button
        v-for="opt in options"
        :key="opt.value"
        size="sm"
        class="font-mono"
        :variant="locale === opt.value ? 'default' : 'ghost'"
        @click="locale = opt.value"
      >
        {{ opt.label }}
      </Button>
    </div>
  </div>
</template>
