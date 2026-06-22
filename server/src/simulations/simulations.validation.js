import { z } from 'zod';

const blockSchema = z.object({
  startAddress: z.number().int().min(0),
  size: z.number().int().min(1),
  isFree: z.boolean(),
  marked: z.boolean(),
  objectId: z.number().int(),
});

// Matches the exact shape of VirtualHeap.serialize() in simulator.js:
// { totalSize, strategyKey, nextId, blocks }
export const heapDataSchema = z
  .object({
    totalSize: z.number().int().min(8).max(1_000_000),
    strategyKey: z.enum(['firstfit', 'bestfit', 'worstfit']),
    nextId: z.number().int().min(1),
    blocks: z.array(blockSchema).min(1).max(5000, 'Too many blocks to save (max 5000).'),
  })
  // Integrity check: block sizes must actually add up to the declared heap size.
  // Rejects tampered or corrupted snapshots rather than silently storing them.
  .refine(
    (heap) => heap.blocks.reduce((sum, b) => sum + b.size, 0) === heap.totalSize,
    { message: 'Block sizes do not add up to totalSize - snapshot looks corrupted.' }
  );

export const createSimulationSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(60, 'Name must be at most 60 characters.'),
  data: heapDataSchema,
});

// For PUT /api/simulations/:id - rename, overwrite the saved data, or both.
// At least one of the two must be present.
export const updateSimulationSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required.').max(60, 'Name must be at most 60 characters.').optional(),
    data: heapDataSchema.optional(),
  })
  .refine((val) => val.name !== undefined || val.data !== undefined, {
    message: 'Provide a new name and/or data to update.',
  });

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
