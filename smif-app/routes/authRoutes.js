const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/logout', authController.logout);
// Sin registro público: más adelante un usuario administrador creará las cuentas.

module.exports = router;
