import { nextTick } from 'vue'
import { createI18n, type I18n } from 'vue-i18n'
import { useLocale } from 'vuetify'

const { current } = useLocale()

export const SUPPORT_LOCALES = ['en', 'fr']

export function setupI18n(options = { locale: 'fr' }) {
  const i18n = createI18n(options)
  setI18nLanguage(i18n, options.locale)
  return i18n
}

export function setI18nLanguage(i18n: I18n<{}, {}, {}, string, true>, locale: string) {
  current.value = locale
  i18n.global.locale = locale
  /**
   * NOTE:
   * If you need to specify the language setting for headers, such as the `fetch` API, set it here.
   * The following is an example for axios.
   *
   * axios.defaults.headers.common['Accept-Language'] = locale
   */
  document.querySelector('html')?.setAttribute('lang', locale)
}

export async function loadLocaleMessages(i18n: { global: { setLocaleMessage: (arg0: any, arg1: any) => void } }, locale: any) {
  // load locale messages with dynamic import
  const messages = await import(
    /* webpackChunkName: "locale-[request]" */ `./locales/${locale}.json`
  )

  // set locale and locale message
  i18n.global.setLocaleMessage(locale, messages.default)

  return nextTick()
}