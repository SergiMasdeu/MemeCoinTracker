import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIST_DIR = path.resolve(__dirname, '../dist');
const HAS_CLIENT_BUILD = fs.existsSync(path.join(CLIENT_DIST_DIR, 'index.html'));

const app = express();
const PORT = Number(process.env.PORT || 8787);
const BOT_INTERVAL_MS = Number(process.env.BOT_INTERVAL_MS || 7000);
const PRICE_REFRESH_MS = Number(process.env.PRICE_REFRESH_MS || 1000);
const USE_REAL_DATA = process.env.USE_REAL_DATA !== 'false';

function envBoolean(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  const normalized = String(raw).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

const STARTING_BALANCE_USD = Number(process.env.STARTING_BALANCE_USD || 10_000);
// Minimum time to hold before stop-loss or phase-break can trigger (2 minutes)
const MIN_HOLD_MS = Number(process.env.MIN_HOLD_MS || 120_000);
// Require at least this many price points before considering any buy
const MIN_HISTORY_DEPTH = Number(process.env.MIN_HISTORY_DEPTH || 6);
// Maximum concurrent open positions
const MAX_OPEN_POSITIONS = Number(process.env.MAX_OPEN_POSITIONS || 3);
// Coin must be younger than this for a P1 buy (3 hours)
const MAX_COIN_AGE_P1_MS = Number(process.env.MAX_COIN_AGE_P1_MS || 3 * 60 * 60 * 1000);
// Only buy when phase confidence is at or above this threshold
const MIN_PHASE_CONFIDENCE = Number(process.env.MIN_PHASE_CONFIDENCE || 0.65);
// Market cap ceiling — skip large caps that can't meaningfully move
const MAX_MARKETCAP_USD = Number(process.env.MAX_MARKETCAP_USD || 10_000_000);
// Keep mature high-value coins (up to 24h old) in tracking even if not buy-eligible.
const TRACK_HIGH_VALUE_MAX_AGE_MS = Number(process.env.TRACK_HIGH_VALUE_MAX_AGE_MS || 24 * 60 * 60 * 1000);
const TRACK_HIGH_VALUE_MIN_MARKETCAP_USD = Number(process.env.TRACK_HIGH_VALUE_MIN_MARKETCAP_USD || 750_000);
const TRACK_HIGH_VALUE_MIN_LIQUIDITY_USD = Number(process.env.TRACK_HIGH_VALUE_MIN_LIQUIDITY_USD || 100_000);
const TRADINGVIEW_ENABLED = process.env.TRADINGVIEW_ENABLED !== 'false';
const TRADINGVIEW_WEBHOOK_TOKEN = process.env.TRADINGVIEW_WEBHOOK_TOKEN || '';
const TRADINGVIEW_SIGNAL_TTL_MS = Number(process.env.TRADINGVIEW_SIGNAL_TTL_MS || 30 * 60 * 1000);
const TRADINGVIEW_MIN_BULLISH_SCORE = Number(process.env.TRADINGVIEW_MIN_BULLISH_SCORE || 0.55);
// Anti-crash discovery and entry quality gates
const MAX_ENTRY_DRAWDOWN_PCT = Number(process.env.MAX_ENTRY_DRAWDOWN_PCT || 18);
const MIN_ENTRY_M5_PCT = Number(process.env.MIN_ENTRY_M5_PCT || -1.8);
const MIN_ENTRY_H1_PCT = Number(process.env.MIN_ENTRY_H1_PCT || -4);
const MIN_ENTRY_BUY_SELL_RATIO = Number(process.env.MIN_ENTRY_BUY_SELL_RATIO || 1.03);
const MIN_ENTRY_LIQUIDITY_USD = Number(process.env.MIN_ENTRY_LIQUIDITY_USD || 40_000);
const MIN_ENTRY_BUY_SELL_RATIO_NO_LIQ = Number(process.env.MIN_ENTRY_BUY_SELL_RATIO_NO_LIQ || 1.6);
const MIN_ENTRY_ACTIVE_USERS_NO_LIQ = Number(process.env.MIN_ENTRY_ACTIVE_USERS_NO_LIQ || 22);
const MIN_VOL_LIQ_RATIO = Number(process.env.MIN_VOL_LIQ_RATIO || 0.35);
const MAX_VOL_LIQ_RATIO = Number(process.env.MAX_VOL_LIQ_RATIO || 30);
const MIN_CANDLE_BULLISH_SCORE = Number(process.env.MIN_CANDLE_BULLISH_SCORE || 0.55);
// Phase classification tuning (helps detect P3 stabilization before broad crash buckets)
const P3_MIN_DRAWDOWN_FROM_ATH = Number(process.env.P3_MIN_DRAWDOWN_FROM_ATH || 0.20);
const P3_MAX_RECENT_RANGE = Number(process.env.P3_MAX_RECENT_RANGE || 0.22);
const P3_MAX_ABS_RECENT_SLOPE = Number(process.env.P3_MAX_ABS_RECENT_SLOPE || 0.08);
const P3_MAX_SINGLE_TICK_DROP_PCT = Number(process.env.P3_MAX_SINGLE_TICK_DROP_PCT || 6);
const P2_MAX_FLAT_SLOPE_FOR_CRASH = Number(process.env.P2_MAX_FLAT_SLOPE_FOR_CRASH || -0.015);
// Recheck skipped symbols after cooldown instead of suppressing forever.
const SKIP_RECHECK_MS = Number(process.env.SKIP_RECHECK_MS || 3 * 60 * 1000);
// Entry execution safety: avoid buying into immediate reversals and cut instant dumps.
const ENTRY_GUARD_WINDOW_POINTS = Number(process.env.ENTRY_GUARD_WINDOW_POINTS || 6);
const ENTRY_GUARD_MAX_WINDOW_DRAWDOWN_PCT = Number(process.env.ENTRY_GUARD_MAX_WINDOW_DRAWDOWN_PCT || 7.5);
const ENTRY_GUARD_MAX_LAST_TICK_DROP_PCT = Number(process.env.ENTRY_GUARD_MAX_LAST_TICK_DROP_PCT || 3.2);
const ENTRY_GUARD_MIN_LAST2_COMBINED_PCT = Number(process.env.ENTRY_GUARD_MIN_LAST2_COMBINED_PCT || -2.6);
const ENTRY_GUARD_MIN_BUY_SELL_RATIO = Number(process.env.ENTRY_GUARD_MIN_BUY_SELL_RATIO || 1.2);
const ENTRY_GUARD_MAX_WINDOW_RISE_PCT = Number(process.env.ENTRY_GUARD_MAX_WINDOW_RISE_PCT || 24);
const BUY_CONFIRMATION_SCANS = Number(process.env.BUY_CONFIRMATION_SCANS || 2);
const POST_BUY_PROTECTION_MS = Number(process.env.POST_BUY_PROTECTION_MS || 90_000);
const POST_BUY_EMERGENCY_STOP_PCT = Number(process.env.POST_BUY_EMERGENCY_STOP_PCT || -4.5);
const ALLOW_EMERGENCY_LOSS_EXIT = process.env.ALLOW_EMERGENCY_LOSS_EXIT === 'true';
// Once unrealized PnL exceeds this, activate trailing stop
const DEFAULT_TRAIL_ACTIVATE_PCT = Number(process.env.TRAIL_ACTIVATE_PCT || 10);
// Trail stop: close when price falls this far below the peak seen while holding
const DEFAULT_TRAIL_STOP_PCT = Number(process.env.TRAIL_STOP_PCT || 8);
// Profit-only selling policy (can be disabled by setting PROFIT_ONLY_MODE=false)
const DEFAULT_PROFIT_ONLY_MODE = process.env.PROFIT_ONLY_MODE !== 'false';
// Sell immediately as soon as open position PnL reaches this level.
const DEFAULT_QUICK_PROFIT_PCT = Number(process.env.QUICK_PROFIT_PCT || 5);
// Require at least this unrealized gain before normal profit exits can trigger
const DEFAULT_MIN_PROFIT_EXIT_PCT = Number(process.env.MIN_PROFIT_EXIT_PCT || 1.5);
// Always lock gains at this profit, regardless of momentum
const DEFAULT_HARD_TAKE_PROFIT_PCT = Number(process.env.HARD_TAKE_PROFIT_PCT || 20);
// After reaching this gain, never let the trade round-trip back to zero
const DEFAULT_BREAKEVEN_ARM_PCT = Number(process.env.BREAKEVEN_ARM_PCT || 6);
const DEFAULT_BREAKEVEN_FLOOR_PCT = Number(process.env.BREAKEVEN_FLOOR_PCT || 1.5);
// If trade is still profitable after this hold duration, take the profit and rotate capital
const DEFAULT_PROFIT_TIME_EXIT_MS = Number(process.env.PROFIT_TIME_EXIT_MS || 30 * 60 * 1000);
const DEFAULT_PROFIT_TIME_EXIT_MIN_PCT = Number(process.env.PROFIT_TIME_EXIT_MIN_PCT || 3);
// Indicator configuration and thresholds (entry + exits)
const INDICATOR_RSI_PERIOD = Number(process.env.INDICATOR_RSI_PERIOD || 14);
const INDICATOR_EMA_FAST_PERIOD = Number(process.env.INDICATOR_EMA_FAST_PERIOD || 9);
const INDICATOR_EMA_SLOW_PERIOD = Number(process.env.INDICATOR_EMA_SLOW_PERIOD || 21);
const INDICATOR_MACD_FAST_PERIOD = Number(process.env.INDICATOR_MACD_FAST_PERIOD || 12);
const INDICATOR_MACD_SLOW_PERIOD = Number(process.env.INDICATOR_MACD_SLOW_PERIOD || 26);
const INDICATOR_MACD_SIGNAL_PERIOD = Number(process.env.INDICATOR_MACD_SIGNAL_PERIOD || 9);
const P1_RSI_MIN = Number(process.env.P1_RSI_MIN || 48);
const P1_RSI_MAX = Number(process.env.P1_RSI_MAX || 78);
const P1_ALLOW_PRICE_ABOVE_FAST_EMA = envBoolean('P1_ALLOW_PRICE_ABOVE_FAST_EMA', true);
const P1_MIN_MACD_HISTOGRAM = Number(process.env.P1_MIN_MACD_HISTOGRAM || -0.00000001);
const P3_RSI_MIN = Number(process.env.P3_RSI_MIN || 50);
const P3_RSI_MAX = Number(process.env.P3_RSI_MAX || 72);
const P3_REQUIRE_TREND_UP = envBoolean('P3_REQUIRE_TREND_UP', true);
const P3_REQUIRE_PRICE_ABOVE_FAST_EMA = envBoolean('P3_REQUIRE_PRICE_ABOVE_FAST_EMA', true);
const P3_MIN_MACD_HISTOGRAM = Number(process.env.P3_MIN_MACD_HISTOGRAM || 0);
const SELL_RSI_OVERBOUGHT_THRESHOLD = Number(process.env.SELL_RSI_OVERBOUGHT_THRESHOLD || 75);
const SELL_RSI_BREAKDOWN_THRESHOLD = Number(process.env.SELL_RSI_BREAKDOWN_THRESHOLD || 44);
const SELL_REQUIRE_MACD_WEAKENING = envBoolean('SELL_REQUIRE_MACD_WEAKENING', true);
// Start trading loop automatically when API boots
const AUTO_START_BOT = process.env.AUTO_START_BOT !== 'false';

app.use(cors());
app.use(express.json());

if (HAS_CLIENT_BUILD) {
  app.use(express.static(CLIENT_DIST_DIR));
}

const PHASES = {
  PHASE_1: 'PHASE_1_FIRST_PUMP',
  PHASE_2: 'PHASE_2_FIRST_CRASH',
  PHASE_3: 'PHASE_3_STABILIZATION',
  PHASE_4: 'PHASE_4_SECOND_PUMP',
};

const phaseLabel = {
  [PHASES.PHASE_1]: 'Phase 1 - First Pump',
  [PHASES.PHASE_2]: 'Phase 2 - First Crash',
  [PHASES.PHASE_3]: 'Phase 3 - Stabilization',
  [PHASES.PHASE_4]: 'Phase 4 - Second Pump',
};

const marketState = new Map();
const trackedCoins = new Map();
const skippedCoins = new Map();
const blacklist = new Set();
const tradeLog = [];
const tradingViewSignals = new Map();

const walletState = {
  startUsd: STARTING_BALANCE_USD,
  cashUsd: STARTING_BALANCE_USD,
  realizedPnlUsd: 0,
  openPositions: new Map(),
};

const botState = {
  running: false,
  timer: null,
  scanInProgress: false,
  scans: 0,
  lastScanAt: null,
  totalBoughtVolume: 0,
  totalSoldVolume: 0,
  realizedPnlPct: 0,
  dataMode: USE_REAL_DATA ? 'real' : 'simulated',
  dataSource: USE_REAL_DATA ? 'pump.fun + DexScreener' : 'internal simulation',
  lastDataError: null,
};

const strategyPresets = {
  conservative: {
    minProfitExitPct: 3,
    quickProfitPct: DEFAULT_QUICK_PROFIT_PCT,
    hardTakeProfitPct: 26,
    breakevenArmPct: 8,
    breakevenFloorPct: 2,
    trailActivatePct: 14,
    trailStopPct: 7,
    profitTimeExitMs: 45 * 60 * 1000,
    profitTimeExitMinPct: 5,
  },
  balanced: {
    minProfitExitPct: DEFAULT_MIN_PROFIT_EXIT_PCT,
    quickProfitPct: DEFAULT_QUICK_PROFIT_PCT,
    hardTakeProfitPct: DEFAULT_HARD_TAKE_PROFIT_PCT,
    breakevenArmPct: DEFAULT_BREAKEVEN_ARM_PCT,
    breakevenFloorPct: DEFAULT_BREAKEVEN_FLOOR_PCT,
    trailActivatePct: DEFAULT_TRAIL_ACTIVATE_PCT,
    trailStopPct: DEFAULT_TRAIL_STOP_PCT,
    profitTimeExitMs: DEFAULT_PROFIT_TIME_EXIT_MS,
    profitTimeExitMinPct: DEFAULT_PROFIT_TIME_EXIT_MIN_PCT,
  },
  aggressive: {
    minProfitExitPct: 1,
    quickProfitPct: DEFAULT_QUICK_PROFIT_PCT,
    hardTakeProfitPct: 16,
    breakevenArmPct: 5,
    breakevenFloorPct: 1,
    trailActivatePct: 8,
    trailStopPct: 10,
    profitTimeExitMs: 20 * 60 * 1000,
    profitTimeExitMinPct: 2,
  },
};

const strategyState = {
  preset: 'balanced',
  profitOnlyMode: DEFAULT_PROFIT_ONLY_MODE,
  quickProfitPct: DEFAULT_QUICK_PROFIT_PCT,
  ...strategyPresets.balanced,
};

function getStrategySnapshot() {
  return {
    preset: strategyState.preset,
    profitOnlyMode: strategyState.profitOnlyMode,
    quickProfitPct: strategyState.quickProfitPct,
    minProfitExitPct: strategyState.minProfitExitPct,
    hardTakeProfitPct: strategyState.hardTakeProfitPct,
    breakevenArmPct: strategyState.breakevenArmPct,
    breakevenFloorPct: strategyState.breakevenFloorPct,
    trailActivatePct: strategyState.trailActivatePct,
    trailStopPct: strategyState.trailStopPct,
    profitTimeExitMs: strategyState.profitTimeExitMs,
    profitTimeExitMinPct: strategyState.profitTimeExitMinPct,
  };
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function floatRand(min, max) {
  return Math.random() * (max - min) + min;
}

function detectPhase(prices) {
  if (prices.length < 6) {
    return { phase: PHASES.PHASE_1, confidence: 0.52, reason: 'Insufficient history — defaults to pump' };
  }

  const n = prices.length;
  const latest = prices[n - 1];
  const first = prices[0];

  const maxPrice = Math.max(...prices);
  const maxIndex = prices.indexOf(maxPrice);

  // ---- Key shape metrics ----

  // Where (0–1) in the series did the ATH occur? 1.0 = at the very end (still pumping)
  const peakPosition = n > 1 ? maxIndex / (n - 1) : 1;

  // How large was the initial pump from series-start to ATH?
  const pumpMagnitude = first > 0 ? (maxPrice - first) / first : 0;

  // How far is current price below ATH?
  const drawdownFromATH = maxPrice > 0 ? (maxPrice - latest) / maxPrice : 0;

  // ---- Recent window (last ~25% of series, min 4 ticks) ----
  const recentCount = Math.max(4, Math.ceil(n * 0.25));
  const recentWindow = prices.slice(-recentCount);
  const recentFirst = recentWindow[0];
  const recentLast = recentWindow[recentWindow.length - 1];
  const recentMin = Math.min(...recentWindow);
  const recentMax = Math.max(...recentWindow);
  // % slope across recent window (positive = rising, negative = falling)
  const recentSlope = recentFirst > 0 ? (recentLast - recentFirst) / recentFirst : 0;
  // How compressed is the recent price range? (low = flat/stabilising)
  const recentRange = recentMin > 0 ? (recentMax - recentMin) / recentMin : 0;

  const recentDeltasPct = [];
  for (let i = 1; i < recentWindow.length; i += 1) {
    const prev = recentWindow[i - 1];
    const next = recentWindow[i];
    recentDeltasPct.push(prev > 0 ? ((next - prev) / prev) * 100 : 0);
  }
  const positiveTicks = recentDeltasPct.filter((v) => v > 0).length;
  const negativeTicks = recentDeltasPct.filter((v) => v < 0).length;
  const maxSingleDropPct = recentDeltasPct.length > 0 ? Math.min(...recentDeltasPct) : 0;
  const stableOscillation = positiveTicks > 0 && negativeTicks > 0;
  const noHardRecentDump = maxSingleDropPct >= -P3_MAX_SINGLE_TICK_DROP_PCT;

  // ---- Post-peak rebound from crash low ----
  const postPeakPrices = prices.slice(maxIndex);
  const postPeakMin = postPeakPrices.length > 0 ? Math.min(...postPeakPrices) : latest;
  const rebound = postPeakMin > 0 ? (latest - postPeakMin) / postPeakMin : 0;

  // ================================================================
  // P1 — BIG PUMP
  // Graph shape: sharp rise, ATH is at or very near the END of the
  // series (price still climbing or just topped), minimal drawdown.
  // ================================================================
  if (peakPosition >= 0.72 && latest >= maxPrice * 0.85) {
    const conf = Math.min(0.92, 0.60 + peakPosition * 0.30 + Math.min(0.10, pumpMagnitude * 0.05));
    return {
      phase: PHASES.PHASE_1, confidence: conf,
      reason: `Peak at ${(peakPosition * 100).toFixed(0)}% mark — still in pump territory`,
    };
  }

  if (drawdownFromATH < 0.15 && pumpMagnitude >= 0.15 && recentSlope >= 0) {
    return {
      phase: PHASES.PHASE_1, confidence: 0.75,
      reason: `Only -${(drawdownFromATH * 100).toFixed(1)}% from ATH, uptrend intact`,
    };
  }

  // ================================================================
  // P3 — STABILISATION
  // Graph shape: big crash has happened, but recent prices are FLAT
  // and compressed — the coin is finding a floor (tight coil).
  // ================================================================
  if (
    drawdownFromATH >= P3_MIN_DRAWDOWN_FROM_ATH
    && recentRange <= P3_MAX_RECENT_RANGE
    && Math.abs(recentSlope) <= P3_MAX_ABS_RECENT_SLOPE
    && noHardRecentDump
    && (stableOscillation || Math.abs(recentSlope) <= 0.02)
  ) {
    const conf = Math.min(0.92, 0.64 + (P3_MAX_RECENT_RANGE - recentRange) * 1.8 + Math.min(0.12, drawdownFromATH * 0.25));
    return {
      phase: PHASES.PHASE_3, confidence: conf,
      reason: `Base forming: range ${(recentRange * 100).toFixed(1)}%, slope ${(recentSlope * 100).toFixed(1)}%, drawdown -${(drawdownFromATH * 100).toFixed(0)}%`,
    };
  }

  // ================================================================
  // P2 — CRASH
  // Graph shape: ATH was EARLY in the series, price has since dropped
  // sharply, and recent ticks are still meaningfully down.
  // ================================================================
  if (peakPosition < 0.55 && drawdownFromATH >= 0.25 && recentSlope <= P2_MAX_FLAT_SLOPE_FOR_CRASH && rebound < 0.18) {
    const conf = Math.min(0.90, 0.60 + drawdownFromATH * 0.50);
    return {
      phase: PHASES.PHASE_2, confidence: conf,
      reason: `Crash -${(drawdownFromATH * 100).toFixed(0)}% from peak (at ${(peakPosition * 100).toFixed(0)}% mark), still falling`,
    };
  }

  // Heavy sell-off regardless of peak position
  if (drawdownFromATH >= 0.35 && recentSlope <= -0.05 && rebound < 0.15) {
    return {
      phase: PHASES.PHASE_2, confidence: 0.80,
      reason: `Heavy sell-off: -${(drawdownFromATH * 100).toFixed(0)}% drawdown, recent slope ${(recentSlope * 100).toFixed(1)}%`,
    };
  }

  // ================================================================
  // P4 — SECOND PUMP (breakout from base)
  // Graph shape: ATH was early, crash happened (P2), flat floor (P3),
  // now price BREAKS UP with positive recent slope AND meaningful
  // rebound from the crash low.
  // ================================================================
  if (drawdownFromATH >= 0.20 && recentSlope >= 0.05 && rebound >= 0.20) {
    const conf = Math.min(0.92, 0.60 + Math.min(0.20, rebound * 0.40) + Math.min(0.12, recentSlope * 0.60));
    return {
      phase: PHASES.PHASE_4, confidence: conf,
      reason: `Breakout: +${(recentSlope * 100).toFixed(1)}% recent slope, +${(rebound * 100).toFixed(0)}% off crash low`,
    };
  }

  // Softer P4: slower grind-up after deep crash
  if (drawdownFromATH >= 0.30 && recentSlope > 0.02 && rebound >= 0.35) {
    return {
      phase: PHASES.PHASE_4, confidence: 0.72,
      reason: `Grind recovery: +${(rebound * 100).toFixed(0)}% off crash low, positive recent slope`,
    };
  }

  // ---- Fallbacks ----
  if (drawdownFromATH < 0.25) {
    return { phase: PHASES.PHASE_1, confidence: 0.55, reason: 'Near ATH — possible early pump' };
  }
  return { phase: PHASES.PHASE_2, confidence: 0.55, reason: 'Bearish structure — unclassified' };
}

function analyzeCandlestick(prices) {
  if (!Array.isArray(prices) || prices.length < 4) {
    return {
      score: 0,
      bullish: false,
      pattern: 'insufficient-data',
      checks: {
        bullishEngulfing: false,
        hammerRejection: false,
        threeWhiteSoldiers: false,
        bearishPressure: false,
      },
    };
  }

  // Build lightweight OHLC candles from close-to-close series.
  const candles = [];
  for (let i = 1; i < prices.length; i += 1) {
    const open = prices[i - 1];
    const close = prices[i];
    const high = Math.max(open, close);
    const low = Math.min(open, close);
    candles.push({ open, high, low, close });
  }

  const n = candles.length;
  const c1 = candles[n - 1];
  const c2 = candles[n - 2];
  const c3 = candles[n - 3];

  const body1 = Math.abs(c1.close - c1.open);
  const range1 = Math.max(1e-12, c1.high - c1.low);
  const lowerWick1 = Math.min(c1.open, c1.close) - c1.low;

  const bullishEngulfing =
    c2.close < c2.open && c1.close > c1.open && c1.close >= c2.open && c1.open <= c2.close;

  const hammerRejection =
    c1.close > c1.open && lowerWick1 >= body1 * 1.8 && body1 / range1 <= 0.55;

  const threeWhiteSoldiers =
    c3.close > c3.open && c2.close > c2.open && c1.close > c1.open
    && c3.close < c2.close && c2.close < c1.close;

  const bearishPressure =
    (c3.close > c3.open && c2.close < c2.open && c1.close < c1.open)
    || (c1.close < c2.close && c2.close < c3.close);

  let score = 0;
  if (bullishEngulfing) score += 0.4;
  if (hammerRejection) score += 0.3;
  if (threeWhiteSoldiers) score += 0.35;
  if (c1.close > c1.open) score += 0.1;
  if (bearishPressure) score -= 0.35;

  const bounded = Number(Math.max(0, Math.min(1, score)).toFixed(2));
  const bullish = bounded >= MIN_CANDLE_BULLISH_SCORE;
  const pattern = bullishEngulfing
    ? 'bullish-engulfing'
    : threeWhiteSoldiers
      ? 'three-white-soldiers'
      : hammerRejection
        ? 'hammer-rejection'
        : bearishPressure
          ? 'bearish-pressure'
          : c1.close > c1.open
            ? 'single-green-candle'
            : 'weak-candle-structure';

  return {
    score: bounded,
    bullish,
    pattern,
    checks: {
      bullishEngulfing,
      hammerRejection,
      threeWhiteSoldiers,
      bearishPressure,
    },
  };
}

function calculateEMA(values, period) {
  if (!Array.isArray(values) || values.length < period || period <= 1) return null;

  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((acc, v) => acc + v, 0) / period;
  for (let i = period; i < values.length; i += 1) {
    ema = (values[i] - ema) * k + ema;
  }
  return ema;
}

function calculateRSI(values, period = 14) {
  if (!Array.isArray(values) || values.length <= period) return null;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(values, fast = 12, slow = 26, signal = 9) {
  if (!Array.isArray(values) || values.length < slow + signal) {
    return { line: null, signal: null, histogram: null };
  }

  const fastSeries = [];
  const slowSeries = [];
  let fastEma = values.slice(0, fast).reduce((acc, v) => acc + v, 0) / fast;
  let slowEma = values.slice(0, slow).reduce((acc, v) => acc + v, 0) / slow;
  const fastK = 2 / (fast + 1);
  const slowK = 2 / (slow + 1);

  for (let i = fast; i < values.length; i += 1) {
    fastEma = (values[i] - fastEma) * fastK + fastEma;
    fastSeries.push(fastEma);
  }

  for (let i = slow; i < values.length; i += 1) {
    slowEma = (values[i] - slowEma) * slowK + slowEma;
    slowSeries.push(slowEma);
  }

  const offset = slow - fast;
  const macdSeries = slowSeries
    .map((s, idx) => fastSeries[idx + offset] - s)
    .filter((value) => Number.isFinite(value));

  if (macdSeries.length < signal) {
    return {
      line: macdSeries[macdSeries.length - 1] ?? null,
      signal: null,
      histogram: null,
    };
  }

  let signalEma = macdSeries.slice(0, signal).reduce((acc, v) => acc + v, 0) / signal;
  const signalK = 2 / (signal + 1);
  for (let i = signal; i < macdSeries.length; i += 1) {
    signalEma = (macdSeries[i] - signalEma) * signalK + signalEma;
  }

  const line = macdSeries[macdSeries.length - 1];
  const histogram = line - signalEma;
  return {
    line,
    signal: signalEma,
    histogram,
  };
}

function analyzeIndicators(prices) {
  const latest = prices?.[prices.length - 1] || 0;
  const emaFast = calculateEMA(prices, INDICATOR_EMA_FAST_PERIOD);
  const emaSlow = calculateEMA(prices, INDICATOR_EMA_SLOW_PERIOD);
  const rsi = calculateRSI(prices, INDICATOR_RSI_PERIOD);
  const macd = calculateMACD(
    prices,
    INDICATOR_MACD_FAST_PERIOD,
    INDICATOR_MACD_SLOW_PERIOD,
    INDICATOR_MACD_SIGNAL_PERIOD,
  );

  const trendUp = emaFast !== null && emaSlow !== null ? emaFast > emaSlow : false;
  const priceAboveFastEma = emaFast !== null ? latest > emaFast : false;
  const macdBullish = macd.histogram !== null ? macd.histogram >= 0 : false;
  const macdWeakening = macd.histogram !== null ? macd.histogram < 0 : false;

  return {
    rsi: rsi === null ? null : Number(rsi.toFixed(2)),
    emaFast: emaFast === null ? null : Number(emaFast.toFixed(10)),
    emaSlow: emaSlow === null ? null : Number(emaSlow.toFixed(10)),
    macdLine: macd.line === null ? null : Number(macd.line.toFixed(10)),
    macdSignal: macd.signal === null ? null : Number(macd.signal.toFixed(10)),
    macdHistogram: macd.histogram === null ? null : Number(macd.histogram.toFixed(10)),
    trendUp,
    priceAboveFastEma,
    macdBullish,
    macdWeakening,
    dataReady: rsi !== null && emaFast !== null && emaSlow !== null && macd.histogram !== null,
    thresholds: {
      rsiPeriod: INDICATOR_RSI_PERIOD,
      emaFastPeriod: INDICATOR_EMA_FAST_PERIOD,
      emaSlowPeriod: INDICATOR_EMA_SLOW_PERIOD,
      macdFastPeriod: INDICATOR_MACD_FAST_PERIOD,
      macdSlowPeriod: INDICATOR_MACD_SLOW_PERIOD,
      macdSignalPeriod: INDICATOR_MACD_SIGNAL_PERIOD,
    },
  };
}

function phase4Signal(coin) {
  const prices = coin.history;
  const minBuySellRatio = 1.05;
  const minActiveUsers = 15;
  const pc = coin.priceChange;
  if (prices.length < 5) {
    return {
      value: false,
      reason: 'not-enough-data',
      buySellRatio: 0,
      minBuySellRatio,
      checks: {
        ascending: false,
        positiveFlow: false,
        healthyUsers: false,
      },
      thresholds: {
        minBuySellRatio,
        minActiveUsers,
      },
    };
  }

  const last3 = prices.slice(-3);
  const ascending = last3[0] < last3[1] && last3[1] < last3[2];
  const buySellRatio = coin.sellVolume > 0 ? coin.buyVolume / coin.sellVolume : 0;
  const positiveFlow = coin.capitalFlow > 0;
  const healthyUsers = coin.activeUsers >= minActiveUsers;
  const shortMomentumOk = !pc || (pc.m5 >= -1.2 && pc.h1 >= 0);

  const value = ascending && buySellRatio > minBuySellRatio && positiveFlow && healthyUsers && shortMomentumOk;
  return {
    value,
    reason: value ? 'ascending-structure-with-positive-flow' : 'signal-not-strong-enough',
    buySellRatio: Number(buySellRatio.toFixed(2)),
    minBuySellRatio,
    checks: {
      ascending,
      positiveFlow,
      healthyUsers,
      shortMomentumOk,
    },
    thresholds: {
      minBuySellRatio,
      minActiveUsers,
    },
  };
}

function phase1BuySignal(coin) {
  const prices = coin.history;
  // Need at least 2 data points to confirm upward movement
  const minBuySellRatio = 1.1;
  const minVelocityPct = 0.2;  // tick-based fallback threshold
  const minH1Pct = 2;          // h1 price change threshold when DexScreener data available
  const maxCreatorOwnershipPct = 30;
  const minActiveUsers = 10;
  if (prices.length < 2) {
    return {
      value: false,
      reason: 'not-enough-data',
      buySellRatio: 0,
      checks: {
        flowAcceptable: false,
        buyPressure: false,
        highActivity: false,
        notOverbought: false,
        rising: false,
        hasVelocity: false,
      },
      thresholds: {
        minBuySellRatio,
        minVelocityPct,
        minActiveUsers,
        maxCreatorOwnershipPct,
      },
      lastMovePct: 0,
    };
  }

  const buySellRatio = coin.sellVolume > 0 ? coin.buyVolume / coin.sellVolume : 0;
  // Flow can be noisy in short windows; real h24 volumes are large so use ratio as primary gate.
  const flowAcceptable = coin.capitalFlow > 0 || buySellRatio >= 1.2;
  const buyPressure = buySellRatio > minBuySellRatio;            // Buyers clearly leading
  const highActivity = coin.activeUsers >= minActiveUsers;       // Coin has real users
  const notOverbought = coin.creatorOwnershipPct < maxCreatorOwnershipPct; // Creator not hoarding

  // Prefer DexScreener hourly price change (much more reliable than 7s tick diffs).
  // Fall back to tick-based analysis for simulated / pump.fun coins.
  const pc = coin.priceChange;
  const shortMomentumOk = !pc || (pc.m5 >= -1.2 && pc.h1 >= 0);
  let rising, lastMovePct;
  if (pc && (pc.h1 !== 0 || pc.h6 !== 0 || pc.h24 !== 0)) {
    // Real token: use h1 change as momentum proxy
    rising = pc.h1 >= minH1Pct;
    lastMovePct = pc.h1;
  } else {
    // Simulated / brand-new coin: use tick history
    const last3 = prices.slice(-3);
    rising = prices.length >= 3
      ? last3[1] > last3[0] && last3[2] > last3[1]
      : prices[prices.length - 1] > prices[0];
    const last2 = prices.slice(-2);
    lastMovePct = last2[0] > 0 ? ((last2[1] - last2[0]) / last2[0]) * 100 : 0;
  }
  const hasVelocity = lastMovePct > (pc && pc.h1 !== 0 ? minH1Pct - 0.01 : minVelocityPct);

  const value = rising && hasVelocity && buyPressure && flowAcceptable && highActivity && notOverbought && shortMomentumOk;
  return {
    value,
    reason: value ? 'early-pump-with-strong-buy-pressure' : 'p1-signal-not-confirmed',
    buySellRatio: Number(buySellRatio.toFixed(2)),
    checks: {
      flowAcceptable,
      buyPressure,
      highActivity,
      notOverbought,
      rising,
      hasVelocity,
      shortMomentumOk,
    },
    thresholds: {
      minBuySellRatio,
      minVelocityPct,
      minActiveUsers,
      maxCreatorOwnershipPct,
    },
    lastMovePct: Number(lastMovePct.toFixed(2)),
  };
}

function socialScore(coin) {
  const hasTwitter = Boolean(coin.socials.twitter);
  const hasTelegram = Boolean(coin.socials.telegram);
  const hasWebsite = Boolean(coin.socials.website);

  let score = 0;
  if (hasTwitter) score += 0.4;
  if (hasTelegram) score += 0.35;
  if (hasWebsite) score += 0.25;

  const activityBoost = Math.min(0.25, coin.activeUsers / 2500);
  score += activityBoost;

  return {
    hasTwitter,
    hasTelegram,
    hasWebsite,
    score: Number(Math.min(1, score).toFixed(2)),
    verdict: score >= 0.7 ? 'STRONG' : score >= 0.45 ? 'MEDIUM' : 'WEAK',
  };
}

function cleanTradingViewSignals(now = Date.now()) {
  for (const [key, signal] of tradingViewSignals.entries()) {
    if ((signal?.expiresAt || 0) <= now) {
      tradingViewSignals.delete(key);
    }
  }
}

function parseSignalDirection(raw) {
  const value = String(raw || '').toLowerCase();
  if (['bull', 'bullish', 'long', 'buy', 'up'].includes(value)) return 'bullish';
  if (['bear', 'bearish', 'short', 'sell', 'down'].includes(value)) return 'bearish';
  return 'neutral';
}

function scoreTradingViewPattern(pattern, confidence) {
  const base = Number.isFinite(Number(confidence)) ? Math.max(0, Math.min(1, Number(confidence))) : 0.5;
  const label = String(pattern || '').toLowerCase();
  let bonus = 0;

  if (label.includes('breakout')) bonus += 0.15;
  if (label.includes('cup') && label.includes('handle')) bonus += 0.12;
  if (label.includes('flag')) bonus += 0.1;
  if (label.includes('triangle')) bonus += 0.08;
  if (label.includes('double bottom')) bonus += 0.12;
  if (label.includes('inverse head')) bonus += 0.12;

  return Number(Math.min(1, base + bonus).toFixed(2));
}

function getTradingViewSignal(coin, now = Date.now()) {
  cleanTradingViewSignals(now);
  const symbolKey = `symbol:${String(coin.symbol || '').toUpperCase()}`;
  const addressKey = `address:${coin.address}`;
  const byAddress = tradingViewSignals.get(addressKey);
  if (byAddress && byAddress.expiresAt > now) return byAddress;
  const bySymbol = tradingViewSignals.get(symbolKey);
  if (bySymbol && bySymbol.expiresAt > now) return bySymbol;
  return null;
}

function listActiveTradingViewSignals(limit = 25) {
  const now = Date.now();
  cleanTradingViewSignals(now);

  const deduped = new Map();
  for (const signal of tradingViewSignals.values()) {
    if (!signal || signal.expiresAt <= now) continue;
    const dedupeKey = signal.address || signal.symbol;
    if (!dedupeKey) continue;
    const existing = deduped.get(dedupeKey);
    if (!existing || (signal.receivedAt || 0) > (existing.receivedAt || 0)) {
      deduped.set(dedupeKey, signal);
    }
  }

  return [...deduped.values()]
    .sort((a, b) => (b.receivedAt || 0) - (a.receivedAt || 0))
    .slice(0, Math.max(1, limit))
    .map((signal) => ({
      symbol: signal.symbol || null,
      address: signal.address || null,
      pattern: signal.pattern || 'unknown',
      timeframe: signal.timeframe || 'unknown',
      direction: signal.direction || 'neutral',
      confidence: Number(safeNumber(signal.confidence, 0).toFixed(2)),
      score: Number(safeNumber(signal.score, 0).toFixed(2)),
      source: signal.source || 'tradingview-webhook',
      receivedAt: signal.receivedAt || now,
      expiresAt: signal.expiresAt || now,
      ttlMs: Math.max(0, (signal.expiresAt || now) - now),
    }));
}

function summarizeCoin(coin) {
  const prices = coin.history;
  const lastPrice = prices[prices.length - 1] || 0;
  const phase = detectPhase(prices);
  const social = socialScore(coin);
  const phase4 = phase4Signal(coin);
  const phase1 = phase1BuySignal(coin);
  const candlestick = analyzeCandlestick(prices);
  const indicators = analyzeIndicators(prices);
  const tvSignal = TRADINGVIEW_ENABLED ? getTradingViewSignal(coin) : null;
  const tvBullish = tvSignal?.direction === 'bullish';
  const tvScoreOk = (tvSignal?.score || 0) >= TRADINGVIEW_MIN_BULLISH_SCORE;
  // Mid-risk behavior: TradingView patterns help pass a strict gate, but do not override core market checks.
  const tvBoost = tvBullish && tvScoreOk;

  const coinAgeMs = Date.now() - (coin.createdAt || 0);
  const liquidityUsd = safeNumber(coin.liquidityUsd, 0);
  const volume24 = Math.max(0, safeNumber(coin.buyVolume, 0) + safeNumber(coin.sellVolume, 0));
  const volLiqRatio = liquidityUsd > 0 ? volume24 / liquidityUsd : 0;
  const hasLiquidityData = liquidityUsd > 0;
  const recentWindow = prices.slice(-12);
  const recentPeak = recentWindow.length > 0 ? Math.max(...recentWindow) : lastPrice;
  const drawdownPct = recentPeak > 0 ? ((recentPeak - lastPrice) / recentPeak) * 100 : 0;
  const buySellRatio = coin.sellVolume > 0 ? coin.buyVolume / coin.sellVolume : 0;
  const pc = coin.priceChange || { m5: 0, h1: 0 };
  const noLiqFallbackOk = !hasLiquidityData
    && buySellRatio >= MIN_ENTRY_BUY_SELL_RATIO_NO_LIQ
    && coin.activeUsers >= MIN_ENTRY_ACTIVE_USERS_NO_LIQ;
  const entryQuality = {
    drawdownOk: drawdownPct <= MAX_ENTRY_DRAWDOWN_PCT,
    shortMomentumOk: pc.m5 >= MIN_ENTRY_M5_PCT && pc.h1 >= MIN_ENTRY_H1_PCT,
    flowOk: buySellRatio >= MIN_ENTRY_BUY_SELL_RATIO,
    liquidityOk: hasLiquidityData ? liquidityUsd >= MIN_ENTRY_LIQUIDITY_USD : noLiqFallbackOk,
    volumeLiqOk: hasLiquidityData ? (volLiqRatio >= MIN_VOL_LIQ_RATIO && volLiqRatio <= MAX_VOL_LIQ_RATIO) : true,
    candlestickOk: candlestick.bullish,
  };
  const p1CandlestickOk = candlestick.bullish || candlestick.pattern === 'insufficient-data';
  const p1IndicatorOk = !indicators.dataReady
    || (
      (indicators.rsi >= P1_RSI_MIN && indicators.rsi <= P1_RSI_MAX)
      && (indicators.trendUp || (P1_ALLOW_PRICE_ABOVE_FAST_EMA && indicators.priceAboveFastEma))
      && (indicators.macdBullish || indicators.macdHistogram >= P1_MIN_MACD_HISTOGRAM)
    );
  const p3IndicatorOk = !indicators.dataReady
    || (
      (indicators.rsi >= P3_RSI_MIN && indicators.rsi <= P3_RSI_MAX)
      && (!P3_REQUIRE_TREND_UP || indicators.trendUp)
      && (!P3_REQUIRE_PRICE_ABOVE_FAST_EMA || indicators.priceAboveFastEma)
      && indicators.macdHistogram >= P3_MIN_MACD_HISTOGRAM
    );
  const p1EntryQualityOk = entryQuality.drawdownOk
    && entryQuality.shortMomentumOk
    && entryQuality.flowOk
    && entryQuality.liquidityOk
    && entryQuality.volumeLiqOk
    && p1CandlestickOk
    && p1IndicatorOk;
  const p3EntryQualityOk = entryQuality.drawdownOk
    && entryQuality.shortMomentumOk
    && entryQuality.flowOk
    && entryQuality.liquidityOk
    && entryQuality.volumeLiqOk
    && entryQuality.candlestickOk
    && p3IndicatorOk;
  const hasEnoughHistory = prices.length >= MIN_HISTORY_DEPTH; // used only for P3
  const confidenceOk = phase.confidence >= MIN_PHASE_CONFIDENCE; // used only for P3
  const marketCapOk = coin.marketCap >= 0 && coin.marketCap <= MAX_MARKETCAP_USD; // allow zero mcap on fresh coins
  const highValueTrackEligible =
    coinAgeMs <= TRACK_HIGH_VALUE_MAX_AGE_MS
    && coin.marketCap >= TRACK_HIGH_VALUE_MIN_MARKETCAP_USD
    && liquidityUsd >= TRACK_HIGH_VALUE_MIN_LIQUIDITY_USD;
  // Only block on weak social if the coin actually HAS social data registered.
  // Real DexScreener coins often have no socials, which should not count against them.
  const hasSocialData = Boolean(coin.socials?.twitter || coin.socials?.telegram || coin.socials?.website);
  const socialOk = !hasSocialData || social.verdict === 'STRONG' || social.verdict === 'MEDIUM';

  // P1: fresh coin only (< 3h). No confidence gate — P1 targets brand-new coins with short history
  // by design. The phase1BuySignal already validates momentum.
  const youngEnoughForP1 = coinAgeMs <= MAX_COIN_AGE_P1_MS;
  const p1CoreOk = phase.phase === PHASES.PHASE_1 && phase1.value && marketCapOk && youngEnoughForP1;
  const canBuyP1 = phase.phase === PHASES.PHASE_1 && phase1.value
    && marketCapOk && socialOk && youngEnoughForP1 && p1EntryQualityOk;
  const canBuyP1Tv = p1CoreOk && tvBoost && p1EntryQualityOk;

  // P3→P4: needs long history + high confidence since phase-3 detection is nuanced
  const minP3Confidence = Math.max(MIN_PHASE_CONFIDENCE, 0.70);
  const p3CoreOk = phase.phase === PHASES.PHASE_3 && phase4.value
    && hasEnoughHistory && confidenceOk && marketCapOk;
  const canBuyP3 = phase.phase === PHASES.PHASE_3 && phase4.value
    && hasEnoughHistory && confidenceOk && phase.confidence >= minP3Confidence && marketCapOk && socialOk && p3EntryQualityOk;
  const canBuyP3Tv = p3CoreOk && tvBoost && p3EntryQualityOk && phase.confidence >= Math.max(minP3Confidence - 0.08, 0.62);

  const canBuy = canBuyP1 || canBuyP3 || canBuyP1Tv || canBuyP3Tv;
  const buyReason = canBuyP1
    ? (tvBoost ? 'P1 Early Pump + TV Pattern' : 'P1 Early Pump')
    : canBuyP1Tv
      ? 'P1 TV Pattern Override'
      : canBuyP3
      ? (tvBoost ? 'P3→P4 Breakout + TV Pattern' : 'P3→P4 Breakout')
      : canBuyP3Tv
        ? 'P3→P4 TV Pattern Override'
      : null;

  // Surface why a coin was blocked even if signal fired
  let skipReason = null;
  if (!canBuy && (phase1.value || phase4.value)) {
    if (!marketCapOk) skipReason = coin.marketCap > MAX_MARKETCAP_USD ? `mcap $${(coin.marketCap/1e6).toFixed(1)}M > limit` : 'no mcap data';
    else if (!entryQuality.drawdownOk) skipReason = `drawdown ${drawdownPct.toFixed(1)}% > ${MAX_ENTRY_DRAWDOWN_PCT}%`;
    else if (!entryQuality.shortMomentumOk) skipReason = `weak momentum (m5 ${pc.m5.toFixed(1)}%, h1 ${pc.h1.toFixed(1)}%)`;
    else if (!entryQuality.flowOk) skipReason = `buy/sell ratio ${buySellRatio.toFixed(2)} < ${MIN_ENTRY_BUY_SELL_RATIO}`;
    else if (!entryQuality.liquidityOk) {
      skipReason = hasLiquidityData
        ? `liquidity $${Math.round(liquidityUsd)} < $${MIN_ENTRY_LIQUIDITY_USD}`
        : `no liquidity data: need ratio >= ${MIN_ENTRY_BUY_SELL_RATIO_NO_LIQ} and users >= ${MIN_ENTRY_ACTIVE_USERS_NO_LIQ}`;
    }
    else if (!entryQuality.volumeLiqOk) skipReason = `vol/liq ${volLiqRatio.toFixed(2)} outside ${MIN_VOL_LIQ_RATIO}-${MAX_VOL_LIQ_RATIO}`;
    else if (!p1IndicatorOk && phase.phase === PHASES.PHASE_1) skipReason = `indicators weak for P1 (RSI ${indicators.rsi ?? 'n/a'})`;
    else if (!p3IndicatorOk && phase.phase === PHASES.PHASE_3) skipReason = `indicators weak for P3 (RSI ${indicators.rsi ?? 'n/a'})`;
    else if (!entryQuality.candlestickOk) skipReason = `candlestick weak (${candlestick.pattern}, score ${candlestick.score})`;
    else if (!socialOk) skipReason = `social ${social.verdict} (with data)`;
    else if (phase.phase === PHASES.PHASE_1 && !youngEnoughForP1) skipReason = `coin too old (${Math.round(coinAgeMs/60000)}m)`;
    else if (phase4.value && !hasEnoughHistory) skipReason = `P3 needs ${MIN_HISTORY_DEPTH} pts (have ${prices.length})`;
    else if (phase4.value && !confidenceOk) skipReason = `P3 confidence ${phase.confidence} < ${MIN_PHASE_CONFIDENCE}`;
  } else if (!canBuy && !phase1.value && phase.phase === PHASES.PHASE_1) {
    // Signal didn't fire — show why
    const bsr = coin.sellVolume > 0 ? (coin.buyVolume / coin.sellVolume) : 0;
    if (!(coin.capitalFlow > -1500 || bsr >= 1.45)) skipReason = 'capital flow too weak';
    else if (bsr <= 1.3) skipReason = `buy/sell ratio ${bsr.toFixed(2)} ≤ 1.3`;
    else if (coin.activeUsers < 20) skipReason = `active users ${coin.activeUsers} < 20`;
    else if (coin.creatorOwnershipPct >= 20) skipReason = `creator owns ${coin.creatorOwnershipPct}%`;
  }

  return {
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    address: coin.address,
    priceSeries: prices.slice(-24).map((p) => Number(p.toFixed(10))),
    createdAt: coin.createdAt,
    coinAgeMs,
    phase: phase.phase,
    phaseLabel: phaseLabel[phase.phase],
    phaseConfidence: phase.confidence,
    phaseReason: phase.reason,
    price: Number(lastPrice.toFixed(10)),
    marketCap: Math.round(coin.marketCap),
    liquidityUsd: Math.round(liquidityUsd),
    capitalFlow: Math.round(coin.capitalFlow),
    activeUsers: Math.round(coin.activeUsers),
    buyVolume: Math.round(coin.buyVolume),
    sellVolume: Math.round(coin.sellVolume),
    creatorOwnershipPct: Number(coin.creatorOwnershipPct.toFixed(2)),
    socials: coin.socials,
    social,
    phase4Signal: phase4,
    phase1Signal: phase1,
    candlestick,
    indicators,
    trackHighValue24h: highValueTrackEligible,
    buyChecks: {
      path: canBuyP1 ? 'P1' : canBuyP3 ? 'P3_BREAKOUT' : null,
      common: {
        marketCapOk,
        marketCap: Math.round(coin.marketCap),
        maxMarketCapUsd: MAX_MARKETCAP_USD,
        liquidityUsd: Math.round(liquidityUsd),
        minLiquidityUsdForHighValueTrack: TRACK_HIGH_VALUE_MIN_LIQUIDITY_USD,
        highValueTrackEligible,
        socialOk,
        socialVerdict: social.verdict,
        hasSocialData,
        tradingViewEnabled: TRADINGVIEW_ENABLED,
        tradingViewBullish: tvBullish,
        tradingViewScore: tvSignal?.score || 0,
        tradingViewScoreMin: TRADINGVIEW_MIN_BULLISH_SCORE,
        tradingViewPattern: tvSignal?.pattern || null,
        tradingViewTimeframe: tvSignal?.timeframe || null,
        tradingViewSignalAt: tvSignal?.receivedAt || null,
        entryQualityOk: p3EntryQualityOk,
        p1EntryQualityOk,
        p3EntryQualityOk,
        drawdownPct: Number(drawdownPct.toFixed(2)),
        maxEntryDrawdownPct: MAX_ENTRY_DRAWDOWN_PCT,
        m5Pct: Number(pc.m5.toFixed(2)),
        minEntryM5Pct: MIN_ENTRY_M5_PCT,
        h1Pct: Number(pc.h1.toFixed(2)),
        minEntryH1Pct: MIN_ENTRY_H1_PCT,
        buySellRatio: Number(buySellRatio.toFixed(2)),
        minEntryBuySellRatio: MIN_ENTRY_BUY_SELL_RATIO,
        volume24: Math.round(volume24),
        volLiqRatio: Number(volLiqRatio.toFixed(2)),
        minVolLiqRatio: MIN_VOL_LIQ_RATIO,
        maxVolLiqRatio: MAX_VOL_LIQ_RATIO,
        minEntryLiquidityUsd: MIN_ENTRY_LIQUIDITY_USD,
        hasLiquidityData,
        minEntryBuySellRatioNoLiq: MIN_ENTRY_BUY_SELL_RATIO_NO_LIQ,
        minEntryActiveUsersNoLiq: MIN_ENTRY_ACTIVE_USERS_NO_LIQ,
        noLiqFallbackOk,
        candlestickPattern: candlestick.pattern,
        candlestickScore: candlestick.score,
        minCandleBullishScore: MIN_CANDLE_BULLISH_SCORE,
        candlestickOk: candlestick.bullish,
        indicatorsReady: indicators.dataReady,
        rsi: indicators.rsi,
        emaFast: indicators.emaFast,
        emaSlow: indicators.emaSlow,
        indicatorThresholds: {
          rsiPeriod: INDICATOR_RSI_PERIOD,
          emaFastPeriod: INDICATOR_EMA_FAST_PERIOD,
          emaSlowPeriod: INDICATOR_EMA_SLOW_PERIOD,
          macdFastPeriod: INDICATOR_MACD_FAST_PERIOD,
          macdSlowPeriod: INDICATOR_MACD_SLOW_PERIOD,
          macdSignalPeriod: INDICATOR_MACD_SIGNAL_PERIOD,
          p1RsiMin: P1_RSI_MIN,
          p1RsiMax: P1_RSI_MAX,
          p1AllowPriceAboveFastEma: P1_ALLOW_PRICE_ABOVE_FAST_EMA,
          p1MinMacdHistogram: P1_MIN_MACD_HISTOGRAM,
          p3RsiMin: P3_RSI_MIN,
          p3RsiMax: P3_RSI_MAX,
          p3RequireTrendUp: P3_REQUIRE_TREND_UP,
          p3RequirePriceAboveFastEma: P3_REQUIRE_PRICE_ABOVE_FAST_EMA,
          p3MinMacdHistogram: P3_MIN_MACD_HISTOGRAM,
          sellRsiOverboughtThreshold: SELL_RSI_OVERBOUGHT_THRESHOLD,
          sellRsiBreakdownThreshold: SELL_RSI_BREAKDOWN_THRESHOLD,
          sellRequireMacdWeakening: SELL_REQUIRE_MACD_WEAKENING,
        },
        macdHistogram: indicators.macdHistogram,
        trendUp: indicators.trendUp,
        priceAboveFastEma: indicators.priceAboveFastEma,
        p1IndicatorOk,
        p3IndicatorOk,
      },
      p1: {
        youngEnough: youngEnoughForP1,
        coinAgeMs,
        maxCoinAgeMs: MAX_COIN_AGE_P1_MS,
        highValueTrackMaxAgeMs: TRACK_HIGH_VALUE_MAX_AGE_MS,
        signal: phase1,
      },
      p3: {
        signal: phase4,
        hasEnoughHistory,
        historyPoints: prices.length,
        minHistoryDepth: MIN_HISTORY_DEPTH,
        confidence: Number(phase.confidence.toFixed(2)),
        minConfidence: minP3Confidence,
        confidenceOk: phase.confidence >= minP3Confidence,
      },
    },
    canBuy,
    buyReason,
    skipReason,
  };
}

function getWalletSnapshot() {
  const positions = [...walletState.openPositions.values()];
  const openValueUsd = positions.reduce((acc, position) => acc + position.currentValueUsd, 0);
  const unrealizedPnlUsd = positions.reduce((acc, position) => acc + position.unrealizedPnlUsd, 0);
  const equityUsd = walletState.cashUsd + openValueUsd;
  const totalReturnUsd = equityUsd - walletState.startUsd;
  const totalReturnPct = walletState.startUsd > 0 ? (totalReturnUsd / walletState.startUsd) * 100 : 0;

  return {
    startUsd: Number(walletState.startUsd.toFixed(2)),
    cashUsd: Number(walletState.cashUsd.toFixed(2)),
    openValueUsd: Number(openValueUsd.toFixed(2)),
    unrealizedPnlUsd: Number(unrealizedPnlUsd.toFixed(2)),
    equityUsd: Number(equityUsd.toFixed(2)),
    realizedPnlUsd: Number(walletState.realizedPnlUsd.toFixed(2)),
    totalReturnUsd: Number(totalReturnUsd.toFixed(2)),
    totalReturnPct: Number(totalReturnPct.toFixed(2)),
    positions: positions.map((position) => ({
      symbol: position.symbol,
      tokenAddress: position.tokenAddress,
      qty: Number(position.qty.toFixed(4)),
      buyPrice: Number(position.buyPrice.toFixed(10)),
      currentPrice: Number(position.currentPrice.toFixed(10)),
      peakPrice: Number((position.peakPrice ?? position.buyPrice).toFixed(10)),
      investedUsd: Number(position.investedUsd.toFixed(2)),
      currentValueUsd: Number(position.currentValueUsd.toFixed(2)),
      unrealizedPnlUsd: Number(position.unrealizedPnlUsd.toFixed(2)),
      unrealizedPnlPct: Number(position.unrealizedPnlPct.toFixed(2)),
      boughtAt: position.boughtAt,
    })),
  };
}

function updateOpenPositionMarks() {
  for (const [tokenAddress, position] of walletState.openPositions.entries()) {
    const coin = marketState.get(tokenAddress);
    const currentPrice = coin?.history?.[coin.history.length - 1] || position.buyPrice;
    const peakPrice = Math.max(position.peakPrice ?? position.buyPrice, currentPrice);
    const currentValueUsd = position.qty * currentPrice;
    const unrealizedPnlUsd = currentValueUsd - position.investedUsd;
    const unrealizedPnlPct = position.investedUsd > 0 ? (unrealizedPnlUsd / position.investedUsd) * 100 : 0;

    walletState.openPositions.set(tokenAddress, {
      ...position,
      currentPrice,
      peakPrice,
      currentValueUsd,
      unrealizedPnlUsd,
      unrealizedPnlPct,
    });
  }
}

function sizePosition(summary) {
  const ticketUsd = 1_000;
  if (walletState.cashUsd < ticketUsd) return null;

  const qty = ticketUsd / summary.price;
  return {
    qty,
    investedUsd: ticketUsd,
  };
}

function executeBuy(summary) {
  if (walletState.openPositions.has(summary.address)) {
    return null;
  }

  const sizing = sizePosition(summary);
  if (!sizing) return null;

  walletState.cashUsd -= sizing.investedUsd;
  botState.totalBoughtVolume += sizing.investedUsd;

  const position = {
    symbol: summary.symbol,
    tokenAddress: summary.address,
    qty: sizing.qty,
    buyPrice: summary.price,
    currentPrice: summary.price,
    peakPrice: summary.price,        // track highest price seen while holding
    investedUsd: sizing.investedUsd,
    currentValueUsd: sizing.investedUsd,
    unrealizedPnlUsd: 0,
    unrealizedPnlPct: 0,
    boughtAt: Date.now(),
  };

  walletState.openPositions.set(summary.address, position);

  return {
    symbol: summary.symbol,
    tokenAddress: summary.address,
    qty: sizing.qty,
    buyPrice: summary.price,
    investedUsd: sizing.investedUsd,
    boughtAt: position.boughtAt,
  };
}

function entryExecutionGuard(summary) {
  const prices = Array.isArray(summary.priceSeries) ? summary.priceSeries : [];
  const n = prices.length;

  // If we do not have enough recent points, defer to existing strategy gates.
  if (n < 3) {
    return { ok: true, reason: 'insufficient-points-for-entry-guard' };
  }

  const windowPoints = Math.max(3, Math.min(ENTRY_GUARD_WINDOW_POINTS, n));
  const window = prices.slice(-windowPoints);
  const latest = window[window.length - 1];
  const earliest = window[0];
  const localPeak = Math.max(...window);
  const windowDrawdownPct = localPeak > 0 ? ((localPeak - latest) / localPeak) * 100 : 0;
  const windowRisePct = earliest > 0 ? ((latest - earliest) / earliest) * 100 : 0;

  const prev = prices[n - 2];
  const prev2 = prices[n - 3];
  const lastTickPct = prev > 0 ? ((prices[n - 1] - prev) / prev) * 100 : 0;
  const prevTickPct = prev2 > 0 ? ((prev - prev2) / prev2) * 100 : 0;
  const last2CombinedPct = lastTickPct + prevTickPct;

  const buySellRatio = safeNumber(summary?.buyChecks?.common?.buySellRatio, 0);

  if (windowDrawdownPct > ENTRY_GUARD_MAX_WINDOW_DRAWDOWN_PCT) {
    return {
      ok: false,
      reason: `entry-guard: local drawdown ${windowDrawdownPct.toFixed(1)}% > ${ENTRY_GUARD_MAX_WINDOW_DRAWDOWN_PCT}%`,
    };
  }

  if (windowRisePct > ENTRY_GUARD_MAX_WINDOW_RISE_PCT) {
    return {
      ok: false,
      reason: `entry-guard: overextended +${windowRisePct.toFixed(1)}% > ${ENTRY_GUARD_MAX_WINDOW_RISE_PCT}%`,
    };
  }

  if (lastTickPct < -ENTRY_GUARD_MAX_LAST_TICK_DROP_PCT) {
    return {
      ok: false,
      reason: `entry-guard: last tick ${lastTickPct.toFixed(1)}% < -${ENTRY_GUARD_MAX_LAST_TICK_DROP_PCT}%`,
    };
  }

  if (last2CombinedPct < ENTRY_GUARD_MIN_LAST2_COMBINED_PCT) {
    return {
      ok: false,
      reason: `entry-guard: last2 ${last2CombinedPct.toFixed(1)}% < ${ENTRY_GUARD_MIN_LAST2_COMBINED_PCT}%`,
    };
  }

  if (buySellRatio > 0 && buySellRatio < ENTRY_GUARD_MIN_BUY_SELL_RATIO) {
    return {
      ok: false,
      reason: `entry-guard: buy/sell ${buySellRatio.toFixed(2)} < ${ENTRY_GUARD_MIN_BUY_SELL_RATIO}`,
    };
  }

  return { ok: true, reason: 'entry-guard-pass' };
}

/**
 * Smart sell signal: read live market momentum to decide the optimal exit when in profit.
 * Returns { sell: boolean, reason: string }
 */
function smartSellSignal(coin, openPosition, currentPrice, heldMs) {
  const prices = coin?.history || [];
  const indicators = analyzeIndicators(prices);
  const pnlPct = openPosition.buyPrice > 0
    ? ((currentPrice - openPosition.buyPrice) / openPosition.buyPrice) * 100
    : 0;
  const peakPrice = openPosition.peakPrice ?? openPosition.buyPrice;
  const peakGainPct = openPosition.buyPrice > 0
    ? ((peakPrice - openPosition.buyPrice) / openPosition.buyPrice) * 100
    : 0;

  // Deterministic exits first so positions cannot get stuck open forever.
  if (pnlPct >= strategyState.hardTakeProfitPct) {
    return { sell: true, reason: `hard-take-profit-${strategyState.hardTakeProfitPct}pct` };
  }

  // Quick profit: take gains as soon as we hit the target — don't wait for reversal signals.
  if (pnlPct >= strategyState.quickProfitPct) {
    return { sell: true, reason: `quick-profit-${strategyState.quickProfitPct}pct` };
  }

  // Only fire normal exits above a minimum profit buffer.
  if (pnlPct < strategyState.minProfitExitPct) {
    return { sell: false, reason: 'below-min-profit-exit' };
  }

  // Once a trade reached decent profit, protect a minimum gain.
  if (peakGainPct >= strategyState.breakevenArmPct && pnlPct <= strategyState.breakevenFloorPct) {
    return { sell: true, reason: 'breakeven-protect' };
  }

  // Capital efficiency: if profitable for long enough, realize and rotate.
  if (heldMs >= strategyState.profitTimeExitMs && pnlPct >= strategyState.profitTimeExitMinPct) {
    return { sell: true, reason: 'time-profit-exit' };
  }

  // Need at least 4 price points to read momentum
  if (prices.length < 4) return { sell: false, reason: 'not-enough-data' };

  const last4 = prices.slice(-4);
  const last3 = prices.slice(-3);

  const buySellRatio = coin.sellVolume > 0 ? coin.buyVolume / coin.sellVolume : 1;
  const negativeFlow = coin.capitalFlow < 0;

  // 3 consecutive price drops — momentum has reversed
  const threeDrops = last3[2] < last3[1] && last3[1] < last3[0];

  // Sellers are clearly overwhelming buyers
  const sellersOverwhelming = buySellRatio < 0.75;

  // Velocity dying: each successive move is getting smaller (deceleration)
  const m1 = last4[1] > 0 ? Math.abs((last4[2] - last4[1]) / last4[1]) : 0;
  const m2 = last4[2] > 0 ? Math.abs((last4[3] - last4[2]) / last4[2]) : 0;
  const decelerating = m2 < m1 * 0.4 && last4[3] < last4[2]; // move shrinking fast AND price dropping

  // Phase has turned bearish
  const phase = detectPhase(prices);
  const phaseCrashing = phase.phase === PHASES.PHASE_2;

  // Exit logic — tiered by profit level
  if (pnlPct >= 5) {
    // At +5% or more: exit on any strong reversal signal
    if (threeDrops && sellersOverwhelming) return { sell: true, reason: 'momentum-reversal' };
    if (phaseCrashing && negativeFlow) return { sell: true, reason: 'phase-crash-with-loss-of-flow' };
  }

  if (pnlPct >= 12) {
    // At +12% or more: exit on softer signals (deceleration + any drop)
    if (decelerating) return { sell: true, reason: 'momentum-deceleration' };
    if (threeDrops && negativeFlow) return { sell: true, reason: 'trend-reversal' };
    if (indicators.dataReady
      && indicators.rsi >= SELL_RSI_OVERBOUGHT_THRESHOLD
      && (!SELL_REQUIRE_MACD_WEAKENING || indicators.macdWeakening)
    ) {
      return { sell: true, reason: 'rsi-overbought-macd-rollover' };
    }
  }

  if (pnlPct >= 25) {
    // At +25%: lock in gains at any two-candle drop
    const twoDrops = last3[2] < last3[1] && last3[1] < last3[0];
    if (twoDrops) return { sell: true, reason: 'locking-gains-above-25pct' };
  }

  if (indicators.dataReady && pnlPct >= strategyState.minProfitExitPct) {
    // Low RSI + bearish momentum while still in profit means trend has likely exhausted.
    if (indicators.rsi <= SELL_RSI_BREAKDOWN_THRESHOLD
      && (!SELL_REQUIRE_MACD_WEAKENING || indicators.macdWeakening)
    ) {
      return { sell: true, reason: 'rsi-breakdown-in-profit' };
    }
  }

  return { sell: false, reason: 'momentum-ok' };
}

function maybeExitPosition(summary, state) {
  if (!state.position) return null;

  const openPosition = walletState.openPositions.get(summary.address);
  if (!openPosition) {
    state.position = null;
    return null;
  }

  const pnlPct = ((summary.price - openPosition.buyPrice) / openPosition.buyPrice) * 100;
  const heldMs = Date.now() - openPosition.boughtAt;
  const oldEnough = heldMs >= MIN_HOLD_MS;
  const inPostBuyProtection = heldMs <= POST_BUY_PROTECTION_MS;

  // Smart momentum-based exit (profit only)
  const coin = marketState.get(summary.address);
  const smartSell = smartSellSignal(coin, openPosition, summary.price, heldMs);

  // Trailing stop: once peak gain >= TRAIL_ACTIVATE_PCT, trail from peak by TRAIL_STOP_PCT
  const peakPrice = openPosition.peakPrice ?? openPosition.buyPrice;
  const peakGainPct = ((peakPrice - openPosition.buyPrice) / openPosition.buyPrice) * 100;
  const trailActive = peakGainPct >= strategyState.trailActivatePct;
  const trailPrice = peakPrice * (1 - strategyState.trailStopPct / 100);
  const hitTrail = trailActive && summary.price <= trailPrice && (!strategyState.profitOnlyMode || pnlPct > 0);

  const buySellRatio = (coin?.sellVolume || 0) > 0 ? coin.buyVolume / coin.sellVolume : 1;
  const negativeFlow = (coin?.capitalFlow || 0) < 0;
  const emergencyDump = ALLOW_EMERGENCY_LOSS_EXIT && inPostBuyProtection
    && pnlPct <= POST_BUY_EMERGENCY_STOP_PCT
    && (negativeFlow || buySellRatio < 0.95 || summary.phase === PHASES.PHASE_2);

  // Hard floor stop: only after min hold, only when trailing not yet active
  const hitStop = !strategyState.profitOnlyMode && oldEnough && !trailActive && pnlPct <= -12;
  const bearishPhase = !strategyState.profitOnlyMode && oldEnough && summary.phase === PHASES.PHASE_2;

  if (!smartSell.sell && !hitTrail && !hitStop && !bearishPhase && !emergencyDump) return null;

  const outcome = smartSell.sell
    ? `smart-exit:${smartSell.reason}`
    : hitTrail ? 'trail-stop'
    : hitStop ? 'stop'
    : emergencyDump ? 'post-buy-emergency-stop'
    : 'phase-break';

  const proceedsUsd = openPosition.qty * summary.price;
  const pnlUsd = proceedsUsd - openPosition.investedUsd;

  walletState.cashUsd += proceedsUsd;
  walletState.realizedPnlUsd += pnlUsd;
  walletState.openPositions.delete(summary.address);
  botState.totalSoldVolume += proceedsUsd;

  const trade = {
    symbol: summary.symbol,
    tokenAddress: summary.address,
    buyPrice: openPosition.buyPrice,
    sellPrice: summary.price,
    qty: openPosition.qty,
    investedUsd: openPosition.investedUsd,
    proceedsUsd,
    pnlUsd: Number(pnlUsd.toFixed(2)),
    pnlPct: Number(pnlPct.toFixed(2)),
    boughtAt: openPosition.boughtAt,
    soldAt: Date.now(),
    heldMs: Date.now() - openPosition.boughtAt,
    outcome: outcome,
  };

  tradeLog.unshift(trade);

  if (trade.pnlUsd > 0) {
    blacklist.add(summary.symbol);
  }

  return trade;
}

function isSkipCoolingDown(skipState, now = Date.now()) {
  if (!skipState) return false;
  const lastSeenAt = Number(skipState.lastSeenAt || skipState.skippedAt || 0);
  return now - lastSeenAt < SKIP_RECHECK_MS;
}

function seedCoin(symbol, name, basePrice, pumpPrice, settlePrice) {
  const now = Date.now();
  const socialChance = Math.random();
  const socials = {
    twitter: socialChance > 0.15 ? `https://x.com/${symbol.toLowerCase()}coin` : null,
    telegram: socialChance > 0.35 ? `https://t.me/${symbol.toLowerCase()}portal` : null,
    website: socialChance > 0.55 ? `https://${symbol.toLowerCase()}coin.fun` : null,
  };

  return {
    id: `sim-${symbol.toLowerCase()}`,
    address: `sim_${symbol.toLowerCase()}_${Math.random().toString(16).slice(2, 10)}`,
    symbol,
    name,
    createdAt: now - rand(4, 40) * 60_000,
    socials,
    history: [
      basePrice,
      basePrice * 1.17,
      pumpPrice,
      pumpPrice * 0.84,
      pumpPrice * 0.63,
      settlePrice,
    ].map((price) => Number(price.toFixed(10))),
    creatorOwnershipPct: rand(4, 22),
    supply: rand(850_000_000, 1_000_000_000),
    activeUsers: rand(40, 220),
    buyVolume: rand(8_000, 40_000),
    sellVolume: rand(5_000, 35_000),
    marketCap: rand(90_000, 1_200_000),
    liquidityUsd: rand(25_000, 400_000),
    capitalFlow: rand(-8_500, 21_000),
  };
}

function mutateSimCoin(coin) {
  const prices = coin.history;
  const last = prices[prices.length - 1];
  const phase = detectPhase(prices);

  let drift = floatRand(-0.04, 0.08);
  if (phase.phase === PHASES.PHASE_1) drift = floatRand(0.01, 0.2);
  if (phase.phase === PHASES.PHASE_2) drift = floatRand(-0.2, -0.01);
  if (phase.phase === PHASES.PHASE_3) drift = floatRand(-0.02, 0.04);
  if (phase.phase === PHASES.PHASE_4) drift = floatRand(0.03, 0.16);

  const nextPrice = Math.max(last * (1 + drift), last * 0.35);
  prices.push(Number(nextPrice.toFixed(10)));
  if (prices.length > 80) prices.shift();

  coin.buyVolume = Math.max(1_000, Math.round(coin.buyVolume * (1 + floatRand(-0.1, 0.12))));
  coin.sellVolume = Math.max(500, Math.round(coin.sellVolume * (1 + floatRand(-0.1, 0.12))));
  coin.activeUsers = Math.max(10, Math.round(coin.activeUsers * (1 + floatRand(-0.08, 0.08))));
  coin.marketCap = Math.max(10_000, Math.round(coin.marketCap * (1 + drift)));
  coin.liquidityUsd = Math.max(5_000, Math.round((coin.liquidityUsd || 30_000) * (1 + floatRand(-0.12, 0.14))));
  coin.capitalFlow = coin.buyVolume - coin.sellVolume;
  coin.creatorOwnershipPct = Number(
    Math.min(40, Math.max(1.5, coin.creatorOwnershipPct + floatRand(-0.18, 0.2))).toFixed(2),
  );
}

function getFallbackSimUniverse() {
  return [
    seedCoin('BORK', 'Bork Inu', 0.000031, 0.000082, 0.00004),
    seedCoin('TUNA', 'Tuna Cat', 0.000051, 0.00011, 0.000053),
    seedCoin('WAGMI', 'Wagmi Rocket', 0.000029, 0.000072, 0.000034),
    seedCoin('MOONI', 'Mooni Dog', 0.000017, 0.000042, 0.00002),
    seedCoin('PEPE2', 'Pepe Two', 0.00022, 0.00044, 0.00023),
    seedCoin('MINTY', 'Minty Frog', 0.000071, 0.00016, 0.000078),
    seedCoin('KABOOM', 'Kaboom Cat', 0.000011, 0.000032, 0.000013),
    seedCoin('RUGX', 'RugX', 0.000055, 0.00014, 0.000061),
  ];
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'shitcoin-tracker/1.0',
    },
  });

  if (!response.ok) {
    const error = new Error(`Failed ${response.status} for ${url}`);
    error.status = response.status;
    error.url = url;
    throw error;
  }

  return response.json();
}

