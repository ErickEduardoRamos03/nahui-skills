// ============================================================
// RUTA EN TU PROYECTO: src/composables/useVoice.js
// (reemplaza el archivo que ya existe ahí)
//
// INSTALACIÓN: ninguna. Usa Vue, que ya está en tu proyecto.
// No necesita npm install de nada nuevo.
// ============================================================
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const US_KEY = 'nahui-voice-en-US'
const GB_KEY = 'nahui-voice-en-GB'
const SAMPLE = {
  'en-US': 'I parked the car near the water fountain, and I will call you later.',
  'en-GB': 'I parked the car near the water fountain, and I will call you later.'
}

// Fuera del composable a propósito: si el utterance solo vive dentro de
// speak(), Chrome/Brave lo pueden recolectar como basura antes de terminar
// de hablar y el audio simplemente no suena, sin ningún error visible.
let activeUtterance = null
let keepAliveTimer = null

// Mismo motivo que activeUtterance: un <audio> creado con `new Audio()`
// que no se agrega al DOM y no vive en ningún lado más que dentro de
// playAudio() puede ser recolectado por el GC a mitad de la reproducción
// (Chrome/Brave). Por eso lo guardamos aquí afuera, igual que el utterance.
let activeAudio = null

function startKeepAlive() {
  if (keepAliveTimer) return
  // Chrome/Brave (mismo motor Chromium) "atoran" speechSynthesis si lleva
  // ~15s hablando sin pausa. Pausar/reanudar cada 10s lo mantiene vivo.
  keepAliveTimer = setInterval(() => {
    if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.pause()
      window.speechSynthesis.resume()
    }
  }, 10000)
}
function stopKeepAlive() {
  clearInterval(keepAliveTimer)
  keepAliveTimer = null
}

