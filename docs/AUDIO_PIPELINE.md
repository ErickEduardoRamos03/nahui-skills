# Audio pregrabado — cómo generarlo

Esto corre en TU máquina (o en CI), nunca en el sitio publicado. El sitio
final solo sirve archivos .mp3 estáticos — sigue sin backend, sin cuenta.

## Primera vez

1. Copia `extract-corpus.mjs` y `generate_audio.py` a tu carpeta `scripts/`
   del proyecto (ya existe `scripts/validate-content.js`, van junto a ese).

2. Instala edge-tts (una sola vez, en tu máquina):
   ```
   pip install edge-tts
   ```

3. Extrae el corpus desde tu contenido real:
   ```
   node scripts/extract-corpus.mjs
   ```
   Esto lee `src/data/content.js` y crea `scripts/corpus.json`.

4. Genera los audios:
   ```
   python scripts/generate_audio.py
   ```
   Esto crea `public/audio/<id>-us.mp3` y `public/audio/<id>-gb.mp3` para
   cada texto del corpus. Tarda según cuánto contenido tengas (cada audio
   son un par de segundos de generación).

5. Haz build/deploy normal. Vite sirve todo lo que está en `public/` tal
   cual, así que `public/audio/l1-us.mp3` queda disponible en `/audio/l1-us.mp3`.

## Cuando agregues contenido nuevo

Repite los pasos 3 y 4. `extract-corpus.mjs` regenera el JSON completo,
pero `generate_audio.py` SOLO genera los mp3 que todavía no existan en
`public/audio/` — los que ya generaste antes no se tocan ni se gastan
llamadas de más en ellos.

## Mientras tanto

Si un botón de "Escuchar" apunta a un id que aún no tiene mp3 generado
(porque acabas de agregar la frase y no has corrido el script), la app no
se queda muda: `voice.playAudio()` detecta el 404 y cae automáticamente a
`speechSynthesis` con el texto de respaldo. Suena distinto según el
navegador en ese caso puntual, pero nunca se queda en silencio — y en
cuanto corres el script una vez, ya queda igual de consistente que el
resto.

## Nota sobre voces

`generate_audio.py` usa `en-US-AriaNeural` y `en-GB-SoniaNeural` por
defecto. Si quieres variar (por ejemplo usar voz masculina para algunos
prompts), corre `edge-tts --list-voices` para ver el catálogo completo y
ajusta `VOICE_BY_LOCALE` en el script, o pásale el voice_name por entrada
si quieres variedad dentro del mismo corpus.
