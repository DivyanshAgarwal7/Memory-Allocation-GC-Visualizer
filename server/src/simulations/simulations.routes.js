import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { createSimulationSchema, updateSimulationSchema, idParamSchema } from './simulations.validation.js';
import { create, list, getOne, update, remove } from './simulations.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/', validate(createSimulationSchema), create);
router.get('/', list);
router.get('/:id', validate(idParamSchema, 'params'), getOne);
router.put('/:id', validate(idParamSchema, 'params'), validate(updateSimulationSchema), update);
router.delete('/:id', validate(idParamSchema, 'params'), remove);

export default router;
