import { createApp } from 'vue'
import { createI18n, useI18n } from 'vue-i18n'
import { createHead } from '@unhead/vue/client'

import App from './App.vue'
import router from '@/router'

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { createVueI18nAdapter } from 'vuetify/locale/adapters/vue-i18n'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'

/*
 * All i18n resources specified in the plugin `include` option can be loaded
 * at once using the import syntax
 */
import messages from '@intlify/unplugin-vue-i18n/messages'

// Import our custom CSS
import './assets/style.scss'

const i18n = createI18n({
    legacy: false,
    locale: 'fr',
    fallbackLocale: [ 'fr', 'en' ],
    globalInjection: true,
    messages,
})

const vuetify = createVuetify({
    components,
    directives,
    theme: {
        defaultTheme: 'dark',
    },
    locale: {
        adapter: createVueI18nAdapter({ i18n, useI18n }),
    },
    icons: {
        defaultSet: 'mdi',
    },
})
const head = createHead()

const app = createApp(App)
    .use(router)
    .use(i18n)
    .use(vuetify)
    .use(head)
    .mount('#app')

export default app