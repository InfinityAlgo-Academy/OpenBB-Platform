
```
  ____  ____ _____ _____ ____  __  __ ___ _   _    _    _     
 | __ )| __ )_   _| ____|  _ \|  \/  |_ _| \ | |  / \  | |    
 |  _ \|  _ \ | | |  _| | |_) | |\/| || ||  \| | / _ \ | |    
 | |_) | |_) || | | |___|  _ <| |  | || || |\  |/ ___ \| |___ 
 |____/|____/ |_| |_____|_| \_\_|  |_|___|_| \_/_/   \_\_____|
```

<p align="center">
  <strong>A Bloomberg‑grade intelligence terminal for your laptop.</strong><br>
  <sub>Real‑time data · Signals engine · 17 analytical screens · Zero API keys</sub>
</p>

<br>

<p align="center">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-amber?style=flat-square&color=%23FF8C00" alt="License">
  <img src="https://img.shields.io/badge/python-3.10--3.12-amber?style=flat-square&color=%23FF8C00" alt="Python">
  <img src="https://img.shields.io/badge/node-18%2B-amber?style=flat-square&color=%23FF8C00" alt="Node">
  <img src="https://img.shields.io/badge/status-production-amber?style=flat-square&color=%23FF8C00" alt="Status">
</p>

<br>

<p align="center">
  <code>curl -fsSL https://raw.githubusercontent.com/InfinityAlgo-Academy/OpenBB-Platform/main/install.sh | bash</code>
</p>

<br>

---

## ▐ **BBTERMINAL**

A Bloomberg‑grade intelligence terminal that runs entirely on your laptop.  
17 analytical functions. Real‑time prices via TradingView. Signals engine.  
Zero API keys required. No subscriptions.

```bash
cd ~/BB-Terminal
./start.sh          # launch API · relay · UI
# → http://localhost:5173
```

**Prerequisites** — macOS · Linux · Python 3.10+ · Node.js 18+ · 2 GB free  
**Windows** — run inside WSL (Ubuntu) or Git Bash

---

## ▐ **FEATURES**

<table>
  <tr>
    <td width="50%">
      <strong>⚡ Real‑time everywhere</strong><br>
      <sub>A Node.js WebSocket relay subscribes to TradingView and pushes sub‑second ticks to every open tab. No polling. No refresh. No stale data.</sub>
    </td>
    <td width="50%">
      <strong>🧠 Signal‑driven intelligence</strong><br>
      <sub>INTEL runs 12 rules per ticker (technicals, valuation, fundamentals) and distills them into a bullish / bearish / neutral verdict. Transparent and tweakable.</sub>
    </td>
  </tr>
  <tr>
    <td>
      <strong>📊 17 function screens</strong><br>
      <sub>Command Center, charts, options chains, world indices, crypto, yield curves, movers, analyst estimates — every page a Bloomberg Launchpad‑style tab.</sub>
    </td>
    <td>
      <strong>🔋 Zero configuration</strong><br>
      <sub>One install command. OpenBB Platform + Yahoo Finance out of the box. Optional provider keys (FRED, FMP, Polygon) drop into a JSON file.</sub>
    </td>
  </tr>
  <tr>
    <td>
      <strong>🔄 Persistent state</strong><br>
      <sub>Tabs stay mounted across navigation. RT prices survive page refresh via localStorage. Relay auto‑reconnects with exponential backoff on disconnect.</sub>
    </td>
    <td>
      <strong>🎨 Terminal‑native UI</strong><br>
      <sub>Amber‑on‑black CRT aesthetic. Keyboard‑first: <code>/</code> to focus, <code>⇥</code> autocomplete, <code>↑/↓</code> history, <code>Enter</code> to execute.</sub>
    </td>
  </tr>
</table>

---

## ▐ **SYSTEM ARCHITECTURE**

