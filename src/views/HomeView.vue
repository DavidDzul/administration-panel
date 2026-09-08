<template>
  <v-card class="pa-6" max-width="480">
    <v-card-title>Panel de Administración</v-card-title>
    <v-card-text>
      <p>Bienvenido/a, {{ fullName }}</p>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/api/authStore'

const { fullName } = storeToRefs(useAuthStore())
</script>
