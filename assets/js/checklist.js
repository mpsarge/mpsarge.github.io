/**
 * Derives Design Checklist status from live app state wherever the tool can
 * verify it automatically; everything else requires explicit user attestation.
 * This is the mechanism that keeps a planner from forgetting one of the
 * workbook's "key engineering flags."
 */
import { CHECKLIST_ITEMS, EQUIPMENT } from './data.js';
import { suggestedLoadPlan, optimizedLoadPlan } from './packing.js';
import { thermalBudget } from './power.js';
import { ANTENNA_APERTURE_IDS, KEY_ITEMS, sumQty, antennaApertureCount } from './equipment-helpers.js';

const RADOME_IDS = EQUIPMENT.filter((e) => e.category === 'Radome Systems' && !e.item.includes('Compressor')).map(
  (e) => e.id
);

export function evaluateChecklist(state) {
  const qtyOf = (id) => state.qty[id] ?? 0;
  const plan = state.packingMode === 'optimized' ? optimizedLoadPlan(EQUIPMENT, qtyOf) : suggestedLoadPlan(EQUIPMENT, qtyOf);
  const budget = thermalBudget(state.power);

  const antennaCount = antennaApertureCount(qtyOf);
  const sBandCovered = KEY_ITEMS.sBand ? qtyOf(KEY_ITEMS.sBand.id) > 0 : false;
  const radomeCount = sumQty(RADOME_IDS, qtyOf);
  const atsIncluded = KEY_ITEMS.ats ? qtyOf(KEY_ITEMS.ats.id) > 0 : false;
  const groundingCount = KEY_ITEMS.grounding ? qtyOf(KEY_ITEMS.grounding.id) : 0;
  const chairCount = KEY_ITEMS.chairs ? qtyOf(KEY_ITEMS.chairs.id) : 0;
  const occupancy = budget.zoneA.occupancy;

  const selectedGen = budget.generators.find((g) => g.id === state.power.selectedGeneratorId) ?? budget.generators[0];
  const zoneASelected =
    budget.zoneA.candidates.find((c) => c.id === state.power.zoneASelectedId) ?? budget.zoneA.candidates[0];
  const zoneBSelected =
    budget.zoneB.candidates.find((c) => c.id === state.power.zoneBSelectedId) ?? budget.zoneB.candidates[0];

  const anyOverCapacity = plan.containers.some((c) => c.status === 'OVER CAPACITY');

  const autoStatus = {
    'antenna-architecture': { ok: antennaCount >= 2, detail: `${antennaCount} antenna aperture(s) selected (threshold 2 / objective 3).` },
    's-band-gap': { ok: sBandCovered, detail: sBandCovered ? 'S-band module selected.' : 'No S-band-capable item selected yet.' },
    'radome-choice': { ok: radomeCount > 0, detail: radomeCount > 0 ? `${radomeCount} radome(s) selected.` : 'No radome selected yet.' },
    'hvac-basis': { ok: true, detail: 'Enforced by the calculator: Zone A always uses sensor typical draw, Zone B always uses sensor max draw.' },
    'ecu-margin': {
      ok: zoneASelected?.level === 'ok' && zoneBSelected?.level === 'ok',
      detail: `Zone A: ${zoneASelected?.statusLabel ?? 'n/a'}. Zone B: ${zoneBSelected?.statusLabel ?? 'n/a'}.`,
    },
    'generator-sizing': {
      ok: selectedGen?.level === 'ok',
      detail: selectedGen ? `${selectedGen.label}: ${selectedGen.statusLabel} (${(selectedGen.loading * 100).toFixed(0)}% loading).` : 'No generator selected.',
    },
    'ats-included': { ok: atsIncluded, detail: atsIncluded ? 'ATS quantity >= 1.' : 'ATS quantity is 0.' },
    'grounding-coverage': {
      ok: antennaCount === 0 ? true : groundingCount >= antennaCount,
      detail: `${groundingCount} grounding kit(s) vs. ${antennaCount} antenna pedestal(s).`,
    },
    'occupancy-sizing': {
      ok: chairCount === occupancy,
      detail: `${chairCount} chair(s) provisioned for a ${occupancy}-person max simultaneous occupancy.`,
    },
    'container-capacity': {
      ok: !anyOverCapacity,
      detail: anyOverCapacity ? 'One or more containers are over capacity.' : 'All packed containers are within limits.',
    },
  };

  return CHECKLIST_ITEMS.map((def) => {
    if (def.kind === 'attest') {
      return { ...def, ok: !!state.attestations[def.id], detail: null };
    }
    const s = autoStatus[def.id] ?? { ok: false, detail: 'Not yet computed.' };
    return { ...def, ...s };
  });
}

export function checklistProgress(state) {
  const items = evaluateChecklist(state);
  const done = items.filter((i) => i.ok).length;
  return { done, total: items.length, items };
}
