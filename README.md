# Nahui Skills

Beta en Vue 3 + Vite + TypeScript, instalada y bloqueada con pnpm. Proyecto educativo independiente, no afiliado ni respaldado por el IPN.

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

## Requisitos

- Node.js 24.12+
- pnpm 11

## Uso

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm build
```

## Seguridad de dependencias

- `packageManager` fija pnpm 11.22.0.
- `pnpm-lock.yaml` debe guardarse en Git.
- `minimumReleaseAge: 1440` retrasa paquetes recién publicados 24 horas.
- `blockExoticSubdeps: true` bloquea fuentes transitivas exóticas.
- `trustPolicy: no-downgrade` evita degradaciones en evidencia de confianza.

Conserva el archivo `LICENSE` AGPL-3.0 del repositorio actual.

