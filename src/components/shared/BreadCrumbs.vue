<template>
  <v-breadcrumbs :items="items" density="compact" class="px-0 py-1 breadcrumbs">
    <template #divider>
      <span class="divider">/</span>
    </template>
    <template #item="{ item }">
      <v-breadcrumbs-item
        :to="item.href"
        :disabled="item.disabled"
        :exact="true"
        active-color="primary"
        :title="item.title"
        class="breadcrumb-item"
      />
    </template>
  </v-breadcrumbs>
</template>

<script setup lang="ts">
import type { LinkInterface } from '@/interfaces/link'

interface Props {
  items?: LinkInterface[]
}

withDefaults(defineProps<Props>(), {
  items: () => [],
})
</script>

<style scoped>
.breadcrumbs {
  min-height: unset;
}
.breadcrumb-item {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.9;
  padding: 0 2px;
}
.divider {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.35);
  margin: 0 2px;
}
</style>
