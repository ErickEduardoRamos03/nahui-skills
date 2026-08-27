import { ref, watch } from 'vue'

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return clone(fallback)
    const saved = JSON.parse(raw)
    if (
      saved && typeof saved === 'object' && !Array.isArray(saved) &&
      fallback && typeof fallback === 'object' && !Array.isArray(fallback)
    ) return { ...clone(fallback), ...saved }
    return saved
  } catch {
    return clone(fallback)
  }
}

export function useLocal(key, fallback) {
  const value = ref(readJSON(key, fallback))
  watch(value, current => {
    try {
      localStorage.setItem(key, JSON.stringify(current))
    } catch (error) {
      console.error(`[Nahui Skills] No se pudo guardar ${key}`, error)
    }
  }, { deep: true })
  return value
}

export function exportData() {
  const payload = {
    schema: 2,
    exportedAt: new Date().toISOString(),
    settings: readJSON('nahui-settings', {}),
    examAnswers: readJSON('nahui-exam-answers', {}),
    progress: readJSON('nahui-progress', {}),
    writing: readJSON('nahui-writing', {}),
    voiceUS: localStorage.getItem('nahui-voice-en-US') || '',
    voiceGB: localStorage.getItem('nahui-voice-en-GB') || ''
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'nahui-skills-backup.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function importData(file) {
  const obj = JSON.parse(await file.text())
  if (![1, 2].includes(obj?.schema)) throw new Error('Respaldo incompatible')
  if (obj.settings && typeof obj.settings === 'object') localStorage.setItem('nahui-settings', JSON.stringify(obj.settings))
  if (obj.writing && typeof obj.writing === 'object') localStorage.setItem('nahui-writing', JSON.stringify(obj.writing))
  if (obj.progress && typeof obj.progress === 'object') localStorage.setItem('nahui-progress', JSON.stringify(obj.progress))
  if (obj.schema >= 2) {
    if (obj.examAnswers && typeof obj.examAnswers === 'object') localStorage.setItem('nahui-exam-answers', JSON.stringify(obj.examAnswers))
    if (typeof obj.voiceUS === 'string') localStorage.setItem('nahui-voice-en-US', obj.voiceUS)
    if (typeof obj.voiceGB === 'string') localStorage.setItem('nahui-voice-en-GB', obj.voiceGB)
  }
  location.reload()
}
