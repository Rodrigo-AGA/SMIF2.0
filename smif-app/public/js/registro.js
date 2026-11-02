const form = document.getElementById('registroForm');
const message = document.getElementById('message');
const $ = (id) => document.getElementById(id);

function msg(texto, tipo) {
  message.textContent = texto || '';
  const clase = { error: 'danger', success: 'success' }[tipo] || 'secondary';
  message.className = texto ? `alert alert-${clase} mt-3 mb-0` : 'd-none';
}

// Muestra los campos según el perfil elegido
function alternarRol() {
  const esDocente = $('rol').value === 'docente';
  document.querySelectorAll('.solo-docente').forEach((el) => el.classList.toggle('hidden', !esDocente));
  document.querySelectorAll('.solo-alumno').forEach((el) => el.classList.toggle('hidden', esDocente));
}
$('rol').addEventListener('change', alternarRol);
['dni', 'celular'].forEach((id) => $(id).addEventListener('input', () => { $(id).value = $(id).value.replace(/\D/g, ''); }));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const rol = $('rol').value;
  const body = {
    rol,
    nombre: $('nombre').value.trim(),
    apellidos: $('apellidos').value.trim(),
    dni: $('dni').value.trim(),
    celular: $('celular').value.trim(),
    email: $('email').value.trim(),
    password: $('password').value
  };
  if (rol === 'alumno') { body.ciclo = $('ciclo').value.trim(); body.modalidad = $('modalidad').value; }
  else { body.especialidad = $('especialidad').value.trim(); }

  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  const res = await api.register(body, rol === 'docente' ? $('claveSecretaria').value : '');
  btn.disabled = false;

  if (!res.ok) return msg(res.data.message || 'No se pudo completar el registro', 'error');
  msg('Cuenta creada. Redirigiendo al ingreso...', 'success');
  setTimeout(() => { window.location.href = 'login.html'; }, 1200);
});
alternarRol();
