#!/usr/bin/env python3
"""
============================================================
RUTA EN TU PROYECTO: scripts/generate_audio.py
(archivo NUEVO, va junto a scripts/extract-corpus.mjs)

INSTALACIÓN (una sola vez, en tu máquina, no en el sitio publicado):

  1. Necesitas Python 3 instalado. Verifica con:
       python --version
     (si no lo tienes: https://www.python.org/downloads/)

  2. Instala la única dependencia, edge-tts:
       pip install edge-tts
     Si "pip" no te jala, prueba:
       python -m pip install edge-tts

CÓMO CORRERLO (desde la raíz del proyecto, en tu terminal, DESPUÉS de
haber corrido "node scripts/extract-corpus.mjs" al menos una vez):

    python scripts/generate_audio.py

Qué hace: lee scripts/corpus.json y genera un mp3 por cada entrada que
TODAVÍA no exista en public/audio/. No vuelve a tocar los que ya están,
así que correrlo de nuevo después de agregar contenido nuevo es barato:
solo genera lo nuevo.

Esto corre en TU máquina, nunca en el sitio publicado — el sitio final
solo sirve los .mp3 ya generados como archivos estáticos.
============================================================
"""
import asyncio
import json
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
CORPUS_PATH = ROOT / "scripts" / "corpus.json"
OUT_DIR = ROOT / "public" / "audio"

# Voces neuronales gratuitas de Microsoft (las mismas que usa "Leer en voz
# alta" de Edge). Puedes cambiarlas por otras del catálogo de edge-tts
# (corre `edge-tts --list-voices` para ver todas).
VOICE_BY_LOCALE = {
    "en-US": "en-US-AriaNeural",
    "en-GB": "en-GB-SoniaNeural",
}

RATE_ADJUST = "-8%"  # un poco más lento, más cómodo para practicar oído


async def synthesize(text: str, locale: str, out_path: Path) -> None:
    voice = VOICE_BY_LOCALE[locale]
    communicate = edge_tts.Communicate(text, voice, rate=RATE_ADJUST)
    await communicate.save(str(out_path))


async def main() -> None:
    if not CORPUS_PATH.exists():
        print("No existe scripts/corpus.json. Corre primero:")
        print("  node scripts/extract-corpus.mjs")
        sys.exit(1)

    corpus = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    pending = []
    for entry in corpus:
        out_path = OUT_DIR / f"{entry['id']}.mp3"
        if not out_path.exists():
            pending.append(entry)

    if not pending:
        print("Nada que generar, todo el corpus ya tiene audio.")
        return

    print(f"Generando {len(pending)} de {len(corpus)} audios (los demás ya existían)...")

    for i, entry in enumerate(pending, start=1):
        out_path = OUT_DIR / f"{entry['id']}.mp3"
        print(f"  [{i}/{len(pending)}] {entry['id']} ({entry['locale']})")
        try:
            await synthesize(entry["text"], entry["locale"], out_path)
        except Exception as exc:  # noqa: BLE001
            print(f"    ERROR generando {entry['id']}: {exc}")

    print("Listo.")


if __name__ == "__main__":
    asyncio.run(main())