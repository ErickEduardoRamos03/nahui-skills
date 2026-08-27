<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ExamHub from './components/ExamHub.vue'
import Explorer from './components/Explorer.vue'
import Settings from './components/Settings.vue'
import { useVoice } from './composables/useVoice'
import { useLocal } from './composables/useLocal'

const voice = useVoice()
const settings = useLocal('nahui-settings', {
  variant: 'us', practice: true, reducedMotion: false, highContrast: false
})
const classes = computed(() => ({
  reduce: settings.value.reducedMotion,
  contrast: settings.value.highContrast
}))

const route = ref({ page: 'home', skill: 'reading' })
const validSkills = ['reading', 'listening', 'writing', 'speaking']

function readRoute() {
  const parts = location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
  if (parts[0] === 'practice') {
    route.value = { page: 'exam', skill: validSkills.includes(parts[1]) ? parts[1] : 'reading' }
  } else if (parts[0] === 'through-time') {
    route.value = { page: 'explore', skill: 'reading' }
  } else if (parts[0] === 'settings') {
    route.value = { page: 'settings', skill: 'reading' }
  } else {
    route.value = { page: 'home', skill: 'reading' }
  }
}

function go(page, skill = 'reading') {
  const path = page === 'exam' ? `/practice/${skill}`
    : page === 'explore' ? '/through-time'
    : page === 'settings' ? '/settings'
    : '/'
  history.pushState({}, '', path)
  readRoute()
  window.scrollTo({ top: 0, behavior: settings.value.reducedMotion ? 'auto' : 'smooth' })
}

onMounted(() => {
  readRoute()
  addEventListener('popstate', readRoute)
})
onUnmounted(() => removeEventListener('popstate', readRoute))
</script>

<template>
  <div :class="classes">
    <header class="topbar">
      <button class="brand" @click="go('home')">
        <span class="logo">4</span>
        <span>Nahui Skills <small>BETA 0.7.1</small></span>
      </button>
      <nav aria-label="Principal">
        <button :class="{ active: route.page === 'home' }" @click="go('home')">Inicio</button>
        <button :class="{ active: route.page === 'exam' }" @click="go('exam', route.skill)">Simulador</button>
        <button :class="{ active: route.page === 'explore' }" @click="go('explore')">Through Time</button>
        <button :class="{ active: route.page === 'settings' }" @click="go('settings')">Ajustes</button>
      </nav>
    </header>

    <main>
      <template v-if="route.page === 'home'">
        <section class="hero">
          <div class="hero-inner">
            <div>
              <span class="pill">Sin cuenta · datos locales · BrE + AmE</span>
              <h1>Practica el examen.<br><em>Explora el idioma.</em></h1>
              <p>Reading, Listening, Writing y Speaking con una capa Frutiger Aero, comparación de variantes y viajes breves por la historia del inglés.</p>
              <div class="hero-actions">
                <button class="aero-button primary" @click="go('exam')">Abrir simulador</button>
                <button class="aero-button light" @click="go('explore')">Viajar por el inglés</button>
              </div>
            </div>
            <div class="world" aria-hidden="true"><span class="bubble b1"></span><span class="bubble b2"></span><div class="island">Aa</div></div>
          </div>
        </section>
        <section class="home-grid">
          <article class="feature"><span class="icon">✓</span><h2>Cuatro habilidades</h2><p>Práctica B2 con textos y reactivos originales, escritura autoguardada y entrevista grabable.</p></article>
          <article class="feature"><span class="icon">US/UK</span><h2>Dos variantes claras</h2><p>Ortografía, vocabulario, AFI y voz etiquetados para evitar mezclas accidentales.</p></article>
          <article class="feature"><span class="icon">⏳</span><h2>Historia sin tedio</h2><p>Frases modernas, viajes históricos y estados de evidencia para no presentar reconstrucciones como hechos.</p></article>
          <article class="feature"><span class="icon">⌂</span><h2>Privado y local</h2><p>Preferencias, respuestas y borradores quedan en este navegador. Puedes exportar un respaldo JSON.</p></article>
        </section>
      </template>

      <ExamHub v-if="route.page === 'exam'" :key="route.skill" :initial-skill="route.skill" :voice="voice" :settings="settings" />
      <Explorer v-if="route.page === 'explore'" :voice="voice" :settings="settings" />
      <Settings v-if="route.page === 'settings'" :settings="settings" :voice="voice" />
    </main>

    <footer><b>Nahui Skills</b> es un proyecto educativo independiente, no afiliado ni respaldado por el IPN. Código AGPL-3.0. <button @click="go('settings')">Privacidad local</button></footer>
    <nav class="mobile-nav" aria-label="Navegación móvil">
      <button @click="go('home')">⌂<small>Inicio</small></button>
      <button @click="go('exam', route.skill)">✓<small>Examen</small></button>
      <button @click="go('explore')">⏳<small>Historia</small></button>
      <button @click="go('settings')">⚙<small>Ajustes</small></button>
    </nav>
  </div>
</template>
