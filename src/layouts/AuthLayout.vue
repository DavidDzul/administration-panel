<template>
  <v-app>
    <v-main>
      <v-container :fluid="true" class="fill-height pa-0">
        <v-row no-gutters class="login__container fill-height" justify="center" align="center">
          <v-col class="login__screen" cols="12" md="6" lg="4">
            <v-card rounded="0" :flat="true" min-height="100%" class="d-flex flex-wrap">
              <v-card-text class="card-center">
                <h1 class="login__title mx-auto">Panel de Administración</h1>
                <router-view />
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
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
  </v-app>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAlertStore } from '@/stores/alert'
const { show, config } = storeToRefs(useAlertStore())
</script>
<style scoped lang="scss">
.login__container {
  min-height: 100svh;
}
.card-center {
  align-self: center;
}
.login__screen {
  display: flex;
  flex-direction: column;
  &-form {
    max-width: 350px;
  }
}
.login__title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 24px;
  text-align: center;
}
</style>
