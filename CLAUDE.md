# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Tetris en JS vanilla + Canvas 2D. Sin `package.json`, build, linter ni tests. README en español; UI y comentarios también en español.

## Ejecutar

- `open index.html`, o servidor estático: `python3 -m http.server 8000` → `http://localhost:8000`.

## Arquitectura

Tres archivos: `index.html` (DOM + canvas), `style.css`, `game.js` (toda la lógica, script único, `'use strict'`, estado en variables globales de módulo).

- Tablero: matriz `ROWS×COLS` con `0` o índice 1–8. Ese índice sirve a la vez para `PIECES` y `COLORS` (índice 0 = `null`); piezas nuevas deben añadirse en `PIECES` y en ambas paletas de `COLORS` (`randomPiece` usa `PIECES.length - 1`). El índice 8 es la tuerca (anillo 3×3 con hueco central, pieza challenge).
- Flujo de pieza: `loop` (rAF, acumula `dropAccum` vs `dropInterval`) / `softDrop` / `hardDrop` → `lockPiece` → `merge` → `clearLines` → `spawn`. `spawn` llama `endGame()` si la pieza nueva colisiona.
- Pausa y game over cancelan el rAF (`animId`); `togglePause` reanuda llamando `loop` directamente; `init()` (también el botón reiniciar) resetea todo el estado.
- Menú de pausa: `P`/`Escape` → `togglePause` muestra/oculta `#pause-menu` (separado de `#overlay`, que es solo game over). Botones Reanudar, Reiniciar (`init`), Ver controles (lista colapsable) y `<select>` de nivel inicial. Mientras `paused`, `keydown` ignora todo salvo P/Esc; tras reanudar o `init` se ignora input `INPUT_LOCK_MS` (150 ms, `inputLockUntil`). Botones hacen `blur()` tras click.
- `startLevel` (1–10, persistido en localStorage `tetris.startLevel`, try/catch): `init` hace `level = startLevel`; `intervalForLevel(level)` da el `dropInterval`; `clearLines` usa `Math.max(startLevel, floor(lines/10)+1)`.
- `updateHUD()` se llama explícitamente tras cambios de score/lines/level (incluido al final del handler `keydown`).
- Tema claro/oscuro (oscuro por defecto): `THEMES` en `game.js` guarda paleta de piezas, rejilla, resaltado y alpha del ghost por tema; `COLORS` apunta a la paleta activa. `applyTheme` pone `data-theme` en `<html>` (las variables CSS en `style.css` hacen el resto) y redibuja. Atajo `T` y botón `#theme-toggle`. Colores de pieza nuevos deben añadirse en ambas paletas.
- Dimensiones del canvas acopladas: `COLS×BLOCK` × `ROWS×BLOCK` deben coincidir con `width`/`height` de `<canvas id="board">` en `index.html` (hoy 300×600). El canvas `next-canvas` es 120×120 (4×4 bloques de 30).
