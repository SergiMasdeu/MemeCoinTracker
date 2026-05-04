# Pump.Gun Memecoin Tracker + Bot

React dashboard + Node bot engine that scans memecoins and classifies each coin in 4 phases.

It now includes:

- Real market data mode (Pump.fun discovery + DexScreener market metrics)
- Virtual paper wallet starting at $10,000

- Phase 1: first pump
- Phase 2: first crash
- Phase 3: stabilization
- Phase 4: second pump

## Trading rule implemented

- Bot tracks coins while they are in Phase 1 or Phase 2.
- Bot buys only when Phase 3 is confirmed and a Phase 4 trend signal is detected.
- Bot tracks total buy volume and total sell volume.
- After a profitable sell, that coin is blacklisted and never tracked again in this runtime.

## What is tracked

- Capital flow (buy volume - sell volume)
- Market capitalization
- Active users
- Buy/sell volume
- Creator ownership percentage
- Social check score (Twitter/Telegram/Website + activity)

## Project structure

- `src/*`: React dashboard
- `server/index.mjs`: scanning bot, phase logic, social scoring, API

## API endpoints

- `GET /api/health`
- `GET /api/dashboard`
- `POST /api/bot/start`
- `POST /api/bot/stop`
- `POST /api/bot/tick`

`GET /api/dashboard` now includes a `wallet` object:

- `startUsd`, `cashUsd`, `openValueUsd`, `equityUsd`
- `realizedPnlUsd`, `totalReturnUsd`, `totalReturnPct`
- `positions[]`

## Environment variables

- `STARTING_BALANCE_USD` (default `10000`)
- `USE_REAL_DATA` (default `true`; set `false` to force simulation)
- `BOT_INTERVAL_MS` (default `7000`)
- `MAX_OPEN_POSITIONS` (default `unlimited`; set to a positive number to cap concurrent positions)

Indicator tuning (entry and exits):

- `INDICATOR_RSI_PERIOD` (default `14`)
- `INDICATOR_EMA_FAST_PERIOD` (default `9`)
- `INDICATOR_EMA_SLOW_PERIOD` (default `21`)
- `INDICATOR_MACD_FAST_PERIOD` (default `12`)
- `INDICATOR_MACD_SLOW_PERIOD` (default `26`)
- `INDICATOR_MACD_SIGNAL_PERIOD` (default `9`)

Phase 1 entry thresholds:

- `P1_RSI_MIN` (default `48`)
- `P1_RSI_MAX` (default `78`)
- `P1_ALLOW_PRICE_ABOVE_FAST_EMA` (default `true`)
- `P1_MIN_MACD_HISTOGRAM` (default `-0.00000001`)
- `P1_EARLY_INDICATOR_OVERRIDE_ENABLED` (default `true`)
- `P1_EARLY_MAX_HISTORY_POINTS` (default `6`)
- `P1_EARLY_MIN_BUY_SELL_RATIO` (default `1.45`)
- `P1_EARLY_MIN_ACTIVE_USERS` (default `20`)
- `P1_EARLY_RSI_MIN` (default `52`)
- `P1_EARLY_RSI_MAX` (default `76`)
- `P1_EARLY_MIN_MACD_HISTOGRAM` (default `0`)

Phase 3 breakout entry thresholds:

- `P3_RSI_MIN` (default `50`)
- `P3_RSI_MAX` (default `72`)
- `P3_REQUIRE_TREND_UP` (default `true`)
- `P3_REQUIRE_PRICE_ABOVE_FAST_EMA` (default `true`)
- `P3_MIN_MACD_HISTOGRAM` (default `0`)

Indicator-based exit thresholds:

- `QUICK_PROFIT_PCT` (default `5`, immediate sell when open position profit is >= this value)
- `SELL_RSI_OVERBOUGHT_THRESHOLD` (default `75`)
- `SELL_RSI_BREAKDOWN_THRESHOLD` (default `44`)
- `SELL_REQUIRE_MACD_WEAKENING` (default `true`)

Conservative loss-management exits:

- `CONSERVATIVE_LOSS_EXIT_ENABLED` (default `true`)
- `CONSERVATIVE_LOSS_MIN_HOLD_MS` (default `720000`)
- `CONSERVATIVE_LOSS_ARM_PCT` (default `-10`)
- `CONSERVATIVE_LOSS_MAX_PCT` (default `-35`)
- `CONSERVATIVE_LOSS_MAX_BUY_SELL_RATIO` (default `0.78`)
- `CONSERVATIVE_LOSS_RSI_MAX` (default `34`)
- `CONSERVATIVE_LOSS_RECENT_DRAWDOWN_PCT` (default `7.5`)
- `CONSERVATIVE_LOSS_MIN_BEARISH_SIGNALS` (default `3`)

Phase detection tuning (stabilization sensitivity):

- `P3_MIN_DRAWDOWN_FROM_ATH` (default `0.20`)
- `P3_MAX_RECENT_RANGE` (default `0.22`)
- `P3_MAX_ABS_RECENT_SLOPE` (default `0.08`)
- `P3_MAX_SINGLE_TICK_DROP_PCT` (default `6`)
- `P2_MAX_FLAT_SLOPE_FOR_CRASH` (default `-0.015`)

## Run

```bash
npm install
npm run dev
```

Frontend runs on Vite, backend API runs on `http://localhost:8787`.

## Notes

If real endpoints fail temporarily, the bot falls back to simulation mode automatically and reports this in the dashboard (`bot.dataMode` and `bot.lastDataError`).
