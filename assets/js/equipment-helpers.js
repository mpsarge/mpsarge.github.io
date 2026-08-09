/**
 * Shared lookups into EQUIPMENT for the handful of items the Setup Wizard and
 * Design Checklist need to reference by identity (not just by category), plus
 * small helpers for "pick one of these mutually-exclusive line items" UI.
 */
import { EQUIPMENT } from './data.js';

const find = (pred) => EQUIPMENT.find(pred);

export const ANTENNA_APERTURE_IDS = EQUIPMENT.filter(
  (e) => e.category === 'Antenna & Tracking Systems' && !e.item.startsWith('Quick-Change Feed Pallet Set')
).map((e) => e.id);

export const KEY_ITEMS = {
  avlDish: find((e) => e.item.startsWith('Mechanically-Positioned Dish')),
  feedPallets: find((e) => e.item.startsWith('Quick-Change Feed Pallet Set')),
  sBand: find((e) => e.item.startsWith('Dedicated S-Band')),
  radomeRigid: find((e) => e.item.startsWith('Rigid Self-Supporting')),
  radomeAir: find((e) => e.item.startsWith('Air-Supported')),
  radomeCompressor: find((e) => e.item.startsWith('High-CFM Inflation Compressor')),
  radomeSpaceFrame: find((e) => e.item.startsWith('Rigid Space-Frame Radome')),
  shelterFabric: find((e) => e.item.startsWith('Expandable Fabric Shelter')),
  shelterRigid: find((e) => e.item.startsWith('Rigid-Wall Expandable Shelter')),
  ecpTent: find((e) => e.item.startsWith('Entry Control Point Module - tent-integrated')),
  ecpIsu: find((e) => e.item.startsWith('Entry Control Point Module - ISU-90')),
  ats: find((e) => e.item.startsWith('Automatic Transfer Switch')),
  grounding: find((e) => e.item.startsWith('Antenna/Mast Grounding')),
  chairs: find((e) => e.item === 'Folding Field Chair'),
};

export function sumQty(ids, qtyOf) {
  return ids.reduce((s, id) => s + qtyOf(id), 0);
}

export function antennaApertureCount(qtyOf) {
  return sumQty(ANTENNA_APERTURE_IDS, qtyOf);
}

/** Set `chosenId`'s quantity and zero every other id in `groupIds`. */
export function chooseExclusive(store, groupIds, chosenId, qty = 1) {
  for (const id of groupIds) {
    if (!id) continue;
    store.setQty(id, id === chosenId ? qty : 0);
  }
}
