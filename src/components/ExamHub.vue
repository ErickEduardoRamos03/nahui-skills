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
      <textarea v-model="draft" rows="14" placeholder="Write your response in English..."></textarea>
      <div class="wordbar" :class="{ok:wordCount>=120 && wordCount<=160}">{{wordCount}} words · target: 120–160</div>
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
