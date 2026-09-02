# MarketVerse: Zero to Titan 🚀

**MarketVerse** is a fictional, browser-based trading game where you start with **$100,000 in paper capital** and try to climb from Rookie to Titan.

It is designed to feel like a compact trading terminal *and* a game: live simulated prices, market regimes, news shocks, leveraged positions, risk exits, XP, achievements, and responsive UI — all without external APIs or a database.

## What changed in the Titan Edition

- ⚡ Premium responsive trader HUD with live ticker
- 📈 Responsive candlestick chart with grid, volume bars, price ladder and MA(10)
- 🧠 Bull / Bear / Sideways / Panic market regimes
- 💼 Portfolio equity, buying power, margin and unrealized/realized P&L
- 🎯 Market, limit and stop order simulation
- 🛡️ Stop-loss and take-profit exits
- 🔄 Opposing orders close positions and can reverse them instead of blindly stacking
- 📰 Live fictional market-news feed with impact levels
- 🆙 XP + persistent level progression in the browser
- 🏆 Milestones / achievements
- ⌨️ Keyboard controls: `B` buy, `S` sell, `R` reset ticket, `Enter` execute
- 🔊 Lightweight WebAudio execution/rejection cues with a sound toggle
- 🔎 Asset search + category filters
- 📱 Mobile/tablet/desktop layouts

## Game loop

**Scan → analyze regime → choose an asset → size risk → execute → manage the position → react to news → level up.**

All prices, assets and events are fictional. This is a simulation, not a brokerage or financial-data product.

## Run on GitHub Pages

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Choose **Deploy from branch**.
4. Select `main` and `/ (root)`.
5. Open the generated GitHub Pages URL.

The front end is static and uses relative paths, so it works directly from GitHub Pages.

## Optional local server

```bash
cd python
pip install -r requirements.txt
python server.py
```

Then open the local URL printed by the server.

## Project structure

```text
.
├── index.html
├── css/
│   └── styles.css
├── data/
│   ├── assets.json
│   └── events.json
├── js/
│   ├── app.js
│   ├── charts.js
│   ├── market.js
│   ├── news.js
│   ├── orders.js
│   ├── portfolio.js
│   └── sounds.js
└── python/
    ├── market_engine.py
    ├── requirements.txt
    └── server.py
```
