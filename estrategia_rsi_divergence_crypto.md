
# Estrategia cuantitativa para criptomonedas: RSI Divergence + Regime + Structure + ATR

> **Objetivo**  
> Diseñar un sistema **mecánico, lógico y automatizable** para las principales criptomonedas, basado solo en el comportamiento del precio, el impulso y la volatilidad.  
> No intenta “adivinar” noticias ni macroeventos: **reacciona** a lo que el mercado ya está mostrando en el gráfico.

---

## 1) Idea central

Las tres ideas base que inspiraron este documento coinciden en algo importante:

1. **La divergencia RSI detecta desacoplos entre precio y momentum**.  
2. **No debe operarse sola**. Necesita confirmación de estructura.  
3. **Funciona mejor en marcos altos, tras movimientos prolongados y con gestión de riesgo**.

A partir de eso, la estrategia que propongo añade dos capas cuantitativas para volverla robusta y automatizable:

- **Filtro de régimen**: no operar todas las divergencias; solo las que ocurren dentro de una estructura de mercado favorable.
- **Filtro de volatilidad**: evitar entornos demasiado muertos o demasiado caóticos.
- **Confirmación estructural**: entrar solo cuando el precio demuestra que el giro o la continuación está ocurriendo de verdad.
- **Gestión matemática del riesgo**: stop, tamaño y salidas definidos por ATR y por múltiplos de riesgo.

El resultado es un sistema de 4 bloques:

1. **Régimen** -> ¿mercado alcista, bajista o neutro?  
2. **Setup** -> ¿hay divergencia válida?  
3. **Trigger** -> ¿el precio confirma?  
4. **Riesgo/Salida** -> ¿cómo se entra, dónde invalida y dónde se cobra?  

---

## 2) Por qué esta lógica puede funcionar sin “saber lo que pasa en el mundo”

No porque las noticias no importen, sino porque este sistema **no intenta predecir causas**, solo medir efectos:

- El **precio** recoge la presión compradora/vendedora.
- El **RSI** mide el cambio relativo entre avances y caídas recientes.
- La **estructura** muestra si el mercado sigue respetando máximos/mínimos.
- El **ATR** mide cuánto se está moviendo realmente el activo.

En otras palabras:  
**si el mercado cambia de estado, eso termina apareciendo en la serie temporal del precio**.  
La estrategia se construye para reaccionar a ese cambio con reglas objetivas.

---

## 3) Universo y marco temporal recomendado

### Universo ideal
Aplicable a activos líquidos y grandes, por ejemplo:

- BTC
- ETH
- SOL
- BNB
- XRP
- ADA
- DOGE
- AVAX

### Qué evitar
- Microcaps
- Tokens con poca liquidez
- Activos con spreads amplios
- Mercados con huecos artificiales o baja profundidad

### Timeframes recomendados
Configuración base:

- **Marco de contexto (HTF)**: **1D**
- **Marco de ejecución (ETF)**: **4H**

Esta combinación equilibra bien:

- menos ruido que 15m/1h,
- más señales que operar solo diario,
- y suficiente estabilidad para automatizar alertas sin sobreajuste.

### Variantes
- **Más agresivo**: 4H / 1H
- **Más conservador**: 1W / 1D

---

## 4) Indicadores y fórmulas

## 4.1 RSI

Usaremos **RSI de 14 períodos**.

Fórmula conceptual:

\[
RSI = 100 - \frac{100}{1 + RS}
\]

donde

\[
RS = \frac{\text{media de cierres alcistas}}{\text{media de cierres bajistas}}
\]

Interpretación:

- RSI alto = el avance reciente domina
- RSI bajo = la caída reciente domina
- Lo importante aquí **no es solo 70/30**, sino la relación entre los pivots del precio y los pivots del RSI

---

## 4.2 ATR

Usaremos **ATR de 14 períodos** para:

- dimensionar el stop,
- filtrar volatilidad,
- normalizar el comportamiento entre activos distintos.

Definición simplificada:

\[
ATR = \text{media suavizada del True Range}
\]

y

\[
TR = \max(H-L,\ |H-C_{prev}|,\ |L-C_{prev}|)
\]

---

## 4.3 EMAs del régimen

Para determinar la dirección dominante del activo:

- **EMA 50** del marco de contexto
- **EMA 200** del marco de contexto

