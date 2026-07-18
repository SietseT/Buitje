<script setup lang="ts">
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { showLightning } from "@/composables/useLightningToggle";
import { useI18n } from "@/i18n/messages";

const { t } = useI18n();

// computed (not a plain array) so the labels re-translate when the locale
// changes - a plain array built from t() at setup time would freeze the
// labels in whichever language was active on first render.
const options = computed(() => [
  { value: true, label: t("lightning.on") },
  { value: false, label: t("lightning.off") },
]);
</script>

<template>
  <div class="flex items-center justify-between gap-3">
    <span class="text-sm text-muted-foreground">{{ t("lightning.label") }}</span>
    <div class="flex gap-1 rounded-md bg-muted p-1">
      <Button
        v-for="opt in options"
        :key="String(opt.value)"
        size="sm"
        class="font-mono"
        :variant="showLightning === opt.value ? 'default' : 'ghost'"
        @click="showLightning = opt.value"
      >
        {{ opt.label }}
      </Button>
    </div>
  </div>
</template>
