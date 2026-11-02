const form = document.getElementById('formClase');
const tabla = document.getElementById('tablaClases');
const message = document.getElementById('message');
const lista = document.getElementById('listaAlumnos');
const btnGuardar = document.getElementById('btnGuardar');
const btnCancelar = document.getElementById('btnCancelar');
const formTitulo = document.getElementById('formTitulo');
const $ = (id) => document.getElementById(id);

function msg(texto, tipo) {
  message.textContent = texto || '';
  const clase = { error: 'danger', success: 'success' }[tipo] || 'secondary';
  message.className = texto ? `alert alert-${clase} mt-3 mb-0` : 'd-none';
}
function manejarAcceso(res) {
  if (res.status === 401) { window.location.href = 'login.html'; return true; }
  if (res.status === 403) { window.location.href = 'panel.html'; return true; }
  return false;
}
function boton(texto, clase, fn) {
  const b = document.createElement('button');
  b.className = `btn btn-sm ${clase}`; b.textContent = texto; b.addEventListener('click', fn);
  return b;
}
// Cualquier error inesperado se muestra en pantalla (antes la página se quedaba en "Cargando...")
function errorInesperado(e, donde) {
  console.error(donde, e);
  msg(`${donde}: ${e.message || e}`, 'error');
}

// ----- lista de alumnos (casillas) -----
async function cargarAlumnos() {
  try {
    const res = await api.listarAlumnos();
    if (manejarAcceso(res)) return;
    lista.replaceChildren();
    if (!res.ok) { lista.textContent = 'No se pudo cargar la lista de alumnos.'; return msg(res.data.message || 'Error al cargar los alumnos', 'error'); }
    const alumnos = res.data.data || [];
    if (alumnos.length === 0) { lista.textContent = 'No hay estudiantes registrados todavía.'; return; }
    alumnos.forEach((a) => {
      const div = document.createElement('div'); div.className = 'form-check';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'form-check-input chk-alumno';
      cb.id = `alumno-${a.id}`; cb.value = a.id;
      const lb = document.createElement('label'); lb.className = 'form-check-label'; lb.htmlFor = cb.id;
      lb.textContent = `${a.apellidos}, ${a.nombre} (DNI ${a.dni})`;
      div.append(cb, lb); lista.appendChild(div);
    });
  } catch (e) { lista.textContent = 'Error al cargar los alumnos.'; errorInesperado(e, 'Alumnos'); }
}
const seleccionados = () => [...document.querySelectorAll('.chk-alumno:checked')].map((c) => Number(c.value));
const marcar = (ids) => document.querySelectorAll('.chk-alumno').forEach((c) => { c.checked = ids.includes(Number(c.value)); });

// ----- tabla de clases -----
function fila(c) {
  const tr = document.createElement('tr');
  [c.nombre, textoHorario(c), c.total_alumnos, c.total_tareas].forEach((v) => {
    const td = document.createElement('td'); td.textContent = String(v); tr.appendChild(td);
  });
  const acc = document.createElement('td'); acc.className = 'text-nowrap';
  const tareas = document.createElement('a');
  tareas.className = 'btn btn-sm btn-smif-azul me-2'; tareas.textContent = 'Tareas';
  tareas.href = `clase.html?id=${encodeURIComponent(c.id)}`;
  acc.append(tareas, boton('Editar', 'btn-outline-primary me-2', () => editar(c.id)),
             boton('Eliminar', 'btn-outline-danger', () => eliminar(c.id)));
  tr.appendChild(acc);
  return tr;
}
async function cargar() {
  try {
    const res = await api.listarClases();
    if (manejarAcceso(res)) return;
    tabla.replaceChildren();
    if (!res.ok) {
      const tr = document.createElement('tr'); const td = document.createElement('td');
      td.colSpan = 5; td.textContent = 'No se pudieron cargar las clases.'; tr.appendChild(td); tabla.appendChild(tr);
      return msg(res.data.message || 'No se pudieron cargar las clases', 'error');
    }
    const clases = res.data.data || [];
    if (clases.length === 0) {
      const tr = document.createElement('tr'); const td = document.createElement('td');
      td.colSpan = 5; td.textContent = 'Aún no has creado clases.'; tr.appendChild(td); tabla.appendChild(tr); return;
    }
    clases.forEach((c) => tabla.appendChild(fila(c)));
  } catch (e) { errorInesperado(e, 'Clases'); }
}

async function editar(id) {
  try {
    const res = await api.obtenerClase(id);
    if (manejarAcceso(res)) return;
    if (!res.ok) return msg(res.data.message, 'error');
    const c = res.data.data;
    $('id').value = c.id; $('nombre').value = c.nombre; $('dia').value = c.dia_semana;
    $('inicio').value = c.hora_inicio; $('fin').value = c.hora_fin;
    marcar(c.alumnos.map((a) => a.id));
    formTitulo.textContent = 'Editar clase'; btnGuardar.textContent = 'Guardar cambios';
    btnCancelar.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) { errorInesperado(e, 'Editar clase'); }
}
function limpiar() {
  form.reset(); $('id').value = ''; marcar([]);
  formTitulo.textContent = 'Crear clase'; btnGuardar.textContent = 'Crear clase';
  btnCancelar.classList.add('hidden');
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const datos = {
    nombre: $('nombre').value.trim(), dia_semana: Number($('dia').value),
    hora_inicio: $('inicio').value, hora_fin: $('fin').value, alumnos: seleccionados()
  };
  if (!datos.nombre || !datos.hora_inicio || !datos.hora_fin) return msg('Indica el nombre y el horario de la clase', 'error');
  const id = $('id').value;
  btnGuardar.disabled = true;
  try {
    const res = id ? await api.actualizarClase(id, datos) : await api.crearClase(datos);
    if (manejarAcceso(res)) return;
    if (!res.ok) return msg(res.data.message || 'Error en la operación', 'error');   // incluye el aviso de choque de horario
    msg(res.data.message, 'success'); limpiar(); await cargar();
  } catch (e) { errorInesperado(e, 'Guardar clase'); }
  finally { btnGuardar.disabled = false; }
});

async function eliminar(id) {
  if (!confirm('¿Eliminar la clase? También se borrarán sus tareas.')) return;
  try {
    const res = await api.eliminarClase(id);
    if (manejarAcceso(res)) return;
    if (!res.ok) return msg(res.data.message, 'error');
    msg(res.data.message, 'success'); await cargar();
  } catch (e) { errorInesperado(e, 'Eliminar clase'); }
}

btnCancelar.addEventListener('click', limpiar);
$('logoutButton').addEventListener('click', async () => { await api.logout(); window.location.href = 'login.html'; });
// Las dos cargas son independientes: si una falla, la otra sigue
cargarAlumnos();
cargar();
