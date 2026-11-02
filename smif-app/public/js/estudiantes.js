const form = document.getElementById('formEstudiante');
const tabla = document.getElementById('tablaEstudiantes');
const message = document.getElementById('message');
const btnGuardar = document.getElementById('btnGuardar');
const btnCancelar = document.getElementById('btnCancelar');
const formTitulo = document.getElementById('formTitulo');
const campos = { id: document.getElementById('id'), nombre: document.getElementById('nombre'),
                 email: document.getElementById('email'), carrera: document.getElementById('carrera') };

function msg(texto, tipo) {
  message.textContent = texto || '';
  const clase = { error: 'danger', success: 'success' }[tipo] || 'secondary';
  message.className = texto ? `alert alert-${clase} mt-3 mb-0` : 'd-none';
}

// Si no hay sesión (401) vuelve al login; si no es docente (403) vuelve al panel.
function manejarAcceso(res) {
  if (res.status === 401) { window.location.href = 'login.html'; return true; }
  if (res.status === 403) { window.location.href = 'panel.html'; return true; }
  return false;
}

function fila(e) {
  const tr = document.createElement('tr');
  [e.id, e.nombre, e.email, e.carrera, new Date(e.creado_en).toLocaleString()].forEach((v) => {
    const td = document.createElement('td');
    td.textContent = String(v ?? '');   // textContent: los datos nunca se interpretan como HTML
    tr.appendChild(td);
  });
  const acc = document.createElement('td');
  acc.className = 'text-nowrap';
  const editar = document.createElement('button');
  editar.className = 'btn btn-sm btn-outline-primary me-2';
  editar.textContent = 'Editar';
  editar.addEventListener('click', () => editar_(e.id));
  const borrar = document.createElement('button');
  borrar.className = 'btn btn-sm btn-outline-danger';
  borrar.textContent = 'Eliminar';
  borrar.addEventListener('click', () => eliminar(e.id));
  acc.append(editar, borrar);
  tr.appendChild(acc);
  return tr;
}

async function cargar() {
  const res = await api.listarEstudiantes();
  if (manejarAcceso(res)) return;
  if (!res.ok) return msg(res.data.message || 'No se pudieron cargar los estudiantes', 'error');
  tabla.replaceChildren();
  if (res.data.data.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6; td.textContent = 'No hay estudiantes registrados.';
    tr.appendChild(td); tabla.appendChild(tr);
    return;
  }
  res.data.data.forEach((e) => tabla.appendChild(fila(e)));
}

async function editar_(id) {
  const res = await api.obtenerEstudiante(id);
  if (manejarAcceso(res)) return;
  if (!res.ok) return msg(res.data.message, 'error');
  const e = res.data.data;
  campos.id.value = e.id; campos.nombre.value = e.nombre;
  campos.email.value = e.email; campos.carrera.value = e.carrera;
  formTitulo.textContent = 'Editar estudiante';
  btnGuardar.textContent = 'Guardar cambios';
  btnCancelar.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function limpiar() {
  form.reset();
  campos.id.value = '';
  formTitulo.textContent = 'Registrar estudiante';
  btnGuardar.textContent = 'Registrar estudiante';
  btnCancelar.classList.add('hidden');
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const datos = { nombre: campos.nombre.value.trim(), email: campos.email.value.trim(), carrera: campos.carrera.value.trim() };
  if (!datos.nombre || !datos.email || !datos.carrera) return msg('Todos los campos son obligatorios', 'error');

  const id = campos.id.value;
  btnGuardar.disabled = true;
  const res = id ? await api.actualizarEstudiante(id, datos) : await api.crearEstudiante(datos);
  btnGuardar.disabled = false;

  if (manejarAcceso(res)) return;
  if (!res.ok) return msg(res.data.message || 'Error en la operación', 'error');
  msg(res.data.message, 'success');
  limpiar();
  await cargar();      // actualiza la tabla sin recargar la página
});

async function eliminar(id) {
  if (!confirm('¿Desea eliminar este estudiante?')) return;
  const res = await api.eliminarEstudiante(id);
  if (manejarAcceso(res)) return;
  if (!res.ok) return msg(res.data.message, 'error');
  msg(res.data.message, 'success');
  await cargar();
}

btnCancelar.addEventListener('click', limpiar);
document.getElementById('btnActualizar').addEventListener('click', cargar);
document.getElementById('logoutButton').addEventListener('click', async () => {
  await api.logout();
  window.location.href = 'login.html';
});
cargar();
