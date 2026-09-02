<script setup>
import { computed, ref, toRefs, watch } from 'vue'
import { readingSections, listeningSections, writingPrompts, speakingPrompts, speakingExaminerLines, careerExaminerTracks } from '../data/content'
import { useLocal } from '../composables/useLocal'
import { useSpeechToText } from '../composables/useSpeechToText'
import { useWhisperTranscriber } from '../composables/useWhisperTranscriber'

const props = defineProps({ initialSkill: { type: String, default: 'reading' }, voice: Object, settings: Object })
const { voice, settings } = toRefs(props)
const skill = ref(props.initialSkill)
const level = ref('B1')
const started = ref(false)
const submitted = ref(false)
const sectionIndex = ref(0)
const answers = useLocal('nahui-exam-answers', {})
const writing = useLocal('nahui-writing', {})
const speaking = useLocal('nahui-speaking', {})

const speechSTT = useSpeechToText()
const whisperSTT = useWhisperTranscriber()
const showPrivacyDetails = ref(false)

// Modo de Speaking: 'interview' (Entrevista oral oficial personalizada) o 'drill' (Reactivo individual)
const speakingMode = ref('interview')
const interviewStageIndex = ref(0)
const detectedCareerKey = ref('software')
const interviewHistory = ref([])
const examinerTransitionMsg = ref('')
const currentExaminerAudioId = ref('spk-intro-1')

const pools = { reading: readingSections, listening: listeningSections, writing: writingPrompts, speaking: speakingPrompts }
const filtered = computed(() => pools[skill.value].filter(item => item.level === level.value))
const current = computed(() => filtered.value[sectionIndex.value % Math.max(filtered.value.length, 1)])
const answerKey = computed(() => current.value ? `${skill.value}:${current.value.id}` : '')
const currentAnswers = computed({
  get: () => answers.value[answerKey.value] || {},
  set: value => { answers.value[answerKey.value] = value }
})

// --- WRITING COMPUTEDS ---
const draft = computed({
  get: () => writing.value[current.value?.id] || '',
  set: value => { if (current.value) writing.value[current.value.id] = value }
})
const wordCount = computed(() => draft.value.trim() ? draft.value.trim().split(/\s+/).length : 0)
const writingTarget = computed(() => current.value?.level === 'B2'
  ? { min: 120, max: 140, label: '120–140' }
  : { min: 80, max: 120, label: '80–120' })
const writingSuggestions = computed(() => {
  const task = current.value?.type || ''
  const register = current.value?.register || 'neutral'
  const suggestions = [
    `Keep a ${register} register from greeting to closing.`,
    'Make each requested point explicit; do not leave the reader to infer it.',
    'Use a short opening, developed middle, and a clear closing or conclusion.'
  ]
  if (/email|message|invitation|application|complaint/i.test(task)) suggestions.unshift('Include an appropriate greeting, purpose, and sign-off.')
  if (/report|proposal|memo|summary|notice/i.test(task)) suggestions.unshift('Use informative paragraphs or headings and make recommendations easy to find.')
  if (/essay|editorial|analysis|response/i.test(task)) suggestions.unshift('State a position, support it with reasons or examples, and finish with a conclusion.')
  if (/review/i.test(task)) suggestions.unshift('Balance description with a recommendation for the intended reader.')
  return suggestions.slice(0, 4)
})
const grammarReport = computed(() => {
  const text = draft.value.trim()
  if (!text) return { summary: 'Start writing to check your text.', issues: [], strength: 'empty' }

  const issues = []
  const normalized = text.replace(/\s+/g, ' ').trim()
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean)

  if (/\s{2,}/.test(text)) issues.push('Avoid double spaces between words.')
  if (/\b(?:teh|recieve|seperate|enviroment|foriegn|becuase|occured|mispell|wether)\b/i.test(text)) {
    const bad = text.match(/\b(?:teh|recieve|seperate|enviroment|foriegn|becuase|occured|mispell|wether)\b/i)?.[0]
    issues.push(`Possible spelling issue: “${bad}” may need proofreading.`)
  }
  if (/\b(i|you|we|they)\s+is\b/i.test(text)) issues.push('Check subject-verb agreement: plural subjects usually take “are”.')
  if (/\b(he|she|it|the class|the team|the student|the school)\s+are\b/i.test(text)) issues.push('Check subject-verb agreement: singular subjects usually take “is”.')
  if (/\b(?:its|it's)\b/i.test(text) && /\bits\b/i.test(text) && /\bit's\b/i.test(text)) issues.push('Check “its” versus “it’s” in your text.')
  if (/\b(?:then|than)\b/i.test(text) && /\bthen\b/i.test(text) && /\bthan\b/i.test(text)) issues.push('Check whether “than” or “then” fits the idea you are expressing.')

  if (/\b(?:a|an)\s+[aeiou]/i.test(text) && /\ba\s+[aeiou]/i.test(text)) issues.push('Check articles before vowel sounds: use “an” where the following word begins with a vowel sound.')
  if (/\b(?:he|she|it)\s+(?:have|do|go)\b/i.test(text)) issues.push('Check third-person singular forms: “he/she/it” usually takes has, does, or goes.')
  if (sentences.some(sentence => /^[a-z]/.test(sentence.trim()))) issues.push('Start each sentence with a capital letter.')
  if (sentences.length < 2 && wordCount.value >= 40) issues.push('Break a longer response into clear sentences so the reader can follow the ideas.')

  sentences.forEach(sentence => {
    const words = sentence.split(/\s+/)
    for (let i = 0; i < words.length - 1; i++) {
      const current = words[i].toLowerCase().replace(/[^a-z]/g, '')
      const next = words[i + 1].toLowerCase().replace(/[^a-z]/g, '')
      if (current && next && current === next) {
        issues.push(`Possible repeated word: “${words[i]}”.`)
        break
      }
    }
  })

  const uniqueIssues = [...new Set(issues)]
  const summary = uniqueIssues.length
    ? `Local text-only check found ${uniqueIssues.length} likely issue${uniqueIssues.length === 1 ? '' : 's'}.`
    : 'No obvious grammar warnings were detected in the text-only check.'

  return {
    summary,
    issues: uniqueIssues.slice(0, 5),
    strength: uniqueIssues.length === 0 ? 'strong' : 'needs-review'
  }
})
const writingEvaluation = computed(() => {
  const text = draft.value.trim()
  if (!text) return null
  const normalized = text.replace(/\s+/g, ' ').trim()
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean)
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean)
  const linkingWords = /\b(?:because|however|therefore|although|for example|first|finally|in conclusion|as a result|while|instead)\b/i.test(text)
  const lengthScore = wordCount.value >= writingTarget.value.min && wordCount.value <= writingTarget.value.max ? 3 : wordCount.value >= writingTarget.value.min * .75 ? 2 : 1
  const organisationScore = sentences.length >= 3 && (paragraphs.length >= 2 || linkingWords) ? 2 : 1
  const accuracyScore = grammarReport.value.issues.length === 0 ? 3 : grammarReport.value.issues.length <= 2 ? 2 : 1
  const taskScore = /email|message|invitation|application|complaint/i.test(current.value?.type || '')
    ? (/\b(?:dear|hello|hi)\b/i.test(text) && /\b(?:regards|sincerely|best wishes|thank you)\b/i.test(text) ? 2 : 1)
    : linkingWords ? 2 : 1
  return { total: lengthScore + organisationScore + accuracyScore + taskScore, lengthScore, organisationScore, accuracyScore, taskScore }
})

