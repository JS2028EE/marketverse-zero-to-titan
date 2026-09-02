// Fictional market engine: regimes, volatility and synthetic price updates.
const MarketVerse = (() => {
  const regimes = ["Bull", "Bear", "Sideways", "Panic"];
  let currentRegime = "Sideways";
  let volatility = 0.015;
  let tickIntervalMs = 1500;
  let assets = [];
  const priceHistory = {};

  function loadAssets() {
    return fetch("data/assets.json")
      .then((r) => { if (!r.ok) throw new Error("Assets could not be loaded"); return r.json(); })
      .then((data) => {
        assets = Array.isArray(data.assets) ? data.assets : [];
        assets.forEach((asset) => {
          priceHistory[asset.symbol] = [];
          seedHistory(asset);
        });
        return assets;
      });
  }

  function seedHistory(asset) {
    let price = asset.startPrice;
    const now = Date.now();
    for (let i = 59; i >= 0; i--) {
      const drift = (Math.random() - 0.5) * 0.012;
      const next = Math.max(0.01, price * (1 + drift));
      const high = Math.max(price, next) * (1 + Math.random() * 0.003);
      const low = Math.min(price, next) * (1 - Math.random() * 0.003);
      priceHistory[asset.symbol].push({
        time: now - i * tickIntervalMs,
        open: price,
        high,
        low,
        close: next,
        volume: 1000 + Math.random() * 7000
      });
      price = next;
    }
  }

  function randomRegimeShift() {
    if (Math.random() >= 0.025) return;
    currentRegime = regimes[Math.floor(Math.random() * regimes.length)];
    switch (currentRegime) {
      case "Bull": volatility = 0.02; break;
      case "Bear": volatility = 0.025; break;
      case "Sideways": volatility = 0.01; break;
      case "Panic": volatility = 0.05; break;
    }
  }

  function getDriftForAsset(asset) {
    switch (currentRegime) {
      case "Bull": return 0.0008;
      case "Bear": return -0.0009;
      case "Sideways": return 0;
      case "Panic": return asset.type === "crypto" ? -0.002 : -0.001;
      default: return 0;
    }
  }

  function nextPrice(asset) {
    const history = priceHistory[asset.symbol];
    const last = history.at(-1);
    const drift = getDriftForAsset(asset);
    const shock = (Math.random() - 0.5) * 2 * volatility;
    const spread = asset.spread || 0.0015;
    const newClose = Math.max(0.01, last.close * (1 + drift + shock));
    const high = Math.max(last.close, newClose) * (1 + Math.random() * 0.004);
    const low = Math.min(last.close, newClose) * (1 - Math.random() * 0.004);
    const volume = last.volume * (0.7 + Math.random() * 0.8);
    const candle = { time: Date.now(), open: last.close, high, low, close: newClose, volume };
    history.push(candle);
    if (history.length > 300) history.shift();
    return { last: newClose, bid: newClose * (1 - spread / 2), ask: newClose * (1 + spread / 2), candle };
  }

  function tickAll() {
    randomRegimeShift();
    assets.forEach(nextPrice);
    AppEvents.onMarketTick();
  }

  function start() { setInterval(tickAll, tickIntervalMs); }
  function getAssets() { return assets; }
  function getHistory(symbol) { return priceHistory[symbol] || []; }
  function getRegime() { return currentRegime; }
  function getVolatility() { return volatility; }

  return { loadAssets, start, getAssets, getHistory, getRegime, getVolatility };
})();