---

## 4.4 Pivots confirmados

Para automatizar divergencias, no conviene usar “ojímetro”.  
Definimos pivots confirmados con una ventana simétrica:

- `left = 5`
- `right = 5`

Eso significa que un pivot solo se confirma cuando han cerrado 5 velas posteriores.  
Es menos rápido, pero mucho más limpio para un bot de alertas.

---

## 5) Definiciones de divergencia que usará el sistema

## 5.1 Divergencia alcista regular
- Precio: **mínimo más bajo**
- RSI: **mínimo más alto**

Lectura: el precio cae más, pero el momentum bajista cae menos.  
Posible **reversión al alza**.

## 5.2 Divergencia bajista regular
- Precio: **máximo más alto**
- RSI: **máximo más bajo**

Lectura: el precio sube más, pero el momentum alcista sube menos.  
Posible **reversión a la baja**.

## 5.3 Divergencia alcista oculta
- Precio: **mínimo más alto**
- RSI: **mínimo más bajo**

Lectura: hay retroceso, pero la estructura alcista sigue viva.  
Posible **continuación alcista**.

## 5.4 Divergencia bajista oculta
- Precio: **máximo más bajo**
- RSI: **máximo más alto**

Lectura: hay rebote, pero la estructura bajista sigue viva.  
Posible **continuación bajista**.

---

## 6) Filosofía operativa del sistema

La mayoría pierde con RSI divergence por tres motivos:

1. operan **contra tendencia** sin filtro,
2. entran **antes de confirmación**,
3. no diferencian **reversión** de **continuación**.

Por eso este sistema separa dos motores:

### Motor A: continuación de tendencia (**principal**)
- Se apoya en **divergencias ocultas**
- Es el que más peso tendrá
- Es el más apto para automatización estable

### Motor B: reversión de swing (**secundario**)
- Se apoya en **divergencias regulares**
- Requiere filtros extra
- Debe operarse con menor tamaño

**Regla de oro**:  
El sistema gana estabilidad cuando **prioriza continuaciones y trata las reversiones como setups premium, no como señal estándar**.

---

## 7) Clasificación del régimen de mercado

Todo empieza aquí.

Definimos el régimen en el **1D**.

## 7.1 Régimen alcista
Se cumple todo:

1. `Close_D > EMA200_D`
2. `EMA50_D > EMA200_D`
3. `Slope(EMA50_D, 5) > 0`

Una forma práctica de la pendiente:

\[
Slope_{EMA50} = \frac{EMA50_t - EMA50_{t-5}}{EMA50_{t-5}}
\]

Si es positiva, la media rápida no solo está encima, sino ascendiendo.

## 7.2 Régimen bajista
Se cumple todo:

1. `Close_D < EMA200_D`
2. `EMA50_D < EMA200_D`
3. `Slope(EMA50_D, 5) < 0`

## 7.3 Régimen neutro
Todo lo demás.

---

## 8) Filtro de volatilidad

No queremos operar:

- cuando el mercado está muerto,
- ni cuando está histérico.

Definimos:

\[
VolRatio = \frac{ATR14_{4H}}{SMA(ATR14_{4H}, 30)}
\]

Solo permitimos setups si:

\[
0.8 \le VolRatio \le 1.8
\]

Interpretación:

- **< 0.8** -> poco movimiento, más ruido, peor relación señal/ruido
- **> 1.8** -> volatilidad anómala, más barridos, peor estabilidad de ejecución

Este filtro es mejor que imponer un ATR fijo, porque se adapta a BTC, ETH, SOL, etc.

---

## 9) Setup principal: continuación con divergencia oculta

Este es el núcleo de la estrategia.

## 9.1 Long de continuación

### Condiciones
1. Régimen **alcista** en 1D.
2. En 4H aparece **divergencia alcista oculta**:
   - precio hace **higher low**
   - RSI hace **lower low**
3. El segundo pivot de precio ocurre:
   - por encima de la **EMA50 de 4H**,  
   **o**
   - como máximo a una distancia de **1 ATR** por debajo de esa EMA.
4. `VolRatio` válido.
5. RSI del segundo pivot entre **30 y 55**.
   - si está demasiado alto, el pullback fue muy superficial
   - si está extremadamente bajo, puede haber rotura real de estructura

