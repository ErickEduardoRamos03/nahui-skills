import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const US_KEY = 'nahui-voice-en-US'
const GB_KEY = 'nahui-voice-en-GB'
const SAMPLE = {
  'en-US': 'I parked the car near the water fountain, and I will call you later.',
  'en-GB': 'I parked the car near the water fountain, and I will call you later.'
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

  function speak(text, locale = 'en-US', rate = 0.9) {
    error.value = ''
    if (!('speechSynthesis' in window)) {
      error.value = 'Síntesis de voz no disponible.'
      return
    }
    load()
    const selected = selectedFor(locale)
    if (!selected) {
      error.value = `No se encontró una voz ${locale}. Instala una voz de ese idioma en Windows o selecciónala en Ajustes.`
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = selected
    utterance.lang = selected.lang || locale
    utterance.rate = rate
    utterance.pitch = locale.toLowerCase().startsWith('en-gb') ? 1.02 : 0.98
    utterance.volume = 1
    status.value = `Reproduciendo ${locale}: ${selected.name} (${selected.lang})`
    utterance.onerror = event => {
      error.value = `No se pudo reproducir la voz: ${event.error || 'error desconocido'}`
      status.value = ''
    }
    utterance.onend = () => { status.value = '' }
    window.speechSynthesis.speak(utterance)
  }

  function preview(locale) {
    speak(SAMPLE[locale], locale, 0.88)
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
    setTimeout(load, 300)
    setTimeout(load, 1200)
  })
  onUnmounted(() => {
    window.speechSynthesis?.cancel?.()
    window.speechSynthesis?.removeEventListener?.('voiceschanged', load)
  })

  return {
    voices, englishVoices, usVoices, gbVoices,
    usVoiceURI, gbVoiceURI, selectedUS, selectedGB,
    status, error, load, speak, preview, previewContrast
  }
}
