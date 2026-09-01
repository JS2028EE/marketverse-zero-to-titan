// Order handling, history, basic matching

const Orders = (() => {
  let orders = []; // history

  function place(order) {
    const hist = MarketVerse.getHistory(order.symbol);
    if (!hist.length) {
      return { ok: false, reason: "No market data" };
    }
    const last = hist[hist.length - 1].close;

    let fillPrice = last;
    if (order.type === "limit" && order.price) {
      if (order.side === "buy" && order.price >= last) {
        fillPrice = order.price;
      } else if (order.side === "sell" && order.price <= last) {
        fillPrice = order.price;
      } else {
        // not filled
        orders.push({
          ...order,
          status: "pending"
        });
        return { ok: false, reason: "Limit not reached (simulated)" };
      }
    } else if (order.type === "stop" && order.price) {
      if (order.side === "buy" && last >= order.price) {
        fillPrice = last;
      } else if (order.side === "sell" && last <= order.price) {
        fillPrice = last;
      } else {
        orders.push({
          ...order,
          status: "pending"
        });
        return { ok: false, reason: "Stop not triggered (simulated)" };
      }
    }

    const res = Portfolio.applyTrade(order, fillPrice);
    const status = res.ok ? "filled" : "rejected";

    orders.push({
      time: new Date().toLocaleTimeString(),
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      qty: order.qty,
      price: fillPrice.toFixed(2),
      status,
      reason: res.reason || null
    });

    return { ok: res.ok, fee: res.fee, fillPrice };
  }

  function getOrders() {
    return orders.slice().reverse();
  }

  return {
    place,
    getOrders
  };
})();
