const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const clase = require('../controllers/claseController');
const tarea = require('../controllers/tareaController');

// Profesor: crea y administra sus clases. Estudiante: solo consulta las suyas.
router.get('/', authMiddleware, clase.getClases);
router.get('/:id', authMiddleware, clase.getClaseById);
router.post('/', authMiddleware, requireRole('docente'), clase.createClase);
router.put('/:id', authMiddleware, requireRole('docente'), clase.updateClase);
router.delete('/:id', authMiddleware, requireRole('docente'), clase.deleteClase);

// Tareas de una clase
router.get('/:id/tareas', authMiddleware, tarea.listByClase);
router.post('/:id/tareas', authMiddleware, requireRole('docente'), tarea.createTarea);

module.exports = router;
