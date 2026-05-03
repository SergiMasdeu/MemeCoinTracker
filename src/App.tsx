import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Phase =
  | 'PHASE_1_FIRST_PUMP'
  | 'PHASE_2_FIRST_CRASH'
  | 'PHASE_3_STABILIZATION'
  | 'PHASE_4_SECOND_PUMP'

type SocialCheck = {
  hasTwitter: boolean
  hasTelegram: boolean
  hasWebsite: boolean
  score: number
  verdict: 'STRONG' | 'MEDIUM' | 'WEAK'
}

type CoinSnapshot = {
  id: string
  symbol: string
  name: string
  address: string
  priceSeries: number[]
  phase: Phase
  phaseLabel: string
  phaseConfidence: number
  phaseReason: string
  price: number
  marketCap: number
  liquidityUsd: number
  capitalFlow: number
  activeUsers: number
  buyVolume: number
  sellVolume: number
  creatorOwnershipPct: number
  social: SocialCheck
  phase4Signal: {
    value: boolean
    reason: string
    buySellRatio: number
    checks?: {
      ascending: boolean
      positiveFlow: boolean
      healthyUsers: boolean
    }
    thresholds?: {
      minBuySellRatio: number
      minActiveUsers: number
    }
  }
  phase1Signal: {
    value: boolean
    reason: string
    buySellRatio: number
    checks?: {
      flowAcceptable: boolean
      buyPressure: boolean
      highActivity: boolean
      notOverbought: boolean
      rising: boolean
      hasVelocity: boolean
    }
    thresholds?: {
      minBuySellRatio: number
      minVelocityPct: number
      minActiveUsers: number
      maxCreatorOwnershipPct: number
    }
    lastMovePct?: number
  }
  buyChecks: {
    path: 'P1' | 'P3_BREAKOUT' | null
    common: {
      marketCapOk: boolean
      marketCap: number
      maxMarketCapUsd: number
      socialOk: boolean
      socialVerdict: 'STRONG' | 'MEDIUM' | 'WEAK'
      hasSocialData: boolean
      tradingViewEnabled?: boolean
      tradingViewBullish?: boolean
      tradingViewScore?: number
      tradingViewScoreMin?: number
      tradingViewPattern?: string | null
      tradingViewTimeframe?: string | null
      tradingViewSignalAt?: number | null
    }
    p1: {
      youngEnough: boolean
      coinAgeMs: number
      maxCoinAgeMs: number
      signal: CoinSnapshot['phase1Signal']
    }
    p3: {
      signal: CoinSnapshot['phase4Signal']
      hasEnoughHistory: boolean
      historyPoints: number
      minHistoryDepth: number
      confidence: number
      minConfidence: number
      confidenceOk: boolean
    }
  }
  canBuy: boolean
  buyReason: string | null
  skipReason: string | null
  coinAgeMs: number
  trackHighValue24h: boolean
}

type TradingViewSignal = {
  symbol: string | null
  address: string | null
  pattern: string
  timeframe: string
  direction: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  score: number
  source: string
  receivedAt: number
  expiresAt: number
  ttlMs: number
}

type TrackedCoin = {
  symbol: string
  status: 'watching' | 'ready' | 'bought'
  observedAt: number
  lastSeenAt: number
  position: {
    symbol: string
    tokenAddress: string
    qty: number
    buyPrice: number
    investedUsd: number
    boughtAt: number
  } | null
  snapshot: CoinSnapshot
}

type SkippedCoin = {
  symbol: string
  reason: string
  skippedAt: number
  lastSeenAt: number
  snapshot: CoinSnapshot
}

type WalletSnapshot = {
  startUsd: number
  cashUsd: number
  openValueUsd: number
  unrealizedPnlUsd: number
  equityUsd: number
  realizedPnlUsd: number
  totalReturnUsd: number
  totalReturnPct: number
  positions: {
    symbol: string
    tokenAddress: string
    qty: number
    buyPrice: number
    currentPrice: number
    peakPrice: number
    investedUsd: number
    currentValueUsd: number
    unrealizedPnlUsd: number
    unrealizedPnlPct: number
    boughtAt: number
  }[]
}

