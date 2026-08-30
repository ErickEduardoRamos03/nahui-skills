<script setup>
import { computed, ref, toRefs } from 'vue'
import { phraseJourneys } from '../data/content'

const props = defineProps({ voice: Object, settings: Object })
const { voice, settings } = toRefs(props)
const index = ref(0)
const filter = ref('all')
const items = computed(() => phraseJourneys.filter(p => filter.value === 'all' || p.topic === filter.value))
const current = computed(() => items.value[index.value % items.value.length] || phraseJourneys[0])
function next() { index.value = (index.value + 1) % items.value.length }
</script>

<template>
<section class="panel">
  <div class="eyebrow">English Through Time</div>
  <h1>Arqueología interactiva del inglés</h1>
  <p class="lede">Compara inglés actual estadounidense y británico; abre la línea histórica cuando exista una adaptación fiable.</p>
  <div class="toolbar">
    <select v-model="filter" @change="index=0">
      <option value="all">Todos los temas</option>
      <option v-for="t in [...new Set(phraseJourneys.map(p=>p.topic))]" :key="t" :value="t">{{t}}</option>
    </select>
    <button class="aero-button" @click="next">Otra frase</button>
  </div>
  <article class="journey">
    <div class="concept">
      <span class="tag">{{current.level}} · {{current.topic}}</span>
      <h2>{{current.es}}</h2>
    </div>
    <div class="variants">
      <div class="variant us">
        <div class="flag">US</div>
        <h3>American English</h3>
        <p class="big">{{current.us.text}}</p>
        <code>{{current.us.ipa}}</code>
        <button class="aero-button" @click="voice.speak(current.us.text,'en-US')">Escuchar en-US</button>
      </div>
      <div class="variant gb">
        <div class="flag">UK</div>
        <h3>British English</h3>
        <p class="big">{{current.gb.text}}</p>
        <code>{{current.gb.ipa}}</code>
        <button class="aero-button" @click="voice.speak(current.gb.text,'en-GB')">Escuchar en-GB</button>
      </div>
    </div>
    <!-- Antes no había NADA de status/error aquí: si speak() fallaba
         (voz no encontrada, Brave bloqueando algo, etc.) no se veía nada. -->
    <p class="voice-status" aria-live="polite">{{ voice.status.value }}</p>
    <p v-if="voice.error.value" class="error">{{ voice.error.value }}</p>
    <p class="note">{{current.note}}</p>
    <div v-if="current.history?.stages?.length" class="timeline">
      <h3>Viaje histórico</h3>
      <article v-for="(h,i) in current.history.stages" :key="`${h.period}-${h.date}-${i}`" class="time-stop">
        <span>{{h.date}}</span>
        <div>
          <b>{{h.period}}</b>
          <p class="historic">{{h.text}}</p>
          <small>{{h.status}} · confianza {{h.confidence}}</small>
          <p>{{h.note}}</p>
        </div>
      </article>
      <div class="historical-warning">El audio histórico no se sintetiza automáticamente: las voces modernas no reproducen con fidelidad pronunciaciones reconstruidas.</div>
    </div>
    <div v-else class="empty-history">Esta idea no tiene una versión histórica natural curada. Preferimos dejarla vacía antes que inventarla.</div>
  </article>
</section>
</template>