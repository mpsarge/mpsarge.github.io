/**
 * Shared lookups into EQUIPMENT for the handful of items the Setup Wizard and
 * Design Checklist need to reference by identity (not just by category), plus
 * small helpers for "pick one of these mutually-exclusive line items" UI.
 */
import { EQUIPMENT } from './data.js';

// Guards every predicate against a row with a missing/non-string `item` -
// live-synced data is validated at the database level (schema.sql declares
// `item text not null`), but this module's lookups run eagerly at import
// time, before any view exists to show an error, so a bad row here must
// degrade to "not found" rather than throw and take the whole app down.
const startsWith = (str, prefix) => typeof str === 'string' && str.startsWith(prefix);
const find = (pred) => EQUIPMENT.find(pred);

export const ANTENNA_APERTURE_IDS = EQUIPMENT.filter(
  (e) => e.category === 'Antenna & Tracking Systems' && !startsWith(e.item, 'Quick-Change Feed Pallet Set')
).map((e) => e.id);

export const KEY_ITEMS = {
  avlDish: find((e) => startsWith(e.item, 'Mechanically-Positioned Dish')),
  feedPallets: find((e) => startsWith(e.item, 'Quick-Change Feed Pallet Set')),
  sBand: find((e) => startsWith(e.item, 'Dedicated S-Band')),
  radomeRigid: find((e) => startsWith(e.item, 'Rigid Self-Supporting')),
  radomeAir: find((e) => startsWith(e.item, 'Air-Supported')),
  radomeCompressor: find((e) => startsWith(e.item, 'High-CFM Inflation Compressor')),
  radomeSpaceFrame: find((e) => startsWith(e.item, 'Rigid Space-Frame Radome')),
  shelterFabric: find((e) => startsWith(e.item, 'Expandable Fabric Shelter')),
  shelterRigid: find((e) => startsWith(e.item, 'Rigid-Wall Expandable Shelter')),
  ecpTent: find((e) => startsWith(e.item, 'Entry Control Point Module - tent-integrated')),
  ecpIsu: find((e) => startsWith(e.item, 'Entry Control Point Module - ISU-90')),
  ats: find((e) => startsWith(e.item, 'Automatic Transfer Switch')),
  grounding: find((e) => startsWith(e.item, 'Antenna/Mast Grounding')),
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
