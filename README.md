# MarketVerse: Zero to Titan

Ultra-max trading game simulator for GitHub Pages.

## Features

- Fictional markets: crypto, stocks, ETFs, commodities, forex
- Market regimes: Bull, Bear, Sideways, Panic
- Live price simulation with candles and volume
- Market, limit, and stop orders
- Leverage, margin, liquidation
- Portfolio with P&L, equity, margin stats
- XP and level system
- News/events feed

## Run on GitHub Pages

1. Create repo: `marketverse-zero-to-titan`
2. Add all files from this project.
3. Commit and push to `main`.
4. In GitHub:
   - Settings → Pages → Deploy from branch
   - Branch: `main`
   - Folder: `/` (root)
5. Open the GitHub Pages URL and start trading.

## Optional local server

```bash
cd python
pip install -r requirements.txt
python server.py
