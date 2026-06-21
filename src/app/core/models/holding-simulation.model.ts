import { Holding } from './holding.model';

export interface HoldingSimulation {
  enabled: boolean;
  additionalShares: number;
}

export const DEFAULT_ADDITIONAL_SHARES = 10;

export function applySimulationToHolding(holding: Holding, sim: HoldingSimulation): Holding {
  if (!sim.enabled || sim.additionalShares <= 0) {
    return holding;
  }

  const totalShares = holding.shares + sim.additionalShares;
  const weightedPrice =
    (holding.purchasePrice * holding.shares + holding.currentPrice * sim.additionalShares) /
    totalShares;

  return { ...holding, shares: totalShares, purchasePrice: weightedPrice };
}

export function isSimulationActive(sim: HoldingSimulation | undefined): boolean {
  return !!sim?.enabled && sim.additionalShares > 0;
}