async function fetchPumpCoinsWithFallback() {
  const endpoints = [
    'https://frontend-api.pump.fun/coins?offset=0&limit=40&sort=created_timestamp&order=DESC&includeNsfw=false',
    'https://frontend-api-v3.pump.fun/coins?offset=0&limit=40&sort=created_timestamp&order=DESC&includeNsfw=false',
  ];

  const errors = [];
  let blockedBy403 = 0;
  for (const endpoint of endpoints) {
    try {
      const payload = await fetchJson(endpoint);
      if (Array.isArray(payload) && payload.length > 0) {
        return {
          coins: payload,
          endpoint,
          blockedBy403: false,
        };
      }

      errors.push(`Empty payload from ${endpoint}`);
    } catch (error) {
      if (error?.status === 403) blockedBy403 += 1;
      errors.push(error instanceof Error ? error.message : `Unknown error for ${endpoint}`);
    }
  }

  const fallbackError = new Error(errors.join(' | '));
  fallbackError.blockedBy403 = blockedBy403 === endpoints.length;
  throw fallbackError;
}

function chooseBestPair(pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0) return null;
  return pairs
    .filter((pair) => pair?.chainId === 'solana')
    .sort((a, b) => {
      const aLiq = Number(a?.liquidity?.usd || 0);
      const bLiq = Number(b?.liquidity?.usd || 0);
      return bLiq - aLiq;
    })[0];
}

