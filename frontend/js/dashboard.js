import { authApi } from './api.js';
import { simulationsApi } from './simulations-api.js';

const usernameEl     = document.getElementById('dash-username');
const logoutBtn      = document.getElementById('logout-btn');
const simsContainer  = document.getElementById('dash-sims-container');

// Small DOM-builder helper, kept local to this module (account-panel.js has
// its own copy - it's a classic script with a separate scope, so sharing
// this helper across the two isn't straightforward without a bundler).
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

function renderSimulations(simulations) {
  simsContainer.innerHTML = '';

  if (simulations.length === 0) {
    simsContainer.appendChild(
      el('div', { className: 'dash-empty' }, [
        el('strong', {}, ['No saved simulations yet']),
        'Open the simulator, run some allocations, and save a snapshot to see it here.',
      ])
    );
    return;
  }

  const list = el('div', { className: 'saved-sim-list' });

  simulations.forEach((sim) => {
    const meta = el('div', { className: 'meta' }, [
      el('span', { className: 'name' }, [sim.name]),
      el('span', { className: 'timestamp' }, [formatTimestamp(sim.updatedAt)]),
    ]);

    const openLink = el('a', { href: `index.html?load=${sim.id}`, className: 'btn-tiny btn-tiny-primary' }, ['Open']);

    const renameBtn = el('button', { className: 'btn-tiny' }, ['Rename']);
    renameBtn.addEventListener('click', () => handleRename(sim.id, sim.name));

    const deleteBtn = el('button', { className: 'btn-tiny' }, ['Delete']);
    deleteBtn.addEventListener('click', () => handleDelete(sim.id, sim.name));

    const actions = el('div', { className: 'actions' }, [openLink, renameBtn, deleteBtn]);
    list.appendChild(el('div', { className: 'saved-sim-item' }, [meta, actions]));
  });

  simsContainer.appendChild(list);
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
