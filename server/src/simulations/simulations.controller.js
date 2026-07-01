import { queries } from '../db.js';

const MAX_SIMULATIONS_PER_USER = 20;

function toSummary(row) {
  return { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at };
}

// Same math as VirtualHeap.usedMemory()/freeMemory()/fragmentationRatio()
// in simulator.js, computed here from the stored snapshot. Returns only
// aggregate numbers - never the raw block array - so the dashboard can
// render a proportional preview without shipping potentially thousands
// of block objects just for a list view.
function computePreview(dataJson) {
  const heap = JSON.parse(dataJson);
  let usedBytes = 0;
  let markedBytes = 0;
  let largestFree = 0;

  for (const b of heap.blocks) {
    if (!b.isFree) {
      usedBytes += b.size;
      if (b.marked) markedBytes += b.size;
    } else if (b.size > largestFree) {
      largestFree = b.size;
    }
  }

  const freeBytes = heap.totalSize - usedBytes;
  const fragmentationPercent = freeBytes === 0 ? 0 : Math.round((1 - largestFree / freeBytes) * 100);

  return {
    totalSize: heap.totalSize,
    usedBytes,
    freeBytes,
    markedBytes,
    blockCount: heap.blocks.length,
    fragmentationPercent,
    strategyKey: heap.strategyKey,
  };
}

// ── POST /api/simulations ───────────────────────────────────────
export function create(req, res, next) {
  try {
    const { count } = queries.countSimulationsByUser.get(req.user.id);
    if (count >= MAX_SIMULATIONS_PER_USER) {
      return res.status(409).json({
        error: `You've reached the limit of ${MAX_SIMULATIONS_PER_USER} saved simulations. Delete one before saving another.`,
      });
    }

    const { name, data } = req.validated;
    const info = queries.insertSimulation.run(req.user.id, name, JSON.stringify(data));
    const row = queries.getSimulationOwned.get(info.lastInsertRowid, req.user.id);

    return res.status(201).json({ simulation: toSummary(row) });
  } catch (err) {
    return next(err);
  }
}

// ── GET /api/simulations ────────────────────────────────────────
export function list(req, res, next) {
  try {
    const rows = queries.listSimulationsByUser.all(req.user.id);
    const simulations = rows.map((row) => ({ ...toSummary(row), preview: computePreview(row.data) }));
    return res.json({ simulations });
  } catch (err) {
    return next(err);
  }
}

// ── GET /api/simulations/:id ────────────────────────────────────
export function getOne(req, res, next) {
  try {
    const row = queries.getSimulationOwned.get(req.validatedParams.id, req.user.id);
    // Same 404 whether the row doesn't exist or belongs to someone else -
    // don't reveal which, so IDs can't be used to probe other accounts.
    if (!row) return res.status(404).json({ error: 'Simulation not found.' });

    return res.json({ simulation: { ...toSummary(row), data: JSON.parse(row.data) } });
  } catch (err) {
    return next(err);
  }
}

// ── PUT /api/simulations/:id ────────────────────────────────────
// Renames the simulation, overwrites its saved data, or both -
// whichever fields were sent (validated to require at least one).
export function update(req, res, next) {
  try {
    const { id } = req.validatedParams;
    const { name, data } = req.validated;

    // Same 404-for-both-cases pattern as getOne/remove: don't reveal
    // whether the row exists but belongs to someone else.
    const existing = queries.getSimulationOwned.get(id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Simulation not found.' });

    if (name !== undefined && data !== undefined) {
      queries.updateNameAndDataOwned.run(name, JSON.stringify(data), id, req.user.id);
    } else if (name !== undefined) {
      queries.updateNameOwned.run(name, id, req.user.id);
    } else {
      queries.updateDataOwned.run(JSON.stringify(data), id, req.user.id);
    }

    const updated = queries.getSimulationOwned.get(id, req.user.id);
    return res.json({ simulation: toSummary(updated) });
  } catch (err) {
    return next(err);
  }
}

// ── DELETE /api/simulations/:id ─────────────────────────────────
export function remove(req, res, next) {
  try {
    const info = queries.deleteSimulationOwned.run(req.validatedParams.id, req.user.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Simulation not found.' });

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}