// --- SPEAKING DYNAMIC CAREER-BRANCHED INTERVIEW ---
const careerTrack = computed(() => careerExaminerTracks[detectedCareerKey.value] || careerExaminerTracks.general)

const currentDynamicStage = computed(() => {
  if (interviewStageIndex.value === 0) {
    return {
      stageNumber: 1,
      audioId: 'spk-intro-1',
      theme: 'Presentación e Información Personal',
      targetGrammar: 'Present simple / present perfect',
      question: speakingExaminerLines[0].text,
      helperPrompt: 'Preséntate, menciona tu nombre completo y qué carrera o área estás estudiando o ejerciendo.'
    }
  } else if (interviewStageIndex.value === 1) {
    return {
      stageNumber: 2,
      audioId: careerTrack.value.stage2.id,
      theme: careerTrack.value.stage2.theme,
      targetGrammar: careerTrack.value.stage2.targetGrammar,
      question: careerTrack.value.stage2.question,
      helperPrompt: careerTrack.value.stage2.helper
    }
  } else if (interviewStageIndex.value === 2) {
    return {
      stageNumber: 3,
      audioId: careerTrack.value.stage3.id,
      theme: careerTrack.value.stage3.theme,
      targetGrammar: careerTrack.value.stage3.targetGrammar,
      question: careerTrack.value.stage3.question,
      helperPrompt: careerTrack.value.stage3.helper
    }
  } else if (interviewStageIndex.value === 3) {
    return {
      stageNumber: 4,
      audioId: careerTrack.value.stage4.id,
      theme: careerTrack.value.stage4.theme,
      targetGrammar: careerTrack.value.stage4.targetGrammar,
      question: careerTrack.value.stage4.question,
      helperPrompt: careerTrack.value.stage4.helper
    }
  }
  return null
})

const isInterviewFinished = computed(() => interviewStageIndex.value >= 4)

const activeSpeakingKey = computed(() => {
  if (speakingMode.value === 'interview') {
    return `interview_${detectedCareerKey.value}_stage_${interviewStageIndex.value + 1}`
  }
  return current.value?.id || 'speaking_draft'
})

const speakingDraft = computed({
  get: () => speaking.value[activeSpeakingKey.value] || '',
  set: val => {
    speaking.value[activeSpeakingKey.value] = val
    if (!speechSTT.isListening.value) {
      speechSTT.setTranscript(val)
    }
  }
})

// Sincronización bidireccional reactiva: cuando el STT genera texto en tiempo real,
// actualiza el borrador activo inmediatamente en la interfaz.
watch(speechSTT.transcript, newVal => {
  if (speechSTT.isListening.value) {
    speaking.value[activeSpeakingKey.value] = newVal
  }
})

// Sincronizar el estado del transcriptor cuando cambia la fase o reactivo
watch(activeSpeakingKey, newKey => {
  if (!speechSTT.isListening.value) {
    speechSTT.setTranscript(speaking.value[newKey] || '')
  }
})

const speakingWordCount = computed(() => {
  const text = (speakingDraft.value || '').trim()
  return text ? text.split(/\s+/).filter(Boolean).length : 0
})

const speakingDurationFormatted = computed(() => {
  const dur = speechSTT.duration.value
  const mins = Math.floor(dur / 60)
  const secs = dur % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
})

const speakingWpm = computed(() => {
  const words = speakingWordCount.value
  const secs = speechSTT.duration.value
  if (secs >= 5 && words > 3) {
    return Math.round((words / secs) * 60)
  }
  return 0
})

const LINKING_PATTERNS = [
  { category: 'Contrast', pattern: /\b(however|although|though|but|on the other hand|while|whereas|even though|nevertheless|in contrast)\b/gi, label: 'Contraste' },
  { category: 'Cause', pattern: /\b(because|since|as a result|therefore|so|that is why|due to|for this reason)\b/gi, label: 'Causa / Razón' },
  { category: 'Sequence', pattern: /\b(first|first of all|secondly|then|after that|finally|to begin with|in conclusion|to sum up)\b/gi, label: 'Secuencia' },
  { category: 'Opinion', pattern: /\b(in my opinion|personally|i believe|from my perspective|i think|in my view|as i see it)\b/gi, label: 'Opinión' },
  { category: 'Addition', pattern: /\b(for example|for instance|such as|in addition|furthermore|moreover|also|besides|what is more)\b/gi, label: 'Ejemplos' }
]