export function useVoice() {
  const voices = ref([])
  const usVoiceURI = ref(localStorage.getItem(US_KEY) || '')
  const gbVoiceURI = ref(localStorage.getItem(GB_KEY) || '')
  const status = ref('')
  const error = ref('')

  const englishVoices = computed(() => voices.value.filter(v => /^en[-_]/i.test(v.lang)))
  const usVoices = computed(() => rank(englishVoices.value.filter(v => /^en[-_]US/i.test(v.lang)), 'en-US'))
  const gbVoices = computed(() => rank(englishVoices.value.filter(v => /^en[-_]GB/i.test(v.lang)), 'en-GB'))
  const selectedUS = computed(() => usVoices.value.find(v => v.voiceURI === usVoiceURI.value) || usVoices.value[0])
  const selectedGB = computed(() => gbVoices.value.find(v => v.voiceURI === gbVoiceURI.value) || gbVoices.value[0])

  function voiceScore(v, locale) {
    const name = `${v.name} ${v.voiceURI}`
    let score = 0
    // Brave bloquea por defecto las voces "en línea" de Google (las manda
    // por privacidad/Shields), así que ya no dependemos de eso para elegir
    // una voz decente: seguimos premiándolas si existen, pero no son
    // obligatorias para que algo suene.
    if (/Natural|Neural|Online/i.test(name)) score += 100
    if (/Aria|Jenny|Guy|Ava|Andrew|Emma|Brian|Sonia|Ryan|Libby|Thomas/i.test(name)) score += 60
    if (/Microsoft|Google|Apple/i.test(name)) score += 25
    if (v.lang?.toLowerCase() === locale.toLowerCase()) score += 20
    if (v.localService === false) score += 10
    if (/David|Zira|Mark|Hazel|Desktop|eSpeak/i.test(name)) score -= 35
    return score
  }

  function rank(list, locale) {
    return [...list].sort((a, b) => voiceScore(b, locale) - voiceScore(a, locale) || a.name.localeCompare(b.name))
  }

  function load() {
    if (!('speechSynthesis' in window)) {
      error.value = 'Este navegador no ofrece síntesis de voz.'
      return
    }
    voices.value = window.speechSynthesis.getVoices()
    if (!usVoices.value.some(v => v.voiceURI === usVoiceURI.value)) usVoiceURI.value = usVoices.value[0]?.voiceURI || ''
    if (!gbVoices.value.some(v => v.voiceURI === gbVoiceURI.value)) gbVoiceURI.value = gbVoices.value[0]?.voiceURI || ''
  }

  function selectedFor(locale) {
    return locale.toLowerCase().startsWith('en-gb') ? selectedGB.value : selectedUS.value
  }

  function speakNow(text, locale, rate) {
    const selected = selectedFor(locale)
    // Ya NO bloqueamos si no hay una voz EXACTA guardada para ese locale:
    // dejamos que el navegador use su voz por defecto vía utterance.lang.
    // Esto es clave en Brave/Linux, donde a veces solo hay una voz local
    // "genérica" y ni siquiera trae en-GB por separado.
    if (!selected) {
      error.value = `No encontré una voz instalada para ${locale}; usando la voz por defecto del navegador.`
    }
    const utterance = new SpeechSynthesisUtterance(text)
    if (selected) utterance.voice = selected
    utterance.lang = selected?.lang || locale
    utterance.rate = rate
    utterance.pitch = locale.toLowerCase().startsWith('en-gb') ? 1.02 : 0.98
    utterance.volume = 1

    status.value = `Reproduciendo ${locale}: ${selected ? `${selected.name} (${selected.lang})` : 'voz por defecto'}`

    utterance.onerror = event => {
      error.value = `No se pudo reproducir la voz: ${event.error || 'error desconocido'}`
      status.value = ''
      activeUtterance = null
      stopKeepAlive()
    }
    utterance.onend = () => {
      status.value = ''
      activeUtterance = null
      stopKeepAlive()
    }

    // Referencia viva fuera del scope de la función: evita el GC prematuro
    // del utterance en Chrome/Brave (motor Chromium compartido).
    activeUtterance = utterance
    window.speechSynthesis.speak(utterance)
    startKeepAlive()
  }

  function speak(text, locale = 'en-US', rate = 0.9) {
    error.value = ''
    if (!('speechSynthesis' in window)) {
      error.value = 'Síntesis de voz no disponible en este navegador.'
      return
    }
    load()
    const wasBusy = window.speechSynthesis.speaking || window.speechSynthesis.pending
    window.speechSynthesis.cancel()
    // cancel() no es instantáneo puertas adentro: si había algo sonando,
    // esperamos un tick antes de mandar el nuevo utterance o el motor
    // (Chrome y Brave por igual) se lo puede comer en silencio.
    if (wasBusy) {
      setTimeout(() => speakNow(text, locale, rate), 60)
    } else {
      speakNow(text, locale, rate)
    }
  }

  function preview(locale) {
    speak(SAMPLE[locale], locale, 0.88)
  }

  // playAudio(id, locale, fallbackText, rate?)
  // Intenta reproducir un mp3 pregrabado de public/audio/<id>-<us|gb>.mp3.
  // Vite publica esa carpeta bajo BASE_URL, no necesariamente en la raíz del
  // dominio (por ejemplo, GitHub Pages sirve el proyecto bajo /nahui-skills/).
  // (generado por scripts/generate_audio.py). Si no existe todavía —por
  // ejemplo, agregaste contenido nuevo y aún no corriste el script—, cae
  // de regreso a speechSynthesis con fallbackText para que nunca se quede
  // mudo. Esto suena IDÉNTICO en cualquier navegador porque un <audio>
  // reproduciendo un mp3 no depende de qué voces trae el sistema.
  function playAudio(id, locale, fallbackText, rate = 0.9) {
    error.value = ''
    const suffix = locale.toLowerCase().startsWith('en-gb') ? 'gb' : 'us'
    const src = `${import.meta.env.BASE_URL}audio/${encodeURIComponent(id)}-${suffix}.mp3`

    // Si ya había un audio pregrabado sonando, lo detenemos y soltamos la
    // referencia anterior antes de arrancar el nuevo.
    if (activeAudio) {
      activeAudio.pause()
      activeAudio.onended = null
      activeAudio.onerror = null
      activeAudio = null
    }

    const audio = new Audio(src)
    // Referencia viva fuera del scope de la función: evita el GC prematuro
    // del <audio> en Chrome/Brave, igual que hacemos con activeUtterance.
    activeAudio = audio

    status.value = `Reproduciendo ${locale}: audio pregrabado`
    audio.onended = () => { status.value = ''; activeAudio = null }
    audio.onerror = () => {
      // No existe el archivo (404) u otro problema de reproducción:
      // nos vamos al plan B con síntesis en vivo, sin molestar al usuario.
      status.value = ''
      activeAudio = null
      if (fallbackText) speak(fallbackText, locale, rate)
    }
    audio.play().catch(() => {
      status.value = ''
      activeAudio = null
      if (fallbackText) speak(fallbackText, locale, rate)
    })
  }

  function previewContrast() {
    speak(SAMPLE['en-US'], 'en-US', 0.88)
    setTimeout(() => speak(SAMPLE['en-GB'], 'en-GB', 0.88), 5200)
  }

  watch(usVoiceURI, value => localStorage.setItem(US_KEY, value || ''))
  watch(gbVoiceURI, value => localStorage.setItem(GB_KEY, value || ''))

  onMounted(() => {
    load()
    window.speechSynthesis?.addEventListener?.('voiceschanged', load)
    // Brave suele tardar más que Chrome en poblar getVoices() (Shields
    // añade una capa extra antes de exponer la lista), así que reintentamos
    // en una escalera más larga en vez de solo dos intentos rápidos.
    ;[300, 1000, 2000, 4000].forEach(delay => setTimeout(load, delay))
  })
  onUnmounted(() => {
    window.speechSynthesis?.cancel?.()
    window.speechSynthesis?.removeEventListener?.('voiceschanged', load)
    stopKeepAlive()
  })

  return {
    voices, englishVoices, usVoices, gbVoices,
    usVoiceURI, gbVoiceURI, selectedUS, selectedGB,
    status, error, load, speak, preview, previewContrast, playAudio
  }
}
