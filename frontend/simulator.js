/**
 * simulator.js
 * ─────────────────────────────────────────────────────────────────
 * Mirrors the C++ VirtualHeap logic in JavaScript so the browser
 * can run a live, interactive visualization without a server.
 *
 * This is intentionally structured to match the C++ class design:
 *   MemoryBlock  ↔  plain JS objects
 *   AllocationStrategy  ↔  strategy functions
 *   VirtualHeap  ↔  VirtualHeap class below
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

// ── Allocation Strategies ─────────────────────────────────────────
const Strategies = {
  firstfit: (blocks, req) => {
    for (let i = 0; i < blocks.length; i++)
      if (blocks[i].isFree && blocks[i].size >= req) return i;
    return -1;
  },

  bestfit: (blocks, req) => {
    let best = -1, bestSize = Infinity;
    for (let i = 0; i < blocks.length; i++)
      if (blocks[i].isFree && blocks[i].size >= req && blocks[i].size < bestSize) {
        best = i; bestSize = blocks[i].size;
      }
    return best;
  },

  worstfit: (blocks, req) => {
    let worst = -1, worstSize = -1;
    for (let i = 0; i < blocks.length; i++)
      if (blocks[i].isFree && blocks[i].size >= req && blocks[i].size > worstSize) {
        worst = i; worstSize = blocks[i].size;
      }
    return worst;
  }
};

// ── VirtualHeap class ─────────────────────────────────────────────
class VirtualHeap {
  constructor(totalSize, strategyKey) {
    this.totalSize   = totalSize;
    this.strategyKey = strategyKey;
    this.blocks      = [{ startAddress: 0, size: totalSize,
                          isFree: true, marked: false, objectId: -1 }];
    this.nextId      = 1;
  }

  get strategyFn() { return Strategies[this.strategyKey]; }

  // ── Coalesce adjacent free blocks ──────────────────────────────
  _coalesce() {
    let i = 0;
    while (i < this.blocks.length - 1) {
      if (this.blocks[i].isFree && this.blocks[i + 1].isFree) {
        this.blocks[i].size += this.blocks[i + 1].size;
        this.blocks.splice(i + 1, 1);
      } else i++;
    }
  }

  // ── Allocate ───────────────────────────────────────────────────
  allocate(req) {
    if (req <= 0 || req > this.totalSize) return { ok: false, msg: 'Invalid size.' };

    const idx = this.strategyFn(this.blocks, req);
    if (idx === -1) return { ok: false, msg: 'Out of memory.' };

    const block    = this.blocks[idx];
    const leftover = block.size - req;
    const id       = this.nextId++;

    block.isFree   = false;
    block.size     = req;
    block.objectId = id;

    if (leftover > 0) {
      this.blocks.splice(idx + 1, 0, {
        startAddress: block.startAddress + req,
        size: leftover, isFree: true, marked: false, objectId: -1
      });
    }
    return { ok: true, id, msg: `Allocated ${req}B → Object #${id}` };
  }

  // ── Free ───────────────────────────────────────────────────────
  freeObject(id) {
    const b = this.blocks.find(b => !b.isFree && b.objectId === id);
    if (!b) return { ok: false, msg: `Object #${id} not found.` };
    b.isFree = true; b.marked = false; b.objectId = -1;
    this._coalesce();
    return { ok: true, msg: `Freed Object #${id}` };
  }

  // ── Mark Phase ─────────────────────────────────────────────────
  markObjects(roots) {
    this.blocks.forEach(b => b.marked = false);
    this.blocks.forEach(b => {
      if (!b.isFree && roots.includes(b.objectId)) b.marked = true;
    });
    return roots.length;
  }

  // ── Sweep Phase ────────────────────────────────────────────────
  sweep() {
    let collected = 0;
    this.blocks.forEach(b => {
      if (!b.isFree && !b.marked) {
        b.isFree = true; b.objectId = -1; collected++;
      }
    });
    if (collected > 0) this._coalesce();
    return collected;
  }

  // ── Analytics ──────────────────────────────────────────────────
  usedMemory() {
    return this.blocks.reduce((s, b) => s + (b.isFree ? 0 : b.size), 0);
  }

  freeMemory()  { return this.totalSize - this.usedMemory(); }
  blockCount()  { return this.blocks.length; }

  fragmentationRatio() {
    const free = this.freeMemory();
    if (free === 0) return 0;
    const largest = Math.max(0,
      ...this.blocks.filter(b => b.isFree).map(b => b.size));
    return 1 - (largest / free);
  }

  // ── Serialize / Deserialize (localStorage snapshot) ───────────
  serialize() {
    return JSON.stringify({
      totalSize:   this.totalSize,
      strategyKey: this.strategyKey,
      nextId:      this.nextId,
      blocks:      this.blocks
    });
  }

  static deserialize(json) {
    const data = JSON.parse(json);
    const h = new VirtualHeap(data.totalSize, data.strategyKey);
    h.nextId = data.nextId;
    h.blocks = data.blocks;
    return h;
  }
}

// ─────────────────────────────────────────────────────────────────
//  UI State
// ─────────────────────────────────────────────────────────────────
let heap = null;

// ─────────────────────────────────────────────────────────────────
//  UI Helpers
// ─────────────────────────────────────────────────────────────────
function log(msg, type = '') {
  const box  = document.getElementById('logBox');
  const time = new Date().toLocaleTimeString('en', { hour12: false });
  const div  = document.createElement('div');
  div.className = 'log-entry';
  div.innerHTML =
    `<span class="log-time">${time}</span>` +
    `<span class="log-msg ${type}">${msg}</span>`;
  box.prepend(div);
}

function clearLog() {
  document.getElementById('logBox').innerHTML = '';
}

function updateStats() {
  if (!heap) return;
  document.getElementById('statTotal').textContent  = heap.totalSize;
  document.getElementById('statUsed').textContent   = heap.usedMemory();
  document.getElementById('statFree').textContent   = heap.freeMemory();
  document.getElementById('statBlocks').textContent = heap.blockCount();
  document.getElementById('statFrag').textContent   =
    (heap.fragmentationRatio() * 100).toFixed(1) + '%';
  document.getElementById('strategyBadge').textContent =
    { firstfit: 'First Fit', bestfit: 'Best Fit', worstfit: 'Worst Fit' }
    [heap.strategyKey] ?? heap.strategyKey;
}

function renderHeapBar() {
  const bar = document.getElementById('heapBar');
  bar.innerHTML = '';
  if (!heap) return;

  heap.blocks.forEach(b => {
    const seg = document.createElement('div');
    const pct = (b.size / heap.totalSize * 100).toFixed(2);
    seg.className = 'heap-segment ' +
      (b.isFree ? 'free' : b.marked ? 'marked' : 'used');
    seg.style.flex = pct;
    const label = b.isFree
      ? `Free ${b.size}B @ ${b.startAddress}`
      : `#${b.objectId} ${b.size}B @ ${b.startAddress}`;
    seg.setAttribute('data-tip', label);
    seg.title = label;
    bar.appendChild(seg);
  });
}

function renderBlockTable() {
  const tbody = document.getElementById('blockTbody');
  tbody.innerHTML = '';
  if (!heap) return;

  heap.blocks.forEach((b, i) => {
    const stateTag = b.isFree
      ? '<span class="tag tag-free">Free</span>'
      : b.marked
        ? '<span class="tag tag-marked">Marked</span>'
        : '<span class="tag tag-used">Used</span>';

    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${i + 1}</td>` +
      `<td>${b.startAddress}</td>` +
      `<td>${b.size}</td>` +
      `<td>${stateTag}</td>` +
      `<td>${b.isFree ? '—' : '#' + b.objectId}</td>` +
      `<td>${(!b.isFree && b.marked) ? '✓' : ''}</td>`;
    tbody.appendChild(tr);
  });
}

function refresh() {
  updateStats();
  renderHeapBar();
  renderBlockTable();
}

// ─────────────────────────────────────────────────────────────────
//  Actions (called by HTML buttons)
// ─────────────────────────────────────────────────────────────────

function initHeap() {
  const size = parseInt(document.getElementById('heapSizeInput').value, 10);
  const strat = document.getElementById('strategySelect').value;
  if (isNaN(size) || size < 8 || size > 100000) {
    log('Heap size must be 8 – 100,000 bytes.', 'err');
    return;
  }
  heap = new VirtualHeap(size, strat);
  log(`Heap initialized: ${size} bytes, strategy = ${strat}`, 'ok');
  refresh();
}

function doAllocate() {
  if (!heap) { log('Initialize a heap first.', 'err'); return; }
  const req = parseInt(document.getElementById('allocSize').value, 10);
  if (isNaN(req) || req <= 0) { log('Invalid allocation size.', 'err'); return; }

  const result = heap.allocate(req);
  log(result.msg, result.ok ? 'ok' : 'err');
  refresh();
}

function doFree() {
  if (!heap) { log('Initialize a heap first.', 'err'); return; }
  const id = parseInt(document.getElementById('freeId').value, 10);
  if (isNaN(id)) { log('Enter a valid object ID.', 'err'); return; }

  const result = heap.freeObject(id);
  log(result.msg, result.ok ? 'ok' : 'err');
  refresh();
}

function doMark() {
  if (!heap) { log('Initialize a heap first.', 'err'); return; }
  const roots = parseRoots();
  const count = heap.markObjects(roots);
  log(`[GC Mark] ${count} root(s) marked as reachable.`, 'gc');
  refresh();
}

function doSweep() {
  if (!heap) { log('Initialize a heap first.', 'err'); return; }
  const collected = heap.sweep();
  log(`[GC Sweep] Collected ${collected} unreachable object(s).`, 'gc');
  refresh();
}

function doGC() {
  if (!heap) { log('Initialize a heap first.', 'err'); return; }
  const roots     = parseRoots();
  const marked    = heap.markObjects(roots);
  const collected = heap.sweep();
  log(`[GC Full] Marked ${marked} root(s), swept ${collected} object(s).`, 'gc');
  refresh();
}

function parseRoots() {
  const raw = document.getElementById('gcRoots').value;
  return raw.split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n));
}

// ── File I/O via localStorage (browser-safe equivalent of file save/load)
function doSave() {
  if (!heap) { log('Nothing to save — initialize a heap first.', 'err'); return; }
  const data = heap.serialize();
  // Download as .snapshot JSON file
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'heap.snapshot';
  a.click();
  URL.revokeObjectURL(url);
  log('Snapshot downloaded: heap.snapshot', 'io');
}

function doLoad() {
  const input = document.createElement('input');
  input.type  = 'file';
  input.accept = '.snapshot,application/json';
  input.onchange = e => {
    const file   = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        heap = VirtualHeap.deserialize(ev.target.result);
        log(`Snapshot loaded: ${file.name}`, 'io');
        refresh();
      } catch (err) {
        log('Failed to load snapshot: ' + err.message, 'err');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}