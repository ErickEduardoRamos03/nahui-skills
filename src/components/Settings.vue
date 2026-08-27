<script setup>
import { toRefs, ref } from 'vue'
import { exportData, importData } from '../composables/useLocal'

const props = defineProps({
  settings: { type: Object, required: true },
  voice: { type: Object, required: true }
})
const { settings, voice } = toRefs(props)
const importMessage = ref('')

async function load(event) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    await importData(file)
  } catch (error) {
    importMessage.value = error.message || 'No se pudo importar el respaldo.'
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
        <label><input v-model="settings.variant" type="radio" value="us"> American English</label>
        <label><input v-model="settings.variant" type="radio" value="gb"> British English</label>
        <p>Las dos variantes siguen visibles. La selección define la voz principal del simulador.</p>
      </article>

      <article class="glass">
        <h2>Modo y accesibilidad</h2>
        <label><input v-model="settings.practice" type="checkbox"> Mostrar ayudas y transcripciones</label>
        <label><input v-model="settings.reducedMotion" type="checkbox"> Reducir movimiento decorativo</label>
        <label><input v-model="settings.highContrast" type="checkbox"> Contraste reforzado</label>
      </article>

      <article class="glass voice-card">
        <span class="voice-locale">US</span>
        <h2>Voz estadounidense</h2>
        <select v-model="voice.usVoiceURI" aria-label="Voz estadounidense">
          <option v-if="!voice.usVoices.length" value="">No hay voces en-US instaladas</option>
          <option v-for="item in voice.usVoices" :key="item.voiceURI" :value="item.voiceURI">
            {{ item.name }} · {{ item.lang }}{{ item.localService ? ' · local' : ' · en línea' }}
          </option>
        </select>
        <p v-if="voice.selectedUS"><b>Activa:</b> {{ voice.selectedUS.name }} ({{ voice.selectedUS.lang }})</p>
        <button class="aero-button primary" :disabled="!voice.selectedUS" @click="voice.preview('en-US')">Probar voz US</button>
      </article>

      <article class="glass voice-card">
        <span class="voice-locale">UK</span>
        <h2>Voz británica</h2>
        <select v-model="voice.gbVoiceURI" aria-label="Voz británica">
          <option v-if="!voice.gbVoices.length" value="">No hay voces en-GB instaladas</option>
          <option v-for="item in voice.gbVoices" :key="item.voiceURI" :value="item.voiceURI">
            {{ item.name }} · {{ item.lang }}{{ item.localService ? ' · local' : ' · en línea' }}
          </option>
        </select>
        <p v-if="voice.selectedGB"><b>Activa:</b> {{ voice.selectedGB.name }} ({{ voice.selectedGB.lang }})</p>
        <button class="aero-button primary" :disabled="!voice.selectedGB" @click="voice.preview('en-GB')">Probar voz UK</button>
      </article>

      <article class="glass voice-help">
        <h2>Comparación A/B</h2>
        <p>La plataforma usa selecciones independientes. Ya no reutiliza una misma voz para ambos botones.</p>
        <button class="aero-button" :disabled="!voice.selectedUS || !voice.selectedGB" @click="voice.previewContrast">Escuchar US y luego UK</button>
        <p class="voice-status" aria-live="polite">{{ voice.status }}</p>
        <p v-if="voice.error" class="error">{{ voice.error }}</p>
        <details>
          <summary>¿La voz todavía suena robótica?</summary>
          <p>La calidad depende de las voces que Windows expone al navegador. Instala paquetes English (United States) y English (United Kingdom), reinicia el navegador y vuelve a esta pantalla. Las voces con “Natural” o “Neural” se priorizan automáticamente.</p>
        </details>
      </article>

      <article class="glass">
        <h2>Respaldo</h2>
        <button class="aero-button" @click="exportData">Exportar JSON</button>
        <label class="aero-button file">Importar JSON<input hidden type="file" accept="application/json" @change="load"></label>
        <p v-if="importMessage" class="error">{{ importMessage }}</p>
        <p>Si borras los datos del navegador, se pierde el progreso salvo que tengas un respaldo.</p>
      </article>
    </div>
  </section>
</template>
