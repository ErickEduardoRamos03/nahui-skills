// ============================================================
// RUTA EN TU PROYECTO: scripts/extract-corpus.mjs
// (archivo nuevo, junto a scripts/generate_audio.py y
// scripts/validate-content.js)
//
// QUÉ HACE: lee src/data/content.js, toma los guiones de
// listeningSections, phraseJourneys, y los audios del examinador
// de Speaking (speakingExaminerLines y careerExaminerTracks), y genera
// scripts/corpus.json con DOS entradas por texto: en-US y en-GB.
// ============================================================
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { listeningSections, phraseJourneys, speakingExaminerLines, careerExaminerTracks } from '../src/data/content.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, 'corpus.json')

const LOCALES = [
  { suffix: 'us', locale: 'en-US' },
  { suffix: 'gb', locale: 'en-GB' }
]

const corpus = []
const warnings = []

// 1. Listening Sections
for (const section of listeningSections || []) {
  if (!section.id) { warnings.push('Sección de listening sin id, se omite.'); continue }
  if (!section.script || !section.script.trim()) {
    warnings.push(`${section.id}: no tiene "script", se omite (no habrá audio pregrabado).`)
    continue
  }
  for (const { suffix, locale } of LOCALES) {
    corpus.push({ id: `${section.id}-${suffix}`, locale, text: section.script })
  }
}

// 2. Phrase journeys
for (const journey of phraseJourneys || []) {
  if (!journey.id) { warnings.push('Phrase journey sin id, se omite.'); continue }
  for (const { suffix, locale } of LOCALES) {
    const text = journey[suffix]?.text
    if (!text || !text.trim()) {
      warnings.push(`${journey.id}-${suffix}: no tiene texto, se omite (no habrá audio pregrabado).`)
      continue
    }
    corpus.push({ id: `${journey.id}-${suffix}`, locale, text })
  }
}

// 3. Speaking Examiner Global Lines
for (const line of speakingExaminerLines || []) {
  if (!line.id || !line.text) continue
  for (const { suffix, locale } of LOCALES) {
    corpus.push({ id: `${line.id}-${suffix}`, locale, text: line.text })
  }
}

// 4. Speaking Career Tracks (Intro reactions, stage questions & transition reactions)
if (careerExaminerTracks) {
  for (const trackKey of Object.keys(careerExaminerTracks)) {
    const track = careerExaminerTracks[trackKey]
    if (!track) continue

    const itemsToAdd = [
      track.introReaction,
      track.stage2 ? { id: track.stage2.id, text: track.stage2.question } : null,
      track.stage2Reaction,
      track.stage3 ? { id: track.stage3.id, text: track.stage3.question } : null,
      track.stage3Reaction,
      track.stage4 ? { id: track.stage4.id, text: track.stage4.question } : null
    ].filter(Boolean)

    for (const item of itemsToAdd) {
      if (!item.id || !item.text) continue
      for (const { suffix, locale } of LOCALES) {
        corpus.push({ id: `${item.id}-${suffix}`, locale, text: item.text })
      }
    }
  }
}

writeFileSync(OUT_PATH, JSON.stringify(corpus, null, 2) + '\n', 'utf-8')

console.log(`corpus.json generado con ${corpus.length} entradas de audio (Listenings, Journeys y Speaking Examiner).`)
if (warnings.length) {
  console.log('\nAvisos:')
  for (const w of warnings) console.log(`  - ${w}`)
}
