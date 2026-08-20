<script setup lang="ts">
import { Plus } from "@lucide/vue";
import PlaceRow from "@/components/PlaceRow.vue";
import type { Place } from "@/composables/usePlaces";
import type { RadarFrame } from "@/composables/useRadarFrames";
import { useI18n } from "@/i18n/messages";

defineProps<{
  places: Place[];
  selectedId: string | null;
  frames: RadarFrame[];
}>();

const emit = defineEmits<{
  add: [];
  select: [id: string];
  remove: [id: string];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {{ t("places.title") }}
      </span>
      <button
        type="button"
        class="flex h-7 items-center gap-1.5 rounded-lg bg-muted px-2.5 text-xs font-medium hover:bg-muted/70"
        @click="emit('add')"
      >
        <Plus class="size-3.5" />
        {{ t("places.add") }}
      </button>
    </div>

    <ul class="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
      <PlaceRow
        v-for="place in places"
        :key="place.id"
        :place="place"
        :frames="frames"
        :selected="place.id === selectedId"
        @select="emit('select', place.id)"
        @remove="emit('remove', place.id)"
      />
    </ul>
  </div>
</template>
