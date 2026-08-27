import { readingSections, listeningSections, writingPrompts, speakingPrompts, phraseJourneys } from '../src/data/content.js'

const errors = []
const ids = new Set()
function unique(id, label) {
  if (!id) errors.push(`${label}: falta id`)
  else if (ids.has(id)) errors.push(`${label}: id duplicado ${id}`)
  else ids.add(id)
}
for (const [kind, sections] of [['reading', readingSections], ['listening', listeningSections]]) {
  for (const section of sections) {
    unique(section.id, kind)
    if (!section.questions?.length) errors.push(`${section.id}: no tiene preguntas`)
    section.questions?.forEach((q, index) => {
      if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`${section.id} pregunta ${index + 1}: opciones insuficientes`)
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options?.length || 0)) errors.push(`${section.id} pregunta ${index + 1}: respuesta inválida`)
    })
  }
}
writingPrompts.forEach(item => unique(item.id, 'writing'))
phraseJourneys.forEach(item => unique(item.id, 'journey'))
if (!speakingPrompts.length) errors.push('No hay preguntas de speaking')
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`Contenido válido: ${readingSections.length} lecturas, ${listeningSections.length} audios, ${writingPrompts.length} tareas de writing, ${speakingPrompts.length} preguntas de speaking y ${phraseJourneys.length} recorridos.`)
