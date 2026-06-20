import { queries } from '../db.js';

const MAX_SIMULATIONS_PER_USER = 20;

function toSummary(row) {
  return { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at };
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
    return res.json({ simulations: rows.map(toSummary) });
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
