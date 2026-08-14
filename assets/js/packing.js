/**
 * Container packing engine.
 * Mirrors the workbook's Container Load Plan tab (SUMIF-by-assigned-container,
 * with an OVER CAPACITY flag), plus an optional first-fit-decreasing optimizer
 * that repacks selected items to minimize the number of ISU-90s needed.
 */
import { CONTAINERS, NON_ISU_LABELS, STRUCTURAL_LABELS, CONTAINER_SPEC } from './data.js';

const CAP_WEIGHT = CONTAINER_SPEC.payloadCapacityLb;
const CAP_VOLUME = CONTAINER_SPEC.volumeCapacityCuFt;

export function lineTotals(item, qty) {
  return {
    weight: item.unitWeight * qty,
    volume: item.unitVolume * qty,
  };
}

function isStructural(item) {
  return STRUCTURAL_LABELS.includes(item.container);
}
function isNonIsu(item) {
  return NON_ISU_LABELS.includes(item.container);
}
function isContainerPackable(item) {
  return item.container.startsWith('Container ');
}

/**
 * Build the "suggested" load plan: each item goes into its workbook-default
 * container (or the non-ISU / structural buckets), exactly like the original
 * SUMIF-based tab. Returns per-container manifests + totals.
 */
export function suggestedLoadPlan(equipment, qtyOf) {
  const byContainer = new Map(CONTAINERS.map((c) => [c.label, { ...c, items: [], weight: 0, volume: 0 }]));
  const nonIsu = { items: [], weight: 0, volume: 0 };
  const structural = { items: [] };

  for (const item of equipment) {
    const qty = qtyOf(item.id);
    if (qty <= 0) continue;
    const { weight, volume } = lineTotals(item, qty);

    if (isStructural(item)) {
      structural.items.push({ item, qty, weight, volume });
      continue;
    }
    if (isNonIsu(item)) {
      nonIsu.items.push({ item, qty, weight, volume });
      nonIsu.weight += weight;
      nonIsu.volume += volume;
      continue;
    }
    const bucket = byContainer.get(item.container);
    if (bucket) {
      bucket.items.push({ item, qty, weight, volume });
      bucket.weight += weight;
      bucket.volume += volume;
    } else {
      // Defensive fallback - unknown container label, treat as non-ISU.
      nonIsu.items.push({ item, qty, weight, volume });
      nonIsu.weight += weight;
      nonIsu.volume += volume;
    }
  }

  const containers = [...byContainer.values()].map((c) => ({
    ...c,
    weightLimit: CAP_WEIGHT,
    volumeLimit: CAP_VOLUME,
    weightMargin: CAP_WEIGHT - c.weight,
    volumeMargin: CAP_VOLUME - c.volume,
    status: c.weight > CAP_WEIGHT || c.volume > CAP_VOLUME ? 'OVER CAPACITY' : 'OK',
  }));

  const fleetTotal = containers.reduce(
    (acc, c) => ({ weight: acc.weight + c.weight, volume: acc.volume + c.volume }),
    { weight: 0, volume: 0 }
  );

  return { containers, nonIsu, structural, fleetTotal };
}

/**
 * First-fit-decreasing bin packing across every ISU-90-eligible selected item,
 * ignoring the workbook's category-based container assignment, to find the
 * minimum number of ISU-90s that fit the current selection. Non-ISU and
 * structural items are excluded (they never go in an ISU-90) and reported
 * alongside for context.
 */
export function optimizedLoadPlan(equipment, qtyOf) {
  const blocks = [];
  const nonIsu = { items: [], weight: 0, volume: 0 };
  const structural = { items: [] };

  for (const item of equipment) {
    const qty = qtyOf(item.id);
    if (qty <= 0) continue;
    const { weight, volume } = lineTotals(item, qty);

    if (isStructural(item)) {
      structural.items.push({ item, qty, weight, volume });
      continue;
    }
    if (!isContainerPackable(item)) {
      nonIsu.items.push({ item, qty, weight, volume });
      nonIsu.weight += weight;
      nonIsu.volume += volume;
      continue;
    }
    blocks.push({ item, qty, weight, volume });
  }

  // Sort largest "load fraction" first (whichever dimension is more constraining).
  blocks.sort((a, b) => {
    const fa = Math.max(a.weight / CAP_WEIGHT, a.volume / CAP_VOLUME);
    const fb = Math.max(b.weight / CAP_WEIGHT, b.volume / CAP_VOLUME);
    return fb - fa;
  });

  const bins = [];
  for (const block of blocks) {
    let placed = false;
    for (const bin of bins) {
      if (bin.weight + block.weight <= CAP_WEIGHT && bin.volume + block.volume <= CAP_VOLUME) {
        bin.items.push(block);
        bin.weight += block.weight;
        bin.volume += block.volume;
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Open a new bin. If the block alone exceeds capacity, it still goes in
      // its own bin, flagged OVER CAPACITY - better to surface it than drop it.
      bins.push({ items: [block], weight: block.weight, volume: block.volume });
    }
  }

  const containers = bins.map((bin, i) => ({
    id: `opt-${i + 1}`,
    label: `Optimized Container ${i + 1}`,
    items: bin.items,
    weight: bin.weight,
    volume: bin.volume,
    weightLimit: CAP_WEIGHT,
    volumeLimit: CAP_VOLUME,
    weightMargin: CAP_WEIGHT - bin.weight,
    volumeMargin: CAP_VOLUME - bin.volume,
    status: bin.weight > CAP_WEIGHT || bin.volume > CAP_VOLUME ? 'OVER CAPACITY' : 'OK',
  }));

  const fleetTotal = containers.reduce(
    (acc, c) => ({ weight: acc.weight + c.weight, volume: acc.volume + c.volume }),
    { weight: 0, volume: 0 }
  );

  return { containers, nonIsu, structural, fleetTotal, containerCount: containers.length };
}
