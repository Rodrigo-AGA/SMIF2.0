// Pruebas de flujo completo contra un servidor en ejecución (local o desplegado).
//   Local:   npm start (en otra terminal)  y luego  npm test
//   Nube:    BASE_URL=https://tu-app.onrender.com ADMIN_KEY=tu_clave npm test
// Requiere Node 18+ (fetch integrado). Usa ADMIN_KEY (de .env o del entorno) para crear un profesor de prueba.
require('dotenv').config();

const BASE = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const uid = Date.now().toString().slice(-8);               // sufijo único por ejecución
const PASSWORD = 'Clave1234';

let pasadas = 0, falladas = 0;
const check = (nombre, condicion, detalle = '') => {
  if (condicion) { pasadas++; console.log(`  ✔ ${nombre}`); }
  else { falladas++; console.log(`  ✘ ${nombre} ${detalle}`); }
};
const titulo = (t) => console.log(`\n${t}`);

// Cliente con cookie de sesión propia
function crearCliente() {
  let cookie = '';
  return async function call(method, path, { body, raw, headers = {}, redirect = 'manual' } = {}) {
    const h = { ...headers };
    if (cookie) h.Cookie = cookie;
    if (body !== undefined || raw !== undefined) h['Content-Type'] = 'application/json';
    const res = await fetch(BASE + path, {
      method, redirect, headers: h,
      body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined
    });
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    setCookies.forEach((c) => { const par = c.split(';')[0]; if (par.endsWith('=')) cookie = ''; else cookie = par; });
    let data = null;
    try { data = await res.json(); } catch (_) { /* respuesta sin JSON (redirecciones, HTML) */ }
    return { status: res.status, data, location: res.headers.get('location') };
  };
}

