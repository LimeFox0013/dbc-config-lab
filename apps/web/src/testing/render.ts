import { createSSRApp, h } from 'vue'
import type { Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createI18n } from 'vue-i18n'
import en from '@dbc-config-lab/core/locales/en.json'

/** Renders a component to HTML as the page would, with the site's English copy. */
export const renderComponent = (
  component: Component,
  props: Record<string, unknown>,
): Promise<string> => {
  const app = createSSRApp({ render: () => h(component, props) })
  app.use(createI18n({ legacy: false, locale: 'en', messages: { en } }))
  return renderToString(app)
}
