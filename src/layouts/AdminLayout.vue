<template>
  <v-layout id="app">
    <v-app-bar :color="'appbar'" border="b" :elevation="0" height="60" :order="0">
      <v-app-bar-nav-icon @click="onClick"></v-app-bar-nav-icon>

      <div class="brand-inline">
        <span class="brand-name">Panel de Administración</span>
      </div>

      <v-spacer></v-spacer>

      <ProfileMenu
        v-if="userProfile"
        :user="userProfile"
        :initials="userInitials"
        :full-name="fullName"
        @logout="logout"
      />
    </v-app-bar>
    <v-navigation-drawer
      v-model="drawer"
      :permanent="!mobile"
      width="280"
      style="background-color: #ffffff"
    >
      <NavMenu />
    </v-navigation-drawer>

    <v-main>
      <v-container class="container__main" :fluid="true">
        <router-view />
      </v-container>
    </v-main>
    <v-snackbar
      v-model="show"
      :timeout="7000"
      :location="'right top'"
      :close-on-content-click="true"
      :color="config.status"
      :vertical="true"
    >
      <div class="d-flex">
        <v-icon class="mt-1 mr-2" v-if="config?.icon" :icon="config.icon"></v-icon>
        <div>
          <div class="text-subtitle-1 font-weight-bold">{{ config.title }}</div>
          <p>{{ config?.body }}</p>
        </div>
      </div>
    </v-snackbar>
  </v-layout>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useDisplay } from 'vuetify'

import { useAuthStore } from '@/stores/api/authStore'
import { useAlertStore } from '@/stores/alert'

import ProfileMenu from '@/layouts/ProfileMenu.vue'
import NavMenu from '@/layouts/NavMenu.vue'

const { userProfile, userInitials, fullName } = storeToRefs(useAuthStore())
const { logout } = useAuthStore()
const { show, config } = storeToRefs(useAlertStore())

const { mobile } = useDisplay()
const drawer = ref(!mobile.value)

const onClick = () => {
  drawer.value = !drawer.value
}
</script>
<style lang="scss" scoped>
.container__main {
  height: calc(100svh - var(--v-layout-top));
  overflow-y: auto;
  padding-top: 8px;
}
:deep(.v-navigation-drawer) {
  border-right: 1px solid rgba(0, 0, 0, 0.07) !important;
}
.brand-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
}
.brand-name {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}
</style>