function extractConnectors(text) {
  if (!text) return []
  const found = []
  LINKING_PATTERNS.forEach(item => {
    const matches = text.match(item.pattern)
    if (matches) {
      matches.forEach(m => {
        const cleaned = m.toLowerCase()
        if (!found.some(f => f.word.toLowerCase() === cleaned)) {
          found.push({ word: cleaned, category: item.category, label: item.label })
        }
      })
    }
  })
  return found
}

const currentStageConnectors = computed(() => extractConnectors(speakingDraft.value))

// Detección automática de la carrera según lo que responda el sustentante en la Fase 1
function detectCareer(text) {
  if (!text) return 'general'
  const lower = text.toLowerCase()
  for (const [key, track] of Object.entries(careerExaminerTracks)) {
    if (key === 'general') continue
    if (track.keywords.some(kw => lower.includes(kw))) {
      return key
    }
  }
  return 'general'
}

function selectCareerDirectly(key) {
  detectedCareerKey.value = key
  if (interviewStageIndex.value === 0 && !speakingDraft.value) {
    const label = careerExaminerTracks[key]?.label || key
    speakingDraft.value = `My name is Alex and I am currently studying ${label.split('/')[0].trim()} at university.`
  }
}

// Reproducción de audio del examinador con MP3 pregrabado (sin sintetizador de navegador)
function playExaminerAudio(audioId, fallbackText) {
  const locale = settings.value.variant === 'gb' ? 'en-GB' : 'en-US'
  currentExaminerAudioId.value = audioId
  voice.value.playAudio(audioId, locale, fallbackText)
}

function playCurrentExaminerQuestion() {
  if (speakingMode.value === 'interview' && currentDynamicStage.value) {
    playExaminerAudio(currentDynamicStage.value.audioId, currentDynamicStage.value.question)
  } else if (current.value?.prompt) {
    voice.value.speak(current.value.prompt, settings.value.variant === 'gb' ? 'en-GB' : 'en-US')
  }
}

// Evaluación global de la entrevista oficial (20 puntos según la guía IPN/CENLEX)
const totalInterviewEvaluation = computed(() => {
  if (interviewHistory.value.length === 0) return null

  const history = interviewHistory.value
  const totalWords = history.reduce((sum, h) => sum + (h.words || 0), 0)
  const totalDuration = history.reduce((sum, h) => sum + (h.duration || 0), 0)
  const allText = history.map(h => h.answer).join(' ')
  const allConnectors = extractConnectors(allText)

  // 1. Coherencia / Cohesión (0 a 4 puntos)
  let cohesionScore = 2
  if (allConnectors.length >= 6) cohesionScore = 4
  else if (allConnectors.length >= 3) cohesionScore = 3
  else if (allConnectors.length >= 1) cohesionScore = 2
  else cohesionScore = 1

  // 2. Pronunciación y Ritmo (0 a 4 puntos)
  let avgWpm = totalDuration > 10 ? Math.round((totalWords / totalDuration) * 60) : 100
  let pronunciationScore = 2
  if (avgWpm >= 85 && avgWpm <= 150) pronunciationScore = 4
  else if (avgWpm >= 65 && avgWpm <= 170) pronunciationScore = 3
  else pronunciationScore = 2

  // 3. Gramática y Vocabulario (0 a 4 puntos)
  const uniqueWords = new Set(allText.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean)).size
  const lexicalRatio = totalWords > 0 ? uniqueWords / totalWords : 0
  let grammarScore = 2
  if (lexicalRatio >= 0.55 && totalWords >= 120) grammarScore = 4
  else if (lexicalRatio >= 0.45 && totalWords >= 70) grammarScore = 3
  else grammarScore = 2

  // 4. Interacción Comunicativa (0 a 4 puntos)
  let interactionScore = 2
  const completedStages = history.filter(h => h.words >= 20).length
  if (completedStages === 4) interactionScore = 4
  else if (completedStages >= 3) interactionScore = 3
  else interactionScore = 2

  // 5. Fluidez (0 a 4 puntos)
  let fluencyScore = 2
  if (totalWords >= 140 || totalDuration >= 180) fluencyScore = 4
  else if (totalWords >= 80 || totalDuration >= 100) fluencyScore = 3
  else fluencyScore = 2

  const totalScore = cohesionScore + pronunciationScore + grammarScore + interactionScore + fluencyScore

  const suggestions = []
  if (allConnectors.length < 4) {
    suggestions.push('Intenta incorporar más conectores variados (e.g. “on the other hand”, “furthermore”, “in my view”) para enriquecer la cohesión.')
  }
  if (totalWords < 120) {
    suggestions.push('Desarrolla respuestas más extensas con ejemplos concretos y justificaciones en cada fase.')
  }
  if (avgWpm > 160) {
    suggestions.push('Hablas a un ritmo muy rápido. Recuerda pausar en puntos clave y articular con claridad las terminaciones.')
  }
  if (avgWpm < 75 && avgWpm > 0) {
    suggestions.push('Trata de hilar tus ideas con mayor espontaneidad para aumentar la naturalidad del diálogo.')
  }
  if (suggestions.length === 0) {
    suggestions.push('¡Desempeño sobresaliente! Demostraste excelente fluidez, vocabulario variado y adecuada interacción comunicativa en todas las fases.')
  }

  return {
    totalScore,
    cohesionScore,
    pronunciationScore,
    grammarScore,
    interactionScore,
    fluencyScore,
    totalWords,
    totalDuration,
    avgWpm,
    allConnectors,
    suggestions,
    isPassed: totalScore >= 14
  }
})

