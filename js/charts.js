// Canvas market chart with grid, candles, volume bars and moving average.
const Charts = (() => {
  let canvas;
  let ctx;
  let currentSymbol = null;

  function init() {
    canvas = document.getElementById("mv-chart");
    ctx = canvas.getContext("2d");
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    canvas.addEventListener("mousemove", drawCrosshair);
    canvas.addEventListener("mouseleave", () => { const cross = document.getElementById("mv-chart-crosshair"); if (cross) cross.hidden = true; });
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    render();
  }

  function setSymbol(symbol) { currentSymbol = symbol; render(); }

  function drawCrosshair(e) {
    const cross = document.getElementById("mv-chart-crosshair");
    if (!cross || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    cross.hidden = false;
    cross.style.left = `${e.clientX - rect.left}px`;
    cross.style.top = `${e.clientY - rect.top}px`;
  }

  function render() {
    if (!canvas || !ctx || !currentSymbol) return;
    const history = MarketVerse.getHistory(currentSymbol);
    if (!history.length) return;

    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#030711";
    ctx.fillRect(0, 0, width, height);

    const visible = history.slice(-120);
    const pad = { top: 16, right: 62, bottom: 46, left: 12 };
    const chartW = width - pad.left - pad.right;
    const priceH = height - pad.top - pad.bottom - 42;
    const volumeTop = pad.top + priceH + 11;
    const volumeH = 30;
    const prices = visible.flatMap((c) => [c.high, c.low]);
    let maxPrice = Math.max(...prices);
    let minPrice = Math.min(...prices);
    const range = Math.max(0.0001, maxPrice - minPrice);
    const extra = range * 0.08;
    maxPrice += extra;
    minPrice = Math.max(0, minPrice - extra);

    // Grid and price ladder.
    ctx.strokeStyle = "rgba(127,166,201,.08)";
    ctx.lineWidth = 1;
    ctx.font = '8px "Space Mono", monospace';
    ctx.fillStyle = "#526981";
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + (priceH / 5) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
      const value = maxPrice - (range + extra * 2) * (i / 5);
      ctx.fillText(value.toLocaleString(undefined, { maximumFractionDigits: value < 10 ? 4 : 2 }), width - pad.right + 8, y + 3);
    }
    for (let i = 0; i < 6; i++) {
      const x = pad.left + (chartW / 5) * i;
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + priceH + volumeH + 7); ctx.stroke();
    }

    const maxVolume = Math.max(...visible.map((c) => c.volume), 1);
    const step = chartW / visible.length;
    const candleW = Math.max(2, Math.min(9, step * 0.64));
    const toY = (price) => pad.top + priceH * (1 - (price - minPrice) / Math.max(0.00001, maxPrice - minPrice));

    // Volume.
    visible.forEach((c, i) => {
      const x = pad.left + i * step + step / 2;
      const vh = (c.volume / maxVolume) * volumeH;
      ctx.fillStyle = c.close >= c.open ? "rgba(76,227,138,.28)" : "rgba(255,97,117,.28)";
      ctx.fillRect(x - candleW / 2, volumeTop + volumeH - vh, candleW, vh);
    });

    // Candlesticks.
    visible.forEach((c, i) => {
      const x = pad.left + i * step + step / 2;
      const openY = toY(c.open);
      const closeY = toY(c.close);
      const highY = toY(c.high);
      const lowY = toY(c.low);
      const up = c.close >= c.open;
      ctx.strokeStyle = up ? "#4ce38a" : "#ff6175";
      ctx.fillStyle = up ? "#4ce38a" : "#ff6175";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, highY); ctx.lineTo(x, lowY); ctx.stroke();
      ctx.fillRect(x - candleW / 2, Math.min(openY, closeY), candleW, Math.max(2, Math.abs(closeY - openY)));
    });

    // Moving average.
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    visible.forEach((c, i) => {
      const start = Math.max(0, i - 9);
      const slice = visible.slice(start, i + 1);
      const avg = slice.reduce((sum, item) => sum + item.close, 0) / slice.length;
      const x = pad.left + i * step + step / 2;
      const y = toY(avg);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Last-price marker.
    const last = visible.at(-1).close;
    const lastY = toY(last);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(57,245,197,.35)";
    ctx.beginPath(); ctx.moveTo(pad.left, lastY); ctx.lineTo(pad.left + chartW, lastY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#39f5c5";
    ctx.fillRect(width - pad.right + 2, lastY - 9, pad.right - 5, 18);
    ctx.fillStyle = "#03110d";
    ctx.font = '700 8px "Space Mono", monospace';
    ctx.fillText(last.toLocaleString(undefined, { maximumFractionDigits: last < 10 ? 4 : 2 }), width - pad.right + 6, lastY + 3);

    ctx.fillStyle = "#526981";
    ctx.font = '700 7px "Space Mono", monospace';
    ctx.fillText("VOL", pad.left, volumeTop + volumeH + 13);
    ctx.fillText("MA(10)", pad.left + 30, volumeTop + volumeH + 13);
  }

  return { init, setSymbol, render };
})();
