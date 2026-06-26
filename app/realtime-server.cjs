#!/usr/bin/env node
const WebSocketLib = require('ws');
const http = require('http');
const TradingView = require('@mathieuc/tradingview');

const PORT = process.env.RT_PORT || 6901;

const YAHOO_TO_TV = {
  "^GSPC":  "SPCFD:SPX",
  "^DJI":   "TVC:DJI",
  "^IXIC":  "NASDAQ:IXIC",
  "^RUT":   "TVC:RUT",
  "^NDX":   "NASDAQ:NDX",
  "^SOX":   "NASDAQ:SOX",
  "^SP400": "SPCFD:MID",
  "^SP600": "SPCFD:SP600",
  "^NYA":   "TVC:NYA",
  "^DJT":   "DJCFD:DJT",
  "^DJU":   "DJCFD:DJU",
  "^VIX":   "TVC:VIX",
  "^RUI":   "TVC:RUI",
  "^VXN":   "CBOE:VXN",
};

const FX_PAIRS = {
  "EURUSD": "OANDA:EURUSD",
  "GBPUSD": "OANDA:GBPUSD",
  "USDJPY": "FX:USDJPY",
  "USDCHF": "OANDA:USDCHF",
  "AUDUSD": "OANDA:AUDUSD",
  "USDCAD": "OANDA:USDCAD",
  "NZDUSD": "OANDA:NZDUSD",
  "EURGBP": "OANDA:EURGBP",
};

const CRYPTO_MAP = {
  "BTC":   "BINANCE:BTCUSDT",
  "ETH":   "BINANCE:ETHUSDT",
  "SOL":   "BINANCE:SOLUSDT",
  "XRP":   "BINANCE:XRPUSDT",
  "DOGE":  "BINANCE:DOGEUSDT",
  "ADA":   "BINANCE:ADAUSDT",
  "LINK":  "BINANCE:LINKUSDT",
  "DOT":   "BINANCE:DOTUSDT",
  "BNB":   "BINANCE:BNBUSDT",
  "AVAX":  "BINANCE:AVAXUSDT",
  "LTC":   "BINANCE:LTCUSDT",
  "MATIC": "BINANCE:POLUSDT",
};

const TREASURY_MAP = {
  "01M": "TVC:US1M",
  "03M": "TVC:US3M",
  "06M": "TVC:US6M",
  "01Y": "TVC:US01Y",
  "02Y": "TVC:US02Y",
  "03Y": "TVC:US03Y",
  "05Y": "TVC:US05Y",
  "07Y": "TVC:US07Y",
  "10Y": "TVC:US10Y",
  "20Y": "TVC:US20Y",
  "30Y": "TVC:US30Y",
};

function toTradingView(sym) {
  if (YAHOO_TO_TV[sym]) return YAHOO_TO_TV[sym];

  if (sym.endsWith("=X")) {
    const pair = sym.replace("=X", "");
    return FX_PAIRS[pair] || `FX:${pair}`;
  }

  if (sym.endsWith("-USD")) {
    const coin = sym.replace("-USD", "");
    return CRYPTO_MAP[coin] || `COINBASE:${coin}USD`;
  }

  // Treasury yield symbols: US10Y, US02Y, etc.
  if (sym.startsWith("US") && TREASURY_MAP[sym.slice(2)]) {
    return TREASURY_MAP[sym.slice(2)];
  }

  if (sym.startsWith("^")) return sym;
  return `NASDAQ:${sym}`;
}

let tvClient = null;
let tvQuoteSession = null;
let lastDataTime = 0;
let reconnecting = false;
let reconnectAttempts = 0;
let reconnectTimer = null;
const markets = new Map();        // TV symbol -> { market, refs, lastData }
const tvToYahoo = new Map();       // TV symbol -> Set<original Yahoo symbol>
const clientSubs = new Map();      // WebSocket -> Set<original Yahoo symbol>

function resetTvClient() {
  console.error("[RT] Resetting TV client");
  for (const entry of markets.values()) {
    try { entry.market.close(); } catch {}
  }
  markets.clear();
  tvToYahoo.clear();
  if (tvQuoteSession) { try { tvQuoteSession.delete(); } catch {} }
  if (tvClient) { try { tvClient.end(); } catch {} }
  tvClient = null;
  tvQuoteSession = null;
  lastDataTime = 0;
}

