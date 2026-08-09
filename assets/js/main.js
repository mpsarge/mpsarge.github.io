import { store } from './state.js';
import { checklistProgress } from './checklist.js';

import { render as renderOverview } from './views/overview.js';
import { render as renderWizard } from './views/wizard.js';
import { render as renderEquipment } from './views/equipment.js';
import { render as renderPower } from './views/power.js';
import { render as renderAntenna } from './views/antenna.js';
import { render as renderChecklist } from './views/checklist.js';

const routes = {
  overview: renderOverview,
  wizard: renderWizard,
  equipment: renderEquipment,
  power: renderPower,
  antenna: renderAntenna,
  checklist: renderChecklist,
};

const main = document.getElementById('app-main');
const navLinks = [...document.querySelectorAll('[data-route]')];
const navToggle = document.getElementById('nav-toggle');
const mobileNav = document.getElementById('main-nav-mobile');

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
