import { createApp } from 'vue'
import App from './App.vue'
import { setupBuffer } from './plugins/buffer'
import { setupVueI18n } from './plugins/vue-i18n'
import { setupRouter } from './router'
import './styles/main.scss'

setupBuffer()

const app = createApp(App)
setupVueI18n(app)
setupRouter(app)
app.mount('#app')