function extractSocials(pair) {
  const socialsList = pair?.info?.socials || [];
  const websitesList = pair?.info?.websites || [];

  const twitter = socialsList.find((item) => item?.type?.toLowerCase() === 'twitter')?.url || null;
  const telegram = socialsList.find((item) => item?.type?.toLowerCase() === 'telegram')?.url || null;
  const website = websitesList[0]?.url || null;

  return { twitter, telegram, website };
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function upsertRealCoin({ address, symbol, name, createdAt, creatorOwnershipPct, pair }) {
  const price = safeNumber(pair?.priceUsd, 0);
  if (price <= 0) return false;

  const txnsH24 = pair?.txns?.h24 || {};
  const buys = safeNumber(txnsH24?.buys, 0);
  const sells = safeNumber(txnsH24?.sells, 0);
  const totalTx = Math.max(1, buys + sells);
  const volumeH24 = safeNumber(pair?.volume?.h24, 0);
  const buyVolume = volumeH24 * (buys / totalTx);
  const sellVolume = volumeH24 * (sells / totalTx);
  const marketCap = safeNumber(pair?.marketCap, safeNumber(pair?.fdv, 0));
  const liquidityUsd = safeNumber(pair?.liquidity?.usd, 0);

  const priceChange = {
    m5:  safeNumber(pair?.priceChange?.m5,  0),
    h1:  safeNumber(pair?.priceChange?.h1,  0),
    h6:  safeNumber(pair?.priceChange?.h6,  0),
    h24: safeNumber(pair?.priceChange?.h24, 0),
  };

  const previous = marketState.get(address);
  const history = previous?.history ? [...previous.history] : [];
  history.push(price);
  if (history.length > 80) history.shift();

  marketState.set(address, {
    id: `real-${address}`,
    address,
    symbol,
    name,
    createdAt,
    history,
    priceChange,
    socials: extractSocials(pair),
    creatorOwnershipPct,
    activeUsers: Math.max(1, Math.round(buys + sells)),
    buyVolume,
    sellVolume,
    marketCap,
    liquidityUsd,
    capitalFlow: buyVolume - sellVolume,
    source: 'real',
  });

  return true;
}

async function ingestRealMarketDataViaPumpFun() {
  const pumpResult = await fetchPumpCoinsWithFallback();
  const coins = pumpResult.coins;

  if (!Array.isArray(coins) || coins.length === 0) {
    throw new Error('Pump.fun returned empty coin list');
  }

  const mints = coins
    .map((coin) => coin?.mint || coin?.address)
    .filter((mint) => typeof mint === 'string' && mint.length > 20)
    .slice(0, 25);

  if (mints.length === 0) {
    throw new Error('No valid token mints found from pump.fun');
  }

  const dexData = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${mints.join(',')}`);
  const pairList = Array.isArray(dexData?.pairs) ? dexData.pairs : [];
  if (pairList.length === 0) {
    throw new Error('DexScreener returned no matching Solana pairs');
  }

  const pairMap = new Map();
  for (const pair of pairList) {
    const tokenAddress = pair?.baseToken?.address;
    if (!tokenAddress) continue;

    const existing = pairMap.get(tokenAddress) || [];
    existing.push(pair);
    pairMap.set(tokenAddress, existing);
  }

  let inserted = 0;
  for (const coin of coins) {
    const address = coin?.mint || coin?.address;
    if (!address) continue;

    const bestPair = chooseBestPair(pairMap.get(address));
    if (!bestPair) continue;

    const ok = upsertRealCoin({
      address,
      symbol: (bestPair?.baseToken?.symbol || coin?.symbol || 'UNK').toUpperCase(),
      name: bestPair?.baseToken?.name || coin?.name || 'Unknown',
      createdAt: safeNumber(coin?.created_timestamp, Date.now()),
      creatorOwnershipPct: safeNumber(
        coin?.creator_token_percentage ?? coin?.creatorPercent ?? coin?.creator_ownership,
        rand(3, 18),
      ),
      pair: bestPair,
    });

    if (ok) inserted += 1;
  }

  if (inserted === 0) {
    throw new Error('Pump.fun + DexScreener produced zero usable tokens');
  }

  return pumpResult.endpoint;
}

async function ingestRealMarketDataViaDexOnly() {
  const tokenProfiles = await fetchJson('https://api.dexscreener.com/token-profiles/latest/v1');
  const profiles = Array.isArray(tokenProfiles) ? tokenProfiles : [];

  const solanaAddresses = profiles
    .filter((item) => item?.chainId === 'solana')
    .map((item) => item?.tokenAddress)
    .filter((address) => typeof address === 'string' && address.length > 20)
    .slice(0, 25);

  if (solanaAddresses.length === 0) {
    throw new Error('Dex token profiles contained no Solana token addresses');
  }

  const dexData = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${solanaAddresses.join(',')}`);
  const pairList = Array.isArray(dexData?.pairs) ? dexData.pairs : [];
  if (pairList.length === 0) {
    throw new Error('Dex-only path returned no token pairs');
  }

  const grouped = new Map();
  for (const pair of pairList) {
    const tokenAddress = pair?.baseToken?.address;
    if (!tokenAddress) continue;

    const current = grouped.get(tokenAddress) || [];
    current.push(pair);
    grouped.set(tokenAddress, current);
  }

  let inserted = 0;
  for (const address of solanaAddresses) {
    const bestPair = chooseBestPair(grouped.get(address));
    if (!bestPair) continue;

    const ok = upsertRealCoin({
      address,
      symbol: (bestPair?.baseToken?.symbol || 'UNK').toUpperCase(),
      name: bestPair?.baseToken?.name || 'Unknown',
      createdAt: Date.now(),
      creatorOwnershipPct: rand(3, 18),
      pair: bestPair,
    });

    if (ok) inserted += 1;
  }

  if (inserted === 0) {
    throw new Error('Dex-only path produced zero usable tokens');
  }
}

