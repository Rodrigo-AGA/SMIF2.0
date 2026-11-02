const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const tarea = require('../controllers/tareaController');

router.get('/', authMiddleware, requireRole('alumno'), tarea.misTareas);
router.put('/:id', authMiddleware, requireRole('docente'), tarea.updateTarea);
router.delete('/:id', authMiddleware, requireRole('docente'), tarea.deleteTarea);
router.get('/:id/estado', authMiddleware, requireRole('docente'), tarea.estadoTarea);
// El estudiante SOLO puede marcar como hecha (no crear, editar ni borrar)
router.post('/:id/hecha', authMiddleware, requireRole('alumno'), tarea.marcarHecha);

module.exports = router;
