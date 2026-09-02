// ============================================================
// RUTA: src/composables/useWhisperTranscriber.js
// Transcriptor de audio 100% local en el navegador usando Whisper (Transformers.js)
// 100% GRATUITO: Corre en WebAssembly/WebGPU directamente en el navegador del usuario.
// Compatible con Brave, Firefox, Chrome, Edge, Safari y sin servidores backend.
// ============================================================

import { ref } from 'vue'

let pipelinePromise = null

async function getTranscriber(onProgress) {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers')
      env.allowLocalModels = false

      try {
        return await pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny.en', {
          dtype: 'fp32',
          device: 'wasm',
          progress_callback: progress => {
            if (onProgress) onProgress(progress)
          }
        })
      } catch (e1) {
        console.warn('Reintentando con Xenova/whisper-tiny.en...', e1)
        return await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
          dtype: 'fp32',
          device: 'wasm',
          progress_callback: progress => {
            if (onProgress) onProgress(progress)
          }
        })
      }
    })().catch(err => {
      pipelinePromise = null
      throw err
    })
  }
  return await pipelinePromise
}

export function useWhisperTranscriber() {
  const isTranscribing = ref(false)
  const progressStatus = ref('')
  const progressPercent = ref(0)
  const error = ref('')

  async function decodeAudioBlob(blob) {
    const arrayBuffer = await blob.arrayBuffer()
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) throw new Error('AudioContext no soportado en este navegador')

    const tempCtx = new AudioCtx()
    const decoded = await tempCtx.decodeAudioData(arrayBuffer)
    tempCtx.close().catch(() => {})

    // Resamplear a 16000 Hz canal mono (requerido por Whisper)
    const targetSampleRate = 16000
    const targetLength = Math.max(1, Math.round(decoded.duration * targetSampleRate))
    const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate)
    const source = offlineCtx.createBufferSource()
    source.buffer = decoded
    source.connect(offlineCtx.destination)
    source.start(0)

    const rendered = await offlineCtx.startRendering()
    return rendered.getChannelData(0)
  }

  async function transcribeAudioBlob(blob) {
    if (!blob || blob.size === 0) return ''
    isTranscribing.value = true
    progressPercent.value = 0
    progressStatus.value = 'Iniciando IA local del navegador (Whisper)...'
    error.value = ''

    try {
      progressStatus.value = 'Decodificando audio grabado...'
      const audioData = await decodeAudioBlob(blob)

      progressStatus.value = 'Cargando modelo local Whisper...'
      const transcriber = await getTranscriber(progress => {
        if (progress.status === 'progress' && progress.total) {
          progressPercent.value = Math.round((progress.loaded / progress.total) * 100)
          progressStatus.value = `Caché de modelo local: ${progressPercent.value}%`
        } else if (progress.status === 'loading') {
          progressStatus.value = `Preparando modelo local...`
        }
      })

      progressStatus.value = '🧠 Transcribiendo audio con IA local...'
      const result = await transcriber(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5
      })

      const text = (Array.isArray(result) ? result.map(r => r.text).join(' ') : (result?.text || '')).trim()
      progressStatus.value = '✅ Transcripción completada'
      return text
    } catch (err) {
      console.warn('Error en transcripción local Whisper:', err)
      error.value = `Aviso: No se pudo completar la transcripción con Whisper (${err.message || err}).`
      return ''
    } finally {
      isTranscribing.value = false
    }
  }

  return {
    isTranscribing,
    progressStatus,
    progressPercent,
    error,
    transcribeAudioBlob
  }
}
