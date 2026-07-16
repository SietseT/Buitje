import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import ColorTuner from './pages/ColorTuner.vue'
import { reportFatalError } from '@/composables/useFatalError'

const useTuner = import.meta.env.DEV && location.pathname === '/admin/colors'

const app = createApp(useTuner ? ColorTuner : App)
app.config.errorHandler = (err, _instance, info) => reportFatalError(err, info)
app.mount('#app')
