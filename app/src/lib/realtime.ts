const RT_URL = `ws://127.0.0.1:6901`;

export interface RealtimePrice {
  lp?: number;
  ch?: number;
  chp?: number;
  ask?: number;
  bid?: number;
  volume?: number;
  open_price?: number;
  high_price?: number;
  low_price?: number;
  prev_close_price?: number;
  lp_time?: string;
  description?: string;
  currency_code?: string;
}

type Listener = (data: RealtimePrice) => void;

class RealtimeClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private lastData = new Map<string, RealtimePrice>();
  private subs = new Set<string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    try {
      this.ws = new WebSocket(RT_URL);
    } catch { return; }

    this.ws.onopen = () => {
      if (this.subs.size > 0) {
        this.ws!.send(JSON.stringify({ type: "subscribe", symbols: [...this.subs] }));
      }
    };

    this.ws.onmessage = (ev) => {
      let msg: any;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === "price") {
        this.lastData.set(msg.symbol, msg.data);
        const ls = this.listeners.get(msg.symbol);
        if (ls) ls.forEach((fn) => fn(msg.data));
      }
    };

    this.ws.onclose = () => {
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = () => {};
  }

  subscribe(symbol: string, listener: Listener) {
    if (!this.listeners.has(symbol)) this.listeners.set(symbol, new Set());
    this.listeners.get(symbol)!.add(listener);

    if (!this.subs.has(symbol)) {
      this.subs.add(symbol);
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "subscribe", symbols: [symbol] }));
      }
    }

    const cached = this.lastData.get(symbol);
    if (cached) listener(cached);

    return () => this.unsubscribe(symbol, listener);
  }

  private unsubscribe(symbol: string, listener: Listener) {
    const ls = this.listeners.get(symbol);
    if (!ls) return;
    ls.delete(listener);
    if (ls.size === 0) {
      this.listeners.delete(symbol);
      this.subs.delete(symbol);
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "unsubscribe", symbols: [symbol] }));
      }
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) { this.ws.close(); this.ws = null; }
  }
}

export const rt = new RealtimeClient();
