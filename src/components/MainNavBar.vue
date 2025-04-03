<script setup lang="ts">
import { onMounted, onBeforeMount } from 'vue'
import { useLocale, useTheme } from 'vuetify'

onMounted(() => {
});

const { t } = useLocale()
const theme = useTheme()

function toggleTheme() {
  theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark'
}

onBeforeMount(() => {
})

onMounted(() => {
})
</script>

<template>
  <v-app-bar prominent density="compact">
    <template v-slot:prepend>
      <v-app-bar-nav-icon icon="mdi-cube-unfolded" :to="{ path: '/' }"></v-app-bar-nav-icon>
    </template>
    <v-app-bar-title>
      {{ t('apptitle') }}
    </v-app-bar-title>
    <v-spacer></v-spacer>
    <v-btn icon>
      <v-icon @click="toggleTheme">mdi-theme-light-dark</v-icon>
    </v-btn>
  </v-app-bar>
</template>