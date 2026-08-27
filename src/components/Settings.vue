<script setup>
import { computed, ref } from 'vue'
import { exportData, importData } from '../composables/useLocal'

const props = defineProps({
  settings: { type: Object, required: true },
  voice: { type: Object, required: true }
})

const importMessage = ref('')
const unwrap = value => value && typeof value === 'object' && 'value' in value ? value.value : value

const usVoices = computed(() => unwrap(props.voice.usVoices) || [])
const gbVoices = computed(() => unwrap(props.voice.gbVoices) || [])
const selectedUS = computed(() => unwrap(props.voice.selectedUS) || null)
const selectedGB = computed(() => unwrap(props.voice.selectedGB) || null)
const voiceStatus = computed(() => unwrap(props.voice.status) || '')
const voiceError = computed(() => unwrap(props.voice.error) || '')

const usVoiceURI = computed({
  get: () => unwrap(props.voice.usVoiceURI) || '',
  set: value => { props.voice.usVoiceURI.value = value }
})
const gbVoiceURI = computed({
  get: () => unwrap(props.voice.gbVoiceURI) || '',
  set: value => { props.voice.gbVoiceURI.value = value }
})

async function load(event) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    await importData(file)
  } catch (error) {
    importMessage.value = error?.message || 'No se pudo importar el respaldo.'
  } finally {
    event.target.value = ''
  }
}
</script>

<template>
  <section class="panel settings">
    <div class="eyebrow">Privacidad y preferencias</div>
    <h1>Configuración local</h1>
    <p class="lede">Todas las preferencias se guardan únicamente en este navegador.</p>

    <div class="settings-grid">
      <article class="glass">
        <h2>Variante objetivo</h2>
        <label><input v-model="props.settings.variant" type="radio" value="us"> American English</label>
        <label><input v-model="props.settings.variant" type="radio" value="gb"> British English</label>
        <p>La selección define la voz principal del simulador, sin ocultar la otra variante.</p>
      </article>

      <article class="glass">
        <h2>Modo y accesibilidad</h2>
        <label><input v-model="props.settings.practice" type="checkbox"> Mostrar ayudas y transcripciones</label>
        <label><input v-model="props.settings.reducedMotion" type="checkbox"> Reducir movimiento decorativo</label>
        <label><input v-model="props.settings.highContrast" type="checkbox"> Contraste reforzado</label>
      </article>

      <article class="glass voice-card">
        <span class="voice-locale">US</span>
        <h2>Voz estadounidense</h2>
        <select v-model="usVoiceURI" aria-label="Voz estadounidense">
          <option v-if="!usVoices.length" value="">No hay voces en-US disponibles</option>
          <option v-for="item in usVoices" :key="item.voiceURI" :value="item.voiceURI">
            {{ item.name }} · {{ item.lang }}{{ item.localService ? ' · local' : ' · en línea' }}
          </option>
        </select>
        <p v-if="selectedUS"><b>Activa:</b> {{ selectedUS.name }} ({{ selectedUS.lang }})</p>
        <button class="aero-button primary" :disabled="!selectedUS" @click="props.voice.preview('en-US')">Probar voz US</button>
      </article>

      <article class="glass voice-card">
        <span class="voice-locale">UK</span>
        <h2>Voz británica</h2>
        <select v-model="gbVoiceURI" aria-label="Voz británica">
          <option v-if="!gbVoices.length" value="">No hay voces en-GB disponibles</option>
          <option v-for="item in gbVoices" :key="item.voiceURI" :value="item.voiceURI">
            {{ item.name }} · {{ item.lang }}{{ item.localService ? ' · local' : ' · en línea' }}
          </option>
        </select>
        <p v-if="selectedGB"><b>Activa:</b> {{ selectedGB.name }} ({{ selectedGB.lang }})</p>
        <button class="aero-button primary" :disabled="!selectedGB" @click="props.voice.preview('en-GB')">Probar voz UK</button>
      </article>

      <article class="glass voice-help">
        <h2>Comparación A/B</h2>
        <p>Las selecciones son independientes. La plataforma no reutiliza la voz US para el botón UK.</p>
        <div class="hero-actions">
          <button class="aero-button" :disabled="!selectedUS" @click="props.voice.preview('en-US')">Escuchar US</button>
          <button class="aero-button" :disabled="!selectedGB" @click="props.voice.preview('en-GB')">Escuchar UK</button>
        </div>
        <p class="voice-status" aria-live="polite">{{ voiceStatus }}</p>
        <p v-if="voiceError" class="error">{{ voiceError }}</p>
      </article>

      <article class="glass">
        <h2>Respaldo</h2>
        <button class="aero-button" @click="exportData">Exportar JSON</button>
        <label class="aero-button file">Importar JSON<input hidden type="file" accept="application/json" @change="load"></label>
        <p v-if="importMessage" class="error">{{ importMessage }}</p>
        <p>Si borras los datos del navegador, el progreso local se elimina salvo que tengas un respaldo.</p>
      </article>
    </div>
  </section>
</template>
