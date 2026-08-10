import { EQUIPMENT, CONTAINER_SPEC } from '../data.js';
import { suggestedLoadPlan, optimizedLoadPlan } from '../packing.js';
import { fmtLb, fmtVol, fmtPct, clamp01, escapeHtml } from '../format.js';
import { suggestCorrectionUrl } from '../github-issue.js';

function barClass(frac) {
  if (frac > 1) return 'danger';
  if (frac > 0.85) return 'warn';
  return '';
}

function containerCardHtml(c) {
  const wFrac = clamp01(c.weight / c.weightLimit);
  const vFrac = clamp01(c.volume / c.volumeLimit);
  const overClass = c.status === 'OVER CAPACITY' ? 'over' : '';
  const pillClass = c.status === 'OVER CAPACITY' ? 'pill-danger' : 'pill-ok';
  return `
    <div class="container-card ${overClass}">
      <div class="container-card__head">
        <h3>${escapeHtml(c.label)}</h3>
        <span class="pill ${pillClass}">${c.status}</span>
      </div>
      ${c.role ? `<div style="color:var(--silver-700);font-size:11.5px;">${escapeHtml(c.role)}</div>` : ''}
      <div class="bar-label"><span>Weight</span><span>${fmtLb(c.weight)} / ${fmtLb(c.weightLimit)}</span></div>
      <div class="bar"><div class="bar__fill ${barClass(c.weight / c.weightLimit)}" style="width:${Math.min(100, wFrac * 100)}%"></div></div>
      <div class="bar-label" style="margin-top:8px;"><span>Volume</span><span>${fmtVol(c.volume)} / ${fmtVol(c.volumeLimit)}</span></div>
      <div class="bar"><div class="bar__fill ${barClass(c.volume / c.volumeLimit)}" style="width:${Math.min(100, vFrac * 100)}%"></div></div>
      ${
        c.items.length
          ? `<ul>${c.items
              .map((li) => `<li><span>${escapeHtml(li.item.item)} &times;${li.qty}</span><span>${fmtLb(li.weight)}</span></li>`)
              .join('')}</ul>`
          : '<p class="empty-note">No items assigned.</p>'
      }
    </div>
  `;
}

function renderPlan(el, store) {
  const qtyOf = (id) => store.qtyOf(id);
  const mode = store.state.packingMode;
  const plan = mode === 'optimized' ? optimizedLoadPlan(EQUIPMENT, qtyOf) : suggestedLoadPlan(EQUIPMENT, qtyOf);

  const totalLimit = {
    weight: plan.containers.length * CONTAINER_SPEC.payloadCapacityLb,
    volume: plan.containers.length * CONTAINER_SPEC.volumeCapacityCuFt,
  };

  el.innerHTML = `
    <div class="grid grid--3">
      ${plan.containers.map(containerCardHtml).join('')}
    </div>

    <div class="card" style="margin-top:16px; background: var(--panel-raised);">
      <h3 style="margin-bottom:8px;">Fleet Total (${plan.containers.length} ISU-90${plan.containers.length === 1 ? '' : 's'})</h3>
      <div class="grid grid--2">
        <div>
          <div class="bar-label"><span>Weight</span><span>${fmtLb(plan.fleetTotal.weight)} / ${fmtLb(totalLimit.weight)}</span></div>
          <div class="bar"><div class="bar__fill" style="width:${Math.min(100, clamp01(plan.fleetTotal.weight / totalLimit.weight) * 100)}%"></div></div>
        </div>
        <div>
          <div class="bar-label"><span>Volume</span><span>${fmtVol(plan.fleetTotal.volume)} / ${fmtVol(totalLimit.volume)}</span></div>
          <div class="bar"><div class="bar__fill" style="width:${Math.min(100, clamp01(plan.fleetTotal.volume / totalLimit.volume) * 100)}%"></div></div>
        </div>
      </div>
    </div>

    ${
      plan.nonIsu.items.length
        ? `<div class="card" style="margin-top:16px;">
            <h3>Non-Containerized / Separate Transport</h3>
            <p style="color:var(--silver-500); font-size:12.5px; margin-top:-4px;">
              Oversized/overweight for practical ISU-90 packing (generators, ECU skids, alternate rigid shelters/radomes).
              Plans to move on its own trailer, skid, or vehicle mount.
            </p>
            <ul style="list-style:none;padding:0;margin:8px 0 0;font-size:13px;">
              ${plan.nonIsu.items
                .map(
                  (li) =>
                    `<li style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--panel-border-soft);">
                      <span>${escapeHtml(li.item.item)} &times;${li.qty}</span>
                      <span style="color:var(--silver-500);">${fmtLb(li.weight)} &middot; ${fmtVol(li.volume)}</span>
                    </li>`
                )
                .join('')}
            </ul>
          </div>`
        : ''
    }

    ${
      plan.structural.items.length
        ? `<div class="card" style="margin-top:16px;">
            <h3>Structural Items (container shells — informational, excluded from payload totals)</h3>
            <ul style="list-style:none;padding:0;margin:8px 0 0;font-size:13px;">
              ${plan.structural.items
                .map((li) => `<li style="padding:4px 0;color:var(--silver-500);">${escapeHtml(li.item.item)} &times;${li.qty}</li>`)
                .join('')}
            </ul>
          </div>`
        : ''
    }
  `;
}

function categorize(items) {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.category)) map.set(item.category, []);
    map.get(item.category).push(item);
  }
  return map;
}

