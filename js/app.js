// MarketVerse game controller: UI, progression, feedback and trader HUD.
const AppEvents = (() => {
  const listeners = { marketTick: [] };
  function onMarketTick() { listeners.marketTick.forEach((fn) => fn()); }
  function subscribe(event, fn) { if (listeners[event]) listeners[event].push(fn); }
  return { onMarketTick, subscribe };
})();

const Game = (() => {
  let selectedSymbol = null;
  let level = Number(localStorage.getItem("mv_level") || 1);
  let xp = Number(localStorage.getItem("mv_xp") || 0);
  let bestEquity = 100000;
  let startingEquity = 100000;
  let soundEnabled = localStorage.getItem("mv_sound") !== "off";
  const achievements = new Map();

  const levelNames = ["Rookie", "Operator", "Speculator", "Trader", "Strategist", "Mogul", "Tycoon", "Titan"];

  function init() {
    document.getElementById("mv-sound-toggle").textContent = soundEnabled ? "🔊" : "🔇";
    wireClock();
    setupFilters();
    setupSearch();
    setupOrderForm();
    setupHotkeys();
    setupSound();
    document.getElementById("mv-clear-orders").addEventListener("click", () => { Orders.clear(); updateOrdersUI(); toast("Activity cleared", "Order blotter reset.", "info"); });
    document.getElementById("mv-levelup-close").addEventListener("click", () => { document.getElementById("mv-levelup").hidden = true; });

    MarketVerse.loadAssets().then((assets) => {
      if (!assets.length) throw new Error("No assets configured");
      selectedSymbol = assets[0].symbol;
      document.getElementById("mv-selected-asset").textContent = `${assets[0].symbol} — ${assets[0].name}`;
      Charts.init();
      Charts.setSymbol(selectedSymbol);
      renderAssetsTable(assets);
      updateAllUI();
      renderTicker();
      renderAchievements();
      toast("MarketVerse online", "Simulation initialized with $100,000 in paper capital.", "success");
    }).catch((err) => toast("Startup error", err.message, "error"));

    NewsEngine.loadEvents().then(() => NewsEngine.init());

    AppEvents.subscribe("marketTick", () => {
      const exits = Portfolio.checkRiskExits();
      const liq = Portfolio.checkLiquidations();
      exits.forEach((exit) => {
        gainXP(15);
        toast(`${exit.symbol} ${exit.reason.toUpperCase()}`, `Position exited at $${exit.price.toFixed(2)} · ${formatMoney(exit.pnl)}`, exit.pnl >= 0 ? "success" : "error");
      });
      if (liq.liquidated) toast("LIQUIDATION", "Maintenance margin was breached. All open positions were closed.", "error");
      Charts.render();
      updateAllUI();
      renderTicker();
      evaluateAchievements();
      gainXP(1);
    });

    MarketVerse.start();
    updateProgressionUI();
  }

  function wireClock() {
    const clockEl = document.getElementById("mv-clock");
    const tick = () => { clockEl.textContent = new Date().toLocaleTimeString([], { hour12: false }); };
    tick();
    setInterval(tick, 1000);
  }

  function setupFilters() {
    document.querySelectorAll(".mv-filter-btn").forEach((btn) => btn.addEventListener("click", () => {
      document.querySelectorAll(".mv-filter-btn").forEach((b) => b.classList.remove("mv-filter-active"));
      btn.classList.add("mv-filter-active");
      renderAssetsTable(getFilteredAssets());
    }));
  }

  function setupSearch() {
    document.getElementById("mv-asset-search").addEventListener("input", () => renderAssetsTable(getFilteredAssets()));
  }

  function getFilteredAssets() {
    const filter = document.querySelector(".mv-filter-active")?.dataset.filter || "all";
    const query = document.getElementById("mv-asset-search").value.trim().toLowerCase();
    return MarketVerse.getAssets().filter((a) => {
      const typeOk = filter === "all" || a.type === filter;
      const queryOk = !query || a.symbol.toLowerCase().includes(query) || a.name.toLowerCase().includes(query);
      return typeOk && queryOk;
    });
  }

  function renderAssetsTable(assets) {
    const tbody = document.querySelector("#mv-assets-table tbody");
    tbody.innerHTML = "";
    assets.forEach((a) => {
      const hist = MarketVerse.getHistory(a.symbol);
      if (!hist.length) return;
      const last = hist.at(-1).close;
      const first = hist[0].open || last;
      const change = ((last - first) / first) * 100;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><strong>${a.symbol}</strong><br><span style="color:var(--muted-2);font:400 7px var(--sans)">${a.type.toUpperCase()}</span></td><td>${formatPrice(last)}</td><td class="${change >= 0 ? "mv-positive" : "mv-negative"}">${change >= 0 ? "+" : ""}${change.toFixed(2)}%</td><td>${(a.spread * 100).toFixed(2)}%</td>`;
      tr.addEventListener("click", () => selectAsset(a));
      tbody.appendChild(tr);
    });
  }

  function selectAsset(asset) {
    selectedSymbol = asset.symbol;
    document.getElementById("mv-selected-asset").textContent = `${asset.symbol} — ${asset.name}`;
    Charts.setSymbol(selectedSymbol);
    updateOrderPricePlaceholder();
    updateChartStats();
  }

  function setupOrderForm() {
    const form = document.getElementById("mv-order-form");
    ["mv-order-type", "mv-order-qty", "mv-order-price", "mv-order-leverage", "mv-order-sl", "mv-order-tp"].forEach((id) => document.getElementById(id).addEventListener("input", recalcOrder));
    document.querySelectorAll('input[name="side"]').forEach((r) => r.addEventListener("change", recalcOrder));
    document.getElementById("mv-order-type").addEventListener("change", () => { updateOrderPricePlaceholder(); recalcOrder(); });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const result = Orders.place(readOrder());
      if (result.ok) {
        Sounds.playExecute();
        gainXP(10);
        const side = readOrder().side === "buy" ? "LONG" : "SHORT";
        toast(`${side} EXECUTED`, `${readOrder().symbol} · ${readOrder().qty} units @ ${formatPrice(result.fillPrice)} · ${result.action || "filled"}`, "success");
      } else if (result.pending) {
        toast("ORDER QUEUED", result.reason, "info");
      } else {
        Sounds.playReject();
        toast("ORDER REJECTED", result.reason || "Order failed.", "error");
      }
      updateAllUI();
      recalcOrder();
      evaluateAchievements();
    });
    recalcOrder();
  }

  function readOrder() {
    const hist = MarketVerse.getHistory(selectedSymbol);
    return {
      symbol: selectedSymbol,
      side: document.querySelector('input[name="side"]:checked').value,
      type: document.getElementById("mv-order-type").value,
      qty: Number(document.getElementById("mv-order-qty").value),
      price: Number(document.getElementById("mv-order-price").value) || null,
      leverage: Number(document.getElementById("mv-order-leverage").value) || 1,
      stopLoss: Number(document.getElementById("mv-order-sl").value) || null,
      takeProfit: Number(document.getElementById("mv-order-tp").value) || null,
      marketLast: hist.length ? hist.at(-1).close : 0
    };
  }

  function recalcOrder() {
    if (!selectedSymbol) return;
    const order = readOrder();
    const last = order.marketLast;
    const qty = Number(order.qty) || 0;
    const notional = last * qty;
    const fee = notional * 0.0005;
    document.getElementById("mv-order-cost").textContent = formatMoney(notional);
    document.getElementById("mv-order-fee").textContent = formatMoney(fee);
    document.getElementById("mv-buying-power").textContent = formatMoney(Portfolio.getBuyingPower());
    document.getElementById("mv-order-mode").textContent = order.type.toUpperCase();
  }

  function updateOrderPricePlaceholder() {
    const input = document.getElementById("mv-order-price");
    input.placeholder = document.getElementById("mv-order-type").value === "market" ? "Not used" : formatPrice(MarketVerse.getHistory(selectedSymbol)?.at(-1)?.close || 0);
  }

  function updateAllUI() {
    updateAssetsTable();
    updatePortfolioUI();
    updateOrdersUI();
    updateRegimeUI();
    updateChartStats();
    updateProgressionUI();
  }

  function updateAssetsTable() { renderAssetsTable(getFilteredAssets()); }

  function updateRegimeUI() {
    const regime = MarketVerse.getRegime();
    const volatility = MarketVerse.getVolatility() * 100;
    document.getElementById("mv-regime").textContent = `Regime: ${regime}`;
    document.getElementById("mv-volatility").textContent = `Volatility: ${volatility.toFixed(2)}%`;
    document.getElementById("mv-regime-big").textContent = regime.toUpperCase();
    const hints = { Bull: "Momentum is risk-on", Bear: "Sellers have control", Sideways: "Balanced flow", Panic: "Extreme volatility" };
    document.getElementById("mv-regime-hint").textContent = hints[regime] || "Watch the tape";
    document.getElementById("mv-market-status").textContent = regime === "Panic" ? "⚠ VOLATILE MARKET" : "MARKET OPEN";
  }

  function updateChartStats() {
    if (!selectedSymbol) return;
    const h = MarketVerse.getHistory(selectedSymbol);
    if (!h.length) return;
    const last = h.at(-1);
    document.getElementById("mv-price-badge").textContent = formatPrice(last.close);
    document.getElementById("mv-volume").textContent = compact(last.volume);
    document.getElementById("mv-high").textContent = formatPrice(Math.max(...h.map((c) => c.high)));
    document.getElementById("mv-low").textContent = formatPrice(Math.min(...h.map((c) => c.low)));
  }

  function updatePortfolioUI() {
    const snap = Portfolio.snapshot();
    const pnlClass = snap.unrealizedPnL >= 0 ? "mv-positive" : "mv-negative";
    document.getElementById("mv-cash").textContent = formatMoney(snap.cash);
    document.getElementById("mv-equity").textContent = formatMoney(snap.equity);
    document.getElementById("mv-margin-used").textContent = formatMoney(snap.marginUsed);
    document.getElementById("mv-maint-margin").textContent = formatMoney(snap.maintMargin);
    document.getElementById("mv-networth").textContent = formatMoney(snap.equity);
    document.getElementById("mv-equity-hero").textContent = formatMoney(snap.equity);
    const delta = snap.equity - startingEquity;
    const deltaEl = document.getElementById("mv-equity-change");
    deltaEl.className = delta >= 0 ? "mv-positive" : "mv-negative";
    deltaEl.textContent = `${delta >= 0 ? "+" : ""}${formatMoney(delta)} since start`;
    document.getElementById("mv-realized").className = snap.realizedPnL >= 0 ? "mv-positive" : "mv-negative";
    document.getElementById("mv-realized").textContent = formatMoney(snap.realizedPnL);
    document.getElementById("mv-unrealized").className = pnlClass;
    document.getElementById("mv-unrealized").textContent = formatMoney(snap.unrealizedPnL);
    document.getElementById("mv-winrate").textContent = `${snap.winRate.toFixed(0)}%`;
    document.getElementById("mv-trades").textContent = snap.closedTrades;

    const tbody = document.querySelector("#mv-positions-table tbody");
    tbody.innerHTML = "";
    if (!snap.positions.length) {
      tbody.innerHTML = `<tr><td colspan="3" style="color:var(--muted-2);text-align:center;padding:18px">NO OPEN POSITIONS</td></tr>`;
      return;
    }
    snap.positions.forEach((p) => {
      const last = MarketVerse.getHistory(p.symbol).at(-1)?.close || p.entry;
      const diff = p.side === "long" ? last - p.entry : p.entry - last;
      const upnl = diff * p.qty * p.leverage;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><strong>${p.symbol}</strong><br><span style="color:var(--muted-2);font-size:7px">${p.side.toUpperCase()} · ${p.leverage}x</span></td><td>${p.qty}</td><td class="${upnl >= 0 ? "mv-positive" : "mv-negative"}">${upnl >= 0 ? "+" : ""}${formatMoney(upnl)}</td>`;
      tr.addEventListener("click", () => selectAsset(MarketVerse.getAssets().find((a) => a.symbol === p.symbol)));
      tbody.appendChild(tr);
    });
    bestEquity = Math.max(bestEquity, snap.equity);
  }

  function updateOrdersUI() {
    const tbody = document.querySelector("#mv-orders-table tbody");
    tbody.innerHTML = "";
    const rows = Orders.getOrders();
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="color:var(--muted-2);text-align:center;padding:18px">NO ACTIVITY YET</td></tr>`;
      return;
    }
    rows.slice(0, 30).forEach((o) => {
      const sideClass = o.side === "buy" ? "mv-positive" : "mv-negative";
      const statusClass = o.status === "filled" ? "mv-positive" : o.status === "rejected" ? "mv-negative" : "";
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${o.time}</td><td class="${sideClass}">${o.side.toUpperCase()}</td><td>${o.qty}</td><td>${o.price}</td><td class="${statusClass}">${o.status.toUpperCase()}</td>`;
      tbody.appendChild(tr);
    });
  }

  function updateProgressionUI() {
    const target = level * 100;
    const percent = Math.min(100, (xp / target) * 100);
    document.getElementById("mv-level").textContent = `LEVEL ${level}`;
    document.getElementById("mv-xp").textContent = `XP ${xp}/${target}`;
    document.getElementById("mv-level-progress").style.width = `${percent}%`;
    document.getElementById("mv-progress-label").textContent = `${levelNames[Math.min(level - 1, levelNames.length - 1)] || "Titan"} · Level ${level}`;
  }

  function gainXP(amount) {
    xp += amount;
    let leveled = false;
    while (xp >= level * 100) {
      xp -= level * 100;
      level += 1;
      leveled = true;
    }
    localStorage.setItem("mv_level", level);
    localStorage.setItem("mv_xp", xp);
    updateProgressionUI();
    if (leveled) {
      document.getElementById("mv-levelup-num").textContent = level;
      document.getElementById("mv-levelup").hidden = false;
      toast("LEVEL UP", `You reached Level ${level}. New rank: ${levelNames[Math.min(level - 1, levelNames.length - 1)] || "Titan"}.`, "success");
    }
  }

  function renderTicker() {
    const ticker = document.getElementById("mv-ticker");
    const items = MarketVerse.getAssets().map((a) => {
      const h = MarketVerse.getHistory(a.symbol);
      if (!h.length) return "";
      const last = h.at(-1).close;
      const prev = h.at(-2)?.close || last;
      const change = ((last - prev) / prev) * 100;
      return `<span class="mv-ticker-item"><b>${a.symbol}</b><span class="mv-ticker-price">${formatPrice(last)}</span><span class="${change >= 0 ? "mv-positive" : "mv-negative"}">${change >= 0 ? "+" : ""}${change.toFixed(2)}%</span></span>`;
    }).join("");
    ticker.innerHTML = `<div class="mv-ticker-track">${items}${items}</div>`;
  }

  function evaluateAchievements() {
    const snap = Portfolio.snapshot();
    const defs = [
      ["first-trade", "FIRST BLOOD", "Execute your first order.", Orders.getOrders().length >= 1],
      ["five-trades", "GETTING SERIOUS", "Reach 5 recorded orders.", Orders.getOrders().length >= 5],
      ["profit", "GREEN DAY", "Finish a position with positive P&L.", snap.winningTrades >= 1],
      ["level5", "MARKET OPERATOR", "Reach Level 5.", level >= 5],
      ["titan", "ZERO TO TITAN", "Reach Level 8.", level >= 8]
    ];
    defs.forEach(([id, title, desc, done]) => achievements.set(id, { title, desc, done }));
    renderAchievements();
  }

  function renderAchievements() {
    const root = document.getElementById("mv-achievements");
    if (!root) return;
    const defs = [
      ["first-trade", "FIRST BLOOD", "Execute your first order."],
      ["five-trades", "GETTING SERIOUS", "Reach 5 recorded orders."],
      ["profit", "GREEN DAY", "Finish a winning position."],
      ["level5", "MARKET OPERATOR", "Reach Level 5."],
      ["titan", "ZERO TO TITAN", "Reach Level 8."]
    ];
    root.innerHTML = defs.map(([id, title, desc], i) => {
      const a = achievements.get(id);
      const done = Boolean(a?.done);
      return `<div class="mv-achievement ${done ? "done" : "locked"}"><div class="mv-achievement-icon">${done ? "✓" : `0${i + 1}`}</div><div><b>${title}</b><span>${desc}</span></div></div>`;
    }).join("");
  }

  function setupHotkeys() {
    window.addEventListener("keydown", (e) => {
      if (e.target.matches("input, select, textarea")) return;
      const key = e.key.toLowerCase();
      if (key === "b") document.querySelector('input[name="side"][value="buy"]').click();
      if (key === "s") document.querySelector('input[name="side"][value="sell"]').click();
      if (key === "r") document.getElementById("mv-order-form").reset();
      if (key === "Enter") document.getElementById("mv-order-form").requestSubmit();
    });
  }

  function setupSound() {
    document.getElementById("mv-sound-toggle").addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      localStorage.setItem("mv_sound", soundEnabled ? "on" : "off");
      document.getElementById("mv-sound-toggle").textContent = soundEnabled ? "🔊" : "🔇";
      toast("Audio", soundEnabled ? "Sound cues enabled." : "Sound cues disabled.", "info");
    });
  }

  function toast(title, body, type) {
    const stack = document.getElementById("mv-toast-stack");
    const el = document.createElement("div");
    el.className = `mv-toast mv-toast-${type || "info"}`;
    el.innerHTML = `<b>${title}</b><span>${body}</span>`;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function formatMoney(n) { return `${n < 0 ? "-$" : "$"}${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
  function formatPrice(n) { return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: Number(n) < 10 ? 4 : 2, maximumFractionDigits: Number(n) < 10 ? 4 : 2 })}`; }
  function compact(n) { return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n); }

  return { init };
})();

window.addEventListener("DOMContentLoaded", Game.init);