type DashboardData = {
  bot: {
    running: boolean
    scans: number
    lastScanAt: number | null
    intervalMs: number
    totalBoughtVolume: number
    totalSoldVolume: number
    realizedPnlPct: number
    dataMode: string
    dataSource: string
    lastDataError: string | null
    strategy: {
      preset: 'conservative' | 'balanced' | 'aggressive'
      profitOnlyMode: boolean
      minProfitExitPct: number
      quickProfitPct?: number
      hardTakeProfitPct: number
      trailActivatePct: number
      trailStopPct: number
      profitTimeExitMs: number
      profitTimeExitMinPct: number
      breakevenArmPct: number
      breakevenFloorPct: number
    }
    tradingView?: {
      enabled: boolean
      activeSignals: number
      signalTtlMs: number
      minBullishScore: number
    }
  }
  wallet: WalletSnapshot
  tracked: TrackedCoin[]
  skipped: SkippedCoin[]
  market: CoinSnapshot[]
  tradingViewSignals?: TradingViewSignal[]
  blacklist: string[]
  trades: {
    symbol: string
    tokenAddress: string
    buyPrice: number
    sellPrice: number
    qty: number
    investedUsd: number
    proceedsUsd: number
    pnlUsd: number
    pnlPct: number
    outcome: string
    boughtAt: number
    soldAt: number
    heldMs?: number
  }[]
}

