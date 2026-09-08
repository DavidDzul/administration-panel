<template>
  <v-list density="compact" nav class="nav-list">
    <v-list-item to="/" title="Inicio" prepend-icon="mdi-home" class="nav-item" exact />
  </v-list>
</template>

<script setup lang="ts"></script>

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
