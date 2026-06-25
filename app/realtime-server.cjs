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

  if (sym.startsWith("^")) return sym;
  return `NASDAQ:${sym}`;
}

let tvClient = null;
let tvQuoteSession = null;
const markets = new Map();        // TV symbol -> { market, refs, lastData }
const tvToYahoo = new Map();       // TV symbol -> Set<original Yahoo symbol>
const clientSubs = new Map();      // WebSocket -> Set<original Yahoo symbol>

function ensureTvConnected() {
  if (tvClient && tvClient.isOpen) return;
  tvClient = new TradingView.Client();
  tvClient.onError(() => {});
  tvQuoteSession = new tvClient.Session.Quote();
}

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
