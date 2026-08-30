<script setup>
import { computed, ref } from 'vue'
import { vocabularyEntries } from '../data/vocabulary'

const level = ref('all')
const category = ref('all')
const query = ref('')
const categories = [...new Set(vocabularyEntries.map(entry => entry.category))]
const entries = computed(() => {
  const term = query.value.trim().toLocaleLowerCase('es-MX')
  return vocabularyEntries.filter(entry =>
    (level.value === 'all' || entry.level === level.value) &&
    (category.value === 'all' || entry.category === category.value) &&
    (!term || Object.values(entry).some(value => String(value).toLocaleLowerCase('es-MX').includes(term)))
  )
})
</script>

<template>
  <section class="panel vocabulary">
    <div class="eyebrow">B1 + B2 · México · US · UK</div>
    <h1>Vocabulario universitario</h1>
    <p class="lede">Equivalencias prácticas para estudiar, describir carreras y preparar trámites. Para una traducción certificada, conserva el nombre oficial que figure en tu documento.</p>

    <div class="toolbar vocabulary-filters">
      <input v-model="query" type="search" placeholder="Buscar en español o inglés" aria-label="Buscar vocabulario">
      <select v-model="level" aria-label="Filtrar por nivel">
        <option value="all">Todos los niveles</option>
        <option value="B1">B1</option>
        <option value="B2">B2</option>
      </select>
      <select v-model="category" aria-label="Filtrar por categoría">
        <option value="all">Todas las categorías</option>
        <option v-for="item in categories" :key="item" :value="item">{{ item }}</option>
      </select>
    </div>

    <p class="tag">{{ entries.length }} términos</p>
    <div class="vocabulary-grid">
      <article v-for="entry in entries" :key="entry.id" class="vocabulary-card">
        <div><span class="tag">{{ entry.level }}</span> <span class="vocabulary-category">{{ entry.category }}</span></div>
        <h2>{{ entry.es }}</h2>
        <dl>
          <div><dt>US</dt><dd>{{ entry.us }}</dd></div>
          <div><dt>UK</dt><dd>{{ entry.gb }}</dd></div>
        </dl>
        <p class="note">{{ entry.note }}</p>
      </article>
    </div>
    <p v-if="!entries.length" class="empty-history">No hay términos que coincidan con los filtros.</p>
  </section>
</template>