```
                                    ═══════════════════════════════════════════════╗
                                    ║           TRADINGVIEW REAL‑TIME            ║
    ╔══════════════════╗  WS 6901   ║     ┌──────────────────────────────┐       ║
    ║   BROWSER (5173) ║◄══════════╬═════│  realtime-server.cjs          │       ║
    ║  React · Tailwind║  sub‑sec   ║     │  singleton TV Client         │◀══════╬── wss://data.tradingview.com
    ║  localStorage    ║  ticks     ║     │  1 Quote Session             │       ║
    ╚════╤═════════════╝            ║     │  reference‑counted markets    │       ║
         │                          ║     │  auto‑reconnect + watchdog   │       ║
         │ HTTP /api                 ║     └──────────────────────────────┘       ║
         ▼                          ╚══════════════════════════════════════════════╝
    ╔══════════════════╗
    ║  OPENBB PLATFORM ║────▶ Yahoo Finance · FRED · SEC · FMP · Polygon · …
    ║  FastAPI (6900)  ║
    ╚══════════════════╝
```

### Data flow

| Stage | Protocol | Detail |
|-------|----------|--------|
| **TradingView relay** | `ws://` | Singleton Node.js process. One `TradingView.Client` + `QuoteSession`. Markets are reference‑counted across all connected browser tabs. If TV disconnects, the relay detects it via `onDisconnected` / watchdog (30s) and recreates the client immediately. Exponential backoff prevents reconnect storms. |
| **Browser ↔ relay** | `ws://127.0.0.1:6901` | JSON messages: `{ type:"subscribe"|"unsubscribe", symbols:[...] }`. Relay broadcasts every price update to all clients — no per‑client routing needed at this scale. |
| **History + fundamentals** | `HTTP /api/*` | Vite proxies `/api` to OpenBB FastAPI. Yahoo Finance for prices, fundamentals, options. FRED for treasury rates. Cached with `react‑query` (stale times 60s–300s). |
| **UI state** | React state + `localStorage` | `rt_prices` key persists last known prices. On page load, cached data renders instantly while fresh ticks arrive milliseconds later. |

---

## ▐ **FUNCTION REFERENCE**

| Code | Screen | Description |
|------|--------|-------------|
| `CC` | **Command Center** | 14 US indices with tick sparklines · yield curve · 8 FX / crypto pairs · gainers / losers / most active (15 each) · 20 market headlines |
| `INTEL` | **Intelligence** | 12‑rule signal engine → bullish / bearish / neutral verdict. Technical (MA, RSI, 52w range), valuation (P/E, EV/EBITDA, PEG), fundamentals (revenue, margin, leverage, ROE) |
| `DES` | **Profile** | Company description, sector, industry, employees, market cap, EBITDA, beta, P/E |
| `GP` | **Chart** | Candlestick chart, 1M / 3M / 6M / YTD / 1Y / 3Y / 5Y. Real‑time last‑price overlay line |
| `QR` | **Quote** | Bid · ask · open · high · low · 52w range · volume · real‑time price via TradingView |
| `HP` | **History** | 2 years of daily OHLCV with 52w high/low markers |
| `FA` | **Financials** | 5 years annual income statements (revenue, gross profit, EBIT, net income, EPS) |
| `KEY` | **Ratios** | 30+ metrics: P/E (ttm/fwd), EV/EBITDA, P/S, P/B, PEG, D/E, current ratio, ROE, ROA, FCF yield, dividend yield, payout ratio, beta, short ratio |
| `DVD` | **Dividends** | 10‑year history with annual totals, yield, payout ratio |
| `EE` | **Estimates** | Analyst consensus, target price, upside, recommendation breakdown (buy/hold/sell) |
| `NI` | **News** | 50 company headlines filtered by relevance, with source attribution |
| `OMON` | **Options** | Full chain: calls · strike · puts. Real‑time underlying price. Grouped by expiration |
| `WEI` | **World Indices** | 16 equity indices grouped by region (Americas · EMEA · Asia‑Pac). Real‑time prices + sparklines |
| `MOV` | **Movers** | Top 100 gainers / losers / most active. Real‑time prices with change and volume |
| `CRYPTO` | **Crypto** | 12 major coins. Real‑time price, 24h Δ/%, volume, tick sparklines |
| `FXC` | **FX Crosses** | 12 major FX pairs. Real‑time prices, change, sparklines |
| `CURV` | **Yield Curve** | US Treasury 11 tenors (1M–30Y). 2s‑10s, 3m‑10y, 5y‑30y spreads. 3‑date overlay |

