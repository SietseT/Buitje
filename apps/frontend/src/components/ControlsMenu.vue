<script setup lang="ts">
import { ref } from "vue";
import { Menu } from "@lucide/vue";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import LanguageSelector from "@/components/LanguageSelector.vue";
import MarkerPanel from "@/components/MarkerPanel.vue";
import type { Marker } from "@/composables/useMarkers";
import { useI18n } from "@/i18n/messages";

defineProps<{
  markers: Marker[];
}>();

const emit = defineEmits<{
  add: [];
  deleteMarker: [id: string];
  flyTo: [lng: number, lat: number];
}>();

const { t } = useI18n();

// Explicitly closing on these two actions (rather than relying on the
// popover's own outside-click dismissal) means the menu is out of the way
// the instant the user needs to look at the map - both to click a spot for
// a new marker, and to see it fly to an existing one.
const open = ref(false);

function handleAdd() {
  open.value = false;
  emit("add");
}

function handleFlyTo(lng: number, lat: number) {
  open.value = false;
  emit("flyTo", lng, lat);
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        class="flex items-center justify-center rounded-xl bg-white/90 p-3 text-foreground shadow-lg backdrop-blur hover:bg-white dark:bg-neutral-900/90 dark:hover:bg-neutral-900"
        :aria-label="t('menu.openLabel')"
      >
        <Menu class="size-4" />
      </button>
    </PopoverTrigger>

    <PopoverContent side="bottom" align="start" class="w-64">
      <LanguageSelector />
      <div class="mt-2 border-t border-border pt-2">
        <MarkerPanel
          :markers="markers"
          @add="handleAdd"
          @delete-marker="(id) => emit('deleteMarker', id)"
          @fly-to="handleFlyTo"
        />
      </div>
    </PopoverContent>
  </Popover>
</template>
