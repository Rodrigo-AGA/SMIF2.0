const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const userController = require('../controllers/userController');

router.get('/perfil', authMiddleware, userController.getProfile);
router.get('/resumen', authMiddleware, userController.getResumen);
router.get('/alumnos', authMiddleware, requireRole('docente'), userController.getAlumnos);

module.exports = router;
