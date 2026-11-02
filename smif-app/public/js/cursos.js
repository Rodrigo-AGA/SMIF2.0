const form = document.getElementById('formCurso');
const tabla = document.getElementById('tablaCursos');
const message = document.getElementById('message');
const btnGuardar = document.getElementById('btnGuardar');
const btnCancelar = document.getElementById('btnCancelar');
const formTitulo = document.getElementById('formTitulo');
const c = { id: document.getElementById('id'), codigo: document.getElementById('codigo'), nombre: document.getElementById('nombre') };

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
function fila(x) {
  const tr = document.createElement('tr');
  [x.codigo, x.nombre].forEach((v) => {
    const td = document.createElement('td'); td.textContent = String(v ?? ''); tr.appendChild(td);   // textContent: sin XSS
  });
  const acc = document.createElement('td'); acc.className = 'text-nowrap';
  acc.append(boton('Editar', 'btn-outline-primary me-2', () => editar(x.id)),
             boton('Eliminar', 'btn-outline-danger', () => eliminar(x.id)));
  tr.appendChild(acc);
  return tr;
}

async function cargar() {
  const res = await api.listarCursos();
  if (manejarAcceso(res)) return;
  if (!res.ok) return msg(res.data.message || 'No se pudieron cargar los cursos', 'error');
  tabla.replaceChildren();
  if (res.data.data.length === 0) {
    const tr = document.createElement('tr'); const td = document.createElement('td');
    td.colSpan = 3; td.textContent = 'No hay cursos registrados.'; tr.appendChild(td); tabla.appendChild(tr); return;
  }
  res.data.data.forEach((x) => tabla.appendChild(fila(x)));
}

async function editar(id) {
  const res = await api.obtenerCurso(id);
  if (manejarAcceso(res)) return;
  if (!res.ok) return msg(res.data.message, 'error');
  const x = res.data.data;
  c.id.value = x.id; c.codigo.value = x.codigo; c.nombre.value = x.nombre;
  formTitulo.textContent = 'Editar curso'; btnGuardar.textContent = 'Guardar cambios';
  btnCancelar.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function limpiar() {
  form.reset(); c.id.value = '';
  formTitulo.textContent = 'Registrar curso'; btnGuardar.textContent = 'Registrar curso';
  btnCancelar.classList.add('hidden');
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const datos = { codigo: c.codigo.value.trim(), nombre: c.nombre.value.trim() };
  if (!datos.codigo || !datos.nombre) return msg('Código y nombre son obligatorios', 'error');
  const id = c.id.value;
  btnGuardar.disabled = true;
  const res = id ? await api.actualizarCurso(id, datos) : await api.crearCurso(datos);
  btnGuardar.disabled = false;
  if (manejarAcceso(res)) return;
  if (!res.ok) return msg(res.data.message || 'Error en la operación', 'error');
  msg(res.data.message, 'success'); limpiar(); await cargar();
});

async function eliminar(id) {
  if (!confirm('¿Desea eliminar este curso?')) return;
  const res = await api.eliminarCurso(id);
  if (manejarAcceso(res)) return;
  if (!res.ok) return msg(res.data.message, 'error');
  msg(res.data.message, 'success'); await cargar();
}

btnCancelar.addEventListener('click', limpiar);
document.getElementById('btnActualizar').addEventListener('click', cargar);
document.getElementById('logoutButton').addEventListener('click', async () => { await api.logout(); window.location.href = 'login.html'; });
cargar();
