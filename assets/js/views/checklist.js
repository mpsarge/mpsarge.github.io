import { checklistProgress } from '../checklist.js';
import { escapeHtml } from '../format.js';

export function render(container, { store }) {
  function draw() {
    const { done, total, items } = checklistProgress(store.state);

    container.innerHTML = `
      <div class="view-header">
        <h1>Design Checklist</h1>
        <p>Every key engineering decision the workbook flags as easy to forget, in one place. Items marked
        &ldquo;auto-verified&rdquo; are computed live from your Equipment and Power &amp; Thermal Budget
        selections; the rest need your explicit confirmation, usually from the Setup Wizard.</p>
      </div>

      <div class="card">
        <div class="progress-summary">
          <span class="progress-ring-label" style="color:${done === total ? 'var(--ok)' : 'var(--warn)'};">${done}/${total}</span>
          <div>
            <div style="font-weight:600; color:var(--silver-100);">${done === total ? 'All key decisions confirmed' : 'Design in progress'}</div>
            <div style="color:var(--silver-500); font-size:12.5px;">${
              done === total
                ? 'Every flagged engineering decision has been addressed.'
                : `${total - done} item${total - done === 1 ? '' : 's'} still need attention.`
            }</div>
          </div>
        </div>
        <div class="bar" style="height:10px;">
          <div class="bar__fill" style="width:${(done / total) * 100}%;"></div>
        </div>
      </div>

      <div class="card">
        ${items
          .map(
            (it) => `
          <div class="checklist-item">
            <div class="checklist-item__icon ${it.ok ? 'ok' : 'pending'}">${it.ok ? '✓' : '·'}</div>
            <div>
              <div class="checklist-item__title">${escapeHtml(it.title)}</div>
              <div class="checklist-item__why">${escapeHtml(it.why)}</div>
              ${it.detail ? `<div class="checklist-item__detail">${escapeHtml(it.detail)}</div>` : ''}
              ${
                it.kind === 'attest'
                  ? `<label style="display:flex; align-items:center; gap:8px; margin-top:8px; cursor:pointer;">
                      <input type="checkbox" data-attest="${it.id}" ${it.ok ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--accent);" />
                      <span style="font-size:12.5px; color:var(--silver-300);">I confirm this has been addressed</span>
                    </label>`
                  : `<div class="checklist-item__hint">Auto-verified</div>`
              }
              <div class="checklist-item__hint">${escapeHtml(it.stepHint)}</div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  }

  draw();

  container.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-attest]')) {
      store.setAttestation(t.dataset.attest, t.checked);
    }
  });

  const unsubscribe = store.subscribe(draw);
  return unsubscribe;
}
