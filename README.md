# Nahui Skills

> Hotfix 0.7.1: corrige rutas directas `/practice/reading`, `/practice/listening`, `/practice/writing` y `/practice/speaking`, además de navegación atrás/adelante.

Nahui Skills es un simulador educativo local de Reading, Listening, Writing y Speaking, construido con Vue 3 + Vite + JavaScript. Incluye comparación entre inglés estadounidense y británico, práctica de voz y micrófono, y una sección experimental de historia del inglés.

Proyecto educativo independiente, no afiliado ni respaldado por el IPN.

## Trademark notice

Nahui Skills and its associated visual identity are trademarks or
trademark applications of their respective owner.

The AGPL-3.0 license applies to the source code only. It does not grant
permission to use the Nahui Skills name, logo, branding or visual identity
to represent modified or derivative projects as official versions.

## Aviso de marca

Nahui Skills y su identidad visual son signos distintivos de su titular.

La licencia AGPL-3.0 se aplica únicamente al código fuente. No concede
permiso para utilizar el nombre, logotipo, identidad gráfica o elementos
de marca de Nahui Skills para presentar modificaciones o proyectos
derivados como versiones oficiales.

## Funciones

- Simulador B2 de cuatro habilidades con contenido original.
- Reading y Listening con 2 secciones y 15 reactivos.
- Writing con selección de tarea, autoguardado y contador de 120-140 palabras.
- Speaking con voces en-US/en-GB, diagnóstico del micrófono y grabación local.
- English Through Time con frases modernas, comparación BrE/AmE y adaptaciones históricas etiquetadas por estado y confianza.
- Preferencias, respuestas y borradores guardados en el navegador.
- Exportación e importación de respaldo JSON.
- Diseño Frutiger Aero responsive para escritorio y móvil.
- Service Worker básico para caché progresiva de la interfaz.

## Privacidad y almacenamiento

No hay registro, cuentas ni backend. Los datos de progreso se guardan en `localStorage`. Las grabaciones se mantienen como URL temporal durante la sesión y no se envían a ningún servidor. Borrar los datos del navegador elimina el progreso local.

## Fuentes y contenido

La estructura del simulador toma como referencia metodológica la guía pública de cuatro habilidades B2 del CENLEX Zacatenco. Las explicaciones lingüísticas se redactan como contenido original y las adaptaciones históricas se etiquetan como tales. Los libros de consulta no se redistribuyen dentro del repositorio.

Este proyecto no ofrece una calificación oficial. Los resultados y listas de revisión son orientativos.

## Requisitos

- Node.js 24.12+
- pnpm 11.22+

## Uso

```bash
corepack enable
pnpm install
pnpm dev
```

Para compilar:

```bash
pnpm build
pnpm preview
```

El micrófono requiere `localhost` o HTTPS.

## Licencia

El código fuente se distribuye bajo GNU Affero General Public License v3. Conserva el archivo `LICENSE` y los avisos de marca al redistribuir o modificar el proyecto.
