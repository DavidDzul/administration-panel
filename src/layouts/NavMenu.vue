<template>
  <v-list density="compact" nav class="nav-list">
    <v-list-item to="/" title="Inicio" prepend-icon="mdi-home" class="nav-item" exact />

    <v-list-group v-if="can(PERMISSIONS.READ_USERS)" value="Usuarios">
      <template #activator="{ props }">
        <v-list-item
          v-bind="props"
          title="Usuarios"
          prepend-icon="mdi-account-multiple"
          class="nav-item"
        />
      </template>

      <v-list-item to="/becarios" title="Becarios y egresados" density="compact" class="nav-subitem" />
    </v-list-group>

    <!--
      D8 (sdd/becario-payment-file-generation/design): top-level group, NOT
      nested under "Control" — "Control" is administration-of-the-
      administration (who may do what); Pagos is operational domain work on
      becarios, peer to "Usuarios". Single-permission gate mirrors the
      Usuarios group's pattern exactly. Ordered before "Control" per the
      user-requested nav order: Inicio, Usuarios, Pagos, Control.
    -->
    <v-list-group v-if="can(PERMISSIONS.READ_PAYMENTS)" value="Pagos">
      <template #activator="{ props }">
        <v-list-item v-bind="props" title="Pagos" prepend-icon="mdi-cash-multiple" class="nav-item" />
      </template>

      <v-list-item to="/pagos" title="Lotes de pago" density="compact" class="nav-subitem" />
    </v-list-group>

    <v-list-group
      v-if="can(PERMISSIONS.READ_ROLES) || can(PERMISSIONS.READ_ADMINS)"
      value="Control"
    >
      <template #activator="{ props }">
        <v-list-item
          v-bind="props"
          title="Control"
          prepend-icon="mdi-shield-account"
          class="nav-item"
        />
      </template>

      <v-list-item
        v-if="can(PERMISSIONS.READ_ROLES)"
        to="/control/roles"
        title="Roles"
        density="compact"
        class="nav-subitem"
      />
      <v-list-item
        v-if="can(PERMISSIONS.READ_ADMINS)"
        to="/control/accesos"
        title="Accesos"
        density="compact"
        class="nav-subitem"
      />
    </v-list-group>
  </v-list>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/api/authStore'
import { PERMISSIONS } from '@/constants'

// Single sub-item under "Usuarios" (per spec's YAGNI resolution) — the group
// is gated directly off ADM_READ_USERS, with no separate group-level
// permission.
const { permissions } = storeToRefs(useAuthStore())

const can = (permission: string): boolean => permissions.value.includes(permission)
</script>

<style lang="scss" scoped>
.nav-list {
  margin-top: 4px;
  padding: 4px 8px;
}
:deep(.v-list) {
  background: transparent !important;
}
.nav-item {
  min-height: 40px !important;
  border-radius: 8px;
  transition: background 0.15s ease;
}
.nav-item :deep(.v-list-item-title) {
  font-size: 13px;
  font-weight: 500;
  color: #000000;
  transition: color 0.15s ease;
}
.nav-item :deep(.v-icon) {
  color: #000000;
  transition: color 0.15s ease;
}
.nav-item:hover {
  background: rgba(39, 95, 252, 0.06);
}
.nav-item:hover :deep(.v-list-item-title) {
  color: #275ffc;
}
.nav-item:hover :deep(.v-icon) {
  color: #275ffc;
}
.nav-subitem {
  padding-left: 36px !important;
  min-height: 34px !important;
  border-radius: 8px;
  transition: background 0.15s ease;
}
.nav-subitem :deep(.v-list-item-title) {
  font-size: 12.5px;
  font-weight: 400;
  color: #000000;
  transition: color 0.15s ease;
}
.nav-subitem:hover {
  background: rgba(39, 95, 252, 0.06);
}
.nav-subitem:hover :deep(.v-list-item-title) {
  color: #275ffc;
}

:deep(.v-list-group) {
  margin-bottom: 4px;
}

:deep(.v-list-item--active) {
  background: rgba(39, 95, 252, 0.08) !important;
  position: relative;
}
:deep(.v-list-item--active .v-list-item-title) {
  color: #275ffc !important;
  font-weight: 600;
}
:deep(.v-list-item--active .v-icon) {
  color: #275ffc !important;
}
:deep(.v-list-item--active)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: #275ffc;
}
:deep(.v-list-item:focus-visible) {
  outline: 2px solid #275ffc;
  outline-offset: -2px;
}
:deep(.v-list-item__overlay) {
  display: none;
}
</style>
