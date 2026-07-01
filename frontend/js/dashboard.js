import { authApi } from './api.js';
import { simulationsApi } from './simulations-api.js';

const usernameEl    = document.getElementById('dash-username');
const logoutBtn     = document.getElementById('logout-btn');
const simsContainer = document.getElementById('dash-sims-container');
const statCountEl   = document.getElementById('stat-count');
const statUtilEl    = document.getElementById('stat-util');
const statLastEl    = document.getElementById('stat-last');

const STRATEGY_LABELS = { firstfit: 'First Fit', bestfit: 'Best Fit', worstfit: 'Worst Fit' };

// Small DOM-builder helper, kept local to this module (account-panel.js has
// its own copy - it's a classic script with a separate scope, so sharing
// this helper across the two isn't straightforward without a bundler).
// Every child is inserted via textContent/createTextNode, never innerHTML -
// so user-controlled values like the simulation name never need escaping
// here the way they did in simulator.js's log() sink.
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'className') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  });
  children.forEach((child) => node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child));
  return node;
}

function formatTimestamp(isoLike) {
  const d = new Date(isoLike.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return isoLike;
  return d.toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatRelative(isoLike) {
  const d = new Date(isoLike.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatTimestamp(isoLike);
}

// ── Mini heap-bar preview ─────────────────────────────────────────
// Same visual grammar as the simulator's own "Visual Map" (free/used/
// marked segments), built from the aggregate stats the server computed
// (preview.usedBytes/markedBytes/freeBytes/totalSize) - never the raw
// block list, which the list endpoint doesn't send.
function buildMiniHeapBar(preview) {
  const bar = el('div', { className: 'mini-heap-bar' });
  const { totalSize, usedBytes, markedBytes, freeBytes } = preview;
  const usedUnmarked = usedBytes - markedBytes;

  const segments = [
    { bytes: usedUnmarked, className: 'used' },
    { bytes: markedBytes, className: 'marked' },
    { bytes: freeBytes, className: 'free' },
  ];

  segments.forEach(({ bytes, className }) => {
    if (bytes <= 0) return;
    const pct = Math.max((bytes / totalSize) * 100, 1.5); // floor so tiny segments stay visible
    const seg = el('div', { className: `mini-heap-bar__segment ${className}` });
    seg.style.flex = `${pct} 0 0%`;
    bar.appendChild(seg);
  });

  return bar;
}

// ── Stat strip ─────────────────────────────────────────────────────
function renderStats(simulations) {
  statCountEl.textContent = simulations.length;

  if (simulations.length === 0) {
    statUtilEl.textContent = '—';
    statLastEl.textContent = '—';
    return;
  }

  const avgUtil =
    simulations.reduce((sum, sim) => sum + sim.preview.usedBytes / sim.preview.totalSize, 0) / simulations.length;
  statUtilEl.textContent = `${Math.round(avgUtil * 100)}%`;

  // Rows arrive sorted by updated_at DESC, so the first entry is the most recent.
  statLastEl.textContent = formatRelative(simulations[0].updatedAt);
}

// ── Card gallery ─────────────────────────────────────────────────
function buildEmptyState() {
  const empty = el('div', { className: 'dash-empty' }, [
    el('strong', {}, ['No saved simulations yet']),
    'Open the simulator, run some allocations, and save a snapshot to see it here.',
  ]);

  const ghostBar = el('div', { className: 'mini-heap-bar' });
  [['free', 40], ['used', 35], ['free', 25]].forEach(([cls, pct]) => {
    const seg = el('div', { className: `mini-heap-bar__segment ${cls}` });
    seg.style.flex = `${pct} 0 0%`;
    ghostBar.appendChild(seg);
  });
  empty.appendChild(ghostBar);

  return empty;
}

function buildSimCard(sim, index) {
  const card = el('div', {
    className: 'card sim-card',
    style: `--enter-delay: ${Math.min(index * 60, 360)}ms`,
  });

  card.addEventListener('animationend', () => card.classList.add('is-settled'));

  const top = el('div', { className: 'sim-card-top' }, [
    el('span', { className: 'sim-card-name' }, [sim.name]),
    el('span', { className: 'sim-card-time' }, [formatRelative(sim.updatedAt)]),
  ]);

  const bar = buildMiniHeapBar(sim.preview);

  const meta = el('div', { className: 'sim-card-meta' }, [
    el('span', {}, [el('strong', {}, [String(sim.preview.blockCount)]), ' blocks']),
    el('span', {}, [el('strong', {}, [`${Math.round((sim.preview.usedBytes / sim.preview.totalSize) * 100)}%`]), ' used']),
    el('span', {}, [STRATEGY_LABELS[sim.preview.strategyKey] || sim.preview.strategyKey]),
  ]);

  const openLink = el('a', { href: `index.html?load=${sim.id}`, className: 'btn-tiny btn-tiny-primary' }, ['Open']);

  const renameBtn = el('button', { className: 'btn-tiny' }, ['Rename']);
  renameBtn.addEventListener('click', () => handleRename(sim.id, sim.name));

  const deleteBtn = el('button', { className: 'btn-tiny' }, ['Delete']);
  deleteBtn.addEventListener('click', () => handleDelete(sim.id, sim.name));

  const actions = el('div', { className: 'actions' }, [openLink, renameBtn, deleteBtn]);

  card.appendChild(top);
  card.appendChild(bar);
  card.appendChild(meta);
  card.appendChild(actions);

  return card;
}

function renderSimulations(simulations) {
  renderStats(simulations);
  simsContainer.innerHTML = '';

  if (simulations.length === 0) {
    simsContainer.appendChild(buildEmptyState());
    return;
  }

  const grid = el('div', { className: 'sim-card-grid' });
  simulations.forEach((sim, index) => {
    const card = buildSimCard(sim, index);
    grid.appendChild(card);
    // tilt-cards.js already scanned the DOM once at load, before these
    // cards existed - attach the same hover behavior explicitly now.
    if (typeof window.applyCardTilt === 'function') window.applyCardTilt(card);
  });
  simsContainer.appendChild(grid);
}

async function loadSimulations() {
  try {
    const { simulations } = await simulationsApi.list();
    renderSimulations(simulations);
  } catch (err) {
    simsContainer.innerHTML = '';
    simsContainer.appendChild(
      el('p', { className: 'account-signed-out' }, [`Could not load your saved simulations: ${err.message}`])
    );
  }
}

async function handleRename(id, currentName) {
  const newName = window.prompt('Rename simulation:', currentName);
  if (newName === null) return; // cancelled
  const trimmed = newName.trim();
  if (!trimmed || trimmed === currentName) return;

  try {
    await simulationsApi.update(id, { name: trimmed });
    await loadSimulations();
  } catch (err) {
    window.alert(err.message);
  }
}

async function handleDelete(id, name) {
  if (!window.confirm(`Delete saved simulation "${name}"? This can't be undone.`)) return;
  try {
    await simulationsApi.remove(id);
    await loadSimulations();
  } catch (err) {
    window.alert(err.message);
  }
}

authApi.me().then(
  ({ user }) => {
    usernameEl.textContent = user.username;
    loadSimulations();
  },
  () => {
    window.location.replace('login.html');
  }
);

logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  try {
    await authApi.logout();
  } finally {
    window.location.replace('login.html');
  }
});