async function ingestRealMarketData() {
  try {
    const endpointUsed = await ingestRealMarketDataViaPumpFun();
    return {
      source: `pump.fun + DexScreener (${new URL(endpointUsed).host})`,
      warning: null,
    };
  } catch (pumpError) {
    await ingestRealMarketDataViaDexOnly();
    const blockedBy403 = Boolean(pumpError?.blockedBy403);
    return {
      source: 'DexScreener-only (pump.fun blocked)',
      warning: blockedBy403
        ? 'Pump.fun blocked with HTTP 403. Running in DexScreener-only discovery mode.'
        : `Pump.fun path failed, switched to Dex-only: ${
            pumpError instanceof Error ? pumpError.message : 'unknown error'
          }`,
    };
  }
}

function ingestSimulatedData() {
  if (marketState.size === 0) {
    for (const coin of getFallbackSimUniverse()) {
      marketState.set(coin.address, coin);
    }
  }

  for (const coin of marketState.values()) {
    mutateSimCoin(coin);
  }
}

async function refreshMarketData() {
  if (!USE_REAL_DATA) {
    ingestSimulatedData();
    botState.dataMode = 'simulated';
    botState.dataSource = 'internal simulation';
    return;
  }

  try {
    const realDataResult = await ingestRealMarketData();
    botState.dataMode = 'real';
    botState.dataSource = realDataResult.source;
    botState.lastDataError = realDataResult.warning;
  } catch (error) {
    botState.lastDataError = error instanceof Error ? error.message : 'Unknown data fetch error';
    ingestSimulatedData();
    botState.dataMode = 'simulated-fallback';
    botState.dataSource = 'fallback simulation (real fetch failed)';
  }
}