### Confirmación
No se entra al detectar la divergencia.  
Se entra solo si el precio **rompe la estructura del pullback**.

Trigger recomendado:

- detectar el **máximo intermedio** entre los dos mínimos del setup,
- entrar cuando una vela 4H **cierra por encima** de ese máximo intermedio.

Ese cierre es la prueba de que la continuación no es solo una hipótesis.

### Entrada
- Entrada al cierre de la vela de confirmación  
  **o**
- orden límite en el retest del nivel roto, si el bot permite lógica de reentrada.

### Stop
Para long:

\[
Stop = \min(PivotLow_2 - 0.5 \times ATR,\ Entry - 1.8 \times ATR)
\]

La idea es que el stop quede **por debajo de la invalidez estructural**, no demasiado pegado.

### Objetivos
Sea:

\[
R = Entry - Stop
\]

Entonces:

- **TP1** = `Entry + 1R`
- **TP2** = `Entry + 2.5R`

Gestión:

- cerrar **40%** en TP1
- mover stop a **breakeven**
- cerrar **40%** en TP2
- dejar **20%** con trailing

### Trailing final
Salir del remanente si ocurre cualquiera:

- cierre 4H por debajo de la **EMA20**
- RSI cae por debajo de **50** tras haber alcanzado TP1
- aparece divergencia bajista oculta opuesta

---

## 9.2 Short de continuación

Simétrico.

### Condiciones
1. Régimen **bajista** en 1D.
2. En 4H aparece **divergencia bajista oculta**:
   - precio hace **lower high**
   - RSI hace **higher high**
3. El segundo pivot ocurre cerca de la EMA50 4H.
4. `VolRatio` válido.
5. RSI del segundo pivot entre **45 y 70**.

### Confirmación
- romper con cierre el **mínimo intermedio** entre los dos máximos del setup.

### Stop
\[
Stop = \max(PivotHigh_2 + 0.5 \times ATR,\ Entry + 1.8 \times ATR)
\]

### Objetivos
- TP1 = `Entry - 1R`
- TP2 = `Entry - 2.5R`
- resto con trailing sobre EMA20 o RSI > 50 tras TP1

---

## 10) Setup secundario: reversión con divergencia regular

Este módulo existe, pero debe tratarse como **setup selectivo**, no como pan diario.

## 10.1 Long de reversión

### Condiciones
1. Régimen **neutro** o **bajista debilitado**.
2. En 4H aparece **divergencia alcista regular**:
   - precio hace lower low
   - RSI hace higher low
3. El segundo pivot tiene RSI **< 35**
4. La distancia del precio a la EMA20 4H en el segundo pivot es al menos **1 ATR**  
   (queremos una extensión real, no una pseudo divergencia en lateral)
5. `VolRatio` válido.

### Confirmación
Solo si ocurre ambas:

1. cierre 4H por encima del **máximo intermedio**
2. cierre 4H por encima de la **EMA20**

### Riesgo
Este setup va con:

- **mitad de tamaño**
- o bien **50% del riesgo estándar**

### Salidas
- TP1 = 1R
- TP2 = 2R o llegada a EMA50 1D
- resto fuera si RSI > 65 y vuelve a cerrar por debajo de 60

---

## 10.2 Short de reversión

Simétrico:

- régimen neutro o alcista debilitado,
- divergencia bajista regular,
- RSI segundo pivot > 65,
- extensión mínima de 1 ATR sobre EMA20,
- confirmación con ruptura y pérdida de EMA20.

---

## 11) Gestión monetaria y tamaño de posición

Esta parte no es secundaria: es el corazón matemático.

## 11.1 Riesgo por trade
Recomendación base:

- **0.5% del capital por operación**
- máximo **0.75%** en BTC/ETH
- máximo **0.25%–0.50%** en alts más violentas

## 11.2 Fórmula de tamaño

Sea:

- `Capital` = equity total
- `r` = porcentaje de riesgo por trade
- `Entry` = precio de entrada
- `Stop` = precio de stop

Entonces:

\[
RiskAmount = Capital \times r
\]

\[
PositionSize = \frac{RiskAmount}{|Entry - Stop|}
\]

Si operas futuros, el apalancamiento **no debe definir el riesgo**;  
el riesgo lo define la distancia al stop y el tamaño calculado.

