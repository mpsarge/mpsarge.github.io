import { store } from './state.js';
import { syncLiveData } from './live-sync.js';

const main = document.getElementById('app-main');
const navLinks = [...document.querySelectorAll('[data-route]')];
const navToggle = document.getElementById('nav-toggle');
const mobileNav = document.getElementById('main-nav-mobile');

let checklistProgress, routes;

// Live-sync BEFORE importing anything that reads EQUIPMENT/etc. at module-eval
// time (equipment-helpers.js computes lookups once, eagerly, when imported —
// see its header comment). Dynamic import() here guarantees that first read
// happens after data.js's arrays have already been replaced with live rows,
// not racing a sync that finishes later. In the common case (no backend
// configured) this resolves in microtasks with no network call at all.
//
// Everything here is wrapped in a try/catch as a last line of defense: if a
// live-synced dataset is ever malformed in a way that breaks a module at
// import time (rather than at render time, which individual views already
// guard against), the user gets an explicit error and a reload button
// instead of a page stuck silently on "Loading…" forever.
try {
  await syncLiveData();

  const [checklistMod, overviewView, wizardView, equipmentView, powerView, antennaView, checklistView, adminView] =
    await Promise.all([
      import('./checklist.js'),
      import('./views/overview.js'),
      import('./views/wizard.js'),
      import('./views/equipment.js'),
      import('./views/power.js'),
      import('./views/antenna.js'),
      import('./views/checklist.js'),
      import('./views/admin.js'),
    ]);

  checklistProgress = checklistMod.checklistProgress;
  routes = {
    overview: overviewView.render,
    wizard: wizardView.render,
    equipment: equipmentView.render,
    power: powerView.render,
    antenna: antennaView.render,
    checklist: checklistView.render,
    admin: adminView.render,
  };
} catch (err) {
  console.error('[main] failed to start app:', err);
  main.innerHTML = `
    <div class="card" style="max-width:520px; margin:60px auto; text-align:center;">
      <h1 style="text-transform:uppercase; font-size:18px;">Couldn't load the app</h1>
      <p style="color:var(--silver-500);">Something in the live data broke loading. Reloading usually clears a
      transient sync issue; if it keeps happening, check the Admin panel for a recently edited row, or open the
      browser console for details.</p>
      <button type="button" class="btn btn-primary" onclick="location.reload()" style="margin-top:8px;">Reload</button>
    </div>
  `;
  throw err;
}

function currentRouteName() {
  const hash = location.hash.replace(/^#\/?/, '');
  const name = hash.split('/')[0];
  return routes[name] ? name : 'overview';
}

function setActiveNav(name) {
  for (const link of navLinks) {
    link.classList.toggle('active', link.dataset.route === name);
  }
}

function updateChecklistBadge() {
  const { done, total } = checklistProgress(store.state);
  const count = document.getElementById('checklist-count');
  const dot = document.querySelector('.checklist-badge__dot');
  if (count) count.textContent = `${done}/${total}`;
  if (dot) dot.classList.toggle('complete', done === total);
}

let currentCleanup = null;

function renderRoute() {
  if (typeof currentCleanup === 'function') currentCleanup();
  currentCleanup = null;

  const name = currentRouteName();
  setActiveNav(name);
  mobileNav.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
  main.innerHTML = '';
  currentCleanup = routes[name](main, { store, navigate }) || null;
  main.focus();
  updateChecklistBadge();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

export function navigate(path) {
  location.hash = path.startsWith('#') ? path : `#${path}`;
}

window.addEventListener('hashchange', renderRoute);
navToggle.addEventListener('click', () => {
  const open = mobileNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
});

store.subscribe(updateChecklistBadge);

if (!location.hash) location.hash = '#/overview';
renderRoute();