function updateRealizedPnlPct() {
  const soldTrades = tradeLog.slice(0, 200);
  if (soldTrades.length === 0) {
    botState.realizedPnlPct = 0;
    return;
  }

  const totalInvested = soldTrades.reduce((acc, t) => acc + t.investedUsd, 0);
  const totalPnl = soldTrades.reduce((acc, t) => acc + t.pnlUsd, 0);
  botState.realizedPnlPct = totalInvested > 0
    ? Number(((totalPnl / totalInvested) * 100).toFixed(2))
    : 0;
}

// Re-fetch prices for open positions that may have slid off the trending list
async function refreshOpenPositionPrices() {
  const openAddresses = [...walletState.openPositions.keys()];
  if (openAddresses.length === 0) return;

  try {
    const dexData = await fetchJson(
      `https://api.dexscreener.com/latest/dex/tokens/${openAddresses.join(',')}`,
    );
    const pairs = Array.isArray(dexData?.pairs) ? dexData.pairs : [];

    const grouped = new Map();
    for (const pair of pairs) {
      const addr = pair?.baseToken?.address;
      if (!addr) continue;
      const bucket = grouped.get(addr) || [];
      bucket.push(pair);
      grouped.set(addr, bucket);
    }

    for (const address of openAddresses) {
      const bestPair = chooseBestPair(grouped.get(address));
      if (!bestPair) continue;
      const existing = marketState.get(address);
      upsertRealCoin({
        address,
        symbol: (bestPair?.baseToken?.symbol || 'UNK').toUpperCase(),
        name: bestPair?.baseToken?.name || 'Unknown',
        createdAt: existing?.createdAt ?? Date.now(),
        creatorOwnershipPct: existing?.creatorOwnershipPct ?? rand(3, 18),
        pair: bestPair,
      });
    }
  } catch {
    // Silent — main refresh already ran; open position marks will use last known price
  }
}

