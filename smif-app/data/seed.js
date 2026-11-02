const bcrypt = require('bcryptjs');
const store = require('./userStore');

// Inserta los usuarios de prueba solo si todavía no existen en PostgreSQL.
module.exports = async function seed() {
  const password = await bcrypt.hash(process.env.SEED_PASSWORD || 'smif2026', 10);
  const base = [
    { rol: 'alumno',  dni: '12345678', nombre: 'Ana',    apellidos: 'Torres Quispe', email: 'ana.torres@correo.com',  celular: '987654321', ciclo: 'Ciclo 1', modalidad: 'presencial' },
    { rol: 'alumno',  dni: '23456789', nombre: 'Luis',   apellidos: 'Quispe Mamani', email: 'luis.quispe@correo.com', celular: '976543210', ciclo: 'Ciclo 2', modalidad: 'virtual' },
    { rol: 'docente', dni: '34567890', nombre: 'María',  apellidos: 'Rojas Salas',   email: 'maria.rojas@smif.edu.pe', celular: '965432109', especialidad: 'Matemática' },
    { rol: 'docente', dni: '45678901', nombre: 'Carlos', apellidos: 'Mendoza Ccori', email: 'carlos.mendoza@smif.edu.pe', celular: '954321098', especialidad: 'Comunicación' }
  ];
  let nuevos = 0;
  for (const u of base) {
    if (!(await store.findByDni(u.dni))) {
      await store.add({ ...u, password });
      nuevos++;
    }
  }
  console.log(`Usuarios de prueba: ${nuevos} nuevo(s), ${base.length - nuevos} ya existían.`);
};
