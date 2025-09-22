## Chart Control and Sequential Flow - Prompt Guide

### What you can ask
- Change timeframe: "Set to 1m", "Switch to 15m".
- Change chart type: "Use candlesticks", "Switch to line".
- Add indicators: "Add EMA 9, 21, 50", "Add Bollinger Bands 20,2", "Add RSI".
- Style hints: "Make the EMA thicker and dashed", "Use blue lines".
- Navigation: "Pan left", "Pan right", "Zoom in/out" (if supported).
- Toggle options: "Show Grid", "Hide Volume".
- Screenshot: "Take a screenshot".
- Sequence analysis: "Analyze this chart step-by-step", "Show 1m with EMAs then 15m with RSI and capture screenshots".

### Sequential Flow Examples
1) Quick intraday scan
   - "Analyze this symbol on 1m with EMAs (9,21,50), take a screenshot, then 15m with RSI 14 and take another."
   - The agent will: set timeframe → add indicators → screenshot → change timeframe → add indicators → screenshot.

2) Volatility breakout check
   - "Check 1m Bollinger 20,2, take a screenshot, then 5m MACD 12,26,9 and screenshot."

### Layout Presets (1 main + 2 sub)
- Day Trading
  - EMA(9,21,50) + RSI(14) + MACD(12,26,9)
  - BOLL(20,2) + RSI(14) + MACD(12,26,9)
  - EMA(9,21,50) + KDJ(9,3,3) + VOL(5,10,20)
- Swing Trading
  - EMA(20,50,200) + RSI(14) + MACD(12,26,9)
  - BOLL(20,2) + RSI(14) + OBV(30)
  - SMA(50,200) + RSI(14) + MACD(12,26,9)

These can be invoked by asking: "Apply day EMA+RSI+MACD layout" or "Use swing Bollinger+RSI+OBV".

### Tips
- If you omit params, sensible defaults are applied automatically based on your trading style.
- You can stop any sequence using the Stop button on the overlay.
- Ask for strategy: "What’s the best strategy for today?" to receive a recommendation and optional chart sequence.


