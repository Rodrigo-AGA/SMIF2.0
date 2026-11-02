# Academia SMIF – Aula virtual (Laboratorio 10)

Proyecto Full Stack integrado en un solo repositorio:
**Frontend** (Bootstrap + JS + Fetch API) · **API REST** (Express) · **PostgreSQL** (`pg` + Pool) · sesiones en PostgreSQL · listo para Render/Railway.

## Ejecutar en local
1. Crear la base: `CREATE DATABASE gestion_academica;`
2. Copiar `.env.example` a `.env` y completar `DB_PASSWORD`, `SESSION_SECRET` y `ADMIN_KEY`.
3. `npm install` y `npm start` → http://localhost:3000
4. En otra terminal: `npm test` (pruebas de flujo completo).

Las tablas (`usuarios`, `estudiantes`, `cursos`, `session`) se crean solas. En desarrollo se cargan usuarios de prueba (contraseña `smif2026`):
estudiante DNI `12345678`, profesor DNI `34567890`.

## Roles
| Función | Estudiante | Profesor |
|---|---|---|
| Registro | Libre (`/registro.html`) | Con clave de secretaría (`ADMIN_KEY`) |
| Perfil, dashboard y cursos (lectura) | Sí | Sí |
| CRUD de cursos | No (403) | Sí |
| Crear/editar/eliminar clases con horario y alumnos | No (403) | Sí (solo las suyas) |
| Ver sus clases y horario | Sí (donde está inscrito) | Sí |
| Crear/editar/eliminar tareas de una clase | No (403) | Sí |
| Marcar una tarea como hecha | **Sí (única acción)** | No (403) |
| Ver quién hizo cada tarea | No | Sí |
| CRUD de estudiantes y lista de alumnos | No (403) | Sí |

## Endpoints
| Método | Ruta | Acceso |
|---|---|---|
| GET | /health | Público |
| POST | /api/auth/register · /login · /logout | Público (registrar profesor: `x-admin-key`) |
| GET | /api/perfil · /api/resumen | Autenticado |
| GET | /api/alumnos | Profesor |
| GET | /api/cursos · /api/cursos/:id | Autenticado |
| POST/PUT/DELETE | /api/cursos[/:id] | Profesor |
| GET/POST/PUT/DELETE | /api/estudiantes[/:id] | Profesor |
| GET | /api/clases · /api/clases/:id | Profesor (las suyas) / estudiante (las suyas) |
| POST/PUT/DELETE | /api/clases[/:id] | Profesor |
| GET | /api/clases/:id/tareas | Profesor / estudiante inscrito |
| POST | /api/clases/:id/tareas | Profesor |
| PUT/DELETE | /api/tareas/:id | Profesor |
| GET | /api/tareas/:id/estado | Profesor |
| GET | /api/tareas | Estudiante (todas sus tareas) |
| POST | /api/tareas/:id/hecha | Estudiante inscrito |

## Clases y choques de horario
- Cada clase tiene **un día de la semana y un rango de horas** (obligatorios; fin posterior al inicio).
- Los alumnos se eligen entre las cuentas de estudiantes registradas (así pueden iniciar sesión y marcar tareas).
- Si el horario se cruza con otra clase del mismo alumno se responde **409** con el nombre del alumno y la clase en conflicto.
  Lo mismo si el profesor ya tiene otra clase a esa hora. Terminar a las 10:00 y empezar a las 10:00 **no** es choque.
- Los cambios de horario se serializan con un bloqueo en PostgreSQL para que dos peticiones simultáneas no creen un choque.

## Seguridad
Consultas parametrizadas (`$1, $2…`) · bcrypt · cookie `httpOnly`/`sameSite`/`secure` en producción · sesiones en PostgreSQL · HTTPS forzado + HSTS en producción · limitador de intentos de login y de clave de secretaría · validación de entradas · el frontend usa `textContent` (sin XSS) · páginas por rol protegidas en el servidor.

## Documentación
- [Plan de pruebas](docs/PLAN_DE_PRUEBAS.md)
- [Despliegue en Render / Supabase](docs/DESPLIEGUE.md)
- [Publicar en GitHub con commits claros](docs/GITHUB.md)

## Limitaciones conocidas
Sin protección CSRF · el registro público de estudiantes no tiene captcha ni límite por IP · las secciones de tareas, notas y horarios siguen como "Próximamente".
