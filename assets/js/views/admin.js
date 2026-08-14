import { isConfigured, getSession, signIn, signOut, fetchTable, insertRow, updateRow, deleteRow } from '../backend.js';
import { syncLiveData, getLiveDataStatus } from '../live-sync.js';
import { CONTAINERS, NON_ISU_LABELS, STRUCTURAL_LABELS } from '../data.js';
import { escapeHtml } from '../format.js';

const CONTAINER_OPTIONS = [
  ...CONTAINERS.map((c) => c.label),
  ...NON_ISU_LABELS,
  ...STRUCTURAL_LABELS,
];

const TABLES = {
  equipment: {
    label: 'Equipment',
    idKind: 'text-slug',
    listColumns: [
      { key: 'item', label: 'Item' },
      { key: 'category', label: 'Category' },
      { key: 'container', label: 'Container' },
      { key: 'default_qty', label: 'Qty' },
    ],
    fields: [
      { key: 'id', label: 'ID (slug, lowercase-with-hyphens)', type: 'text', required: true, lockOnEdit: true },
      { key: 'category', label: 'Category', type: 'text', required: true },
      { key: 'item', label: 'Item', type: 'text', required: true },
      { key: 'vendor', label: 'Vendor / Model', type: 'text' },
      { key: 'default_qty', label: 'Default Qty', type: 'number' },
      {
        key: 'unit_weight',
        label: 'Unit Weight (lb)',
        type: 'number',
        help: 'From a scale, per unit. Weight can’t be reliably derived from dimensions alone, so this is always entered directly — it’s what the ISU-90 10,000 lb capacity check uses.',
      },
      {
        key: 'length_in',
        label: 'Case Length (in)',
        type: 'number',
        help: 'Outer shipping-case dimensions from a tape measure. Optional — only used to calculate Unit Volume below.',
      },
      { key: 'width_in', label: 'Case Width (in)', type: 'number' },
      { key: 'height_in', label: 'Case Height (in)', type: 'number' },
      {
        key: 'unit_volume',
        label: 'Unit Volume (cu ft)',
        type: 'number',
        help: 'Per unit. Use "Calculate from dimensions" above once L/W/H are filled in, or enter cubic feet directly.',
        extraControl: 'calc-volume',
      },
      { key: 'transport', label: 'Transport', type: 'text' },
      { key: 'container', label: 'Assigned Container', type: 'select', options: CONTAINER_OPTIONS, required: true },
      { key: 'pros', label: 'Pros', type: 'textarea' },
      { key: 'cons', label: 'Cons', type: 'textarea' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'source', label: 'Source', type: 'text' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' },
    ],
  },
  power_load_items: {
    label: 'Power Load Items',
    idKind: 'text-slug',
    listColumns: [
      { key: 'label', label: 'Label' },
      { key: 'typical_w', label: 'Typical W' },
      { key: 'max_w', label: 'Max W' },
      { key: 'qty', label: 'Qty' },
    ],
    fields: [
      { key: 'id', label: 'ID (slug)', type: 'text', required: true, lockOnEdit: true },
      { key: 'label', label: 'Label', type: 'text', required: true },
      { key: 'typical_w', label: 'Typical W (each)', type: 'number' },
      { key: 'max_w', label: 'Max W (each)', type: 'number' },
      { key: 'qty', label: 'Qty', type: 'number' },
      { key: 'qty_editable', label: 'Qty editable on Power & Thermal page?', type: 'checkbox' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' },
    ],
  },
  antenna_comparison: {
    label: 'Antenna Comparison',
    idKind: 'auto',
    listColumns: [
      { key: 'system', label: 'System' },
      { key: 'architecture', label: 'Architecture' },
    ],
    fields: [
      { key: 'system', label: 'System', type: 'text', required: true },
      { key: 'architecture', label: 'Architecture', type: 'text' },
      { key: 'band_coverage', label: 'Band Coverage', type: 'text' },
      { key: 'orbital_regimes', label: 'Orbital Regimes', type: 'text' },
      { key: 'pack_form', label: 'Pack / Transport Form', type: 'text' },
      { key: 'acquisition', label: 'Acquisition Path', type: 'text' },
      { key: 'pros', label: 'Pros', type: 'textarea' },
      { key: 'cons', label: 'Cons', type: 'textarea' },
      { key: 'source', label: 'Source', type: 'text' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' },
    ],
  },
  radome_comparison: {
    label: 'Radome Comparison',
    idKind: 'auto',
    listColumns: [
      { key: 'system', label: 'System' },
      { key: 'structure_type', label: 'Structure Type' },
    ],
    fields: [
      { key: 'system', label: 'System', type: 'text', required: true },
      { key: 'structure_type', label: 'Structure Type', type: 'text' },
      { key: 'continuous_power', label: 'Continuous Power Needed?', type: 'text' },
      { key: 'setup_time', label: 'Setup Time', type: 'text' },
      { key: 'pros', label: 'Pros', type: 'textarea' },
      { key: 'cons', label: 'Cons', type: 'textarea' },
      { key: 'source', label: 'Source', type: 'text' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' },
    ],
  },
};

function fieldInput(field, value, { locked } = {}) {
  const v = value ?? '';
  const common = `data-field="${field.key}" id="admin-field-${field.key}"`;
  const lockAttr = locked ? 'readonly title="ID cannot be changed after creation"' : '';
  if (field.type === 'textarea') {
    return `<textarea ${common} rows="3" style="width:100%;" ${lockAttr}>${escapeHtml(v)}</textarea>`;
  }
  if (field.type === 'checkbox') {
    return `<input type="checkbox" ${common} ${value ? 'checked' : ''} />`;
  }
  if (field.type === 'select') {
    return `<select ${common} style="width:100%;" ${locked ? 'disabled' : ''}>${field.options
      .map((o) => `<option value="${escapeHtml(o)}" ${o === value ? 'selected' : ''}>${escapeHtml(o)}</option>`)
      .join('')}</select>`;
  }
  if (field.type === 'number') {
    return `<input type="text" inputmode="decimal" ${common} data-field-type="number" value="${escapeHtml(v)}" style="width:100%;" ${lockAttr} />`;
  }
  return `<input type="text" ${common} value="${escapeHtml(v)}" style="width:100%;" ${lockAttr} />`;
}

function formHtml(tableKey, row, isNew) {
  const table = TABLES[tableKey];
  return `
    <div class="card" style="background:var(--panel-raised); margin-top:12px;" id="admin-form">
      <h3>${isNew ? 'Add' : 'Edit'} — ${escapeHtml(table.label)}</h3>
      <div class="grid grid--2">
        ${table.fields
          .filter((f) => table.idKind !== 'auto' || f.key !== 'id')
          .map(
            (f) => `
          <div style="${f.type === 'textarea' ? 'grid-column: 1 / -1;' : ''}">
            <label style="display:block; font-size:11.5px; color:var(--silver-500); margin-bottom:4px;">${escapeHtml(f.label)}${f.required ? ' *' : ''}</label>
            ${fieldInput(f, row[f.key], { locked: !isNew && f.lockOnEdit })}
            ${f.help ? `<p style="font-size:11px; color:var(--silver-700); margin:4px 0 0;">${escapeHtml(f.help)}</p>` : ''}
            ${
              f.extraControl === 'calc-volume'
                ? `<button type="button" class="btn" data-calc-volume style="margin-top:6px; font-size:12px; padding:4px 10px;">Calculate from L × W × H</button>
                   <span id="calc-volume-msg" style="font-size:11px; color:var(--silver-500); margin-left:8px;"></span>`
                : ''
            }
          </div>
        `
          )
          .join('')}
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" data-admin-save="${tableKey}">${isNew ? 'Create' : 'Save changes'}</button>
        <button type="button" class="btn" data-admin-cancel>Cancel</button>
        ${!isNew ? `<button type="button" class="btn" style="margin-left:auto; border-color:var(--danger); color:var(--danger);" data-admin-delete="${tableKey}" data-id="${escapeHtml(String(row.id))}">Delete</button>` : ''}
      </div>
      <p id="admin-form-error" style="color:var(--danger); font-size:12.5px; margin-top:10px;"></p>
    </div>
  `;
}

function readForm(tableKey) {
  const table = TABLES[tableKey];
  const formEl = document.getElementById('admin-form');
  const row = {};
  for (const f of table.fields) {
    if (table.idKind === 'auto' && f.key === 'id') continue;
    const el = formEl.querySelector(`[data-field="${f.key}"]`);
    if (!el) continue;
    if (f.type === 'checkbox') row[f.key] = el.checked;
    else if (el.dataset.fieldType === 'number') row[f.key] = el.value === '' ? 0 : Number(el.value);
    else row[f.key] = el.value;
  }
  return row;
}

export function render(container) {
  let session = null;
  let activeTable = 'equipment';
  let rows = [];
  let editing = null; // { isNew: bool, row: {...} } or null
  let loading = false;
  let listError = '';
  let signInError = '';
  let formEmail = ''; // preserved across re-renders (e.g. after a failed attempt); password is not

  async function loadRows() {
    loading = true;
    draw();
    try {
      rows = await fetchTable(activeTable);
      listError = '';
    } catch (e) {
      listError = e.message || String(e);
      rows = [];
    }
    loading = false;
    draw();
  }

  function draw() {
    if (!isConfigured()) {
      container.innerHTML = `
        <div class="view-header">
          <h1>Admin</h1>
          <p>Edit the equipment and comparison data behind this tool, live for every visitor.</p>
        </div>
        <div class="card">
          <h2>Backend not connected</h2>
          <p style="color:var(--silver-500);">This site is currently running entirely on its bundled static data — that's normal
          and the tool works fully without a backend. To enable live editing here, follow
          <code>SETUP.md</code> in the repository to connect a free Supabase project, then redeploy.</p>
        </div>
      `;
      return;
    }

    if (!session) {
      container.innerHTML = `
        <div class="view-header">
          <h1>Admin Sign-in</h1>
          <p>Sign in with the one admin account created during backend setup.</p>
        </div>
        <div class="card" style="max-width:420px;">
          <label style="display:block; font-size:11.5px; color:var(--silver-500); margin-bottom:4px;">Email</label>
          <input type="email" id="admin-email" value="${escapeHtml(formEmail)}" style="width:100%; margin-bottom:12px;" autocomplete="username" />
          <label style="display:block; font-size:11.5px; color:var(--silver-500); margin-bottom:4px;">Password</label>
          <input type="password" id="admin-password" style="width:100%;" autocomplete="current-password" />
          <div class="btn-row">
            <button type="button" class="btn btn-primary" id="admin-signin">Sign in</button>
          </div>
          ${signInError ? `<p style="color:var(--danger); font-size:12.5px; margin-top:10px;">${escapeHtml(signInError)}</p>` : ''}
        </div>
      `;
      return;
    }

    const status = getLiveDataStatus();
    const table = TABLES[activeTable];

    container.innerHTML = `
      <div class="view-header">
        <h1>Admin</h1>
        <p>Signed in as <strong style="color:var(--silver-100);">${escapeHtml(session.email)}</strong>.
        ${status.active ? `Live data last synced ${status.lastSyncedAt?.toLocaleTimeString() ?? ''}.` : ''}</p>
      </div>

      <div class="btn-row" style="margin-bottom:0;">
        <div class="toggle-group" id="admin-table-toggle">
          ${Object.entries(TABLES)
            .map(([key, t]) => `<button type="button" class="${key === activeTable ? 'active' : ''}" data-admin-table="${key}">${escapeHtml(t.label)}</button>`)
            .join('')}
        </div>
        <button type="button" class="btn" id="admin-signout" style="margin-left:auto;">Sign out</button>
      </div>

      <div class="card" style="margin-top:16px;">
        <div class="btn-row" style="margin-top:0; justify-content:space-between;">
          <h2 style="margin:0;">${escapeHtml(table.label)}</h2>
          <button type="button" class="btn btn-primary" data-admin-add="${activeTable}">+ Add new</button>
        </div>
        ${loading ? '<p style="color:var(--silver-500);">Loading&hellip;</p>' : ''}
        ${listError ? `<p style="color:var(--danger); font-size:12.5px;">${escapeHtml(listError)}</p>` : ''}
        ${
          !loading && !listError
            ? `<div class="table-wrap"><table>
                <thead><tr>${table.listColumns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')}<th></th></tr></thead>
                <tbody>
                  ${rows
                    .map(
                      (r) => `
                    <tr>
                      ${table.listColumns.map((c) => `<td>${escapeHtml(String(r[c.key] ?? ''))}</td>`).join('')}
                      <td><button type="button" class="btn" data-admin-edit="${escapeHtml(String(r.id))}">Edit</button></td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table></div>
              ${rows.length === 0 ? '<p style="color:var(--silver-700); font-size:12.5px;">No rows yet.</p>' : ''}`
            : ''
        }
        ${editing ? formHtml(activeTable, editing.row, editing.isNew) : ''}
      </div>
    `;
  }

  draw();

  (async () => {
    session = await getSession();
    draw();
    if (session) loadRows();
  })();

  async function submitSignIn() {
    formEmail = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;
    try {
      signInError = '';
      session = await signIn(formEmail, password);
      draw();
      loadRows();
    } catch (err) {
      signInError = err.message || 'Sign-in failed.';
      draw();
    }
  }

  container.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target.id === 'admin-email' || e.target.id === 'admin-password')) {
      e.preventDefault();
      submitSignIn();
    }
  });

  container.addEventListener('click', async (e) => {
    const t = e.target;

    if (t.matches('#admin-signin')) {
      await submitSignIn();
      return;
    }

    if (t.matches('#admin-signout')) {
      await signOut();
      session = null;
      rows = [];
      editing = null;
      draw();
      return;
    }

    const tableBtn = t.closest('[data-admin-table]');
    if (tableBtn) {
      activeTable = tableBtn.dataset.adminTable;
      editing = null;
      loadRows();
      return;
    }

    if (t.matches('[data-calc-volume]')) {
      const formEl = document.getElementById('admin-form');
      const len = Number(formEl.querySelector('[data-field="length_in"]')?.value);
      const wid = Number(formEl.querySelector('[data-field="width_in"]')?.value);
      const hei = Number(formEl.querySelector('[data-field="height_in"]')?.value);
      const msgEl = document.getElementById('calc-volume-msg');
      if (![len, wid, hei].every((n) => Number.isFinite(n) && n > 0)) {
        msgEl.textContent = 'Enter length, width, and height (inches) first.';
        msgEl.style.color = 'var(--danger)';
        return;
      }
      const cuFt = (len * wid * hei) / 1728; // 1728 cu in per cu ft
      const volumeInput = formEl.querySelector('[data-field="unit_volume"]');
      volumeInput.value = cuFt.toFixed(2);
      msgEl.textContent = `Set to ${cuFt.toFixed(2)} cu ft (${len}" × ${wid}" × ${hei}" ÷ 1728).`;
      msgEl.style.color = 'var(--ok)';
      return;
    }

    const addBtn = t.closest('[data-admin-add]');
    if (addBtn) {
      const empty = {};
      for (const f of TABLES[activeTable].fields) empty[f.key] = f.type === 'checkbox' ? false : '';
      editing = { isNew: true, row: empty };
      draw();
      return;
    }

    const editBtn = t.closest('[data-admin-edit]');
    if (editBtn) {
      const row = rows.find((r) => String(r.id) === editBtn.dataset.adminEdit);
      if (row) {
        editing = { isNew: false, row };
        draw();
      }
      return;
    }

    if (t.matches('[data-admin-cancel]')) {
      editing = null;
      draw();
      return;
    }

    const saveBtn = t.closest('[data-admin-save]');
    if (saveBtn) {
      const tableKey = saveBtn.dataset.adminSave;
      const table = TABLES[tableKey];
      const errorEl = document.getElementById('admin-form-error');
      const patch = readForm(tableKey);

      for (const f of table.fields) {
        if (table.idKind === 'auto' && f.key === 'id') continue; // no id field is ever rendered/read for auto-id tables
        if (f.required && !String(patch[f.key] ?? '').trim()) {
          errorEl.textContent = `${f.label} is required.`;
          return;
        }
      }
      if (table.idKind === 'text-slug' && editing.isNew && !/^[a-z0-9-]+$/.test(patch.id || '')) {
        errorEl.textContent = 'ID must be lowercase letters, numbers, and hyphens only.';
        return;
      }

      try {
        if (editing.isNew) {
          await insertRow(tableKey, patch);
        } else {
          const id = editing.row.id;
          if (table.idKind !== 'auto') delete patch.id; // primary key, immutable on update
          await updateRow(tableKey, id, patch);
        }
        editing = null;
        await syncLiveData(); // refresh the shared in-app arrays so other views pick this up
        await loadRows();
      } catch (err) {
        errorEl.textContent = err.message || 'Save failed.';
      }
      return;
    }

    const delBtn = t.closest('[data-admin-delete]');
    if (delBtn) {
      if (!confirm('Delete this row? This cannot be undone.')) return;
      try {
        await deleteRow(delBtn.dataset.adminDelete, delBtn.dataset.id);
        editing = null;
        await syncLiveData();
        await loadRows();
      } catch (err) {
        const errorEl = document.getElementById('admin-form-error');
        if (errorEl) errorEl.textContent = err.message || 'Delete failed.';
      }
      return;
    }
  });

  return () => {};
}
