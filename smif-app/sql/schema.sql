-- Se ejecuta automáticamente al iniciar la app (es idempotente).

CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  rol           VARCHAR(10)  NOT NULL CHECK (rol IN ('alumno', 'docente')),
  nombre        VARCHAR(80)  NOT NULL,
  apellidos     VARCHAR(80)  NOT NULL,
  dni           CHAR(8)      UNIQUE NOT NULL,
  email         VARCHAR(100) UNIQUE NOT NULL,
  celular       CHAR(9)      NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  ciclo         VARCHAR(30),
  modalidad     VARCHAR(20),
  especialidad  VARCHAR(80),
  creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS estudiantes (
  id        SERIAL PRIMARY KEY,
  nombre    VARCHAR(100) NOT NULL,
  email     VARCHAR(100) UNIQUE NOT NULL,
  carrera   VARCHAR(80)  NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cursos (
  id        SERIAL PRIMARY KEY,
  codigo    VARCHAR(20)  UNIQUE NOT NULL,
  nombre    VARCHAR(100) NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Migración: los cursos ya no tienen créditos ni ciclo (si la tabla se creó antes con esas columnas)
ALTER TABLE cursos DROP COLUMN IF EXISTS creditos;
ALTER TABLE cursos DROP COLUMN IF EXISTS ciclo;
-- La tabla "session" (sesiones) la crea connect-pg-simple automáticamente.

-- ===== Clases, horarios y tareas =====
CREATE TABLE IF NOT EXISTS clases (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  docente_id  INTEGER  NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  dia_semana  SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),   -- 1 = lunes ... 7 = domingo
  hora_inicio TIME     NOT NULL,
  hora_fin    TIME     NOT NULL,
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (hora_fin > hora_inicio)
);

CREATE TABLE IF NOT EXISTS clase_alumnos (
  clase_id  INTEGER NOT NULL REFERENCES clases(id)   ON DELETE CASCADE,
  alumno_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (clase_id, alumno_id)
);

CREATE TABLE IF NOT EXISTS tareas (
  id           SERIAL PRIMARY KEY,
  clase_id     INTEGER NOT NULL REFERENCES clases(id) ON DELETE CASCADE,
  titulo       VARCHAR(150) NOT NULL,
  descripcion  VARCHAR(500),
  fecha_limite DATE,
  creado_en    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Solo existe una fila cuando el alumno marcó la tarea como hecha
CREATE TABLE IF NOT EXISTS tareas_hechas (
  tarea_id  INTEGER NOT NULL REFERENCES tareas(id)   ON DELETE CASCADE,
  alumno_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  hecha_en  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tarea_id, alumno_id)
);
