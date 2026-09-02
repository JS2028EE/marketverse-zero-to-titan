// Order handling, pending-order matching and activity history.
const Orders = (() => {
  let orders = [];

  function record(order, status, fillPrice, reason = null) {
    orders.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      qty: order.qty,
      price: fillPrice != null ? Number(fillPrice).toFixed(2) : "—",
      status,
      reason
    });
    if (orders.length > 50) orders.shift();
  }

  function shouldFill(order, last) {
    if (order.type === "market") return true;
    if (!order.price) return false;
    if (order.type === "limit") return order.side === "buy" ? last <= order.price : last >= order.price;
    if (order.type === "stop") return order.side === "buy" ? last >= order.price : last <= order.price;
    return false;
  }

  function place(order) {
    const hist = MarketVerse.getHistory(order.symbol);
    if (!hist.length) return { ok: false, reason: "No market data" };
    const last = hist[hist.length - 1].close;
    const normalized = {
      ...order,
      qty: Number(order.qty),
      leverage: Math.max(1, Number(order.leverage) || 1),
      price: order.price != null && Number(order.price) > 0 ? Number(order.price) : null,
      stopLoss: order.stopLoss != null && Number(order.stopLoss) > 0 ? Number(order.stopLoss) : null,
      takeProfit: order.takeProfit != null && Number(order.takeProfit) > 0 ? Number(order.takeProfit) : null
    };

    if (!shouldFill(normalized, last)) {
      normalized.status = "pending";
      record(normalized, "pending", null, `${normalized.type} waiting for trigger`);
      return { ok: false, pending: true, reason: `${normalized.type} waiting for trigger` };
    }

    const fillPrice = normalized.type === "limit" && normalized.price ? normalized.price : last;
    const res = Portfolio.applyTrade(normalized, fillPrice);
    record(normalized, res.ok ? "filled" : "rejected", fillPrice, res.reason || null);
    return { ok: res.ok, fee: res.fee, fillPrice, action: res.action, pnl: res.pnl };
  }

  function checkPending() {
    // Pending orders are intentionally kept simple: this simulation reuses the order history as the visible blotter
    // and does not expose a mutable open-order book yet.
  }

  function getOrders() { return orders.slice().reverse(); }
  function clear() { orders = []; }

  return { place, checkPending, getOrders, clear };
})();