## 11.3 Correlación
Las majors cripto suelen ir correlacionadas.  
Regla sensata:

- no tener más de **2 posiciones fuertemente correlacionadas** en la misma dirección,
- o reducir el riesgo por trade cuando varias señales se disparan a la vez.

Ejemplo:
- si entran BTC, ETH y SOL long en la misma sesión, no son 3 riesgos independientes.

## 11.4 Time stop
Una operación que no se mueve a favor en un tiempo razonable suele ser una mala operación.

Regla:

- si tras **10 velas de 4H** no alcanzó TP1,
- y además cierra 2 veces contra EMA20,
- salir o reducir agresivamente.

---

## 12) Sistema de alertas para bot

El bot no debe lanzar una sola alerta genérica.  
Debe trabajar por estados.

## 12.1 Estado 1: WATCH
Se activa cuando:

- ya existe divergencia confirmada por pivots,
- el régimen es válido,
- la volatilidad es válida,
- pero **aún no hay ruptura estructural**.

Ejemplo:

- `WATCH_LONG_CONTINUATION`
- `WATCH_SHORT_CONTINUATION`
- `WATCH_LONG_REVERSAL`
- `WATCH_SHORT_REVERSAL`

## 12.2 Estado 2: ENTRY
Se activa cuando:

- se cumple el setup completo,
- y la vela de confirmación cierra validando el trigger.

Ejemplo:

- `ENTER_LONG`
- `ENTER_SHORT`

## 12.3 Estado 3: MANAGEMENT
Se activa cuando se alcanza:

- `TP1_HIT`
- `MOVE_STOP_BE`
- `TP2_HIT`

## 12.4 Estado 4: EXIT
Se activa cuando:

- stop-loss,
- trailing stop,
- invalidación estructural,
- señal opuesta suficientemente fuerte.

---

## 13) Formato de alerta sugerido

```json
{
  "system": "RSI_REGIME_STRUCTURE_ATR",
  "symbol": "BTCUSDT",
  "timeframe": "4H",
  "setup": "HIDDEN_BULLISH_CONTINUATION",
  "state": "ENTER_LONG",
  "entry": 65250.0,
  "stop": 63580.0,
  "tp1": 66920.0,
  "tp2": 69425.0,
  "risk_pct": 0.5,
  "vol_ratio": 1.12,
  "htf_regime": "BULL",
  "timestamp": "2026-04-23T12:00:00Z"
}
```

Esto permite conectar TradingView o cualquier motor similar a:

- Telegram
- Discord
- Slack
- Webhook hacia exchange/broker
- Base de datos de logs
- Motor propio de ejecución

---

## 14) Pseudocódigo lógico del sistema

```text
INPUTS:
  rsi_len = 14
  atr_len = 14
  ema_fast_htf = 50
  ema_slow_htf = 200
  ema_trail_etf = 20
  pivot_left = 5
  pivot_right = 5
  risk_pct = 0.5%

DATA:
  HTF = 1D
  ETF = 4H

STEP 1: Determine regime
  bull_regime = close_D > ema200_D AND ema50_D > ema200_D AND slope(ema50_D,5) > 0
  bear_regime = close_D < ema200_D AND ema50_D < ema200_D AND slope(ema50_D,5) < 0
  neutral_regime = NOT bull_regime AND NOT bear_regime

STEP 2: Determine volatility filter
  vol_ratio = ATR14_4H / SMA(ATR14_4H, 30)
  vol_ok = 0.8 <= vol_ratio <= 1.8

STEP 3: Build confirmed pivots
  get last two confirmed price pivot lows/highs
  get last two confirmed RSI pivot lows/highs

STEP 4: Detect divergences
  hidden_bull = price_low_2 > price_low_1 AND rsi_low_2 < rsi_low_1
  hidden_bear = price_high_2 < price_high_1 AND rsi_high_2 > rsi_high_1
  regular_bull = price_low_2 < price_low_1 AND rsi_low_2 > rsi_low_1
  regular_bear = price_high_2 > price_high_1 AND rsi_high_2 < rsi_high_1

STEP 5: Create WATCH state
  if bull_regime AND hidden_bull AND vol_ok -> WATCH_LONG_CONTINUATION
  if bear_regime AND hidden_bear AND vol_ok -> WATCH_SHORT_CONTINUATION
  if neutral_or_weak_bear AND regular_bull AND vol_ok -> WATCH_LONG_REVERSAL
  if neutral_or_weak_bull AND regular_bear AND vol_ok -> WATCH_SHORT_REVERSAL

STEP 6: Confirmation trigger
  long_trigger = close_4H > intermediate_swing_high AND close_4H > EMA20_4H
  short_trigger = close_4H < intermediate_swing_low AND close_4H < EMA20_4H

STEP 7: Fire ENTRY alert
  if WATCH_LONG_x AND long_trigger -> ENTER_LONG
  if WATCH_SHORT_x AND short_trigger -> ENTER_SHORT

STEP 8: Risk
  stop = structural_invalidation +/- ATR buffer
  size = (capital * risk_pct) / abs(entry - stop)

STEP 9: Management
  if price reaches 1R -> TP1_HIT and move stop to breakeven
  if price reaches 2.5R -> TP2_HIT
  if trailing condition breaks -> EXIT
```