// Control de grabación
function toggleRecording() {
  if (speechSTT.isListening.value) {
    speechSTT.stopListening()
  } else {
    const lang = settings.value.variant === 'gb' ? 'en-GB' : 'en-US'
    speechSTT.startListening({
      lang,
      initialText: speakingDraft.value
    })
  }
}

async function triggerWhisperTranscription() {
  if (speechSTT.audioBlob.value) {
    const text = await whisperSTT.transcribeAudioBlob(speechSTT.audioBlob.value)
    if (text) {
      const existing = (speakingDraft.value || '').trim()
      if (!existing) {
        speakingDraft.value = text
      } else if (!existing.toLowerCase().includes(text.toLowerCase())) {
        speakingDraft.value = `${existing} ${text}`
      }
      speechSTT.setTranscript(speakingDraft.value)
    }
  }
}

// Al finalizar la grabación: si el reconocimiento en la nube de Google fue bloqueado
// por el navegador (ej. Brave Shields) o no se detectó texto, transcribir automáticamente con IA local Whisper
watch(speechSTT.audioBlob, async blob => {
  if (blob && (speechSTT.isNetworkBlocked.value || !speakingDraft.value.trim())) {
    await triggerWhisperTranscription()
  }
})

function clearStageAnswer() {
  speaking.value[activeSpeakingKey.value] = ''
  speechSTT.resetTranscript()
  whisperSTT.error.value = ''
  whisperSTT.progressStatus.value = ''
}

// Confirmar respuesta de la fase y avanzar de manera dinámica
function confirmStageAnswer() {
  if (speechSTT.isListening.value) {
    speechSTT.stopListening()
  }

  const answer = (speakingDraft.value || '').trim()
  const stage = currentDynamicStage.value

  // Si estamos en la Fase 1, detectar la carrera del candidato si aún no se seleccionó
  if (interviewStageIndex.value === 0) {
    detectedCareerKey.value = detectCareer(answer)
  }

  const currentTrack = careerTrack.value

  // Guardar en el historial de la entrevista
  interviewHistory.value.push({
    stageNumber: interviewStageIndex.value + 1,
    theme: stage?.theme || `Fase ${interviewStageIndex.value + 1}`,
    targetGrammar: stage?.targetGrammar || '',
    examinerQuestion: stage?.question || '',
    candidateAnswer: answer,
    words: speakingWordCount.value,
    duration: speechSTT.duration.value,
    wpm: speakingWpm.value,
    audioUrl: speechSTT.audioUrl.value,
    connectors: currentStageConnectors.value
  })

  // Transición y audio dinámico según la fase
  if (interviewStageIndex.value === 0) {
    examinerTransitionMsg.value = currentTrack.introReaction.text
    playExaminerAudio(currentTrack.introReaction.id, currentTrack.introReaction.text)
  } else if (interviewStageIndex.value === 1) {
    examinerTransitionMsg.value = currentTrack.stage2Reaction.text
    playExaminerAudio(currentTrack.stage2Reaction.id, currentTrack.stage2Reaction.text)
  } else if (interviewStageIndex.value === 2) {
    examinerTransitionMsg.value = currentTrack.stage3Reaction.text
    playExaminerAudio(currentTrack.stage3Reaction.id, currentTrack.stage3Reaction.text)
  } else if (interviewStageIndex.value === 3) {
    examinerTransitionMsg.value = speakingExaminerLines[1].text
    playExaminerAudio('spk-conclusion', speakingExaminerLines[1].text)
  }

  // Avanzar a la siguiente fase
  interviewStageIndex.value += 1
  speechSTT.resetTranscript()

  // Si avanza a una nueva fase (Fase 2, 3 o 4), programar la lectura de la pregunta personalizada
  if (interviewStageIndex.value < 4) {
    setTimeout(() => {
      if (currentDynamicStage.value) {
        playExaminerAudio(currentDynamicStage.value.audioId, currentDynamicStage.value.question)
      }
    }, 4200)
  }
}

function resetInterview() {
  interviewStageIndex.value = 0
  interviewHistory.value = []
  examinerTransitionMsg.value = ''
  speechSTT.resetTranscript()
  playExaminerAudio('spk-intro-1', speakingExaminerLines[0].text)
}

function shufflePick() {
  if (skill.value === 'speaking' && speakingMode.value === 'interview') {
    const keys = Object.keys(careerExaminerTracks)
    detectedCareerKey.value = keys[Math.floor(Math.random() * keys.length)]
    resetInterview()
    started.value = true
    return
  }

  if (!filtered.value.length) return
  sectionIndex.value = Math.floor(Math.random() * filtered.value.length)
  submitted.value = false
  started.value = true
  speechSTT.resetTranscript()
}

function choose(index, value) { currentAnswers.value = { ...currentAnswers.value, [index]: value } }
function playListening() { voice.value.playAudio(current.value.id, settings.value.variant === 'gb' ? 'en-GB' : 'en-US', current.value.script) }
function reset() { answers.value[answerKey.value] = {}; submitted.value = false }

watch([skill, level], () => {
  sectionIndex.value = 0
  started.value = false
  submitted.value = false
  resetInterview()
})
</script>

