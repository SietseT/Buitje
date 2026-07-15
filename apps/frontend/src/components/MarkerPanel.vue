<script setup lang="ts">
import { MapPin, Plus, X } from "@lucide/vue";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <button
        type="button"
        class="flex shrink-0 items-center justify-center rounded-xl bg-white/90 px-4 py-3 text-foreground shadow-lg backdrop-blur hover:bg-white dark:bg-neutral-900/90 dark:hover:bg-neutral-900"
        :aria-label="t('markers.panelTitle')"
      >
        <MapPin class="size-4" />
      </button>
    </PopoverTrigger>

    <PopoverContent side="top" align="center" class="w-64">
      <button
        type="button"
        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-muted"
        @click="emit('add')"
      >
        <Plus class="size-4" />
        {{ t("markers.add") }}
      </button>

      <div v-if="markers.length === 0" class="px-2 py-1 text-sm text-muted-foreground">
        {{ t("markers.empty") }}
      </div>

      <ul v-else class="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
        <li
          v-for="marker in markers"
          :key="marker.id"
          class="group flex items-center gap-1 rounded-md hover:bg-muted"
        >
          <button
            type="button"
            class="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm"
            @click="emit('flyTo', marker.lng, marker.lat)"
          >
            {{ marker.label }}
          </button>
          <button
            type="button"
            class="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-destructive"
            :aria-label="t('markers.delete')"
            @click="emit('deleteMarker', marker.id)"
          >
            <X class="size-3.5" />
          </button>
        </li>
      </ul>
    </PopoverContent>
  </Popover>
</template>