// Lightweight price refresh — always running, no trading logic
async function refreshPrices() {
  try {
    await refreshMarketData();
    if (USE_REAL_DATA && walletState.openPositions.size > 0) {
      await refreshOpenPositionPrices();
    }
    updateOpenPositionMarks();
  } catch (err) {
    botState.lastDataError = err instanceof Error ? err.message : 'Price refresh error';
  }
}

async function scanAndTrack() {
  if (botState.scanInProgress) return;

  botState.scanInProgress = true;
  try {
    // Prices already fresh from background loop; just re-mark open positions
    updateOpenPositionMarks();

    botState.scans += 1;
    botState.lastScanAt = Date.now();

    const summaries = [...marketState.values()].map((coin) => summarizeCoin(coin));

    for (const summary of summaries) {
      const now = Date.now();
      const existing = trackedCoins.get(summary.symbol) || {
        status: 'watching',
        observedAt: Date.now(),
        position: null,
        sold: false,
        buySignalStreak: 0,
      };

      const shouldTrackByPolicy =
        summary.phase === PHASES.PHASE_1
        || summary.phase === PHASES.PHASE_2
        || summary.phase === PHASES.PHASE_3
        || trackedCoins.has(summary.symbol)
        || summary.trackHighValue24h;

      // Tokens explicitly skipped by strategy are moved to a separate list and no longer tracked.
      if (summary.skipReason && !existing.position && !summary.trackHighValue24h) {
        const previousSkip = skippedCoins.get(summary.symbol);
        skippedCoins.set(summary.symbol, {
          symbol: summary.symbol,
          reason: summary.skipReason,
          skippedAt: previousSkip?.skippedAt ?? now,
          lastSeenAt: now,
          snapshot: summary,
        });
      }

      // Keep skipped list snapshots fresh for UI, but do not re-track them.
      if (skippedCoins.has(summary.symbol) && summary.trackHighValue24h) {
        skippedCoins.delete(summary.symbol);
      }

      if (skippedCoins.has(summary.symbol)) {
        const previousSkip = skippedCoins.get(summary.symbol);
        if (summary.canBuy || !isSkipCoolingDown(previousSkip, now)) {
          skippedCoins.delete(summary.symbol);
        } else {
          skippedCoins.set(summary.symbol, {
            ...previousSkip,
            reason: summary.skipReason || previousSkip.reason,
            lastSeenAt: now,
            snapshot: summary,
          });
          continue;
        }
      }

      if (blacklist.has(summary.symbol)) {
        continue;
      }

      if (shouldTrackByPolicy) {
        existing.snapshot = summary;
        existing.lastSeenAt = now;

        if (!existing.position) {
          existing.buySignalStreak = summary.canBuy ? (existing.buySignalStreak || 0) + 1 : 0;
        }

        if (!existing.position && summary.canBuy && walletState.openPositions.size < MAX_OPEN_POSITIONS) {
          if ((existing.buySignalStreak || 0) < Math.max(1, BUY_CONFIRMATION_SCANS)) {
            existing.status = 'watching';
            trackedCoins.set(summary.symbol, existing);
            continue;
          }

          const guard = entryExecutionGuard(summary);
          if (!guard.ok) {
            const previousSkip = skippedCoins.get(summary.symbol);
            skippedCoins.set(summary.symbol, {
              symbol: summary.symbol,
              reason: guard.reason,
              skippedAt: previousSkip?.skippedAt ?? now,
              lastSeenAt: now,
              snapshot: summary,
            });
            existing.status = 'watching';
            trackedCoins.set(summary.symbol, existing);
            continue;
          }

          const bought = executeBuy(summary);
          if (bought) {
            existing.position = bought;
            existing.status = 'bought';
            existing.buySignalStreak = 0;
          }
        }

        const exitTrade = maybeExitPosition(summary, existing);
        if (exitTrade) {
          existing.status = 'sold';
          existing.position = null;
          existing.sold = true;
        }

        if (!existing.position && !existing.sold) {
          existing.status = summary.canBuy ? 'ready' : 'watching';
        }

        trackedCoins.set(summary.symbol, existing);
      }
    }

    for (const [symbol, state] of trackedCoins.entries()) {
      if (state.sold) {
        trackedCoins.delete(symbol);
      }
    }

    updateOpenPositionMarks();
    updateRealizedPnlPct();
  } finally {
    botState.scanInProgress = false;
  }
}