function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastPriceTick, setLastPriceTick] = useState<number>(0)
  const [tokenTab, setTokenTab] = useState<'tracked' | 'skipped'>('tracked')
  const [trackedPage, setTrackedPage] = useState(1)
  const [skippedPage, setSkippedPage] = useState(1)
  const [bullishOnlySignals, setBullishOnlySignals] = useState(false)
  const [showTradingViewPanel, setShowTradingViewPanel] = useState(true)

  // Full dashboard: all state every 1s
  async function fetchDashboard() {
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as DashboardData
      setData(json)
      setLastPriceTick(Date.now())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const dashId = setInterval(fetchDashboard, 1000) // full state every 1s
    return () => {
      clearInterval(dashId)
    }
  }, [])

  async function runAction(path: '/api/bot/start' | '/api/bot/stop' | '/api/bot/tick') {
    setBusy(true)
    try {
      const res = await fetch(path, { method: 'POST' })
      if (!res.ok) {
        throw new Error(`Action failed: ${res.status}`)
      }
      await fetchDashboard()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function setStrategyPreset(preset: 'conservative' | 'balanced' | 'aggressive') {
    setBusy(true)
    try {
      const res = await fetch('/api/strategy/preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset }),
      })
      if (!res.ok) throw new Error(`Strategy update failed: ${res.status}`)
      await fetchDashboard()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Strategy update failed')
    } finally {
      setBusy(false)
    }
  }

  async function toggleProfitOnly() {
    const next = !(data?.bot.strategy?.profitOnlyMode ?? true)
    setBusy(true)
    try {
      const res = await fetch('/api/strategy/profit-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      if (!res.ok) throw new Error(`Profit-only toggle failed: ${res.status}`)
      await fetchDashboard()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profit-only toggle failed')
    } finally {
      setBusy(false)
    }
  }

  const topCandidates = useMemo(() => {
    if (!data) return []
    const trackedCandidates = (data.tracked ?? [])
      .map((item) => item.snapshot)
      .filter((coin) => coin.canBuy)

    const seenAddresses = new Set(trackedCandidates.map((coin) => coin.address))
    const marketFallback = (data.market ?? []).filter(
      (coin) => coin.canBuy && !seenAddresses.has(coin.address),
    )

    return [...trackedCandidates, ...marketFallback]
      .sort((a, b) => {
        if (b.phaseConfidence !== a.phaseConfidence) {
          return b.phaseConfidence - a.phaseConfidence
        }
        return b.marketCap - a.marketCap
      })
      .slice(0, 8)
  }, [data?.tracked, data?.market])

  const pageSize = 20
  const trackedTotalPages = Math.max(1, Math.ceil((data?.tracked.length ?? 0) / pageSize))
  const skippedTotalPages = Math.max(1, Math.ceil((data?.skipped.length ?? 0) / pageSize))

  const currentTrackedPage = Math.min(trackedPage, trackedTotalPages)
  const currentSkippedPage = Math.min(skippedPage, skippedTotalPages)

  const pagedTracked = useMemo(() => {
    const source = data?.tracked ?? []
    const start = (currentTrackedPage - 1) * pageSize
    return source.slice(start, start + pageSize)
  }, [data?.tracked, currentTrackedPage])

  const pagedSkipped = useMemo(() => {
    const source = data?.skipped ?? []
    const start = (currentSkippedPage - 1) * pageSize
    return source.slice(start, start + pageSize)
  }, [data?.skipped, currentSkippedPage])

  const statusTone = data?.bot.running ? 'status-live' : 'status-offline'
  const checkClass = (value: boolean) => (value ? 'check-pass' : 'check-fail')
  const visibleTradingViewSignals = useMemo(() => {
    const signals = data?.tradingViewSignals ?? []
    return bullishOnlySignals ? signals.filter((signal) => signal.direction === 'bullish') : signals
  }, [data?.tradingViewSignals, bullishOnlySignals])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">pump.gun TA bot</p>
          <h1>Memecoin Phase Tracker</h1>
          <p className="subtitle">
            Tracks first pump/crash/stabilization/second pump and only buys when Phase 3 shows a
            valid Phase 4 signal.
          </p>
          <p className="subtitle">Data Source: {data?.bot.dataSource ?? '-'}</p>
          {data?.bot.lastDataError ? (
            <p className="subtitle down">Data Warning: {data.bot.lastDataError}</p>
          ) : null}
          {lastPriceTick > 0 ? (
            <p className="subtitle" style={{ color: '#7bffb4', fontSize: '0.78rem' }}>
              Prices last updated: {new Date(lastPriceTick).toLocaleTimeString()}
            </p>
          ) : null}
        </div>
        <div className="controls">
          <button disabled={busy} onClick={() => runAction('/api/bot/start')}>
            Start Bot
          </button>
          <button disabled={busy} onClick={() => runAction('/api/bot/stop')}>
            Stop Bot
          </button>
          <button disabled={busy} onClick={() => runAction('/api/bot/tick')}>
            Manual Scan
          </button>
          <button
            type="button"
            className={`strategy-btn ${showTradingViewPanel ? 'strategy-btn-active' : ''}`}
            onClick={() => {
              const next = !showTradingViewPanel
              setShowTradingViewPanel(next)
              if (!showTradingViewPanel) {
                requestAnimationFrame(() => {
                  document.getElementById('tradingview-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                })
              }
            }}
          >
            TradingView: {showTradingViewPanel ? 'ON' : 'OFF'}
          </button>
          <div className={`status-pill ${statusTone ?? 'status-offline'}`}>
            {data?.bot.running ? 'RUNNING' : 'STOPPED'}
          </div>
          <div className="strategy-controls">
            <p className="muted">Sell Strategy</p>
            <div className="strategy-row">
              <button
                type="button"
                className={`strategy-btn ${data?.bot.strategy?.preset === 'conservative' ? 'strategy-btn-active' : ''}`}
                disabled={busy}
                onClick={() => setStrategyPreset('conservative')}
              >
                Conservative
              </button>
              <button
                type="button"
                className={`strategy-btn ${data?.bot.strategy?.preset === 'balanced' ? 'strategy-btn-active' : ''}`}
                disabled={busy}
                onClick={() => setStrategyPreset('balanced')}
              >
                Balanced
              </button>
              <button
                type="button"
                className={`strategy-btn ${data?.bot.strategy?.preset === 'aggressive' ? 'strategy-btn-active' : ''}`}
                disabled={busy}
                onClick={() => setStrategyPreset('aggressive')}
              >
                Aggressive
              </button>
              <button
                type="button"
                className={`strategy-btn ${data?.bot.strategy?.profitOnlyMode ? 'strategy-btn-active' : ''}`}
                disabled={busy}
                onClick={toggleProfitOnly}
              >
                Profit Only: {data?.bot.strategy?.profitOnlyMode ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {loading ? <p className="panel">Loading dashboard...</p> : null}
      {error ? <p className="panel danger">{error}</p> : null}

      <section className="kpi-grid">
        <article className="kpi-card">
          <p>Data Mode</p>
          <strong>{data?.bot.dataMode ?? '-'}</strong>
        </article>
        <article className="kpi-card">
          <p>Wallet Equity</p>
          <strong>${fmt(data?.wallet.equityUsd)}</strong>
        </article>
        <article className="kpi-card">
          <p>Wallet Cash</p>
          <strong>${fmt(data?.wallet.cashUsd)}</strong>
        </article>
        <article className="kpi-card">
          <p>Open Position Value</p>
          <strong>${fmt(data?.wallet.openValueUsd)}</strong>
        </article>
        <article className="kpi-card">
          <p>Tracked Coins</p>
          <strong>{data?.tracked.length ?? 0}</strong>
        </article>
        <article className="kpi-card">
          <p>Total Buy Volume</p>
          <strong>${fmt(data?.bot.totalBoughtVolume)}</strong>
        </article>
        <article className="kpi-card">
          <p>Total Sell Volume</p>
          <strong>${fmt(data?.bot.totalSoldVolume)}</strong>
        </article>
        <article className="kpi-card">
          <p>Realized PnL</p>
          <strong>
            {(data?.wallet.realizedPnlUsd ?? 0) >= 0 ? '+' : ''}${fmt(data?.wallet.realizedPnlUsd)}
          </strong>
          {data?.bot.totalBoughtVolume ? (
            <small style={{ opacity: 0.7 }}>
              {(((data.wallet.realizedPnlUsd ?? 0) / data.bot.totalBoughtVolume) * 100).toFixed(2)}% on invested
            </small>
          ) : null}
        </article>
        <article className="kpi-card">
          <p>Wallet Total Return</p>
          <strong>
            {(data?.wallet.totalReturnPct ?? 0).toFixed(2)}% (${fmt(data?.wallet.totalReturnUsd)})
          </strong>
        </article>
      </section>

      <section className="panel two-col">
        <article>
          <h2>Virtual Wallet (Paper Trading)</h2>
          <ul className="list">
            <li>Start Balance: ${fmt(data?.wallet.startUsd)}</li>
            <li>Cash: ${fmt(data?.wallet.cashUsd)}</li>
            <li>Open Value: ${fmt(data?.wallet.openValueUsd)}</li>
            <li>Equity: ${fmt(data?.wallet.equityUsd)}</li>
            <li>Realized PnL: ${fmt(data?.wallet.realizedPnlUsd)}</li>
            <li>Unrealized PnL: {(data?.wallet.unrealizedPnlUsd ?? 0) >= 0 ? '+' : ''}${fmt(data?.wallet.unrealizedPnlUsd)}</li>
            <li style={{ borderTop: '1px solid #333', paddingTop: 4, marginTop: 4 }}>
              <strong>Total Return = Realized + Unrealized = ${fmt((data?.wallet.realizedPnlUsd ?? 0) + (data?.wallet.unrealizedPnlUsd ?? 0))}</strong>
            </li>
          </ul>
        </article>
        <article>
          <h2>Open Positions</h2>
          <ul className="list">
            {(data?.wallet.positions ?? []).map((position) => {
              const marketCoin = (data?.market ?? []).find((coin) => coin.address === position.tokenAddress)
              const peakGainPct = ((position.peakPrice - position.buyPrice) / position.buyPrice) * 100
              const trailActive = peakGainPct >= 10
              const trailPrice = position.peakPrice * 0.92
              return (
                <li key={`${position.tokenAddress}-${position.boughtAt}`}>
                  <strong>{position.symbol}</strong> invested ${fmt(position.investedUsd)} |{' '}
                  uPnL <span className={position.unrealizedPnlPct >= 0 ? 'up' : 'down'}>
                    {position.unrealizedPnlPct >= 0 ? '+' : ''}{position.unrealizedPnlPct.toFixed(2)}%
                  </span>{' '}(${fmt(position.unrealizedPnlUsd)})
                  {trailActive ? (
                    <span style={{ color: '#f0c040', marginLeft: 6, fontSize: '0.8rem' }}>
                      ⚡ Trail stop @ {trailPrice.toFixed(8)} (peak +{peakGainPct.toFixed(1)}%)
                    </span>
                  ) : null}
                  {marketCoin?.priceSeries?.length ? (
                    <div style={{ marginTop: 6 }}>
                      <Sparkline points={marketCoin.priceSeries} className="sparkline-position" />
                    </div>
                  ) : null}
                </li>
              )
            })}
            {(data?.wallet.positions.length ?? 0) === 0 ? (
              <li className="muted">No open positions.</li>
            ) : null}
          </ul>
        </article>
      </section>

      <section className="panel">
        <h2>Buy Candidates (Phase 1 / Phase 3→4 Signal)</h2>
        <div className="chips">
          {topCandidates.length === 0 ? <span className="muted">No valid candidates yet.</span> : null}
          {topCandidates.map((coin) => {
            const ageMin = Math.round((coin.coinAgeMs ?? 0) / 60000)
            return (
              <span key={coin.symbol} className="chip">
                {coin.symbol} | {coin.buyReason} | ratio{' '}
                {coin.buyReason === 'P1 Early Pump'
                  ? coin.phase1Signal.buySellRatio
                  : coin.phase4Signal.buySellRatio}{' '}
                | social {coin.social.verdict} | age {ageMin}m
              </span>
            )
          })}
        </div>
      </section>

      {showTradingViewPanel ? (
      <section className="panel" id="tradingview-panel">
        <h2>TradingView Pattern Signals</h2>
        <div className="panel-head">
          <p className="muted" style={{ marginBottom: 0 }}>
            Integration: {data?.bot.tradingView?.enabled ? 'ON' : 'OFF'} | Active: {data?.bot.tradingView?.activeSignals ?? 0} | Min bullish score: {(data?.bot.tradingView?.minBullishScore ?? 0.55).toFixed(2)}
          </p>
          <button
            type="button"
            className={`tv-filter-btn ${bullishOnlySignals ? 'tv-filter-btn-active' : ''}`}
            onClick={() => setBullishOnlySignals((v) => !v)}
          >
            {bullishOnlySignals ? 'Showing: Bullish Only' : 'Showing: All Signals'}
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Pattern</th>
                <th>TF</th>
                <th>Direction</th>
                <th>Quality</th>
                <th>Score</th>
                <th>Confidence</th>
                <th>Received</th>
                <th>TTL</th>
              </tr>
            </thead>
            <tbody>
              {visibleTradingViewSignals.slice(0, 12).map((signal) => (
                <tr key={`${signal.symbol ?? signal.address ?? 'tv'}-${signal.receivedAt}`}>
                  <td>
                    <strong>{signal.symbol ?? '-'}</strong>
                    {signal.address ? <p className="muted">{signal.address.slice(0, 6)}...{signal.address.slice(-4)}</p> : null}
                  </td>
                  <td>{signal.pattern}</td>
                  <td>{signal.timeframe}</td>
                  <td className={signal.direction === 'bullish' ? 'up' : signal.direction === 'bearish' ? 'down' : 'muted'}>
                    {signal.direction.toUpperCase()}
                  </td>
                  <td>
                    <span className={`tv-quality-badge ${tradingViewQualityClass(signal.score, signal.confidence)}`}>
                      {tradingViewQualityLabel(signal.score, signal.confidence)}
                    </span>
                  </td>
                  <td>{signal.score.toFixed(2)}</td>
                  <td>{Math.round(signal.confidence * 100)}%</td>
                  <td className="muted">{new Date(signal.receivedAt).toLocaleTimeString()}</td>
                  <td className="muted">{Math.max(0, Math.round(signal.ttlMs / 1000))}s</td>
                </tr>
              ))}
              {visibleTradingViewSignals.length === 0 ? (
                <tr>
                  <td className="muted" colSpan={9}>
                    {bullishOnlySignals
                      ? 'No bullish TradingView signals right now. Turn off filter to see all signals.'
                      : 'No active TradingView signals yet. Send alerts to /api/integrations/tradingview/webhook.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      <section className="panel">
        <h2>Why Buy Now (Top Candidates)</h2>
        {topCandidates.length === 0 ? <p className="muted">No active buy candidates right now.</p> : null}
        <div className="why-grid">
          {topCandidates.map((coin) => {
            const isP1 = coin.buyChecks.path === 'P1'
            const ageMin = Math.round((coin.buyChecks.p1.coinAgeMs ?? 0) / 60000)
            const maxAgeMin = Math.round((coin.buyChecks.p1.maxCoinAgeMs ?? 0) / 60000)
            const p1Signal = coin.buyChecks.p1.signal
            const p3Signal = coin.buyChecks.p3.signal

            return (
              <article key={`${coin.symbol}-why`} className="why-card">
                <h3>
                  {coin.symbol} <span className="muted">({coin.buyReason})</span>
                </h3>
                <p className={`check-line ${checkClass(coin.buyChecks.common.marketCapOk)}`}>
                  MCap ${fmt(coin.buyChecks.common.marketCap)} {'<='} ${fmt(coin.buyChecks.common.maxMarketCapUsd)}
                </p>
                <p className={`check-line ${checkClass(coin.buyChecks.common.socialOk)}`}>
                  Social {coin.buyChecks.common.socialVerdict}
                  {!coin.buyChecks.common.hasSocialData ? ' (no social data required)' : ''}
                </p>

                {isP1 ? (
                  <>
                    <p className={`check-line ${checkClass(Boolean(p1Signal.value))}`}>
                      P1 signal: {p1Signal.reason} | ratio {p1Signal.buySellRatio}
                    </p>
                    <p className={`check-line ${checkClass(coin.buyChecks.p1.youngEnough)}`}>
                      Coin age {ageMin}m {'<='} {maxAgeMin}m
                    </p>
                    <p className={`check-line ${checkClass(Boolean(p1Signal.checks?.highActivity))}`}>
                      Active users {coin.activeUsers} {'>='} {p1Signal.thresholds?.minActiveUsers ?? 20}
                    </p>
                    <p className={`check-line ${checkClass(Boolean(p1Signal.checks?.hasVelocity))}`}>
                      Last move {p1Signal.lastMovePct ?? 0}% {'>='} {p1Signal.thresholds?.minVelocityPct ?? 0.5}%
                    </p>
                  </>
                ) : (
                  <>
                    <p className={`check-line ${checkClass(Boolean(p3Signal.value))}`}>
                      P3-{'>'}P4 signal: {p3Signal.reason} | ratio {p3Signal.buySellRatio}
                    </p>
                    <p className={`check-line ${checkClass(coin.buyChecks.p3.hasEnoughHistory)}`}>
                      History {coin.buyChecks.p3.historyPoints} {'>='} {coin.buyChecks.p3.minHistoryDepth} points
                    </p>
                    <p className={`check-line ${checkClass(coin.buyChecks.p3.confidenceOk)}`}>
                      Confidence {Math.round(coin.buyChecks.p3.confidence * 100)}% {'>='} {Math.round(coin.buyChecks.p3.minConfidence * 100)}%
                    </p>
                    <p className={`check-line ${checkClass(Boolean(p3Signal.checks?.healthyUsers))}`}>
                      Active users {coin.activeUsers} {'>='} {p3Signal.thresholds?.minActiveUsers ?? 25}
                    </p>
                  </>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{tokenTab === 'tracked' ? 'Tracked Tokens' : 'Skipped Tokens'}</h2>
          <div className="tab-row">
            <button
              className={`tab-btn ${tokenTab === 'tracked' ? 'tab-btn-active' : ''}`}
              onClick={() => setTokenTab('tracked')}
              type="button"
            >
              Tracked ({data?.tracked.length ?? 0})
            </button>
            <button
              className={`tab-btn ${tokenTab === 'skipped' ? 'tab-btn-active' : ''}`}
              onClick={() => setTokenTab('skipped')}
              type="button"
            >
              Skipped ({data?.skipped.length ?? 0})
            </button>
          </div>
        </div>

        {tokenTab === 'tracked' ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Coin</th>
                    <th>Phase</th>
                    <th>Graph</th>
                    <th>Cap Flow</th>
                    <th>MCap</th>
                    <th>Active Users</th>
                    <th>Buy/Sell</th>
                    <th>Creator %</th>
                    <th>Social</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTracked.map((item) => (
                    <tr key={item.symbol}>
                      <td>
                        <strong>{item.snapshot.symbol}</strong>
                        {item.snapshot.trackHighValue24h ? (
                          <span className="hv-badge">HIGH-VALUE 24H</span>
                        ) : null}
                        <p className="muted">{item.snapshot.name}</p>
                        {item.snapshot.trackHighValue24h ? (
                          <p className="muted">Liq ${fmt(item.snapshot.liquidityUsd)}</p>
                        ) : null}
                      </td>
                      <td>
                        <span className={`phase ${phaseClass(item.snapshot.phase)}`}>
                          {phaseShort(item.snapshot.phase)}
                        </span>
                        <p className="muted">{Math.round(item.snapshot.phaseConfidence * 100)}%</p>
                      </td>
                      <td>
                        <Sparkline points={item.snapshot.priceSeries} className="sparkline-tracked" />
                      </td>
                      <td className={item.snapshot.capitalFlow >= 0 ? 'up' : 'down'}>
                        ${fmt(item.snapshot.capitalFlow)}
                      </td>
                      <td>${fmt(item.snapshot.marketCap)}</td>
                      <td>{fmt(item.snapshot.activeUsers)}</td>
                      <td>
                        <p className="up">B ${fmt(item.snapshot.buyVolume)}</p>
                        <p className="down">S ${fmt(item.snapshot.sellVolume)}</p>
                      </td>
                      <td>{item.snapshot.creatorOwnershipPct.toFixed(2)}%</td>
                      <td>
                        {item.snapshot.social.verdict} ({Math.round(item.snapshot.social.score * 100)}%)
                      </td>
                      <td>
                        {item.status.toUpperCase()}
                        {item.snapshot.buyReason ? (
                          <p className="muted">{item.snapshot.buyReason}</p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {pagedTracked.length === 0 ? (
                    <tr>
                      <td className="muted" colSpan={10}>No tracked tokens.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="pager-row">
              <button
                type="button"
                onClick={() => setTrackedPage((p) => Math.max(1, p - 1))}
                disabled={currentTrackedPage <= 1}
              >
                Prev
              </button>
              <span className="muted">Page {currentTrackedPage} / {trackedTotalPages}</span>
              <button
                type="button"
                onClick={() => setTrackedPage((p) => Math.min(trackedTotalPages, p + 1))}
                disabled={currentTrackedPage >= trackedTotalPages}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Coin</th>
                    <th>Phase</th>
                    <th>MCap</th>
                    <th>Skip Reason</th>
                    <th>Skipped At</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedSkipped.map((item) => (
                    <tr key={`skip-${item.symbol}`}>
                      <td>
                        <strong>{item.snapshot.symbol}</strong>
                        <p className="muted">{item.snapshot.name}</p>
                      </td>
                      <td>
                        <span className={`phase ${phaseClass(item.snapshot.phase)}`}>
                          {phaseShort(item.snapshot.phase)}
                        </span>
                        <p className="muted">{Math.round(item.snapshot.phaseConfidence * 100)}%</p>
                      </td>
                      <td>${fmt(item.snapshot.marketCap)}</td>
                      <td className="muted">{item.reason}</td>
                      <td className="muted">{new Date(item.skippedAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                  {pagedSkipped.length === 0 ? (
                    <tr>
                      <td className="muted" colSpan={5}>No skipped tokens.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="pager-row">
              <button
                type="button"
                onClick={() => setSkippedPage((p) => Math.max(1, p - 1))}
                disabled={currentSkippedPage <= 1}
              >
                Prev
              </button>
              <span className="muted">Page {currentSkippedPage} / {skippedTotalPages}</span>
              <button
                type="button"
                onClick={() => setSkippedPage((p) => Math.min(skippedTotalPages, p + 1))}
                disabled={currentSkippedPage >= skippedTotalPages}
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>

      <section className="panel two-col">
        <article>
          <h2>Recent Exits</h2>
          <ul className="list">
            {(data?.trades ?? []).slice(0, 8).map((trade) => {
              const heldSec = trade.heldMs != null ? Math.round(trade.heldMs / 1000) : null
              const heldLabel = heldSec != null
                ? heldSec >= 60 ? `${Math.floor(heldSec / 60)}m ${heldSec % 60}s` : `${heldSec}s`
                : ''
              return (
                <li key={`${trade.symbol}-${trade.soldAt}`}>
                  <strong>{trade.symbol}</strong> {trade.outcome.toUpperCase()} |{' '}
                  sold @ {trade.sellPrice.toFixed(8)} ({trade.pnlPct > 0 ? '+' : ''}{trade.pnlPct.toFixed(2)}%) |
                  pnl ${fmt(trade.pnlUsd)}{heldLabel ? ` | held ${heldLabel}` : ''}
                </li>
              )
            })}
            {(data?.trades.length ?? 0) === 0 ? <li className="muted">No sold trades yet.</li> : null}
          </ul>
        </article>
        <article>
          <h2>Blacklist (never re-tracked)</h2>
          <div className="chips">
            {(data?.blacklist ?? []).map((symbol) => (
              <span key={symbol} className="chip muted-chip">
                {symbol}
              </span>
            ))}
            {(data?.blacklist.length ?? 0) === 0 ? <span className="muted">None yet.</span> : null}
          </div>
        </article>
      </section>
    </div>
  )
}

function fmt(value: number | undefined) {
  if (typeof value !== 'number') return '0'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

function phaseShort(phase: Phase) {
  if (phase === 'PHASE_1_FIRST_PUMP') return 'P1 Pump'
  if (phase === 'PHASE_2_FIRST_CRASH') return 'P2 Crash'
  if (phase === 'PHASE_3_STABILIZATION') return 'P3 Base'
  return 'P4 Pump'
}

function phaseClass(phase: Phase) {
  if (phase === 'PHASE_1_FIRST_PUMP') return 'p1'
  if (phase === 'PHASE_2_FIRST_CRASH') return 'p2'
  if (phase === 'PHASE_3_STABILIZATION') return 'p3'
  return 'p4'
}

function Sparkline({ points, className }: { points: number[]; className?: string }) {
  if (!points || points.length < 2) {
    return <span className="muted">-</span>
  }

  const width = 130
  const height = 34
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = Math.max(max - min, 1e-12)

  const d = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  const up = points[points.length - 1] >= points[0]

  return (
    <svg className={`sparkline ${className ?? ''}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="price chart">
      <path d={d} className={up ? 'sparkline-path-up' : 'sparkline-path-down'} />
    </svg>
  )
}

function tradingViewQualityLabel(score: number, confidence: number) {
  if (score >= 0.8 && confidence >= 0.7) return 'HIGH'
  if (score >= 0.65 && confidence >= 0.55) return 'MEDIUM'
  return 'LOW'
}

function tradingViewQualityClass(score: number, confidence: number) {
  if (score >= 0.8 && confidence >= 0.7) return 'tv-quality-high'
  if (score >= 0.65 && confidence >= 0.55) return 'tv-quality-medium'
  return 'tv-quality-low'
}

export default App