**Syntax:** `[SYMBOL] [CODE]` — e.g., `TSLA KEY`, `NVDA` (defaults to INTEL), or standalone `CC` / `WEI` / `CURV`.

**Keyboard:** <kbd>/</kbd> focus command bar · <kbd>⇥</kbd> autocomplete · <kbd>↑</kbd><kbd>↓</kbd> history · <kbd>Enter</kbd> execute

---

## ▐ **SIGNALS ENGINE**

Every ticker that opens in INTEL passes through 12 rules defined in `app/src/lib/signals.ts`:

```
TECHNICAL              VALUATION              FUNDAMENTALS
─────────────────────  ─────────────────────  ─────────────────────
● 50‑day MA position  ● Trailing P/E         ● Revenue growth (YoY)
● 200‑day MA position  ● Forward P/E          ● Operating margin
● 52‑week range %      ● EV/EBITDA            ● Debt / equity
● RSI (14)             ● PEG ratio            ● Return on equity
● Volume vs avg
```

Each rule outputs a dot: **bullish** <span style="color:#22ee22">●</span>, **bearish** <span style="color:#ff3b3b">●</span>, or **neutral** <span style="color:#ff8c00">●</span>. The verdict badge aggregates them into one word. No black box — every threshold is plain TypeScript, readable and overridable.

---

## ▐ **KNOWN LIMITS**

| Constraint | Mitigation |
|------------|------------|
| **Signals are heuristics, not predictions** | Every rule is plain TypeScript in `signals.ts`. Tune thresholds to your own framework |
| **Free‑tier data covers ~95% of use** | Premium providers (FRED, TradingEconomics, FMP, Polygon) need an API key in `~/.openbb_platform/user_settings.json` |
| **Some TradingView symbols may not resolve** | MATIC → POL rebrand. Certain regional indices. Open a GitHub issue |
| **Economic calendar / world news** | Require provider API keys; UI handles 401 gracefully |

---

## ▐ **INSTALL**

```bash
# One‑line install (macOS / Linux)
curl -fsSL https://raw.githubusercontent.com/InfinityAlgo-Academy/OpenBB-Platform/main/install.sh | bash
```

### Manual (after clone)

```bash
git clone https://github.com/InfinityAlgo-Academy/OpenBB-Platform.git
cd BB-Terminal
./setup.sh       # OpenBB + UI deps (~3‑5 min)
./start.sh       # launch everything
```

### Adding provider keys

```bash
$EDITOR ~/.openbb_platform/user_settings.json
# → add keys, then ./stop.sh && ./start.sh
```

---

## ▐ **REPOSITORY**

```
BBterminal/
├── setup.sh                # one‑time install
├── start.sh                # launch API (6900) + relay (6901) + UI (5173)
├── stop.sh                 # shut down all three
├── app/
│   ├── realtime-server.cjs # TradingView WebSocket relay
│   ├── src/
│   │   ├── lib/
│   │   │   ├── realtime.ts # WebSocket client singleton + hooks
│   │   │   ├── api.ts      # OpenBB REST wrapper
│   │   │   ├── signals.ts  # 12‑rule signal engine
│   │   │   └── format.ts   # price, percentage, time formatters
│   │   ├── functions/      # 17 page components (CC, INTEL, DES, …)
│   │   ├── components/     # CommandBar, FunctionPanel, StatusBar, WorkspaceTabs
│   │   ├── store/          # Zustand workspace store
│   │   └── App.tsx         # multi‑tab renderer
│   └── tailwind.config.js
```

---

## ▐ **LICENSE**

This project is licensed under the **GNU Affero General Public License v3.0** — see [LICENSE](LICENSE) for the full text.

| Component | License |
|-----------|---------|
| **BBTerminal application code** | AGPL‑3.0 (this repository) |
| **OpenBB Platform** | AGPL‑v3 (upstream dependency) |
| **Yahoo Finance data** | Subject to Yahoo's terms — personal use only |

If you modify this software and make it accessible over a network, the AGPL requires you to offer the modified source code to its users. This is by design — it ensures the community always has access to improvements.

---

<br>
<p align="center">
  <sub><strong>BBTERMINAL</strong> · build your own terminal · free data · real‑time · open source</sub>
</p>
<p align="center">
  <sub><code>./start.sh</code> and start typing</sub>
</p>
<br>
