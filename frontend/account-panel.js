/**
 * account-panel.js
 * ─────────────────────────────────────────────────────────────────
 * Adds "save to account" / "load from account" on top of the
 * existing simulator. Loaded as a CLASSIC script (no type="module"),
 * after simulator.js, so it shares simulator.js's top-level scope and
 * can read/reassign `heap` and call `refresh()` / `log()` directly.
 * simulator.js itself is not modified.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

// ── Wire up the simulator's own buttons ──────────────────────────
// index.html used to call these via inline onclick="..." attributes.
// The server's CSP (script-src 'self', no 'unsafe-inline') silently
// blocks inline event handlers, so the buttons stopped working once
// helmet was added. Fix: bind them here via addEventListener instead -
// same global functions from simulator.js, just CSP-compliant wiring.
// simulator.js itself is still not modified.
function wireSimulatorButtons() {
  const bindings = [
    ['initHeapBtn', () => initHeap()],
    ['allocateBtn', () => doAllocate()],
    ['freeBtn', () => doFree()],
    ['markBtn', () => doMark()],
    ['sweepBtn', () => doSweep()],
    ['fullGcBtn', () => doGC()],
    ['saveSnapshotBtn', () => doSave()],
    ['loadSnapshotBtn', () => doLoad()],
    ['clearLogBtn', () => clearLog()],
  ];

  bindings.forEach(([id, handler]) => {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', handler);
  });
}
wireSimulatorButtons();

const ACCOUNT_MAX_SIMULATIONS = 20;

// ── Minimal fetch helpers (deliberately self-contained - this is a
//    classic script, so it can't `import` the ES-module api.js used
//    by the auth pages) ──────────────────────────────────────────
async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const err = new Error(data.error || 'Something went wrong.');
    err.status = response.status;
    throw err;
  }
  return data;
}

function fetchMe() {
  return apiRequest('/api/auth/me');
}
function fetchSimulations() {
  return apiRequest('/api/simulations');
}
function saveSimulation(name, data) {
  return apiRequest('/api/simulations', { method: 'POST', body: { name, data } });
}
function loadSimulation(id) {
  return apiRequest(`/api/simulations/${id}`);
}
function deleteSimulation(id) {
  return apiRequest(`/api/simulations/${id}`, { method: 'DELETE' });
}
function updateSimulation(id, payload) {
  return apiRequest(`/api/simulations/${id}`, { method: 'PUT', body: payload });
}

// ── DOM helpers ───────────────────────────────────────────────────
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

// simulator.js's log() renders messages via innerHTML (safe in the
// original app, since every call there only ever passed hardcoded text
// or numbers). The simulation `name` field is free-text user input with
// no content restriction beyond length, so any value passed through
// log() must be escaped first - this is that escaping step.
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Header auth status ────────────────────────────────────────────
function renderAuthStatus(user) {
  const container = document.getElementById('authStatus');
  if (!container) return;
  container.innerHTML = '';

  if (user) {
    container.appendChild(el('span', { className: 'username' }, [user.username]));
    container.appendChild(
      el('button', { className: 'btn-tiny', onclick: handleLogout }, ['Sign out'])
    );
  } else {
    container.appendChild(el('a', { href: 'login.html' }, ['Sign in']));
    container.appendChild(el('a', { href: 'signup.html' }, ['Create account']));
  }
}

async function handleLogout() {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
  } finally {
    window.location.reload();
  }
}

// ── Account panel body ─────────────────────────────────────────────
function renderSignedOut() {
  const body = document.getElementById('accountPanelBody');
  if (!body) return;
  body.innerHTML = '';
  body.appendChild(
    el('p', { className: 'account-signed-out' }, [
      'Sign in to save your heap simulations and load them later. ',
      el('a', { href: 'login.html' }, ['Sign in']),
      ' or ',
      el('a', { href: 'signup.html' }, ['create an account']),
      '.',
    ])
  );
}

function renderSavedList(body, simulations) {
  const list = el('div', { className: 'saved-sim-list' });

  if (simulations.length === 0) {
    list.appendChild(el('p', { className: 'saved-sim-empty' }, ['No saved simulations yet.']));
  } else {
    simulations.forEach((sim) => {
      const meta = el('div', { className: 'meta' }, [
        el('span', { className: 'name' }, [sim.name]),
        el('span', { className: 'timestamp' }, [formatTimestamp(sim.updatedAt)]),
      ]);

      const loadBtn = el('button', { className: 'btn-tiny btn-tiny-primary' }, ['Load']);
      loadBtn.addEventListener('click', () => handleLoad(sim.id, sim.name));

      const updateBtn = el('button', { className: 'btn-tiny' }, ['Update']);
      updateBtn.addEventListener('click', () => handleUpdate(sim.id, sim.name));

      const renameBtn = el('button', { className: 'btn-tiny' }, ['Rename']);
      renameBtn.addEventListener('click', () => handleRename(sim.id, sim.name));

      const deleteBtn = el('button', { className: 'btn-tiny' }, ['Delete']);
      deleteBtn.addEventListener('click', () => handleDelete(sim.id, sim.name));

      const actions = el('div', { className: 'actions' }, [loadBtn, updateBtn, renameBtn, deleteBtn]);
      list.appendChild(el('div', { className: 'saved-sim-item' }, [meta, actions]));
    });
  }

  body.appendChild(list);
  body.appendChild(
    el('p', { className: 'account-limit-note' }, [`${simulations.length} / ${ACCOUNT_MAX_SIMULATIONS} saved`])
  );
}

async function renderSignedIn() {
  const body = document.getElementById('accountPanelBody');
  if (!body) return;
  body.innerHTML = '';

  // Same stacked label→input→full-width-button pattern as every other
  // sidebar section (Heap Setup, Allocate, Free) - not a horizontal row.
  // A horizontal row collided with this app's own `.btn { width: 100% }`
  // rule and squeezed the input down to a sliver.
  const label = el('label', {}, ['Snapshot name']);
  const nameInput = el('input', {
    type: 'text',
    id: 'saveNameInput',
    placeholder: 'e.g. After mark & sweep',
    maxlength: '60',
  });
  label.appendChild(nameInput);
  body.appendChild(label);

  const saveBtn = el('button', { className: 'btn btn-green' }, ['Save']);
  body.appendChild(saveBtn);

  saveBtn.addEventListener('click', () => handleSave(nameInput));

  try {
    const { simulations } = await fetchSimulations();
    renderSavedList(body, simulations);
  } catch {
    body.appendChild(el('p', { className: 'saved-sim-empty' }, ['Could not load your saved simulations.']));
  }
}

// ── Action handlers ─────────────────────────────────────────────
async function handleSave(nameInput) {
  if (typeof heap === 'undefined' || !heap) {
    log('Initialize a heap first.', 'err');
    return;
  }

  const name = nameInput.value.trim();
  if (!name) {
    log('Enter a name before saving.', 'err');
    return;
  }

  try {
    const data = JSON.parse(heap.serialize());
    await saveSimulation(name, data);
    log(`Saved simulation "${escapeHtml(name)}" to your account.`, 'io');
    nameInput.value = '';
    renderSignedIn();
  } catch (err) {
    log(escapeHtml(err.message), 'err');
  }
}

async function handleLoad(id, name) {
  try {
    const { simulation } = await loadSimulation(id);
    heap = VirtualHeap.deserialize(JSON.stringify(simulation.data));
    refresh();
    log(`Loaded simulation "${escapeHtml(name)}" from your account.`, 'io');
  } catch (err) {
    log(escapeHtml(err.message), 'err');
  }
}

async function handleRename(id, currentName) {
  const newName = window.prompt('Rename simulation:', currentName);
  if (newName === null) return; // cancelled
  const trimmed = newName.trim();
  if (!trimmed) {
    log('Name cannot be empty.', 'err');
    return;
  }
  if (trimmed === currentName) return; // nothing changed

  try {
    await updateSimulation(id, { name: trimmed });
    log(`Renamed "${escapeHtml(currentName)}" to "${escapeHtml(trimmed)}".`, 'io');
    renderSignedIn();
  } catch (err) {
    log(escapeHtml(err.message), 'err');
  }
}

async function handleUpdate(id, name) {
  if (typeof heap === 'undefined' || !heap) {
    log('Initialize a heap first.', 'err');
    return;
  }
  if (!window.confirm(`Overwrite saved simulation "${name}" with the current heap state?`)) return;

  try {
    const data = JSON.parse(heap.serialize());
    await updateSimulation(id, { data });
    log(`Updated saved simulation "${escapeHtml(name)}" with the current heap state.`, 'io');
    renderSignedIn();
  } catch (err) {
    log(escapeHtml(err.message), 'err');
  }
}

async function handleDelete(id, name) {
  if (!window.confirm(`Delete saved simulation "${name}"? This can't be undone.`)) return;

  try {
    await deleteSimulation(id);
    log(`Deleted simulation "${escapeHtml(name)}".`, 'io');
    renderSignedIn();
  } catch (err) {
    log(escapeHtml(err.message), 'err');
  }
}

// ── Auto-load via ?load=<id> (used by the dashboard's "Open" button) ──
async function maybeAutoLoad() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('load');
  if (!id) return;

  try {
    const { simulation } = await loadSimulation(id);
    heap = VirtualHeap.deserialize(JSON.stringify(simulation.data));
    refresh();
    log(`Loaded simulation "${escapeHtml(simulation.name)}" from your account.`, 'io');
  } catch (err) {
    log(`Could not load the requested simulation: ${escapeHtml(err.message)}`, 'err');
  }

  // Clean the URL so refreshing the page doesn't reload it again.
  window.history.replaceState({}, '', window.location.pathname);
}

// ── Init ───────────────────────────────────────────────────────────
(async function init() {
  let user = null;
  try {
    const result = await fetchMe();
    user = result.user;
  } catch {
    user = null;
  }

  renderAuthStatus(user);

  if (user) {
    await renderSignedIn();
    await maybeAutoLoad();
  } else {
    renderSignedOut();
  }
})();
