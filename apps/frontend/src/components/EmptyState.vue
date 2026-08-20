<script setup lang="ts">
import { LocateFixed, MapPin, LoaderCircle } from "@lucide/vue";
import { locating, locationFailed, requestLocate } from "@/composables/useUserLocation";
import { useI18n } from "@/i18n/messages";

// The first thing a new visitor sees, so it reads as an invitation rather
// than an error: the map behind is already a working national rain radar,
// only the personalised answer is missing.
const emit = defineEmits<{
  pickOnMap: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-col gap-1.5">
      <span class="text-xl leading-tight font-semibold tracking-tight">{{ t("empty.title") }}</span>
      <span class="text-sm text-pretty text-muted-foreground">
        {{ locationFailed ? t("location.deniedHint") : t("empty.body") }}
      </span>
    </div>

    <div class="flex flex-col gap-2 sm:flex-row">
      <!-- Kept behind an explicit press rather than firing on load: browsers
           treat a permission prompt from a real user gesture far more kindly,
           and an unprompted one on first paint is the classic way to get
           permanently blocked. -->
      <button
        type="button"
        class="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        :disabled="locating"
        @click="requestLocate()"
      >
        <LoaderCircle v-if="locating" class="size-4 animate-spin" />
        <LocateFixed v-else class="size-4" />
        {{ locating ? t("empty.locating") : t("empty.useLocation") }}
      </button>

      <button
        type="button"
        class="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-muted px-4 text-sm font-medium hover:bg-muted/70"
        @click="emit('pickOnMap')"
      >
        <MapPin class="size-4" />
        {{ t("empty.pickOnMap") }}
      </button>
    </div>
  </div>
</template>