---

## 15) Parámetros por defecto

| Parámetro | Valor base | Comentario |
|---|---:|---|
| RSI | 14 | estándar y suficientemente robusto |
| ATR | 14 | volatilidad y stops |
| EMA HTF rápida | 50 | dirección intermedia |
| EMA HTF lenta | 200 | dirección de fondo |
| EMA ETF trailing | 20 | trailing y filtro de trigger |
| Pivot left/right | 5 / 5 | reduce ruido |
| Timeframe contexto | 1D | filtro de régimen |
| Timeframe ejecución | 4H | entrada operable |
| VolRatio min | 0.8 | evita mercado muerto |
| VolRatio max | 1.8 | evita anomalías |
| Riesgo por trade | 0.5% | base prudente |
| TP1 | 1R | liberar presión |
| TP2 | 2.5R | capturar impulso |
| Time stop | 10 velas 4H | evita capital inmovilizado |

---

## 16) Checklist operativo manual

Antes de cualquier trade, responder:

1. ¿El activo es líquido?
2. ¿El régimen diario es claro?
3. ¿La volatilidad está en rango normal?
4. ¿La divergencia está confirmada por pivots cerrados?
5. ¿Es oculta (continuación) o regular (reversión)?
6. ¿Hay ruptura estructural real?
7. ¿El stop está bajo/encima de invalidez, no arbitrario?
8. ¿La posición respeta el riesgo fijo?
9. ¿Estoy duplicando exposición con otra cripto correlacionada?
10. ¿Tengo plan de salida antes de entrar?

Si una respuesta es “no”, el trade se descarta.

---

## 17) Cómo aplicarlo bien a las principales criptos

## BTC
- Mejor activo para la versión base
- Suele respetar mejor estructura y pivots
- Ideal para empezar a testear el sistema

## ETH
- Muy válido
- Algo más nervioso que BTC, pero excelente para divergencias bien filtradas

## SOL / AVAX / DOGE
- Más violentas
- Mantener el mismo sistema, pero:
  - reducir riesgo por trade
  - exigir con más rigor el filtro de volatilidad
  - aceptar más slippage

## XRP / ADA / BNB
- También válidas
- Conviene revisar si el activo atraviesa fases largas de compresión lateral
- En laterales largos, el sistema pierde calidad

---

## 18) Errores más comunes

1. **Operar divergencias en rango**
   - La divergencia tiene más valor tras tramos tendenciales o extensiones claras.
2. **Entrar antes de la ruptura**
   - Ver divergencia no es lo mismo que tener señal.
3. **Sobreactuar con RSI 70/30**
   - La divergencia importa más que el número aislado.
4. **Pivots sin confirmar**
   - Un bot no debe leer pivots “a medio formar”.
5. **Stops demasiado cortos**
   - En cripto, eso es invitar a que te barran.
6. **Ignorar correlación**
   - Tres longs de majors no son tres apuestas separadas.
7. **Optimizar demasiado**
   - Ajustar mil parámetros al pasado destruye la robustez.

---

## 19) Plan serio de backtesting

Antes de automatizar de verdad, haría esto:

## Fase A: backtest básico
- BTC, ETH, SOL
- 4H con contexto 1D
- últimos 3–5 años
- separar por activo

