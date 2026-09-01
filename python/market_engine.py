"""
Optional advanced market engine (offline / dev use).

This does NOT run on GitHub Pages; it's for local experiments.
"""

import random
import math
from dataclasses import dataclass


@dataclass
class AssetState:
  symbol: str
  price: float
  regime: str
  volatility: float


REGIMES = ["Bull", "Bear", "Sideways", "Panic"]


def next_regime(current: str) -> str:
  if random.random() < 0.05:
    return random.choice(REGIMES)
  return current


def drift_for_regime(regime: str) -> float:
  return {
    "Bull": 0.0008,
    "Bear": -0.0009,
    "Sideways": 0.0,
    "Panic": -0.0015
  }.get(regime, 0.0)


def step_asset(state: AssetState) -> AssetState:
  regime = next_regime(state.regime)
  drift = drift_for_regime(regime)
  shock = (random.random() - 0.5) * 2 * state.volatility
  new_price = max(0.01, state.price * (1 + drift + shock))
  return AssetState(
    symbol=state.symbol,
    price=new_price,
    regime=regime,
    volatility=state.volatility
  )


def simulate_path(symbol: str, start_price: float, steps: int = 500):
  state = AssetState(symbol=symbol, price=start_price,
                     regime="Sideways", volatility=0.02)
  path = []
  for _ in range(steps):
    state = step_asset(state)
    path.append(
      {"price": state.price, "regime": state.regime}
    )
  return path


if __name__ == "__main__":
  path = simulate_path("NOVA", 184.72)
  for p in path[:20]:
    print(p)
