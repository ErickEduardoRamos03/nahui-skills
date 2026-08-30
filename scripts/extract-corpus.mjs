// ============================================================
// RUTA EN TU PROYECTO: scripts/extract-corpus.mjs
// (archivo nuevo, junto a scripts/generate_audio.py y
// scripts/validate-content.js)
//
// QUÉ HACE: lee src/data/content.js, toma únicamente los guiones de
// listeningSections (son los únicos reproducidos con audio pregrabado
// vía voice.playAudio() — ver src/composables/useVoice.js) y genera
// scripts/corpus.json con DOS entradas por sección: una en-US y otra
// en-GB, con el sufijo ya incluido en el id ("l1-us", "l1-gb", ...)
// para que coincida exactamente con lo que pide el frontend:
//   /audio/${id}-${us|gb}.mp3
//
// CÓMO CORRERLO (desde la raíz del proyecto):
//   node scripts/extract-corpus.mjs
// ============================================================
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { listeningSections } from '../src/data/content.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, 'corpus.json')

const LOCALES = [
  { suffix: 'us', locale: 'en-US' },
  { suffix: 'gb', locale: 'en-GB' }
]

const corpus = []
const warnings = []

for (const section of listeningSections) {
  if (!section.id) { warnings.push('Sección de listening sin id, se omite.'); continue }
  if (!section.script || !section.script.trim()) {
    warnings.push(`${section.id}: no tiene "script", se omite (no habrá audio pregrabado).`)
    continue
  }
  for (const { suffix, locale } of LOCALES) {
    corpus.push({ id: `${section.id}-${suffix}`, locale, text: section.script })
  }
}

writeFileSync(OUT_PATH, JSON.stringify(corpus, null, 2) + '\n', 'utf-8')

console.log(`corpus.json generado con ${corpus.length} entradas (${listeningSections.length} secciones × 2 variantes).`)
if (warnings.length) {
  console.log('\nAvisos:')
  for (const w of warnings) console.log(`  - ${w}`)
}