## Fase B: walk-forward
- entrenar parámetros en un bloque
- validar en bloque posterior
- repetir

## Fase C: evaluación real
Métricas mínimas:

- win rate
- average win
- average loss
- expectancy
- profit factor
- max drawdown
- tiempo medio en trade
- % de setups de continuación vs reversión

Expectancy:

\[
E = p \cdot G - (1-p) \cdot L
\]

donde:

- \(p\) = probabilidad de acierto
- \(G\) = ganancia media
- \(L\) = pérdida media

Una estrategia puede ganar dinero con win rate modesto si el ratio beneficio/pérdida es sano.

## Fase D: paper trading
- mínimo 30–50 señales reales
- comparar alertas vs ejecución real
- revisar latencia, slippage y falsas activaciones

---

## 20) Reglas para no romper la estrategia

- No cambiar parámetros cada semana
- No añadir 6 indicadores más “por si acaso”
- No operar setups contra el filtro de régimen como si fueran estándar
- No aumentar tamaño tras una racha buena
- No interpretar una alerta WATCH como si fuera una ENTRY

---

## 21) Configuración recomendada final

Si quieres una versión base, simple y fuerte, me quedaría con esto:

### Versión base
- **HTF**: 1D
- **ETF**: 4H
- **Regla principal**: solo operar **divergencias ocultas**
- **Regulares**: solo en BTC/ETH y a media talla
- **Trigger**: ruptura estructural con cierre
- **Stop**: pivot + buffer ATR
- **Salidas**: 1R / 2.5R / trailing
- **Riesgo**: 0.5%

Esto sacrifica número de señales, pero mejora la calidad.

---

## 22) Conclusión operativa

La mejor lectura de RSI divergence no es “el RSI dice compra” o “el RSI dice venta”.  
La lectura correcta es:

> “El precio sigue intentando una dirección, pero el momentum ya no acompaña igual.  
> Ahora necesito saber si la estructura confirma que ese desequilibrio importa de verdad”.

Ese es el corazón del sistema.

Por eso la estrategia funciona mejor cuando:

- la divergencia **no se usa sola**,
- se **filtra por régimen**,
- se **confirma con estructura**,
- y se **gestiona con ATR y riesgo fijo**.

En forma resumida:

- **Oculta + tendencia + ruptura** = setup principal  
- **Regular + extensión + ruptura** = setup secundario  
- **Todo con ATR, pivots confirmados y sizing fijo** = sistema automatizable

---

## 23) Qué construir en el bot

Si fueras a implementar el bot de alertas, yo construiría estos módulos:

1. **Scanner multiactivo**
   - BTC, ETH, SOL, BNB, XRP, ADA, AVAX, DOGE

2. **Motor de régimen**
   - calcula filtro 1D

3. **Motor de pivots**
   - confirma highs/lows cerrados

4. **Motor de divergencias**
   - regular y oculta

5. **Motor de trigger**
   - ruptura estructural confirmada

6. **Motor de riesgo**
   - calcula stop, R y objetivos

7. **Motor de alertas**
   - WATCH / ENTRY / MANAGEMENT / EXIT

8. **Logger**
   - guardar cada señal para auditoría y mejora

---

## 24) Referencias utilizadas e inspiración

Fuentes base aportadas:

1. Kraken Learn — RSI divergences:  
   https://www.kraken.com/es-es/learn/rsi-divergences-what-they-how-they-work

2. TradingView Community — Mastering RSI Divergence:  
   https://www.tradingview.com/chart/BTCUSD/SQI5Tlod-Mastering-RSI-Divergence-A-Complete-Guide-to-Trend-Reversals/

3. ACY — RSI Divergence Trading Strategy for Gold:  
   https://acy.com/en/market-news/education/how-to-spot-rsi-divergence-gold-j-o-093126/

Complemento técnico para automatización:

4. TradingView Pine Script — Alerts:  
   https://www.tradingview.com/pine-script-docs/concepts/alerts/

5. TradingView Pine Script — Other timeframes and data / request.security():  
   https://www.tradingview.com/pine-script-docs/concepts/other-timeframes-and-data/

> La parte de divergencias está inspirada por las fuentes anteriores.  
> La estructura completa del sistema, los filtros, la jerarquía de setups, la gestión del riesgo y el esquema de automatización son una propuesta de diseño cuantitativo propia.
