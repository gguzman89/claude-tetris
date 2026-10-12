---
name: clima
description: Obtiene el clima actual y el pronóstico de la ubicación local del usuario (o de una ciudad indicada) usando wttr.in, sin API key. Úsala cuando pregunte por el clima, temperatura, lluvia o pronóstico, o invoque /clima.
---

# Clima local

Consulta el clima con `curl` a [wttr.in](https://wttr.in). No requiere API key.

## Pasos

1. Determinar la ubicación:
   - Si el usuario indicó una ciudad (argumento o mensaje), usarla.
   - Si no, dejar la ubicación vacía: wttr.in la detecta por la IP.
   - Reemplazar espacios por `+` (ej. `Buenos+Aires`).

2. Clima actual + pronóstico de 3 días (formato compacto, en español):

   ```bash
   curl -s "wttr.in/<CIUDAD>?lang=es&m&format=j1"
   ```

   - `m` = unidades métricas (°C, km/h). Quitarlo si el usuario pide °F.
   - `format=j1` devuelve JSON. Campos útiles:
     - `current_condition[0]`: `temp_C`, `FeelsLikeC`, `humidity`, `windspeedKmph`, `winddir16Point`, `precipMM`, `lang_es[0].value` (descripción).
     - `nearest_area[0]`: `areaName[0].value`, `country[0].value` (confirmar la ubicación detectada).
     - `weather[0..2]`: `date`, `maxtempC`, `mintempC`, `hourly[].chanceofrain`.

3. Si solo se quiere una línea rápida:

   ```bash
   curl -s "wttr.in/<CIUDAD>?lang=es&m&format=%l:+%c+%t+(sensación+%f)+💧%h+💨%w"
   ```

4. Responder en español, conciso:
   - Ubicación detectada, temperatura, sensación térmica, condición, humedad, viento.
   - Pronóstico de hoy/mañana (máx/mín, probabilidad de lluvia) si el usuario lo pidió.
   - Si la ubicación se detectó por IP, mencionarlo por si es incorrecta.

## Errores

- Sin salida o timeout: reintentar una vez con `--max-time 10`; si falla, avisar que wttr.in no responde.
- Ciudad no encontrada: pedir al usuario otra ciudad o país.
- No inventar datos: si la consulta falla, no estimar el clima.