(async () => {
  console.log(`Probando ${BASE}`);
  const alumno = crearCliente();
  const docente = crearCliente();
  const anonimo = crearCliente();

  const dniAlumno = '9' + uid.slice(1, 8);                 // 8 dígitos
  const dniDocente = '8' + uid.slice(1, 8);
  const emailAlumno = `alumno.${uid}@prueba.com`;
  const cuentaAlumno = {
    rol: 'alumno', nombre: 'Prueba', apellidos: 'Alumno', dni: dniAlumno, email: emailAlumno,
    celular: '912345678', password: PASSWORD, ciclo: 'Ciclo 1', modalidad: 'virtual'
  };

  // ---------- 0. Disponibilidad ----------
  titulo('0. Disponibilidad');
  let r = await anonimo('GET', '/health');
  check('GET /health responde 200', r.status === 200, `(status ${r.status})`);
  r = await anonimo('GET', '/login.html');
  check('La página de login es pública', r.status === 200, `(status ${r.status})`);

  // ---------- 1. Registro ----------
  titulo('1. Registro de usuarios');
  r = await anonimo('POST', '/api/auth/register', { body: cuentaAlumno });
  check('Registro de estudiante → 201', r.status === 201, `(status ${r.status}: ${r.data && r.data.message})`);
  check('La respuesta no expone el hash de la contraseña', r.data && r.data.data && !('password' in r.data.data) && !('password_hash' in r.data.data));
  r = await anonimo('POST', '/api/auth/register', { body: { ...cuentaAlumno, dni: '7' + uid.slice(1, 8) } });
  check('Correo duplicado → 409', r.status === 409, `(status ${r.status})`);
  r = await anonimo('POST', '/api/auth/register', { body: { ...cuentaAlumno, email: `otro.${uid}@prueba.com` } });
  check('DNI duplicado → 409', r.status === 409, `(status ${r.status})`);
  r = await anonimo('POST', '/api/auth/register', { body: {} });
  check('Registro con datos vacíos → 400', r.status === 400, `(status ${r.status})`);
  r = await anonimo('POST', '/api/auth/register', { body: { ...cuentaAlumno, password: '123' } });
  check('Contraseña débil → 400', r.status === 400, `(status ${r.status})`);
  r = await anonimo('POST', '/api/auth/register', { raw: '{ esto no es json' });
  check('JSON inválido → 400', r.status === 400, `(status ${r.status})`);
  r = await anonimo('POST', '/api/auth/register', {
    body: { ...cuentaAlumno, rol: 'docente', dni: dniDocente, especialidad: 'X' }, headers: { 'x-admin-key': 'clave-incorrecta' }
  });
  check('Registrar profesor sin clave de secretaría → 403', r.status === 403, `(status ${r.status})`);

  if (ADMIN_KEY) {
    r = await anonimo('POST', '/api/auth/register', {
      body: { rol: 'docente', nombre: 'Prueba', apellidos: 'Docente', dni: dniDocente, email: `docente.${uid}@prueba.com`,
              celular: '923456789', password: PASSWORD, especialidad: 'Pruebas' },
      headers: { 'x-admin-key': ADMIN_KEY }
    });
    check('Registro de profesor con clave de secretaría → 201', r.status === 201, `(status ${r.status}: ${r.data && r.data.message})`);
  } else {
    console.log('  – Sin ADMIN_KEY: se omiten las pruebas de profesor (defínela en .env o en el entorno)');
  }

  // ---------- 2. Login y dashboard del estudiante ----------
  titulo('2. Login y dashboard (estudiante)');
  r = await alumno('POST', '/api/auth/login', { body: { rol: 'alumno', dni: dniAlumno, password: 'incorrecta1' } });
  check('Contraseña incorrecta → 401', r.status === 401, `(status ${r.status})`);
  r = await alumno('POST', '/api/auth/login', { body: { rol: 'alumno', dni: "' OR '1'='1", password: 'x' } });
  check('Inyección SQL en el DNI → 400 (rechazada)', r.status === 400, `(status ${r.status})`);
  r = await alumno('POST', '/api/auth/login', { body: { rol: 'alumno', dni: dniAlumno, password: PASSWORD } });
  check('Login correcto → 200', r.status === 200, `(status ${r.status})`);
  r = await alumno('GET', '/api/perfil');
  check('Perfil del estudiante → 200', r.status === 200 && r.data.data.rol === 'alumno', `(status ${r.status})`);
  r = await alumno('GET', '/api/resumen');
  check('Dashboard (resumen) → 200 sin datos de profesor', r.status === 200 && r.data.data.estudiantes === undefined, `(status ${r.status})`);
  r = await alumno('GET', '/api/cursos');
  check('El estudiante puede ver los cursos → 200', r.status === 200, `(status ${r.status})`);
  r = await alumno('GET', '/alumno.html');
  check('Página del estudiante accesible → 200', r.status === 200, `(status ${r.status})`);

  // ---------- 3. Rutas no autorizadas ----------
  titulo('3. Control de acceso (estudiante)');
  r = await alumno('GET', '/api/estudiantes');
  check('Estudiante no ve /api/estudiantes → 403', r.status === 403, `(status ${r.status})`);
  r = await alumno('POST', '/api/estudiantes', { body: { nombre: 'A', email: 'a@a.com', carrera: 'B' } });
  check('Estudiante no crea estudiantes → 403', r.status === 403, `(status ${r.status})`);
  r = await alumno('POST', '/api/cursos', { body: { codigo: 'X1', nombre: 'X', creditos: 3, ciclo: 'C1' } });
  check('Estudiante no crea cursos → 403', r.status === 403, `(status ${r.status})`);
  r = await alumno('GET', '/api/alumnos');
  check('Estudiante no ve la lista de alumnos → 403', r.status === 403, `(status ${r.status})`);
  r = await alumno('GET', '/docente.html');
  check('Estudiante en /docente.html → redirige a /alumno.html', r.status === 302 && /alumno\.html$/.test(r.location || ''), `(status ${r.status}, ${r.location})`);

  // ---------- 4. Sin sesión ----------
  titulo('4. Intentos sin sesión');
  for (const ruta of ['/api/perfil', '/api/estudiantes', '/api/cursos', '/api/resumen']) {
    r = await anonimo('GET', ruta);
    check(`GET ${ruta} → 401`, r.status === 401, `(status ${r.status})`);
  }
  r = await anonimo('DELETE', '/api/estudiantes/1');
  check('DELETE /api/estudiantes/1 sin sesión → 401', r.status === 401, `(status ${r.status})`);
  r = await anonimo('GET', '/estudiantes.html');
  check('/estudiantes.html sin sesión → redirige al login', r.status === 302 && /login\.html$/.test(r.location || ''), `(status ${r.status})`);
  r = await anonimo('GET', '/api/no-existe');
  check('Ruta de API inexistente → 404', r.status === 404, `(status ${r.status})`);

  // ---------- 5. Cierre de sesión (estudiante) ----------
  titulo('5. Cierre de sesión');
  r = await alumno('POST', '/api/auth/logout');
  check('Logout → 200', r.status === 200, `(status ${r.status})`);
  r = await alumno('GET', '/api/perfil');
  check('Tras el logout el perfil → 401', r.status === 401, `(status ${r.status})`);

  // ---------- 6. Profesor: CRUD ----------
  if (!ADMIN_KEY) {
    console.log('\n6. CRUD de profesor omitido (falta ADMIN_KEY).');
  } else {
    titulo('6. Profesor: CRUD de estudiantes y cursos');
    r = await docente('POST', '/api/auth/login', { body: { rol: 'docente', dni: dniDocente, password: PASSWORD } });
    check('Login de profesor → 200', r.status === 200, `(status ${r.status})`);
    r = await docente('GET', '/api/resumen');
    check('Dashboard del profesor incluye estudiantes y alumnos', r.status === 200 && r.data.data.estudiantes !== undefined, `(status ${r.status})`);
    r = await docente('GET', '/docente.html');
    check('Página del profesor → 200', r.status === 200, `(status ${r.status})`);

    // ----- Estudiantes -----
    const est = { nombre: `Estudiante ${uid}`, email: `est.${uid}@prueba.com`, carrera: 'Ingeniería de Sistemas' };
    r = await docente('POST', '/api/estudiantes', { body: {} });
    check('Estudiante con datos vacíos → 400', r.status === 400, `(status ${r.status})`);
    r = await docente('POST', '/api/estudiantes', { body: { ...est, email: 'no-es-correo' } });
    check('Estudiante con correo inválido → 400', r.status === 400, `(status ${r.status})`);
    r = await docente('POST', '/api/estudiantes', { body: est });
    check('Crear estudiante → 201', r.status === 201, `(status ${r.status})`);
    const idEst = r.data && r.data.data && r.data.data.id;
    r = await docente('POST', '/api/estudiantes', { body: est });
    check('Correo de estudiante duplicado → 409', r.status === 409, `(status ${r.status})`);
    r = await docente('GET', `/api/estudiantes/${idEst}`);
    check('Obtener estudiante → 200', r.status === 200, `(status ${r.status})`);
    r = await docente('GET', '/api/estudiantes/999999999');
    check('Estudiante inexistente → 404', r.status === 404, `(status ${r.status})`);
    r = await docente('GET', '/api/estudiantes/abc');
    check('ID no numérico → 400', r.status === 400, `(status ${r.status})`);
    r = await docente('PUT', `/api/estudiantes/${idEst}`, { body: { ...est, carrera: 'Ingeniería de Software' } });
    check('Actualizar estudiante → 200', r.status === 200 && r.data.data.carrera === 'Ingeniería de Software', `(status ${r.status})`);
    r = await docente('POST', '/api/estudiantes', { body: { nombre: "Robert'); DROP TABLE estudiantes;--", email: `sqli.${uid}@prueba.com`, carrera: 'X' } });
    check('Texto con intento de inyección SQL se guarda como texto → 201', r.status === 201, `(status ${r.status})`);
    const idSqli = r.data && r.data.data && r.data.data.id;
    r = await docente('GET', '/api/estudiantes');
    check('La tabla estudiantes sigue existiendo tras la inyección → 200', r.status === 200, `(status ${r.status})`);
    if (idSqli) await docente('DELETE', `/api/estudiantes/${idSqli}`);
    r = await docente('DELETE', `/api/estudiantes/${idEst}`);
    check('Eliminar estudiante → 200', r.status === 200, `(status ${r.status})`);
    r = await docente('DELETE', `/api/estudiantes/${idEst}`);
    check('Eliminar de nuevo → 404', r.status === 404, `(status ${r.status})`);

    // ----- Cursos -----
    const curso = { codigo: `T${uid}`, nombre: 'Curso de prueba', creditos: 4, ciclo: 'Ciclo 1' };
    r = await docente('POST', '/api/cursos', { body: {} });
    check('Curso con datos vacíos → 400', r.status === 400, `(status ${r.status})`);
    r = await docente('POST', '/api/cursos', { body: { ...curso, creditos: 99 } });
    check('Curso con créditos fuera de rango → 400', r.status === 400, `(status ${r.status})`);
    r = await docente('POST', '/api/cursos', { body: curso });
    check('Crear curso → 201', r.status === 201, `(status ${r.status})`);
    const idCurso = r.data && r.data.data && r.data.data.id;
    r = await docente('POST', '/api/cursos', { body: curso });
    check('Código de curso duplicado → 409', r.status === 409, `(status ${r.status})`);
    r = await docente('PUT', `/api/cursos/${idCurso}`, { body: { ...curso, creditos: 5 } });
    check('Actualizar curso → 200', r.status === 200 && r.data.data.creditos === 5, `(status ${r.status})`);
    r = await docente('GET', '/api/cursos/999999999');
    check('Curso inexistente → 404', r.status === 404, `(status ${r.status})`);
    r = await docente('DELETE', `/api/cursos/${idCurso}`);
    check('Eliminar curso → 200', r.status === 200, `(status ${r.status})`);

    // ---------- Clases, horarios y tareas ----------
    titulo('7. Clases, horarios y tareas');
    const docente2 = crearCliente();
    const alumno2 = crearCliente();
    const dniA2 = '6' + uid.slice(1, 8);
    const dniD2 = '5' + uid.slice(1, 8);
    r = await anonimo('POST', '/api/auth/register', { body: { ...cuentaAlumno, dni: dniA2, email: `alumno2.${uid}@prueba.com` } });
    check('Segundo estudiante registrado → 201', r.status === 201, `(status ${r.status})`);
    r = await anonimo('POST', '/api/auth/register', {
      body: { rol: 'docente', nombre: 'Prueba', apellidos: 'Docente Dos', dni: dniD2, email: `docente2.${uid}@prueba.com`,
              celular: '934567890', password: PASSWORD, especialidad: 'Pruebas' },
      headers: { 'x-admin-key': ADMIN_KEY }
    });
    check('Segundo profesor registrado → 201', r.status === 201, `(status ${r.status})`);
    r = await alumno('POST', '/api/auth/login', { body: { rol: 'alumno', dni: dniAlumno, password: PASSWORD } });
    const idA1 = r.data && r.data.data && r.data.data.id;
    r = await alumno2('POST', '/api/auth/login', { body: { rol: 'alumno', dni: dniA2, password: PASSWORD } });
    const idA2 = r.data && r.data.data && r.data.data.id;
    await docente2('POST', '/api/auth/login', { body: { rol: 'docente', dni: dniD2, password: PASSWORD } });
    r = await docente('GET', '/api/alumnos');
    check('El profesor ve la lista de alumnos para elegir', r.status === 200 && r.data.data.some((a) => a.id === idA1), `(status ${r.status})`);

    const base = { nombre: `Clase ${uid}`, dia_semana: 1, hora_inicio: '08:00', hora_fin: '10:00', alumnos: [idA1] };
    r = await docente('POST', '/api/clases', { body: { nombre: 'Sin horario' } });
    check('Clase sin horario → 400', r.status === 400, `(status ${r.status})`);
    r = await docente('POST', '/api/clases', { body: { ...base, hora_fin: '08:00' } });
    check('Hora de fin igual a la de inicio → 400', r.status === 400, `(status ${r.status})`);
    r = await docente('POST', '/api/clases', { body: { ...base, hora_inicio: '11:00', hora_fin: '09:00' } });
    check('Hora de fin anterior a la de inicio → 400', r.status === 400, `(status ${r.status})`);
    r = await docente('POST', '/api/clases', { body: { ...base, dia_semana: 9 } });
    check('Día inválido → 400', r.status === 400, `(status ${r.status})`);
    r = await docente('POST', '/api/clases', { body: { ...base, alumnos: [999999999] } });
    check('Alumno inexistente → 400', r.status === 400, `(status ${r.status})`);
    r = await docente('POST', '/api/clases', { body: base });
    check('Crear clase con alumnos y horario → 201', r.status === 201 && r.data.data.alumnos.length === 1, `(status ${r.status}: ${r.data && r.data.message})`);
    const idClase1 = r.data && r.data.data && r.data.data.id;

    r = await docente('POST', '/api/clases', { body: { ...base, nombre: `Choque profesor ${uid}`, alumnos: [], hora_inicio: '09:00', hora_fin: '11:00' } });
    check('Choque de horario del profesor → 409', r.status === 409, `(status ${r.status})`);
    r = await docente2('POST', '/api/clases', { body: { ...base, nombre: `Choque alumno ${uid}`, hora_inicio: '09:00', hora_fin: '11:00' } });
    check('Alumno ya ocupado en ese horario → 409', r.status === 409, `(status ${r.status}: ${r.data && r.data.message})`);
    r = await docente2('POST', '/api/clases', { body: { ...base, nombre: `Clase 2 ${uid}`, hora_inicio: '09:00', hora_fin: '11:00', alumnos: [idA2] } });
    check('Mismo horario con otro alumno libre → 201', r.status === 201, `(status ${r.status})`);
    const idClase2 = r.data && r.data.data && r.data.data.id;
    r = await docente('POST', '/api/clases', { body: { ...base, nombre: `Contigua ${uid}`, hora_inicio: '10:00', hora_fin: '12:00' } });
    check('Clase que empieza justo cuando termina otra (10:00) no choca → 201', r.status === 201, `(status ${r.status}: ${r.data && r.data.message})`);
    const idClase3 = r.data && r.data.data && r.data.data.id;
    r = await docente('PUT', `/api/clases/${idClase3}`, { body: { ...base, nombre: `Contigua ${uid}`, hora_inicio: '09:30', hora_fin: '12:00' } });
    check('Mover la clase a un horario que choca → 409', r.status === 409, `(status ${r.status})`);
    r = await docente('PUT', `/api/clases/${idClase3}`, { body: { ...base, nombre: `Contigua ${uid}`, hora_inicio: '10:00', hora_fin: '12:00', alumnos: [idA1, idA2] } });
    check('Añadir a la clase un alumno ocupado a esa hora → 409', r.status === 409, `(status ${r.status})`);
    r = await docente('PUT', `/api/clases/${idClase3}`, { body: { ...base, nombre: `Contigua ${uid} editada`, hora_inicio: '10:00', hora_fin: '12:00' } });
    check('Editar la clase sin crear choques (no choca consigo misma) → 200', r.status === 200, `(status ${r.status}: ${r.data && r.data.message})`);

    r = await alumno('POST', '/api/clases', { body: base });
    check('El estudiante no puede crear clases → 403', r.status === 403, `(status ${r.status})`);
    r = await alumno('GET', '/api/clases');
    check('El estudiante ve solo sus 2 clases (su horario) → 200', r.status === 200 && r.data.data.length === 2 && r.data.data[0].docente, `(status ${r.status})`);
    r = await alumno2('GET', `/api/clases/${idClase1}`);
    check('Un estudiante no inscrito no ve la clase → 404', r.status === 404, `(status ${r.status})`);
    r = await docente2('PUT', `/api/clases/${idClase1}`, { body: base });
    check('Un profesor no edita clases de otro → 404', r.status === 404, `(status ${r.status})`);
    r = await docente2('DELETE', `/api/clases/${idClase1}`);
    check('Un profesor no elimina clases de otro → 404', r.status === 404, `(status ${r.status})`);

    // ----- tareas -----
    const tarea = { titulo: `Tarea ${uid}`, descripcion: 'Resolver la guía', fecha_limite: '2030-12-31' };
    r = await docente('POST', `/api/clases/${idClase1}/tareas`, { body: { ...tarea, titulo: '' } });
    check('Tarea sin título → 400', r.status === 400, `(status ${r.status})`);
    r = await docente('POST', `/api/clases/${idClase1}/tareas`, { body: { ...tarea, fecha_limite: 'mañana' } });
    check('Tarea con fecha inválida → 400', r.status === 400, `(status ${r.status})`);
    r = await docente('POST', `/api/clases/${idClase1}/tareas`, { body: tarea });
    check('El profesor crea una tarea en su clase → 201', r.status === 201, `(status ${r.status})`);
    const idTarea = r.data && r.data.data && r.data.data.id;
    r = await docente2('POST', `/api/clases/${idClase1}/tareas`, { body: tarea });
    check('Otro profesor no crea tareas en esa clase → 404', r.status === 404, `(status ${r.status})`);
    r = await alumno('POST', `/api/clases/${idClase1}/tareas`, { body: tarea });
    check('El estudiante no crea tareas → 403', r.status === 403, `(status ${r.status})`);
    r = await alumno('PUT', `/api/tareas/${idTarea}`, { body: tarea });
    check('El estudiante no edita tareas → 403', r.status === 403, `(status ${r.status})`);
    r = await alumno('DELETE', `/api/tareas/${idTarea}`);
    check('El estudiante no elimina tareas → 403', r.status === 403, `(status ${r.status})`);
    r = await alumno('GET', '/api/tareas');
    check('El estudiante ve su tarea pendiente', r.status === 200 && r.data.data.some((t) => t.id === idTarea && t.hecha === false), `(status ${r.status})`);
    r = await docente('POST', `/api/tareas/${idTarea}/hecha`);
    check('El profesor no usa "marcar como hecha" → 403', r.status === 403, `(status ${r.status})`);
    r = await alumno2('POST', `/api/tareas/${idTarea}/hecha`);
    check('Alumno de otra clase no puede marcarla → 403', r.status === 403, `(status ${r.status})`);
    r = await alumno('POST', '/api/tareas/999999999/hecha');
    check('Marcar una tarea inexistente → 404', r.status === 404, `(status ${r.status})`);
    r = await alumno('POST', `/api/tareas/${idTarea}/hecha`);
    check('El estudiante marca la tarea como hecha → 200', r.status === 200, `(status ${r.status})`);
    r = await alumno('POST', `/api/tareas/${idTarea}/hecha`);
    check('Marcarla otra vez no falla (idempotente) → 200', r.status === 200, `(status ${r.status})`);
    r = await alumno('GET', `/api/clases/${idClase1}/tareas`);
    check('La tarea aparece como hecha para el estudiante', r.status === 200 && r.data.data[0].hecha === true, `(status ${r.status})`);
    r = await docente('GET', `/api/tareas/${idTarea}/estado`);
    check('El profesor ve quién la hizo', r.status === 200 && r.data.data.some((a) => a.id === idA1 && a.hecha === true), `(status ${r.status})`);
    r = await docente('GET', `/api/clases/${idClase1}/tareas`);
    check('El profesor ve el progreso 1/1', r.status === 200 && r.data.data[0].hechas === 1 && r.data.data[0].total === 1, `(status ${r.status})`);
    r = await docente('PUT', `/api/tareas/${idTarea}`, { body: { ...tarea, titulo: `Tarea ${uid} editada` } });
    check('El profesor edita la tarea → 200', r.status === 200, `(status ${r.status})`);
    r = await docente('DELETE', `/api/tareas/${idTarea}`);
    check('El profesor elimina la tarea → 200', r.status === 200, `(status ${r.status})`);

    // limpieza
    await docente('DELETE', `/api/clases/${idClase1}`);
    await docente('DELETE', `/api/clases/${idClase3}`);
    r = await docente2('DELETE', `/api/clases/${idClase2}`);
    check('El profesor elimina su clase → 200', r.status === 200, `(status ${r.status})`);
    await alumno('POST', '/api/auth/logout'); await alumno2('POST', '/api/auth/logout'); await docente2('POST', '/api/auth/logout');

    titulo('8. Cierre de sesión (profesor)');
    r = await docente('POST', '/api/auth/logout');
    check('Logout → 200', r.status === 200, `(status ${r.status})`);
    r = await docente('GET', '/api/estudiantes');
    check('Tras el logout /api/estudiantes → 401', r.status === 401, `(status ${r.status})`);
  }

  console.log(`\nResultado: ${pasadas} correctas, ${falladas} fallidas`);
  process.exit(falladas ? 1 : 0);
})().catch((e) => { console.error('No se pudo ejecutar la prueba:', e.message); process.exit(2); });
