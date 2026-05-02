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

## Run

```bash
npm install
npm run dev
```

Frontend runs on Vite, backend API runs on `http://localhost:8787`.

## Notes

If real endpoints fail temporarily, the bot falls back to simulation mode automatically and reports this in the dashboard (`bot.dataMode` and `bot.lastDataError`).
