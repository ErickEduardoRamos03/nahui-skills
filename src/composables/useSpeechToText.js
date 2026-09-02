// ============================================================
// RUTA: src/composables/useSpeechToText.js
// Composable para reconocimiento de voz (Speech-to-Text) en tiempo real
// y grabación local de audio usando APIs nativas del navegador
// (Web Speech API + MediaRecorder + Web Audio API).
//
// 100% GRATUITO, LOCAL Y RESILIENTE:
// - Cero costos, cero APIs de terceros de paga, sin servidores intermedios.
// - Transcripción en vivo (interim + final) en tiempo real.
// - Reanudación continua automática ante silencios del navegador.
// - Manejo de navegadores con escudos de privacidad o sin conexión.
// ============================================================

import { ref, onUnmounted } from 'vue'

export function useSpeechToText() {
  const SpeechRecognition = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
    : null

  const isSupported = ref(Boolean(SpeechRecognition))
  const isListening = ref(false)
  const transcript = ref('')
  const interimTranscript = ref('')
  const error = ref('')
  const isNetworkBlocked = ref(false)
  const duration = ref(0)
  const audioVolume = ref(0)
  const audioUrl = ref('')
  const audioBlob = ref(null)

  let recognitionInstance = null
  let mediaStream = null
  let mediaRecorder = null
  let audioChunks = []
  let audioContext = null
  let analyser = null
  let animationFrameId = null
  let timerInterval = null
  let manualStop = false
  let restartTimeout = null
  let baseTranscript = ''
  let currentLang = 'en-US'

  function cleanupAudioContext() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => {})
      audioContext = null
    }
    analyser = null
    audioVolume.value = 0
  }

  function startVolumeMeter(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      audioContext = new AudioCtx()
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {})
      }
      const source = audioContext.createMediaStreamSource(stream)
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const updateMeter = () => {
        if (!isListening.value || !analyser) return
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const average = sum / bufferLength
        audioVolume.value = Math.min(100, Math.round((average / 128) * 100))
        animationFrameId = requestAnimationFrame(updateMeter)
      }
      updateMeter()
    } catch {
      // Si el navegador no permite AudioContext, continuamos sin vúmetro
    }
  }

  function initRecognition() {
    if (!SpeechRecognition) return null

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = currentLang
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        // Reconocimiento activo
      }

      recognition.onresult = event => {
        let sessionFinal = ''
        let interim = ''
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i]
          if (res.isFinal) {
            const piece = res[0].transcript.trim()
            if (piece) {
              sessionFinal += (sessionFinal ? ' ' : '') + piece
            }
          } else {
            interim += res[0].transcript
          }
        }

        let fullText = baseTranscript
        if (sessionFinal) {
          fullText = baseTranscript ? `${baseTranscript} ${sessionFinal}` : sessionFinal
        }

        transcript.value = fullText
        interimTranscript.value = interim
      }

      recognition.onerror = event => {
        if (event.error === 'no-speech') return
        if (event.error === 'aborted') return

        if (event.error === 'network') {
          isNetworkBlocked.value = true
          // En Brave o navegadores con escudos de privacidad, Google Speech API se bloquea.
          // No mostramos error en rojo porque Whisper IA local procesará el audio al terminar la grabación.
          error.value = ''
          return
        }

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          error.value = 'Permiso de micrófono no concedido para el reconocimiento de voz.'
        } else {
          error.value = `Aviso del sistema de voz: ${event.error}`
        }
      }

      recognition.onend = () => {
        // Al terminar la sesión de reconocimiento (por silencio o pausa del motor),
        // consolidamos la base acumulada
        baseTranscript = transcript.value

        // Si no fue parada manual ni error de red, relanzamos en background para escucha continua
        if (!manualStop && isListening.value && !isNetworkBlocked.value) {
          clearTimeout(restartTimeout)
          restartTimeout = setTimeout(() => {
            if (!manualStop && isListening.value) {
              try {
                recognitionInstance = initRecognition()
                if (recognitionInstance) recognitionInstance.start()
              } catch {
                // Si el motor está transicionando, no romper
              }
            }
          }, 80)
        }
      }

      return recognition
    } catch (err) {
      console.warn('No se pudo inicializar SpeechRecognition:', err)
      return null
    }
  }

  async function startListening(options = {}) {
    error.value = ''
    isNetworkBlocked.value = false
    interimTranscript.value = ''
    manualStop = false
    clearTimeout(restartTimeout)

    currentLang = options.lang || 'en-US'
    baseTranscript = (options.initialText !== undefined ? options.initialText : transcript.value) || ''
    transcript.value = baseTranscript

    // Limpiar audio previo
    if (audioUrl.value) {
      URL.revokeObjectURL(audioUrl.value)
      audioUrl.value = ''
    }

    // 1. Iniciar captura de micrófono local (MediaRecorder)
    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        startVolumeMeter(mediaStream)

        audioChunks = []
        try {
          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/mp4')
              ? 'audio/mp4'
              : 'audio/webm'

          mediaRecorder = new MediaRecorder(mediaStream, { mimeType })
        } catch {
          mediaRecorder = new MediaRecorder(mediaStream)
        }

        mediaRecorder.ondataavailable = e => {
          if (e.data && e.data.size > 0) {
            audioChunks.push(e.data)
          }
        }

        mediaRecorder.onstop = () => {
          if (audioChunks.length > 0) {
            const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' })
            audioBlob.value = blob
            audioUrl.value = URL.createObjectURL(blob)
          }
        }

        mediaRecorder.start(250)
      }
    } catch (err) {
      console.warn('No se pudo iniciar la captura de audio local:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        error.value = 'Permiso de micrófono denegado. Habilita el acceso en tu navegador.'
        return
      }
    }

    // 2. Iniciar SpeechRecognition
    if (SpeechRecognition) {
      recognitionInstance = initRecognition()
      if (recognitionInstance) {
        try {
          recognitionInstance.start()
        } catch (err) {
          console.warn('Error al iniciar SpeechRecognition:', err)
        }
      }
    } else {
      error.value = 'Tu navegador no cuenta con Web Speech API nativa. Puedes grabar tu audio y escribir tu respuesta en el cuadro de texto.'
    }

    // Cronómetro
    duration.value = 0
    if (timerInterval) clearInterval(timerInterval)
    timerInterval = setInterval(() => {
      duration.value += 1
    }, 1000)
    isListening.value = true
  }

  function stopListening() {
    manualStop = true
    isListening.value = false
    clearTimeout(restartTimeout)

    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }

    if (interimTranscript.value) {
      const piece = interimTranscript.value.trim()
      if (piece) {
        transcript.value = transcript.value ? `${transcript.value} ${piece}` : piece
      }
      interimTranscript.value = ''
    }

    if (recognitionInstance) {
      try {
        recognitionInstance.stop()
      } catch {}
      recognitionInstance = null
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop()
      } catch {}
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop())
      mediaStream = null
    }

    cleanupAudioContext()
  }

  function setTranscript(text) {
    transcript.value = text || ''
    baseTranscript = text || ''
    interimTranscript.value = ''
  }

  function resetTranscript() {
    stopListening()
    transcript.value = ''
    baseTranscript = ''
    interimTranscript.value = ''
    duration.value = 0
    error.value = ''
    isNetworkBlocked.value = false
    audioBlob.value = null
    if (audioUrl.value) {
      URL.revokeObjectURL(audioUrl.value)
      audioUrl.value = ''
    }
  }

  onUnmounted(() => {
    stopListening()
    if (audioUrl.value) {
      URL.revokeObjectURL(audioUrl.value)
    }
  })

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    isNetworkBlocked,
    duration,
    audioVolume,
    audioUrl,
    audioBlob,
    startListening,
    stopListening,
    setTranscript,
    resetTranscript
  }
}
