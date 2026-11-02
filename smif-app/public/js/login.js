const form = document.getElementById('loginForm');
const rolSelect = document.getElementById('rol');
const dniInput = document.getElementById('dni');
const passwordInput = document.getElementById('password');
const message = document.getElementById('message');

const PANEL_POR_ROL = { alumno: 'alumno.html', docente: 'docente.html' };

function msg(texto, tipo) {
  message.textContent = texto || '';
  const clase = { error: 'danger', success: 'success' }[tipo] || 'secondary';
  message.className = texto ? `alert alert-${clase} text-center mt-3 mb-0` : 'd-none';
}

// El DNI solo admite dígitos
dniInput.addEventListener('input', () => { dniInput.value = dniInput.value.replace(/\D/g, ''); });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const dni = dniInput.value.trim();
  const password = passwordInput.value;

  if (!/^\d{8}$/.test(dni)) return msg('El DNI debe tener 8 dígitos', 'error');
  if (!password) return msg('Ingresa tu contraseña', 'error');

  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  const res = await api.login({ rol: rolSelect.value, dni, password });
  btn.disabled = false;

  if (!res.ok) return msg(res.data.message || 'No se pudo iniciar sesión', 'error');

  msg('Ingreso exitoso. Redirigiendo...', 'success');
  const destino = PANEL_POR_ROL[res.data.data.rol] || 'panel.html';
  setTimeout(() => { window.location.href = destino; }, 600);
});
