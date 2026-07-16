import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { reportFatalError } from '@/composables/useFatalError'

const app = createApp(App)
app.config.errorHandler = (err, _instance, info) => reportFatalError(err, info)
app.mount('#app')
