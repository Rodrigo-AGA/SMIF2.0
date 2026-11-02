const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const controller = require('../controllers/cursoController');

// Leer: cualquier usuario con sesión (alumno o docente). Escribir: solo docente.
router.get('/', authMiddleware, controller.getCursos);
router.get('/:id', authMiddleware, controller.getCursoById);
router.post('/', authMiddleware, requireRole('docente'), controller.createCurso);
router.put('/:id', authMiddleware, requireRole('docente'), controller.updateCurso);
router.delete('/:id', authMiddleware, requireRole('docente'), controller.deleteCurso);

module.exports = router;
