const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const controller = require('../controllers/estudianteController');

// Todo el CRUD exige sesión iniciada y rol docente (401 sin sesión, 403 si es alumno).
// Para permitir a cualquier usuario autenticado, quita requireRole('docente').
router.use(authMiddleware, requireRole('docente'));

router.get('/', controller.getEstudiantes);
router.get('/:id', controller.getEstudianteById);
router.post('/', controller.createEstudiante);
router.put('/:id', controller.updateEstudiante);
router.delete('/:id', controller.deleteEstudiante);

module.exports = router;