<template>
<section class="panel">
  <div class="eyebrow">B1 + B2 practice</div>
  <h1>Four-skills simulator</h1>
  <p class="lede">Choose a level and skill. Each new attempt selects an item from the available pool.</p>

  <div class="skill-tabs">
    <button v-for="name in ['reading','listening','writing','speaking']" :key="name" :class="{active:skill===name}" @click="skill=name">{{name}}</button>
  </div>
  <div class="section-nav">
    <button v-for="name in ['B1','B2']" :key="name" :class="{active:level===name}" @click="level=name">{{name}}</button>
  </div>

  <article v-if="!started" class="start-card">
    <h2>{{ level }} · {{ skill }}</h2>
    <p v-if="skill==='speaking'">
      Simulador de entrevista oral oficial (4 fases con examinador adaptativo según tu carrera) para nivel {{ level }}.
    </p>
    <p v-else>{{ filtered.length }} activities are available in this pool.</p>
    <button class="aero-button primary" @click="shufflePick">
      {{ skill === 'speaking' ? 'Iniciar simulación de entrevista oral' : 'Start random activity' }}
    </button>
  </article>

  <!-- SECCIÓN DE SPEAKING: SIMULADOR DE ENTREVISTA ADAPTATIVA -->
  <template v-else-if="skill === 'speaking'">
    <div class="toolbar speaking-toolbar">
      <span class="tag">{{ level }} · Oral Interview Simulation</span>
      <div class="speaking-mode-toggle">
        <button
          class="aero-button small-btn"
          :class="{ active: speakingMode === 'interview' }"
          @click="speakingMode = 'interview'"
        >
          🎙️ Entrevista adaptativa (4 fases)
        </button>
        <button
          class="aero-button small-btn"
          :class="{ active: speakingMode === 'drill' }"
          @click="speakingMode = 'drill'"
        >
          ⚡ Práctica rápida individual
        </button>
      </div>
      <button class="aero-button" @click="shufflePick">Reiniciar / Otra carrera</button>
    </div>

    <!-- MODO 1: SIMULADOR DE ENTREVISTA OFICIAL (4 FASES) -->
    <div v-if="speakingMode === 'interview'" class="speaking-interview-flow">
      <!-- Banner de Privacidad y Procesamiento Local -->
      <article class="privacy-banner">
        <div class="privacy-banner-main">
          <span class="privacy-shield">🛡️</span>
          <div class="privacy-text">
            <strong>100% Privado y Local:</strong> Tu voz se graba y procesa localmente en tu navegador.
            <span class="privacy-sub">Sin servidores externos · Audios del examinador pregrabados en alta fidelidad.</span>
          </div>
          <button class="aero-button privacy-btn" @click="showPrivacyDetails = !showPrivacyDetails">
            {{ showPrivacyDetails ? 'Ocultar privacidad' : 'Privacidad de audio' }}
          </button>
        </div>
        <div v-if="showPrivacyDetails" class="privacy-details-box">
          <ul>
            <li><b>🔒 Sin backend ni nube:</b> Las grabaciones solo viven en la memoria temporal de esta pestaña para que puedas escucharte.</li>
            <li><b>🎧 Audios Neuronales MP3:</b> La voz del examinador proviene de archivos MP3 pregrabados servidos estáticamente, sin depender del sintetizador de voz del navegador.</li>
            <li><b>⚙️ Compatible con Brave/Offline:</b> Puedes grabar tu voz, escuchar la reproducción y redactar o ajustar tus respuestas sin bloqueos.</li>
          </ul>
        </div>
      </article>

      <!-- FASES 1 A 4: CONVERSACIÓN CON EL EXAMINADOR -->
      <template v-if="!isInterviewFinished && currentDynamicStage">
        <!-- Tarjeta del Examinador con la pregunta interactiva -->
        <article class="examiner-chat-card glass">
          <div class="examiner-header">
            <div class="examiner-avatar-box">
              <div class="examiner-avatar">👨‍🏫</div>
              <div>
                <h3>Examinador de Inglés (Oral Interviewer)</h3>
                <span class="stage-tag">Fase {{ currentDynamicStage.stageNumber }} de 4 · {{ currentDynamicStage.theme }}</span>
              </div>
            </div>
            <button class="aero-button small-btn" @click="playCurrentExaminerQuestion" title="Escuchar pregunta en voz alta">
              🔊 Reproducir pregunta
            </button>
          </div>

          <!-- Burbuja de reacción / transición contextual del examinador -->
          <div v-if="examinerTransitionMsg" class="examiner-transition-bubble">
            <em>"{{ examinerTransitionMsg }}"</em>
          </div>

          <!-- Pregunta del examinador -->
          <div class="examiner-question-bubble">
            <p class="question-text">"{{ currentDynamicStage.question }}"</p>
          </div>

          <!-- Selector de carrera en Fase 1 para respuesta rápida -->
          <div v-if="interviewStageIndex === 0" class="career-selector-bar">
            <span><b>O selecciona tu área / carrera:</b></span>
            <div class="career-pills-list">
              <button
                v-for="(track, key) in careerExaminerTracks"
                :key="key"
                class="career-pill-btn"
                :class="{ active: detectedCareerKey === key }"
                @click="selectCareerDirectly(key)"
              >
                {{ track.label }}
              </button>
            </div>
          </div>

          <div class="stage-help-bar">
            <span><b>Estructura esperada:</b> {{ currentDynamicStage.targetGrammar }}</span>
            <small>💡 {{ currentDynamicStage.helperPrompt }}</small>
          </div>
        </article>

        <!-- Cuadrícula de Respuesta del Sustentante -->
        <div class="speaking-grid">
          <!-- Panel de Grabación Local -->
          <article class="glass recorder-panel">
            <div class="mic-visualizer-row">
              <div class="mic-orb" :class="{ 'is-recording': speechSTT.isListening.value }">
                <span v-if="!speechSTT.isListening.value">🎙️</span>
                <span v-else class="pulse-mic">🔴</span>
              </div>
              <div class="mic-status-meta">
                <h3>{{ speechSTT.isListening.value ? 'Grabando tu respuesta...' : (speakingDraft ? 'Respuesta lista' : 'Listo para responder') }}</h3>
                <span class="variant-pill">Voz examinador: <b>{{ settings.variant === 'gb' ? 'British (Sonia)' : 'American (Aria)' }}</b></span>
              </div>
            </div>

            <!-- Vúmetro de entrada -->
            <div v-if="speechSTT.isListening.value" class="volume-meter-block">
              <div class="volume-header">
                <small>Nivel de entrada de micrófono:</small>
                <small>{{ speechSTT.audioVolume.value }}%</small>
              </div>
              <div class="meter volume-meter">
                <span :style="{ width: `${Math.max(8, speechSTT.audioVolume.value)}%` }"></span>
              </div>
            </div>

            <!-- Cronómetro de la fase -->
            <div class="speaking-timer-block">
              <div class="timer-meta">
                <span class="timer-time">⏱️ {{ speakingDurationFormatted }}</span>
                <span class="timer-goal">Meta: 45–90s</span>
              </div>
              <div class="meter timer-progress">
                <span :style="{ width: `${Math.min(100, (speechSTT.duration.value / 90) * 100)}%` }"></span>
              </div>
            </div>

            <!-- Acciones de grabación -->
            <div class="recorder-actions">
              <button
                class="aero-button"
                :class="speechSTT.isListening.value ? 'danger' : 'primary'"
                @click="toggleRecording"
              >
                {{ speechSTT.isListening.value ? '⏹️ Detener grabación' : (speakingDraft ? '🎙️ Grabar de nuevo' : '🎙️ Iniciar grabación') }}
              </button>
              <button
                v-if="speechSTT.audioBlob.value && !speechSTT.isListening.value"
                class="aero-button"
                :disabled="whisperSTT.isTranscribing.value"
                @click="triggerWhisperTranscription"
                title="Transcribir con IA local del navegador (Whisper)"
              >
                {{ whisperSTT.isTranscribing.value ? '🧠 Transcribiendo con IA...' : '🧠 Transcribir con IA local' }}
              </button>
              <button v-if="speakingDraft" class="aero-button" @click="clearStageAnswer">
                Limpiar
              </button>
            </div>

            <!-- Estado de transcripción IA local (Whisper) -->
            <div v-if="whisperSTT.isTranscribing.value" class="whisper-status-box">
              <span class="pulse-mic">🧠</span>
              <span><b>{{ whisperSTT.progressStatus.value }}</b></span>
            </div>

            <p v-if="whisperSTT.error.value" class="error speaking-error">{{ whisperSTT.error.value }}</p>
            <p v-if="speechSTT.error.value && !whisperSTT.isTranscribing.value" class="error speaking-error">{{ speechSTT.error.value }}</p>

            <!-- Reproductor de audio grabado por el usuario -->
            <div v-if="speechSTT.audioUrl.value" class="audio-playback-section">
              <h4>🔊 Escucha tu respuesta grabada:</h4>
              <audio :src="speechSTT.audioUrl.value" controls></audio>
              <small>Verifica tu pronunciación y fluidez antes de confirmar.</small>
            </div>
          </article>

          <!-- Panel de Transcripción y Edición -->
          <article class="paper transcript-panel">
            <div class="transcript-header">
              <h3>Tu respuesta (Fase {{ currentDynamicStage.stageNumber }})</h3>
              <span class="word-counter-badge" :class="{ ok: speakingWordCount >= 30 }">
                {{ speakingWordCount }} palabras
              </span>
            </div>

            <div class="transcript-area-wrap">
              <textarea
                v-model="speakingDraft"
                rows="7"
                placeholder="Habla al micrófono para transcribir tu respuesta, o escribe directamente aquí en inglés..."
              ></textarea>
              <div v-if="speechSTT.interimTranscript.value" class="interim-overlay">
                <em>🗣️ Detectando en vivo: {{ speechSTT.interimTranscript.value }}</em>
              </div>
            </div>

            <!-- Conectores detectados en esta fase -->
            <div v-if="currentStageConnectors.length" class="connectors-detected-box">
              <h4>🔗 Conectores detectados en esta fase:</h4>
              <div class="connector-tags-list">
                <span v-for="item in currentStageConnectors" :key="item.word" class="connector-pill">
                  {{ item.word }} <small>· {{ item.label }}</small>
                </span>
              </div>
            </div>

            <!-- Botón de avance de fase -->
            <div class="stage-advance-action">
              <button
                class="aero-button primary big-advance-btn"
                :disabled="speakingWordCount < 4 && !speechSTT.audioUrl.value"
                @click="confirmStageAnswer"
              >
                {{ interviewStageIndex === 3 ? '✅ Finalizar entrevista y ver calificación ➔' : `Confirmar y pasar a la Fase ${interviewStageIndex + 2} ➔` }}
              </button>
            </div>
          </article>
        </div>
      </template>

      <!-- FASE 5: BOLETA FINAL DE CALIFICACIÓN OFICIAL (20 PUNTOS) -->
      <template v-else-if="isInterviewFinished && totalInterviewEvaluation">
        <article class="glass interview-final-card">
          <div class="evaluation-top">
            <div>
              <span class="eyebrow">Simulación de Examen Oral Oficial · {{ level }} · {{ careerTrack.label }}</span>
              <h2>Boleta de Calificación de Speaking: {{ totalInterviewEvaluation.totalScore }} / 20 puntos</h2>
              <p class="interview-result-status" :class="totalInterviewEvaluation.isPassed ? 'passed' : 'review'">
                {{ totalInterviewEvaluation.isPassed ? '🎉 Dominio Demostrado (Aprobado ≥ 14/20)' : '⚠️ Requiere Mayor Práctica (< 14/20)' }}
              </p>
            </div>
            <div class="hero-actions">
              <button class="aero-button primary" @click="resetInterview">Reintentar esta entrevista</button>
              <button class="aero-button" @click="shufflePick">Probar otra carrera</button>
            </div>
          </div>

          <!-- Rúbrica de 5 competencias (4 pts c/u = 20 pts) según la guía oficial -->
          <div class="official-rubric-grid">
            <div class="official-rubric-card">
              <span class="score-badge">{{ totalInterviewEvaluation.cohesionScore }} / 4</span>
              <strong>🔗 Coherencia y Cohesión</strong>
              <p>{{ totalInterviewEvaluation.allConnectors.length }} conectores usados a lo largo de las 4 fases.</p>
            </div>
            <div class="official-rubric-card">
              <span class="score-badge">{{ totalInterviewEvaluation.pronunciationScore }} / 4</span>
              <strong>🗣️ Pronunciación y Ritmo</strong>
              <p>Promedio de {{ totalInterviewEvaluation.avgWpm }} palabras por minuto (WPM).</p>
            </div>
            <div class="official-rubric-card">
              <span class="score-badge">{{ totalInterviewEvaluation.grammarScore }} / 4</span>
              <strong>📚 Gramática y Vocabulario</strong>
              <p>Estructuras del nivel y terminología técnica de {{ careerTrack.label.split('/')[0] }}.</p>
            </div>
            <div class="official-rubric-card">
              <span class="score-badge">{{ totalInterviewEvaluation.interactionScore }} / 4</span>
              <strong>💬 Interacción Comunicativa</strong>
              <p>Respuesta pertinente y sostenida en las 4 fases.</p>
            </div>
            <div class="official-rubric-card">
              <span class="score-badge">{{ totalInterviewEvaluation.fluencyScore }} / 4</span>
              <strong>⚡ Fluidez</strong>
              <p>{{ totalInterviewEvaluation.totalWords }} palabras totales en {{ totalInterviewEvaluation.totalDuration }}s de habla.</p>
            </div>
          </div>

          <!-- Recomendaciones del examinador -->
          <div class="speaking-feedback-list">
            <h3>Dictamen y recomendaciones del examinador:</h3>
            <ul>
              <li v-for="(tip, idx) in totalInterviewEvaluation.suggestions" :key="idx">{{ tip }}</li>
            </ul>
          </div>

          <!-- Historial completo de la entrevista -->
          <div class="interview-transcript-history">
            <h3>Transcripción completa de la entrevista:</h3>
            <div v-for="item in interviewHistory" :key="item.stageNumber" class="history-stage-item">
              <div class="history-stage-badge">Fase {{ item.stageNumber }} · {{ item.theme }}</div>
              <div class="history-dialogue">
                <p><b>👨‍🏫 Examinador:</b> "{{ item.examinerQuestion }}"</p>
                <p><b>👤 Tu respuesta:</b> {{ item.candidateAnswer || '(Sin transcripción de texto)' }}</p>
                <div v-if="item.audioUrl" class="history-audio-box">
                  <audio :src="item.audioUrl" controls></audio>
                </div>
              </div>
            </div>
          </div>
        </article>
      </template>
    </div>

    <!-- MODO 2: PRÁCTICA RÁPIDA INDIVIDUAL (DRILL) -->
    <div v-else class="speaking-drill-flow">
      <article class="notice speaking-prompt-card">
        <div class="speaking-prompt-top">
          <span class="tag">{{ current.level }} · Reactivo individual</span>
          <button class="aero-button small-btn" @click="playCurrentExaminerQuestion">🔊 Escuchar</button>
        </div>
        <h2>{{ current.prompt }}</h2>
        <p>Practica tu respuesta individual durante 60–90 segundos con grabación y evaluación instantánea.</p>
      </article>

      <div class="speaking-grid">
        <article class="glass recorder-panel">
          <div class="mic-visualizer-row">
            <div class="mic-orb" :class="{ 'is-recording': speechSTT.isListening.value }">
              <span v-if="!speechSTT.isListening.value">🎙️</span>
              <span v-else class="pulse-mic">🔴</span>
            </div>
            <div class="mic-status-meta">
              <h3>{{ speechSTT.isListening.value ? 'Grabando respuesta...' : (speakingDraft ? 'Respuesta lista' : 'Listo para hablar') }}</h3>
              <span class="variant-pill">{{ settings.variant === 'gb' ? 'British English' : 'American English' }}</span>
            </div>
          </div>

          <!-- Vúmetro de entrada -->
          <div v-if="speechSTT.isListening.value" class="volume-meter-block">
            <div class="volume-header">
              <small>Nivel de entrada de micrófono:</small>
              <small>{{ speechSTT.audioVolume.value }}%</small>
            </div>
            <div class="meter volume-meter">
              <span :style="{ width: `${Math.max(8, speechSTT.audioVolume.value)}%` }"></span>
            </div>
          </div>

          <!-- Cronómetro de la práctica -->
          <div class="speaking-timer-block">
            <div class="timer-meta">
              <span class="timer-time">⏱️ {{ speakingDurationFormatted }}</span>
              <span class="timer-goal">Meta: 60–90s</span>
            </div>
            <div class="meter timer-progress">
              <span :style="{ width: `${Math.min(100, (speechSTT.duration.value / 90) * 100)}%` }"></span>
            </div>
          </div>

          <div class="recorder-actions">
            <button class="aero-button" :class="speechSTT.isListening.value ? 'danger' : 'primary'" @click="toggleRecording">
              {{ speechSTT.isListening.value ? '⏹️ Detener grabación' : (speakingDraft ? '🎙️ Grabar de nuevo' : '🎙️ Iniciar grabación') }}
            </button>
            <button
              v-if="speechSTT.audioBlob.value && !speechSTT.isListening.value"
              class="aero-button"
              :disabled="whisperSTT.isTranscribing.value"
              @click="triggerWhisperTranscription"
              title="Transcribir con IA local del navegador (Whisper)"
            >
              {{ whisperSTT.isTranscribing.value ? '🧠 Transcribiendo con IA...' : '🧠 Transcribir con IA local' }}
            </button>
            <button v-if="speakingDraft" class="aero-button" @click="clearStageAnswer">Limpiar</button>
          </div>

          <!-- Estado de transcripción IA local (Whisper) -->
          <div v-if="whisperSTT.isTranscribing.value" class="whisper-status-box">
            <span class="pulse-mic">🧠</span>
            <span><b>{{ whisperSTT.progressStatus.value }}</b></span>
          </div>

          <p v-if="whisperSTT.error.value" class="error speaking-error">{{ whisperSTT.error.value }}</p>
          <p v-if="speechSTT.error.value && !whisperSTT.isTranscribing.value" class="error speaking-error">{{ speechSTT.error.value }}</p>
          <div v-if="speechSTT.audioUrl.value" class="audio-playback-section">
            <h4>🔊 Escuchar grabación:</h4>
            <audio :src="speechSTT.audioUrl.value" controls></audio>
          </div>
        </article>

        <article class="paper transcript-panel">
          <div class="transcript-header">
            <h3>Transcripción del habla</h3>
            <span class="word-counter-badge" :class="{ ok: speakingWordCount >= 30 }">{{ speakingWordCount }} palabras</span>
          </div>
          <div class="transcript-area-wrap">
            <textarea v-model="speakingDraft" rows="8" placeholder="Habla al micrófono para transcribir tu respuesta, o escribe directamente aquí en inglés..."></textarea>
            <div v-if="speechSTT.interimTranscript.value" class="interim-overlay">
              <em>🗣️ Detectando en vivo: {{ speechSTT.interimTranscript.value }}</em>
            </div>
          </div>

          <!-- Conectores detectados -->
          <div v-if="currentStageConnectors.length" class="connectors-detected-box">
            <h4>🔗 Conectores detectados:</h4>
            <div class="connector-tags-list">
              <span v-for="item in currentStageConnectors" :key="item.word" class="connector-pill">
                {{ item.word }} <small>· {{ item.label }}</small>
              </span>
            </div>
          </div>
        </article>
      </div>
    </div>
  </template>

  <!-- OTRAS HABILIDADES: READING, LISTENING, WRITING -->
  <template v-else-if="current">
    <div class="toolbar">
      <span class="tag">{{current.level}}</span>
      <button class="aero-button" @click="shufflePick">Another random activity</button>
    </div>

    <!-- READING SKILL -->
    <div v-if="skill==='reading'" class="exam-grid">
      <article class="paper"><h2>{{current.title}}</h2><div class="reading-text">{{current.text}}</div></article>
      <article class="questions">
        <div v-for="(q,i) in current.questions" :key="i" class="question">
          <b>{{i+1}}. {{q.q}}</b>
          <label v-for="(option,j) in q.options" :key="j" :class="submitted ? (j===q.answer?'right':currentAnswers[i]===j?'wrong':'') : ''">
            <input type="radio" :name="`${current.id}-${i}`" :checked="currentAnswers[i]===j" @change="choose(i,j)"> {{option}}
          </label>
        </div>
        <button class="aero-button primary" @click="submitted=true">Check answers</button>
        <button class="aero-button" @click="reset">Reset</button>
        <p v-if="submitted"><b>Score: {{score}} / {{current.questions.length}}</b></p>
      </article>
    </div>

    <!-- LISTENING SKILL -->
    <div v-else-if="skill==='listening'" class="exam-grid">
      <article class="paper audio-card">
        <div class="orb">▶</div><h2>{{current.title}}</h2>
        <button class="aero-button primary" @click="playListening">Play audio</button>
        <p class="voice-status" aria-live="polite">{{voice.status.value}}</p>
        <p v-if="voice.error.value" class="error">{{voice.error.value}}</p>
        <details v-if="settings.practice"><summary>Practice transcript</summary><p>{{current.script}}</p></details>
      </article>
      <article class="questions">
        <div v-for="(q,i) in current.questions" :key="i" class="question">
          <b>{{i+1}}. {{q.q}}</b>
          <label v-for="(option,j) in q.options" :key="j" :class="submitted ? (j===q.answer?'right':currentAnswers[i]===j?'wrong':'') : ''">
            <input type="radio" :name="`${current.id}-${i}`" :checked="currentAnswers[i]===j" @change="choose(i,j)"> {{option}}
          </label>
        </div>
        <button class="aero-button primary" @click="submitted=true">Check answers</button>
        <button class="aero-button" @click="reset">Reset</button>
        <p v-if="submitted"><b>Score: {{score}} / {{current.questions.length}}</b></p>
      </article>
    </div>

    <!-- WRITING SKILL -->
    <article v-else-if="skill==='writing'" class="paper writing">
      <span class="tag">{{current.type}} · {{current.register}}</span><h2>{{current.prompt}}</h2>
      <aside class="writing-suggestions">
        <h3>Suggestions for this task</h3>
        <ul><li v-for="suggestion in writingSuggestions" :key="suggestion">{{ suggestion }}</li></ul>
      </aside>
      <textarea v-model="draft" rows="14" placeholder="Write your response in English..."></textarea>
      <div class="wordbar" :class="{ok:wordCount>=writingTarget.min && wordCount<=writingTarget.max}">{{wordCount}} words · target: {{ writingTarget.label }}</div>

      <div v-if="draft.trim()" class="grammar-panel" :class="grammarReport.strength">
        <h3>Local grammar check</h3>
        <p>{{ grammarReport.summary }}</p>
        <ul v-if="grammarReport.issues.length">
          <li v-for="issue in grammarReport.issues" :key="issue">{{ issue }}</li>
        </ul>
        <p v-else>This text-only review did not detect obvious grammar problems.</p>
      </div>
      <div v-if="writingEvaluation" class="writing-evaluation">
        <h3>Rule-based practice score: {{ writingEvaluation.total }} / 10</h3>
        <p>Length {{ writingEvaluation.lengthScore }}/3 · organisation {{ writingEvaluation.organisationScore }}/2 · accuracy {{ writingEvaluation.accuracyScore }}/3 · task format {{ writingEvaluation.taskScore }}/2.</p>
        <p>This is local, transparent feedback—not an official grade. It checks observable writing features and cannot judge every idea or nuance.</p>
      </div>
    </article>
  </template>
</section>
</template>
