// Portfolio, margin, P&L

const Portfolio = (() => {
  const START_CASH = 100000;
  const MAINT_MARGIN_RATIO = 0.25;

  let cash = START_CASH;
  let positions = []; // {symbol, side, qty, entry, leverage}
  let realizedPnL = 0;

  function getPosition(symbol) {
    return positions.find((p) => p.symbol === symbol);
  }

  function upsertPosition(pos) {
    const existing = getPosition(pos.symbol);
    if (!existing) {
      positions.push(pos);
    } else {
      Object.assign(existing, pos);
    }
  }

  function removePosition(symbol) {
    positions = positions.filter((p) => p.symbol !== symbol);
  }

  function getMarketPrice(symbol) {
    const hist = MarketVerse.getHistory(symbol);
    if (!hist.length) return null;
    return hist[hist.length - 1].close;
  }

  function computeUnrealized() {
    let total = 0;
    positions.forEach((p) => {
      const last = getMarketPrice(p.symbol);
      if (!last) return;
      const diff =
        p.side === "long" ? last - p.entry : p.entry - last;
      total += diff * p.qty * p.leverage;
    });
    return total;
  }

  function computeEquity() {
    return cash + realizedPnL + computeUnrealized();
  }

  function computeMarginUsed() {
    let used = 0;
    positions.forEach((p) => {
      const last = getMarketPrice(p.symbol);
      if (!last) return;
      const notional = last * p.qty;
      used += notional / p.leverage;
    });
    return used;
  }

  function computeMaintMargin() {
    return computeMarginUsed() * MAINT_MARGIN_RATIO;
  }

  function canOpen(notional, leverage) {
    const marginRequired = notional / leverage;
    const equity = computeEquity();
    return marginRequired <= equity * 0.8;
  }

  function applyTrade(order, fillPrice) {
    const notional = fillPrice * order.qty;
    const fee = notional * 0.0005;
    const side = order.side === "buy" ? "long" : "short";

    if (!canOpen(notional, order.leverage)) {
      return { ok: false, reason: "Insufficient margin" };
    }

    cash -= notional / order.leverage;
    cash -= fee;

    const existing = getPosition(order.symbol);
    if (!existing) {
      upsertPosition({
        symbol: order.symbol,
        side,
        qty: order.qty,
        entry: fillPrice,
        leverage: order.leverage
      });
    } else {
      // simple average entry
      const last = getMarketPrice(order.symbol) || existing.entry;
      const totalQty = existing.qty + order.qty;
      const newEntry =
        (existing.entry * existing.qty + fillPrice * order.qty) /
        totalQty;
      existing.qty = totalQty;
      existing.entry = newEntry;
      existing.leverage = order.leverage;
      existing.side = side;
    }

    checkLiquidations();

    return { ok: true, fee };
  }

  function checkLiquidations() {
    const equity = computeEquity();
    const maint = computeMaintMargin();
    if (equity < maint) {
      // liquidate all
      positions.forEach((p) => {
        const last = getMarketPrice(p.symbol) || p.entry;
        const diff =
          p.side === "long" ? last - p.entry : p.entry - last;
        const pnl = diff * p.qty * p.leverage;
        realizedPnL += pnl;
      });
      positions = [];
    }
  }

  function snapshot() {
    return {
      cash,
      equity: computeEquity(),
      marginUsed: computeMarginUsed(),
      maintMargin: computeMaintMargin(),
      realizedPnL,
      unrealizedPnL: computeUnrealized(),
      positions: positions.slice()
    };
  }

  function getBuyingPower() {
    const equity = computeEquity();
    const marginUsed = computeMarginUsed();
    return Math.max(0, equity * 2 - marginUsed);
  }

  return {
    applyTrade,
    snapshot,
    getBuyingPower
  };
})();
