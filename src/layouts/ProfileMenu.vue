<template>
  <v-menu :close-on-content-click="false">
    <template #activator="{ props }">
      <v-btn icon class="mr-0 profile-trigger" v-bind="props">
        <v-avatar color="accent" class="profile-avatar">
          <span class="text-h6">{{ initials }}</span>
        </v-avatar>
      </v-btn>
    </template>

    <v-card min-width="280" rounded="lg" elevation="8" class="profile-card">
      <div class="profile-head">
        <v-avatar color="accent" size="48">
          <span class="text-h6">{{ initials }}</span>
        </v-avatar>
        <div class="profile-id">
          <span class="profile-name">{{ fullName }}</span>
          <span class="profile-email">{{ user.email }}</span>
        </div>
      </div>

      <div class="profile-chips" v-if="roleLabel || user.workstation">
        <v-chip v-if="roleLabel" size="x-small" variant="tonal" color="secondary">{{
          roleLabel
        }}</v-chip>
        <v-chip v-if="user.workstation" size="x-small" variant="outlined">{{
          user.workstation
        }}</v-chip>
      </div>

      <v-divider class="my-2" />
      <v-list density="compact" nav>
        <v-list-item
          prepend-icon="mdi-logout"
          title="Cerrar sesión"
          class="logout-item"
          @click="$emit('logout')"
        />
      </v-list>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { UserProfile } from '@/interfaces/user'

const props = defineProps<{
  initials: string
  fullName: string
  user: UserProfile
}>()

defineEmits(['logout'])

const roleLabel = computed(() => props.user.roles?.[0]?.name ?? '')
</script>

<style lang="scss" scoped>
.profile-avatar {
  border: 2px solid transparent;
  background-color: black;
  color: white;
  transition: border-color 0.18s ease;
}
.profile-trigger:hover .profile-avatar,
.profile-trigger:focus-visible .profile-avatar {
  border-color: rgba(54, 54, 52, 0.5);
}
.profile-card {
  overflow: hidden;
}
.profile-head {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 16px;
}
.profile-id {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.profile-name {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.profile-email {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.profile-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 16px 8px;
}
.logout-item {
  color: rgb(var(--v-theme-error));
}
:deep(.logout-item .v-icon) {
  color: rgb(var(--v-theme-error));
}
</style>
