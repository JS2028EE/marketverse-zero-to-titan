// Simple candlestick chart renderer

const Charts = (() => {
  let canvas, ctx;
  let currentSymbol = null;

  function init() {
    canvas = document.getElementById("mv-chart");
    ctx = canvas.getContext("2d");
  }

  function setSymbol(symbol) {
    currentSymbol = symbol;
    render();
  }

  function render() {
    if (!canvas || !ctx || !currentSymbol) return;
    const history = MarketVerse.getHistory(currentSymbol);
    if (!history.length) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const padding = 20;
    const w = canvas.width - padding * 2;
    const h = canvas.height - padding * 2;

    const maxPrice = Math.max(...history.map((c) => c.high));
    const minPrice = Math.min(...history.map((c) => c.low));

    const candleWidth = Math.max(3, w / history.length);

    history.forEach((candle, i) => {
      const x = padding + i * candleWidth;
      const openY =
        padding +
        h * (1 - (candle.open - minPrice) / (maxPrice - minPrice));
      const closeY =
        padding +
        h * (1 - (candle.close - minPrice) / (maxPrice - minPrice));
      const highY =
        padding +
        h * (1 - (candle.high - minPrice) / (maxPrice - minPrice));
      const lowY =
        padding +
        h * (1 - (candle.low - minPrice) / (maxPrice - minPrice));

      const isUp = candle.close >= candle.open;
      ctx.strokeStyle = isUp ? "#2ecc71" : "#e74c3c";
      ctx.fillStyle = isUp ? "#2ecc71" : "#e74c3c";

      // wick
      ctx.beginPath();
      ctx.moveTo(x + candleWidth / 2, highY);
      ctx.lineTo(x + candleWidth / 2, lowY);
      ctx.stroke();

      // body
      const bodyTop = Math.min(openY, closeY);
      const bodyBottom = Math.max(openY, closeY);
      ctx.fillRect(
        x,
        bodyTop,
        candleWidth - 1,
        Math.max(2, bodyBottom - bodyTop)
      );
    });
  }

  return {
    init,
    setSymbol,
    render
  };
})();