function reconnectAll() {
  if (reconnecting) return;
  reconnecting = true;
  reconnectAttempts++;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  // Back off if reconnecting rapidly (>10 times in 60s)
  if (reconnectAttempts > 10) {
    console.error("[RT] Too many reconnects, waiting 30s before next attempt");
    resetTvClient();
    reconnectTimer = setTimeout(() => {
      reconnectAttempts = 0;
      reconnecting = false;
      reconnectAll();
    }, 30000);
    return;
  }
  // Reset counter after 60s of stability
  setTimeout(() => { reconnectAttempts = 0; }, 60000);

  resetTvClient();
  const allSyms = [...clientSubs.values()].flatMap(s => [...s]);
  if (allSyms.length > 0) {
    ensureTvConnected();
    for (const sym of allSyms) {
      const tvSym = toTradingView(sym);
      subscribeSymbol(sym, tvSym);
    }
  }
  reconnecting = false;
}

function ensureTvConnected() {
  if (tvClient) return;
  tvClient = new TradingView.Client();
  tvClient.onError((...args) => {
    console.error("[TV] Client error:", ...args);
    reconnectAll();
  });
  tvClient.onDisconnected(() => {
    reconnectAll();
  });
  tvQuoteSession = new tvClient.Session.Quote();
}

// Watchdog: if no data for 30s, assume TV client died and reset
setInterval(() => {
  if (tvClient && Date.now() - lastDataTime > 30000 && clientSubs.size > 0) {
    console.error("[WATCHDOG] No data for 30s — resetting TV client");
    console.error("[WATCHDOG] No data for 60s — resetting TV client");
    // Collect all active symbols before reset
    const allSyms = [...clientSubs.values()].flatMap(s => [...s]);
    resetTvClient();
    // Re-subscribe everything
    for (const sym of allSyms) {
      const tvSym = toTradingView(sym);
      subscribeSymbol(sym, tvSym);
    }
  }
}, 30000);

function subscribeSymbol(yahooSym, tvSym) {
  if (markets.has(tvSym)) {
    markets.get(tvSym).refs++;
    if (!tvToYahoo.has(tvSym)) tvToYahoo.set(tvSym, new Set());
    tvToYahoo.get(tvSym).add(yahooSym);
    return;
  }
  ensureTvConnected();
  const market = new tvQuoteSession.Market(tvSym);
  const entry = { market, refs: 1, lastData: null };
  markets.set(tvSym, entry);
  const yahooSet = new Set([yahooSym]);
  tvToYahoo.set(tvSym, yahooSet);

  market.onData((data) => {
    lastDataTime = Date.now();
    entry.lastData = data;
    for (const orig of yahooSet) {
      broadcast({ type: "price", symbol: orig, data });
    }
  });

  market.onError((...err) => {
    console.error(`[TV] ${tvSym}:`, ...err);
  });
}

function unsubscribeSymbol(yahooSym, tvSym) {
  const entry = markets.get(tvSym);
  if (!entry) return;
  const yahooSet = tvToYahoo.get(tvSym);
  if (yahooSet) {
    yahooSet.delete(yahooSym);
    if (yahooSet.size === 0) tvToYahoo.delete(tvSym);
  }
  entry.refs--;
  if (entry.refs <= 0) {
    entry.market.close();
    markets.delete(tvSym);
    tvToYahoo.delete(tvSym);
  }
}

function broadcast(msg) {
  const raw = JSON.stringify(msg);
  for (const [ws] of clientSubs) {
    if (ws.readyState === 1) ws.send(raw);
  }
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, symbols: markets.size, clients: clientSubs.size }));
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketLib.Server({ server });

wss.on("connection", (ws) => {
  const subs = new Set();
  clientSubs.set(ws, subs);

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === "subscribe" && Array.isArray(msg.symbols)) {
      for (const sym of msg.symbols) {
        if (subs.has(sym)) continue;
        const tvSym = toTradingView(sym);
        subscribeSymbol(sym, tvSym);
        subs.add(sym);
      }
    }

    if (msg.type === "unsubscribe" && Array.isArray(msg.symbols)) {
      for (const sym of msg.symbols) {
        if (!subs.has(sym)) continue;
        const tvSym = toTradingView(sym);
        unsubscribeSymbol(sym, tvSym);
        subs.delete(sym);
      }
    }
  });

  ws.on("close", () => {
    for (const sym of subs) {
      const tvSym = toTradingView(sym);
      unsubscribeSymbol(sym, tvSym);
    }
    clientSubs.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`[RT] Realtime server running on ws://127.0.0.1:${PORT}`);
});

process.on("uncaughtException", (err) => {
  console.error("[CRASH] Uncaught exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[CRASH] Unhandled rejection:", reason);
});

process.on("SIGTERM", () => {
  for (const entry of markets.values()) entry.market.close();
  if (tvQuoteSession) tvQuoteSession.delete();
  if (tvClient) tvClient.end();
  server.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  for (const entry of markets.values()) entry.market.close();
  if (tvQuoteSession) tvQuoteSession.delete();
  if (tvClient) tvClient.end();
  server.close();
  process.exit(0);
});
