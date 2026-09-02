// Portfolio, positions, P&L and simulated margin management.
const Portfolio = (() => {
  const START_CASH = 100000;
  const MAINT_MARGIN_RATIO = 0.25;
  const FEE_RATE = 0.0005;

  let cash = START_CASH;
  let positions = [];
  let realizedPnL = 0;
  let closedTrades = 0;
  let winningTrades = 0;

  function getPosition(symbol) { return positions.find((p) => p.symbol === symbol); }

  function getMarketPrice(symbol) {
    const hist = MarketVerse.getHistory(symbol);
    return hist.length ? hist[hist.length - 1].close : null;
  }

  function upsertPosition(pos) {
    const idx = positions.findIndex((p) => p.symbol === pos.symbol);
    if (idx === -1) positions.push(pos); else positions[idx] = pos;
  }

  function computeUnrealized() {
    return positions.reduce((total, p) => {
      const last = getMarketPrice(p.symbol);
      if (last == null) return total;
      const diff = p.side === "long" ? last - p.entry : p.entry - last;
      return total + diff * p.qty * p.leverage;
    }, 0);
  }

  function computeEquity() { return cash + realizedPnL + computeUnrealized(); }

  function computeMarginUsed() {
    return positions.reduce((used, p) => {
      const last = getMarketPrice(p.symbol) || p.entry;
      return used + (last * p.qty) / Math.max(1, p.leverage);
    }, 0);
  }

  function computeMaintMargin() { return computeMarginUsed() * MAINT_MARGIN_RATIO; }
  function canOpen(notional, leverage) { return notional / Math.max(1, leverage) <= computeEquity() * 0.8; }

  function realizeForPosition(p, closeQty, closePrice) {
    const diff = p.side === "long" ? closePrice - p.entry : p.entry - closePrice;
    const pnl = diff * closeQty * p.leverage;
    realizedPnL += pnl;
    closedTrades += 1;
    if (pnl > 0) winningTrades += 1;
    return pnl;
  }

  function applyTrade(order, fillPrice) {
    const qty = Number(order.qty);
    const leverage = Math.max(1, Number(order.leverage) || 1);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(fillPrice) || fillPrice <= 0) {
      return { ok: false, reason: "Invalid order" };
    }

    const requestedSide = order.side === "buy" ? "long" : "short";
    const existing = getPosition(order.symbol);
    const notional = fillPrice * qty;
    const fee = notional * FEE_RATE;

    // Same direction adds to the position. Opposite direction closes first, then reverses if needed.
    if (existing && existing.side === requestedSide) {
      if (!canOpen(notional, leverage)) return { ok: false, reason: "Insufficient margin" };
      const totalQty = existing.qty + qty;
      existing.entry = (existing.entry * existing.qty + fillPrice * qty) / totalQty;
      existing.qty = totalQty;
      existing.leverage = leverage;
      existing.stopLoss = order.stopLoss ?? existing.stopLoss ?? null;
      existing.takeProfit = order.takeProfit ?? existing.takeProfit ?? null;
      cash -= notional / leverage + fee;
      return { ok: true, fee, action: "added" };
    }

    if (existing && existing.side !== requestedSide) {
      const closeQty = Math.min(existing.qty, qty);
      const pnl = realizeForPosition(existing, closeQty, fillPrice);
      const closeNotional = fillPrice * closeQty;
      cash += closeNotional / existing.leverage;
      existing.qty -= closeQty;

      if (existing.qty <= 1e-9) {
        positions = positions.filter((p) => p !== existing);
      }

      const remaining = qty - closeQty;
      if (remaining <= 1e-9) {
        cash -= fee;
        return { ok: true, fee, pnl, action: "closed" };
      }

      if (!canOpen(fillPrice * remaining, leverage)) {
        cash -= fee;
        return { ok: true, fee, pnl, action: "partially-closed" };
      }
      positions.push({
        symbol: order.symbol,
        side: requestedSide,
        qty: remaining,
        entry: fillPrice,
        leverage,
        stopLoss: order.stopLoss ?? null,
        takeProfit: order.takeProfit ?? null
      });
      cash -= (fillPrice * remaining) / leverage;
      cash -= fee;
      return { ok: true, fee, pnl, action: "reversed" };
    }

    if (!canOpen(notional, leverage)) return { ok: false, reason: "Insufficient margin" };
    positions.push({
      symbol: order.symbol,
      side: requestedSide,
      qty,
      entry: fillPrice,
      leverage,
      stopLoss: order.stopLoss ?? null,
      takeProfit: order.takeProfit ?? null
    });
    cash -= notional / leverage;
    cash -= fee;
    return { ok: true, fee, action: "opened" };
  }

  function checkLiquidations() {
    const equity = computeEquity();
    const maint = computeMaintMargin();
    if (positions.length && equity < maint) {
      const snapshot = positions.slice();
      snapshot.forEach((p) => {
        const last = getMarketPrice(p.symbol) || p.entry;
        realizeForPosition(p, p.qty, last);
        cash += (last * p.qty) / p.leverage;
      });
      positions = [];
      return { liquidated: true, reason: "Maintenance margin breached" };
    }
    return { liquidated: false };
  }

  function checkRiskExits() {
    const exits = [];
    positions.slice().forEach((p) => {
      const last = getMarketPrice(p.symbol);
      if (last == null) return;
      const hitSL = p.stopLoss != null && (p.side === "long" ? last <= p.stopLoss : last >= p.stopLoss);
      const hitTP = p.takeProfit != null && (p.side === "long" ? last >= p.takeProfit : last <= p.takeProfit);
      if (hitSL || hitTP) {
        const pnl = realizeForPosition(p, p.qty, last);
        cash += (last * p.qty) / p.leverage;
        positions = positions.filter((x) => x !== p);
        exits.push({ symbol: p.symbol, reason: hitSL ? "stop-loss" : "take-profit", price: last, pnl });
      }
    });
    return exits;
  }

  function snapshot() {
    return {
      cash,
      equity: computeEquity(),
      marginUsed: computeMarginUsed(),
      maintMargin: computeMaintMargin(),
      realizedPnL,
      unrealizedPnL: computeUnrealized(),
      closedTrades,
      winningTrades,
      winRate: closedTrades ? (winningTrades / closedTrades) * 100 : 0,
      positions: positions.slice()
    };
  }

  function getBuyingPower() {
    return Math.max(0, computeEquity() * 2 - computeMarginUsed());
  }

  return { applyTrade, snapshot, getBuyingPower, checkRiskExits, checkLiquidations };
})();