function getDashboard() {
  // Ensure open position marks reflect the freshest known market prices.
  updateOpenPositionMarks();

  const activeTradingViewSignals = listActiveTradingViewSignals(20);

  const market = [...marketState.values()]
    .map((coin) => summarizeCoin(coin))
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 40);

  const summaryBySymbol = new Map(market.map((item) => [item.symbol, item]));

  const tracked = [...trackedCoins.entries()]
    .map(([symbol, value]) => {
      const refreshedSnapshot = summaryBySymbol.get(symbol) || value.snapshot;
      return {
        symbol,
        status: value.status,
        observedAt: value.observedAt,
        lastSeenAt: value.lastSeenAt,
        position: value.position,
        snapshot: refreshedSnapshot,
      };
    })
    .filter((item) => item.snapshot)
    .sort((a, b) => b.snapshot.marketCap - a.snapshot.marketCap);

  const skipped = [...skippedCoins.values()]
    .map((item) => ({
      ...item,
      snapshot: summaryBySymbol.get(item.symbol) || item.snapshot,
    }))
    .filter((item) => item.snapshot)
    .sort((a, b) => b.skippedAt - a.skippedAt);

  return {
    bot: {
      running: botState.running,
      scans: botState.scans,
      lastScanAt: botState.lastScanAt,
      intervalMs: BOT_INTERVAL_MS,
      totalBoughtVolume: Number(botState.totalBoughtVolume.toFixed(2)),
      totalSoldVolume: Number(botState.totalSoldVolume.toFixed(2)),
      realizedPnlPct: botState.realizedPnlPct,
      dataMode: botState.dataMode,
      dataSource: botState.dataSource,
      lastDataError: botState.lastDataError,
      tradingView: {
        enabled: TRADINGVIEW_ENABLED,
        activeSignals: activeTradingViewSignals.length,
        signalTtlMs: TRADINGVIEW_SIGNAL_TTL_MS,
        minBullishScore: TRADINGVIEW_MIN_BULLISH_SCORE,
      },
      strategy: getStrategySnapshot(),
    },
    wallet: getWalletSnapshot(),
    tracked,
    skipped,
    market,
    tradingViewSignals: activeTradingViewSignals,
    blacklist: [...blacklist],
    trades: tradeLog.slice(0, 30),
  };
}