function rowHtml(item, qty) {
  const total = { weight: item.unitWeight * qty, volume: item.unitVolume * qty };
  return `
    <div class="equip-row" data-item="${item.id}">
      <div class="equip-row__info">
        <div class="item-title">${escapeHtml(item.item)}</div>
        <div class="item-vendor">${escapeHtml(item.vendor)}</div>
        <button type="button" class="details-toggle" data-toggle="${item.id}">Details</button>
      </div>
      <div class="equip-row__unit">${fmtLb(item.unitWeight)} &middot; ${fmtVol(item.unitVolume)} <span style="color:var(--silver-700);">each</span></div>
      <div>
        <label class="sr-only" for="qty-${item.id}">Quantity for ${escapeHtml(item.item)}</label>
        <input class="qty-input input-editable" type="number" min="0" step="1" id="qty-${item.id}" value="${qty}" data-qty="${item.id}" />
      </div>
      <div class="equip-row__total" data-total="${item.id}">${fmtLb(total.weight)}<br>${fmtVol(total.volume)}</div>
      <div class="item-details" id="details-${item.id}">
        <p><strong>Assigned to:</strong> ${escapeHtml(item.container)} &middot; <strong>Transport:</strong> ${escapeHtml(item.transport)}</p>
        ${
          item.lengthIn && item.widthIn && item.heightIn
            ? `<p><strong>Case dimensions:</strong> ${item.lengthIn}&Prime; &times; ${item.widthIn}&Prime; &times; ${item.heightIn}&Prime; (L &times; W &times; H)</p>`
            : ''
        }
        <p><strong>Pros:</strong> ${escapeHtml(item.pros)}</p>
        <p><strong>Cons:</strong> ${escapeHtml(item.cons)}</p>
        <p><strong>Notes:</strong> ${escapeHtml(item.notes)}</p>
        <p><strong>Source:</strong> ${escapeHtml(item.source)}</p>
        <p><a href="${suggestCorrectionUrl({ itemLabel: item.item, itemId: item.id, currentData: item })}" target="_blank" rel="noopener">Suggest a correction ↗</a></p>
      </div>
    </div>
  `;
}

export function render(container, { store }) {
  const categories = categorize(EQUIPMENT);

  container.innerHTML = `
    <div class="view-header">
      <h1>Equipment &amp; Container Packing</h1>
      <p>Select quantities below (defaults match the workbook's baseline 10-person site). The load plan
      updates live and flags any ISU-90 that goes over its 10,000&nbsp;lb / 385&nbsp;cu&nbsp;ft limit.</p>
    </div>

    <div class="card">
      <h2>ISU-90 Load Plan</h2>
      <div class="btn-row" style="margin-top:-4px; margin-bottom:16px; justify-content: space-between;">
        <div class="toggle-group" id="mode-toggle">
          <button type="button" data-mode="suggested">Suggested (by category)</button>
          <button type="button" data-mode="optimized">Optimized (fewest containers)</button>
        </div>
        <button type="button" class="btn" id="reset-defaults">Reset to workbook defaults</button>
      </div>
      <div id="load-plan"></div>
    </div>

    <div class="card">
      <h2>Select Equipment</h2>
      <div id="equipment-list">
        ${[...categories.entries()]
          .map(
            ([cat, items]) => `
            <div class="equip-category">
              <div class="equip-category__title">${escapeHtml(cat)}</div>
              ${items.map((it) => rowHtml(it, store.qtyOf(it.id))).join('')}
            </div>
          `
          )
          .join('')}
      </div>
    </div>
  `;

  const planEl = container.querySelector('#load-plan');
  const listEl = container.querySelector('#equipment-list');
  const modeToggle = container.querySelector('#mode-toggle');

  function syncModeButtons() {
    for (const btn of modeToggle.querySelectorAll('button')) {
      btn.classList.toggle('active', btn.dataset.mode === store.state.packingMode);
    }
  }
  syncModeButtons();

  function refreshPlan() {
    renderPlan(planEl, store);
    syncModeButtons();
  }
  refreshPlan();

  modeToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    store.setPackingMode(btn.dataset.mode);
  });

  container.querySelector('#reset-defaults').addEventListener('click', () => {
    for (const item of EQUIPMENT) store.setQty(item.id, item.defaultQty);
  });

  function syncRow(item) {
    const qty = store.qtyOf(item.id);
    const input = listEl.querySelector(`[data-qty="${item.id}"]`);
    // Don't clobber an input the user is actively typing into.
    if (input && document.activeElement !== input) input.value = store.rawQty(item.id);
    const totalEl = listEl.querySelector(`[data-total="${item.id}"]`);
    if (totalEl) totalEl.innerHTML = `${fmtLb(item.unitWeight * qty)}<br>${fmtVol(item.unitVolume * qty)}`;
  }

  function syncAllRows() {
    for (const item of EQUIPMENT) syncRow(item);
  }

  listEl.addEventListener('input', (e) => {
    const input = e.target.closest('[data-qty]');
    if (!input) return;
    const id = input.dataset.qty;
    const item = EQUIPMENT.find((x) => x.id === id);
    store.setQty(id, input.value);
    syncRow(item);
  });

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-toggle]');
    if (!btn) return;
    const panel = listEl.querySelector(`#details-${btn.dataset.toggle}`);
    if (!panel) return;
    const open = panel.classList.toggle('open');
    btn.textContent = open ? 'Hide details' : 'Details';
  });

  const unsubscribe = store.subscribe(() => {
    refreshPlan();
    syncAllRows();
  });
  return unsubscribe;
}
