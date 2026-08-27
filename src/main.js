import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

function showFatal(error) {
  console.error('[Nahui Skills]', error)
  let box = document.getElementById('nahui-runtime-error')
  if (!box) {
    box = document.createElement('pre')
    box.id = 'nahui-runtime-error'
    box.style.cssText = 'position:fixed;z-index:9999;left:1rem;right:1rem;bottom:1rem;max-height:45vh;overflow:auto;padding:1rem;border:2px solid #a21b15;border-radius:12px;background:#fff1ef;color:#78120d;white-space:pre-wrap;font:14px/1.45 Consolas,monospace;box-shadow:0 12px 40px #0005'
    document.body.appendChild(box)
  }
  box.textContent = `Nahui Skills encontró un error de ejecución:\n\n${error?.stack || error?.message || String(error)}`
}

const app = createApp(App)
app.config.errorHandler = error => showFatal(error)
window.addEventListener('error', event => showFatal(event.error || event.message))
window.addEventListener('unhandledrejection', event => showFatal(event.reason))
app.mount('#app')

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    navigator.serviceWorker.register('/sw.js').catch(showFatal)
  } else {
    navigator.serviceWorker.getRegistrations().then(items => items.forEach(item => item.unregister()))
    caches?.keys?.().then(keys => Promise.all(keys.filter(key => key.startsWith('nahui-')).map(key => caches.delete(key))))
  }
}
