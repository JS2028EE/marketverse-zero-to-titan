// Market engine: regimes, volatility, price updates

const MarketVerse = (() => {
  const regimes = ["Bull", "Bear", "Sideways", "Panic"];
  let currentRegime = "Sideways";
  let volatility = 0.015; // base daily-ish volatility
  let tickIntervalMs = 1500;

  let assets = [];
  let priceHistory = {}; // symbol -> array of candles

  function loadAssets() {
    return fetch("data/assets.json")
      .then((r) => r.json())
      .then((data) => {
        assets = data.assets;
        assets.forEach((a) => {
          priceHistory[a.symbol] = [];
          // seed with initial candle
          const base = a.startPrice;
          priceHistory[a.symbol].push({
            time: Date.now(),
            open: base,
            high: base * 1.01,
            low: base * 0.99,
            close: base,
            volume: 1000 + Math.random() * 5000
          });
        });
        return assets;
      });
  }

  function randomRegimeShift() {
    const roll = Math.random();
    if (roll < 0.02) {
      currentRegime = regimes[Math.floor(Math.random() * regimes.length)];
      switch (currentRegime) {
        case "Bull":
          volatility = 0.02;
          break;
        case "Bear":
          volatility = 0.025;
          break;
        case "Sideways":
          volatility = 0.01;
          break;
        case "Panic":
          volatility = 0.05;
          break;
      }
    }
  }

  function getDriftForAsset(asset) {
    switch (currentRegime) {
      case "Bull":
        return 0.0008;
      case "Bear":
        return -0.0009;
      case "Sideways":
        return 0.0;
      case "Panic":
        return asset.type === "crypto" ? -0.002 : -0.001;
      default:
        return 0.0;
    }
  }

  function nextPrice(asset) {
    const history = priceHistory[asset.symbol];
    const last = history[history.length - 1];
    const lastClose = last.close;
    const drift = getDriftForAsset(asset);
    const shock = (Math.random() - 0.5) * 2 * volatility;
    const spread = asset.spread || 0.0015;

    const newClose = Math.max(0.01, lastClose * (1 + drift + shock));
    const high = Math.max(lastClose, newClose) * (1 + Math.random() * 0.004);
    const low = Math.min(lastClose, newClose) * (1 - Math.random() * 0.004);
    const volume = last.volume * (0.7 + Math.random() * 0.8);

    const candle = {
      time: Date.now(),
      open: lastClose,
      high,
      low,
      close: newClose,
      volume
    };

    history.push(candle);
    if (history.length > 300) history.shift();

    return {
      last: newClose,
      bid: newClose * (1 - spread / 2),
      ask: newClose * (1 + spread / 2),
      candle
    };
  }

  function tickAll() {
    randomRegimeShift();
    assets.forEach((asset) => {
      nextPrice(asset);
    });
    AppEvents.onMarketTick();
  }

  function start() {
    setInterval(tickAll, tickIntervalMs);
  }

  function getAssets() {
    return assets;
  }

  function getHistory(symbol) {
    return priceHistory[symbol] || [];
  }

  function getRegime() {
    return currentRegime;
  }

  function getVolatility() {
    return volatility;
  }

  return {
    loadAssets,
    start,
    getAssets,
    getHistory,
    getRegime,
    getVolatility
  };
})();
