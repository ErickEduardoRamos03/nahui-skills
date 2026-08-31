<script setup>
import { computed, ref, toRefs, watch } from 'vue'
import { readingSections, listeningSections, writingPrompts, speakingPrompts } from '../data/content'
import { useLocal } from '../composables/useLocal'

const props = defineProps({ initialSkill: { type:String, default:'reading' }, voice:Object, settings:Object })
const { voice, settings } = toRefs(props)
const skill = ref(props.initialSkill)
const level = ref('B1')
const started = ref(false)
const submitted = ref(false)
const sectionIndex = ref(0)
const answers = useLocal('nahui-exam-answers', {})
const writing = useLocal('nahui-writing', {})

const pools = { reading:readingSections, listening:listeningSections, writing:writingPrompts, speaking:speakingPrompts }
const filtered = computed(() => pools[skill.value].filter(item => item.level === level.value))
const current = computed(() => filtered.value[sectionIndex.value % Math.max(filtered.value.length, 1)])
const answerKey = computed(() => current.value ? `${skill.value}:${current.value.id}` : '')
const currentAnswers = computed({
  get:() => answers.value[answerKey.value] || {},
  set:value => { answers.value[answerKey.value] = value }
})
const draft = computed({
  get:() => writing.value[current.value?.id] || '',
  set:value => { if (current.value) writing.value[current.value.id] = value }
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
const score = computed(() => {
  if (!current.value?.questions) return 0
  return current.value.questions.reduce((sum,q,i) => sum + (currentAnswers.value[i] === q.answer ? 1 : 0), 0)
})

function shufflePick(){
  if (!filtered.value.length) return
  sectionIndex.value = Math.floor(Math.random() * filtered.value.length)
  submitted.value = false
  started.value = true
}
function choose(index,value){ currentAnswers.value = { ...currentAnswers.value, [index]:value } }
function playListening(){ voice.value.playAudio(current.value.id, settings.value.variant === 'gb' ? 'en-GB' : 'en-US', current.value.script) }
function reset(){ answers.value[answerKey.value] = {}; submitted.value = false }
watch([skill,level], () => { sectionIndex.value=0; started.value=false; submitted.value=false })
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
    <p>{{ filtered.length }} activities are available in this pool.</p>
    <button class="aero-button primary" :disabled="!filtered.length" @click="shufflePick">Start random activity</button>
  </article>

  <template v-else-if="current">
    <div class="toolbar">
      <span class="tag">{{current.level}}</span>
      <button class="aero-button" @click="shufflePick">Another random activity</button>
    </div>

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

    <div v-else class="speaking">
      <article class="notice"><span class="tag">{{current.level}}</span><h2>{{current.prompt}}</h2><p>Plan your answer, then practise it aloud for 60–90 seconds. Focus on clear organisation, examples, and pronunciation.</p></article>
      <article class="checklist">
        <h3>Self-check</h3>
        <label><input type="checkbox"> I answered every part of the prompt.</label>
        <label><input type="checkbox"> I used a reason and an example.</label>
        <label><input type="checkbox"> I used linking words to organise my ideas.</label>
      </article>
    </div>
  </template>
</section>
</template>
