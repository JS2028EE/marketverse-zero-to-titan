// Main app wiring, UI, XP/levels

const AppEvents = (() => {
  const listeners = {
    marketTick: []
  };

  function onMarketTick() {
    listeners.marketTick.forEach((fn) => fn());
  }

  function subscribe(event, fn) {
    if (listeners[event]) listeners[event].push(fn);
  }

  return {
    onMarketTick,
    subscribe
  };
})();

const Game = (() => {
  let selectedSymbol = null;
  let level = 1;
  let xp = 0;

  function init() {
    const clockEl = document.getElementById("mv-clock");
    setInterval(() => {
      clockEl.textContent = new Date().toLocaleTimeString();
    }, 1000);

    MarketVerse.loadAssets().then((assets) => {
      renderAssetsTable(assets);
      selectedSymbol = assets[0].symbol;
      document.getElementById("mv-selected-asset").textContent =
        `${selectedSymbol} — ${assets[0].name}`;
      Charts.init();
      Charts.setSymbol(selectedSymbol);
      updateRegimeUI();
      updatePortfolioUI();
      updateOrdersUI();
    });

    NewsEngine.loadEvents().then(() => NewsEngine.init());

    setupFilters();
    setupOrderForm();

    AppEvents.subscribe("marketTick", () => {
      Charts.render();
      updateAssetsTable();
      updateRegimeUI();
      updatePortfolioUI();
      updateOrdersUI();
      gainXP(1);
    });

    MarketVerse.start();
  }

  function setupFilters() {
    const buttons = document.querySelectorAll(".mv-filter-btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("mv-filter-active"));
        btn.classList.add("mv-filter-active");
        const filter = btn.dataset.filter;
        const assets = MarketVerse.getAssets();
        renderAssetsTable(
          filter === "all"
            ? assets
            : assets.filter((a) => a.type === filter)
        );
      });
    });
  }

  function renderAssetsTable(assets) {
    const tbody = document.querySelector("#mv-assets-table tbody");
    tbody.innerHTML = "";
    assets.forEach((a) => {
      const hist = MarketVerse.getHistory(a.symbol);
      const last = hist[hist.length - 1].close;
      const prev = hist.length > 1 ? hist[hist.length - 2].close : last;
      const change = ((last - prev) / prev) * 100;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${a.symbol}</td>
        <td>${a.type}</td>
        <td>${last.toFixed(2)}</td>
        <td class="${change >= 0 ? "mv-positive" : "mv-negative"}">
          ${change >= 0 ? "+" : ""}${change.toFixed(2)}%
        </td>
        <td>${(a.spread * 100).toFixed(2)}%</td>
      `;
      tr.addEventListener("click", () => {
        selectedSymbol = a.symbol;
        document.getElementById("mv-selected-asset").textContent =
          `${a.symbol} — ${a.name}`;
        Charts.setSymbol(selectedSymbol);
      });
      tbody.appendChild(tr);
    });
  }

  function updateAssetsTable() {
    const filterBtn = document.querySelector(".mv-filter-active");
    const filter = filterBtn ? filterBtn.dataset.filter : "all";
    const assets = MarketVerse.getAssets();
    renderAssetsTable(
      filter === "all"
        ? assets
        : assets.filter((a) => a.type === filter)
    );
  }

  function updateRegimeUI() {
    document.getElementById("mv-regime").textContent =
      `Regime: ${MarketVerse.getRegime()}`;
    document.getElementById("mv-volatility").textContent =
      `Volatility: ${(MarketVerse.getVolatility() * 100).toFixed(2)}%`;
  }

  function setupOrderForm() {
    const form = document.getElementById("mv-order-form");
    const qtyEl = document.getElementById("mv-order-qty");
    const priceEl = document.getElementById("mv-order-price");
    const sideEl = document.getElementById("mv-order-side");
    const typeEl = document.getElementById("mv-order-type");
    const levEl = document.getElementById("mv-order-leverage");
    const costEl = document.getElementById("mv-order-cost");
    const feeEl = document.getElementById("mv-order-fee");
    const bpEl = document.getElementById("mv-buying-power");

    function recalc() {
      const hist = MarketVerse.getHistory(selectedSymbol);
      if (!hist.length) return;
      const last = hist[hist.length - 1].close;
      const qty = Number(qtyEl.value) || 0;
      const notional = last * qty;
      const fee = notional * 0.0005;
      costEl.textContent = `$${notional.toFixed(2)}`;
      feeEl.textContent = `$${fee.toFixed(2)}`;
      bpEl.textContent = `$${Portfolio.getBuyingPower().toFixed(2)}`;
    }

    ["input", "change"].forEach((ev) => {
      qtyEl.addEventListener(ev, recalc);
      priceEl.addEventListener(ev, recalc);
      sideEl.addEventListener(ev, recalc);
      typeEl.addEventListener(ev, recalc);
      levEl.addEventListener(ev, recalc);
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const qty = Number(qtyEl.value);
      if (!qty || qty <= 0) return;

      const order = {
        symbol: selectedSymbol,
        side: sideEl.value,
        type: typeEl.value,
        qty,
        price: Number(priceEl.value) || null,
        leverage: Number(levEl.value) || 1
      };

      const res = Orders.place(order);
      if (res.ok) {
        Sounds.playExecute();
        gainXP(10);
      } else {
        Sounds.playReject();
      }
      updatePortfolioUI();
      updateOrdersUI();
      recalc();
    });

    recalc();
  }

  function updatePortfolioUI() {
    const snap = Portfolio.snapshot();
    document.getElementById("mv-cash").textContent =
      `$${snap.cash.toFixed(2)}`;
    document.getElementById("mv-equity").textContent =
      `$${snap.equity.toFixed(2)}`;
    document.getElementById("mv-margin-used").textContent =
      `$${snap.marginUsed.toFixed(2)}`;
    document.getElementById("mv-maint-margin").textContent =
      `$${snap.maintMargin.toFixed(2)}`;
    document.getElementById("mv-networth").textContent =
      `Net Worth: $${snap.equity.toFixed(2)}`;

    const tbody = document.querySelector("#mv-positions-table tbody");
    tbody.innerHTML = "";
    snap.positions.forEach((p) => {
      const lastHist = MarketVerse.getHistory(p.symbol);
      const last = lastHist.length
        ? lastHist[lastHist.length - 1].close
        : p.entry;
      const diff =
        p.side === "long" ? last - p.entry : p.entry - last;
      const upnl = diff * p.qty * p.leverage;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.symbol}</td>
        <td>${p.side}</td>
        <td>${p.qty}</td>
        <td>${p.entry.toFixed(2)}</td>
        <td>${last.toFixed(2)}</td>
        <td class="${upnl >= 0 ? "mv-positive" : "mv-negative"}">
          ${upnl >= 0 ? "+" : ""}${upnl.toFixed(2)}
        </td>
        <td>${p.leverage}x</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function updateOrdersUI() {
    const tbody = document.querySelector("#mv-orders-table tbody");
    tbody.innerHTML = "";
    Orders.getOrders().forEach((o) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${o.time}</td>
        <td>${o.symbol}</td>
        <td>${o.side}</td>
        <td>${o.type}</td>
        <td>${o.qty}</td>
        <td>${o.price}</td>
        <td>${o.status}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function gainXP(amount) {
    xp += amount;
    const levelBefore = level;
    while (xp >= level * 100) {
      xp -= level * 100;
      level++;
    }
    document.getElementById("mv-level").textContent =
      `Level ${level}`;
    document.getElementById("mv-xp").textContent =
      `XP ${xp}/${level * 100}`;
    if (level !== levelBefore) {
      console.log(`LEVEL UP → ${level}`);
    }
  }

  return {
    init
  };
})();

window.addEventListener("DOMContentLoaded", () => {
  Game.init();
});
