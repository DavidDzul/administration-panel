<template>
  <v-form class="login__screen-form mx-auto text-center">
    <v-text-field
      v-model="email"
      label="Correo electrónico"
      prepend-inner-icon="mdi-account"
      @update:model-value="email = email?.replace(/\s/g, '')"
    ></v-text-field>
    <v-text-field
      v-model="password"
      label="Contraseña"
      :append-inner-icon="show ? 'mdi-eye' : 'mdi-eye-off'"
      :type="show ? 'text' : 'password'"
      @click:append-inner="show = !show"
      prepend-inner-icon="mdi-lock"
    ></v-text-field>
    <v-btn class="mt-3" color="primary" @click="onLogin" :loading="loading"
      >INICIAR SESIÓN</v-btn
    >
  </v-form>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref } from 'vue'

import { useLoginPageStore } from '@/stores/views/loginPage'

const { onLogin } = useLoginPageStore()
const { email, password, loading } = storeToRefs(useLoginPageStore())

const show = ref(false)
</script>
