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
- `updateHUD()` se llama explícitamente tras cambios de score/lines/level (incluido al final del handler `keydown`).
- Tema claro/oscuro (oscuro por defecto): `THEMES` en `game.js` guarda paleta de piezas, rejilla, resaltado y alpha del ghost por tema; `COLORS` apunta a la paleta activa. `applyTheme` pone `data-theme` en `<html>` (las variables CSS en `style.css` hacen el resto) y redibuja. Atajo `T` y botón `#theme-toggle`. Colores de pieza nuevos deben añadirse en ambas paletas.
- Dimensiones del canvas acopladas: `COLS×BLOCK` × `ROWS×BLOCK` deben coincidir con `width`/`height` de `<canvas id="board">` en `index.html` (hoy 300×600). El canvas `next-canvas` es 120×120 (4×4 bloques de 30).

## Records, combo y pantalla de inicio

- `#start-screen` se muestra al cargar; el juego no arranca hasta `startGame()` (botón Jugar o Enter), que llama `init()`. `started` es false antes; `keydown` solo atiende Enter/T y `togglePause` no actúa. El script termina con `renderStartScreen()`, no con `init()`.
- Records en `localStorage['tetris.records']` = `{ top: [{name, score, lines, level, date}] (máx 5, desc), bestCombo, maxLines }`. `records` (memoria) es la fuente de verdad; `loadRecords`/`saveRecords` usan try/catch y degradan a memoria. Nombres se pintan con `textContent`.
- `endGame` → `showGameOverRecords`: actualiza bestCombo/maxLines siempre; si el score entra al top muestra input de nombre (`#record-name`, maxlength 12) con vista previa resaltada (`.highlight`); `savePendingRecord` inserta y re-renderiza. Botones "Resetear records" (con `confirm()`) en inicio y game over.
- `combo`: +1 por cada `lockPiece` cuyo `clearLines()` devuelve >0, a 0 si no limpia; `maxComboThisGame` se resetea en `init()`.
- El `keydown` global ignora eventos con `e.target` INPUT/TEXTAREA (escribir el nombre con Space/P/T).
