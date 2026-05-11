# MEXC REST Memecoin Tracker + Bot

React dashboard + Node bot engine that scans memecoins from MEXC REST market data and ranks each coin with Option A score analysis.

It now includes:

- Real market data mode (MEXC REST discovery)
- Tracks solid and liquid memecoins listed on MEXC
- Virtual paper wallet starting at $10,000

- Option A composite scoring: momentum + flow + liquidity + risk + catalyst
- Conservative risk controls for entries and exits
- Discord Bot notifications on buy/sell (Bot Token + Channel ID)
- Auto-generated sell image card (token, PnL %, prices, invested/proceeds)

## Trading rule implemented

- Bot tracks coins when Option A score passes watch thresholds.
- Bot buys only when Option A entry score and quality floors are all satisfied.
- Bot tracks total buy volume and total sell volume.
- Coins can be bought multiple times (no blacklist after profitable sells).

## What is tracked

- Capital flow (buy volume - sell volume)
- Market capitalization
- Active users
- Buy/sell volume
- Creator ownership percentage
- Social check score (Twitter/Telegram/Website + activity)

## Project structure

- `src/*`: React dashboard
- `server/index.mjs`: scanning bot, Option A score logic, social scoring, API

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
- `DISCORD_NOTIFICATIONS_ENABLED` (default `false`)
- `DISCORD_BOT_TOKEN` (Discord bot token)
- `DISCORD_CHANNEL_ID` (target Discord channel ID)
- `DISCORD_GUILD_ID` (optional; recommended for instant slash-command updates in one server)
- `DISCORD_NOTIFY_ON_BUY` (default `true`)
- `DISCORD_NOTIFY_ON_SELL` (default `true`)

Discord command:

- `/report` posts an on-demand performance report to the configured channel.
- If `DISCORD_GUILD_ID` is set, slash command registration is near-instant for that guild.
- Without `DISCORD_GUILD_ID`, global command propagation can take several minutes.

Indicator tuning (entry and exits):

- `INDICATOR_RSI_PERIOD` (default `14`)
- `INDICATOR_EMA_FAST_PERIOD` (default `9`)
- `INDICATOR_EMA_SLOW_PERIOD` (default `21`)
- `INDICATOR_MACD_FAST_PERIOD` (default `12`)
- `INDICATOR_MACD_SLOW_PERIOD` (default `26`)
- `INDICATOR_MACD_SIGNAL_PERIOD` (default `9`)

Option A entry thresholds:

- `OPTION_A_MIN_ENTRY_SCORE` (default `0.68`)
- `OPTION_A_TRACK_MIN_SCORE` (default `0.44`)
- `OPTION_A_MIN_MOMENTUM_SCORE` (default `0.52`)
- `OPTION_A_MIN_FLOW_SCORE` (default `0.58`)
- `OPTION_A_MIN_RISK_SCORE` (default `0.50`)
- `OPTION_A_TV_SCORE_BONUS` (default `0.05`)
- `OPTION_A_MAX_COIN_AGE_MS` (default `28800000`)

Option A exit breakdown guards:

- `OPTION_A_EXIT_MOMENTUM_FLOOR` (default `0.36`)
- `OPTION_A_EXIT_RISK_FLOOR` (default `0.38`)

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

Crash-protection exits (early rug/cascade defense):

- `CRASH_PROTECTION_ENABLED` (default `true`)
- `CRASH_PROTECTION_MIN_HOLD_MS` (default `90000`)
- `CRASH_PROTECTION_ARM_PCT` (default `-6`)
- `CRASH_PROTECTION_HARD_STOP_PCT` (default `-14`)
- `CRASH_PROTECTION_PEAK_DROP_PCT` (default `12`)
- `CRASH_PROTECTION_RECENT_DRAWDOWN_PCT` (default `8.5`)
- `CRASH_PROTECTION_MAX_BUY_SELL_RATIO` (default `0.74`)
- `CRASH_PROTECTION_RSI_MAX` (default `38`)
- `CRASH_PROTECTION_MIN_BEARISH_SIGNALS` (default `2`)

Legacy phase-tuning variables are no longer used for entry decisions.

## Run

```bash
npm install
npm run dev
```

Frontend runs on Vite, backend API runs on `http://localhost:8787`.

## Notes

If real endpoints fail temporarily, the bot falls back to simulation mode automatically and reports this in the dashboard (`bot.dataMode` and `bot.lastDataError`).
