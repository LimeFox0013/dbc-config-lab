import type { App } from 'vue'
import { createI18n } from 'vue-i18n'
import en from '../../locales/en.json'

export const setupVueI18n = (app: App): void => {
  app.use(
    createI18n({
      legacy: false,
      locale: 'en',
      fallbackLocale: 'en',
      messages: { en },
    }),
  )
}
