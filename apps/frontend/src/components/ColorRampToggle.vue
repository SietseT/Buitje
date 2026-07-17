<script setup lang="ts">
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { smoothColorRamp } from "@/composables/useSmoothColorRamp";
import { useI18n } from "@/i18n/messages";

const { t } = useI18n();

// computed (not a plain array) so the labels re-translate when the locale
// changes - a plain array built from t() at setup time would freeze the
// labels in whichever language was active on first render.
const options = computed(() => [
  { value: true, label: t("colorRamp.smooth") },
  { value: false, label: t("colorRamp.hard") },
]);
</script>

<template>
  <div class="flex items-center justify-between gap-3">
    <span class="text-sm text-muted-foreground">{{ t("colorRamp.label") }}</span>
    <div class="flex gap-1 rounded-md bg-muted p-1">
      <Button
        v-for="opt in options"
        :key="String(opt.value)"
        size="sm"
        class="font-mono"
        :variant="smoothColorRamp === opt.value ? 'default' : 'ghost'"
        @click="smoothColorRamp = opt.value"
      >
        {{ opt.label }}
      </Button>
    </div>
  </div>
</template>
