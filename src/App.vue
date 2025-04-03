<script setup lang="ts">
import { RouterView } from 'vue-router'
import { onBeforeMount, onMounted } from 'vue'
import MainNavBar from './components/MainNavBar.vue'

const version = import.meta.env.VITE_APP_VERSION

onMounted(async () => {})

onBeforeMount(async () => {})
</script>
<script lang="ts">
  export default {
    name: 'App',
    metaInfo: {
      // if no subcomponents specify a metaInfo.title, this title will be used
      title: 'Conway`\'s Game of Life',
      // all titles will be injected into this template
      titleTemplate: 'ARIANE | %s',
      htmlAttrs: {
        lang: 'fr',
      },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  }
</script>
<template>
  <v-app>
    <v-layout>
      <MainNavBar />
      <v-main app class="ms-2 fluid fill-height">
        <router-view />
      </v-main>
    </v-layout>
  </v-app>
</template>
