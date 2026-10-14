# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Tetris en JS vanilla + Canvas 2D. Sin `package.json`, build, linter ni tests. README en español; UI y comentarios también en español.

## Ejecutar

- `open index.html`, o servidor estático: `python3 -m http.server 8000` → `http://localhost:8000`.

## Arquitectura

Tres archivos: `index.html` (DOM + canvas), `style.css`, `game.js` (toda la lógica, script único, `'use strict'`, estado en variables globales de módulo).

- Tablero: matriz `ROWS×COLS` con `0` o índice 1–8. Ese índice sirve a la vez para `PIECES` y `COLORS` (índice 0 = `null`); piezas nuevas deben añadirse en `PIECES` y en las paletas de `SKINS` (`randomPiece` usa `PIECES.length - 1`). El índice 8 es la tuerca (anillo 3×3 con hueco central, pieza challenge).
- Flujo de pieza: `loop` (rAF, acumula `dropAccum` vs `dropInterval`) / `softDrop` / `hardDrop` → `lockPiece` → `merge` → `clearLines` → `spawn`. `spawn` llama `endGame()` si la pieza nueva colisiona.
- Pausa y game over cancelan el rAF (`animId`); `togglePause` reanuda llamando `loop` directamente; `init()` (también el botón reiniciar) resetea todo el estado.
- `updateHUD()` se llama explícitamente tras cambios de score/lines/level (incluido al final del handler `keydown`).
- Skins (retro por defecto, neon, pastel, pixel; reemplazan al antiguo tema claro/oscuro): `SKINS` en `game.js` guarda por skin `label`, `colors[0..8]`, `grid`, `ghostAlpha` y `draw` (función de bloque `(ctx, px, py, size, color)`); `COLORS` apunta a la paleta activa y `drawBlock` delega en la `draw` de la skin. `applySkin` pone `data-skin` en `<html>` (variables CSS por skin en `style.css`), guarda en `localStorage` (`tetris-skin`, fallback retro) y redibuja. Selector `#skin-select` y atajo `T` (cicla). Colores de pieza nuevos deben añadirse en las 4 paletas.
- Dimensiones del canvas acopladas: `COLS×BLOCK` × `ROWS×BLOCK` deben coincidir con `width`/`height` de `<canvas id="board">` en `index.html` (hoy 300×600). El canvas `next-canvas` es 120×120 (4×4 bloques de 30).