async function startBot() {
  if (botState.running) return;
  botState.running = true;
  await scanAndTrack();
  botState.timer = setInterval(() => {
    scanAndTrack().catch((error) => {
      botState.lastDataError = error instanceof Error ? error.message : 'Unknown scan error';
    });
  }, BOT_INTERVAL_MS);
}

function stopBot() {
  if (!botState.running) return;
  botState.running = false;
  clearInterval(botState.timer);
  botState.timer = null;
}

app.get('/api/health', (_req, res) => {
  const activeSignals = listActiveTradingViewSignals(20);
  res.json({
    ok: true,
    service: 'pumpgun-bot',
    ts: Date.now(),
    dataMode: botState.dataMode,
    dataSource: botState.dataSource,
    scanInProgress: botState.scanInProgress,
    integrations: {
      tradingView: {
        enabled: TRADINGVIEW_ENABLED,
        activeSignals: activeSignals.length,
        signalTtlMs: TRADINGVIEW_SIGNAL_TTL_MS,
        minBullishScore: TRADINGVIEW_MIN_BULLISH_SCORE,
      },
    },
  });
});

app.get('/api/integrations/tradingview/signals', (_req, res) => {
  const activeSignals = listActiveTradingViewSignals(50);
  return res.json({
    ok: true,
    enabled: TRADINGVIEW_ENABLED,
    count: activeSignals.length,
    signals: activeSignals,
    ts: Date.now(),
  });
});

app.post('/api/integrations/tradingview/webhook', (req, res) => {
  if (!TRADINGVIEW_ENABLED) {
    return res.status(503).json({ ok: false, error: 'TradingView integration disabled' });
  }

  const suppliedToken = String(req?.headers?.['x-tv-token'] || req?.query?.token || req?.body?.token || '');
  if (TRADINGVIEW_WEBHOOK_TOKEN && suppliedToken !== TRADINGVIEW_WEBHOOK_TOKEN) {
    return res.status(401).json({ ok: false, error: 'Invalid TradingView webhook token' });
  }

  const symbol = String(req?.body?.symbol || '').toUpperCase().trim();
  const address = String(req?.body?.address || '').trim();
  const pattern = String(req?.body?.pattern || req?.body?.setup || 'unknown').trim();
  const timeframe = String(req?.body?.timeframe || req?.body?.tf || 'unknown').trim();
  const direction = parseSignalDirection(req?.body?.direction || req?.body?.signal || req?.body?.side);
  const confidence = safeNumber(req?.body?.confidence, 0.5);

  if (!symbol && !address) {
    return res.status(400).json({ ok: false, error: 'Provide symbol or address in payload' });
  }

  const score = scoreTradingViewPattern(pattern, confidence);
  const receivedAt = Date.now();
  const signal = {
    symbol,
    address,
    pattern,
    timeframe,
    direction,
    confidence: Number(confidence.toFixed(2)),
    score,
    source: 'tradingview-webhook',
    receivedAt,
    expiresAt: receivedAt + TRADINGVIEW_SIGNAL_TTL_MS,
  };

  if (symbol) tradingViewSignals.set(`symbol:${symbol}`, signal);
  if (address) tradingViewSignals.set(`address:${address}`, signal);

  return res.json({
    ok: true,
    stored: { symbol: signal.symbol || null, address: signal.address || null },
    signal,
    activeSignals: tradingViewSignals.size,
  });
});

app.get('/api/dashboard', (_req, res) => {
  res.json(getDashboard());
});

app.post('/api/bot/start', async (_req, res) => {
  await startBot();
  res.json({ ok: true, running: true, walletStartUsd: STARTING_BALANCE_USD });
});

app.post('/api/bot/stop', (_req, res) => {
  stopBot();
  res.json({ ok: true, running: false });
});

app.post('/api/bot/tick', async (_req, res) => {
  await scanAndTrack();
  res.json({ ok: true, scan: botState.scans });
});

app.post('/api/strategy/preset', (req, res) => {
  const preset = req?.body?.preset;
  if (!preset || !strategyPresets[preset]) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid preset. Use one of: conservative, balanced, aggressive',
    });
  }

  const keepProfitOnly = strategyState.profitOnlyMode;
  Object.assign(strategyState, strategyPresets[preset], {
    preset,
    profitOnlyMode: keepProfitOnly,
  });

  return res.json({ ok: true, strategy: getStrategySnapshot() });
});

app.post('/api/strategy/profit-only', (req, res) => {
  const enabled = req?.body?.enabled;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'enabled must be a boolean' });
  }

  strategyState.profitOnlyMode = enabled;
  return res.json({ ok: true, strategy: getStrategySnapshot() });
});

app.get('/api/market', (_req, res) => {
  // Ensure wallet position marks use the freshest available market prices.
  updateOpenPositionMarks();

  const market = [...marketState.values()]
    .map((coin) => summarizeCoin(coin))
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 40);

  const summaryBySymbol = new Map(market.map((item) => [item.symbol, item]));

  const tracked = [...trackedCoins.entries()]
    .map(([symbol, value]) => {
      const refreshedSnapshot = summaryBySymbol.get(symbol) || value.snapshot;
      return {
        symbol,
        status: value.status,
        observedAt: value.observedAt,
        lastSeenAt: value.lastSeenAt,
        position: value.position,
        snapshot: refreshedSnapshot,
      };
    })
    .filter((item) => item.snapshot)
    .sort((a, b) => b.snapshot.marketCap - a.snapshot.marketCap);

  const skipped = [...skippedCoins.values()]
    .map((item) => ({
      ...item,
      snapshot: summaryBySymbol.get(item.symbol) || item.snapshot,
    }))
    .filter((item) => item.snapshot)
    .sort((a, b) => b.skippedAt - a.skippedAt);

  const tradingViewSignalsPayload = listActiveTradingViewSignals(20);
  res.json({
    market,
    tracked,
    skipped,
    wallet: getWalletSnapshot(),
    tradingViewSignals: tradingViewSignalsPayload,
    ts: Date.now(),
  });
});

app.get('/', (_req, res) => {
  if (!HAS_CLIENT_BUILD) {
    return res.status(404).send('Frontend build not found. Build with "npm run build" before starting the server.');
  }
  return res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
});

app.get(/^(?!\/api\/).*/, (req, res, next) => {
  if (req.method !== 'GET') return next();
  if (!HAS_CLIENT_BUILD) return next();
  return res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`Pump.Gun tracker API running on http://localhost:${PORT}`);
  console.log(`Data mode: ${USE_REAL_DATA ? 'REAL' : 'SIMULATION'} | Wallet start: $${STARTING_BALANCE_USD}`);

  // Seed initial market data immediately on boot
  await refreshPrices().catch(() => {});

  // Always-on price refresh loop — independent of trading bot
  setInterval(() => {
    refreshPrices();
  }, PRICE_REFRESH_MS);

  console.log(`Price refresh loop started (every ${PRICE_REFRESH_MS}ms)`);

  if (AUTO_START_BOT) {
    await startBot().catch((error) => {
      botState.lastDataError = error instanceof Error ? error.message : 'Failed to auto-start bot';
    });
    console.log(`Trading loop auto-start: ${botState.running ? 'ON' : 'FAILED'}`);
  }
});
