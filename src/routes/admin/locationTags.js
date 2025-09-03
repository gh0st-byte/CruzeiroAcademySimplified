import express from 'express';
import locationTagController from '../../controllers/locationTagController.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/authorization.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting for location tag operations
const createLocationTagLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 creates per minute
  message: {
    error: 'Too many location tag creation attempts',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const updateLocationTagLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute  
  max: 20, // 20 updates per minute
  message: {
    error: 'Too many location tag update attempts',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const deleteLocationTagLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 deletes per 5 minutes
  message: {
    error: 'Too many location tag deletion attempts',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware para todas as rotas - requer autenticação
router.use(authenticate);

// Rotas que requerem apenas autenticação (super_admin e viewer podem ver)
router.get('/', locationTagController.listLocationTags);
router.get('/stats', locationTagController.getLocationTagStats);
router.get('/:id', locationTagController.getLocationTag);
router.get('/:id/contents', locationTagController.getContentsByLocationTag);

// Rotas que requerem super_admin
router.post('/', 
  requireRole(['super_admin']), 
  createLocationTagLimiter,
  locationTagController.createLocationTag
);

router.put('/:id', 
  requireRole(['super_admin']), 
  updateLocationTagLimiter,
  locationTagController.updateLocationTag
);

router.patch('/:id/toggle', 
  requireRole(['super_admin']), 
  updateLocationTagLimiter,
  locationTagController.toggleLocationTag
);

router.delete('/:id', 
  requireRole(['super_admin']), 
  deleteLocationTagLimiter,
  locationTagController.deleteLocationTag
);

export default router;
