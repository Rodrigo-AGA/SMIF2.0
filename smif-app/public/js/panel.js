// Envía a cada usuario a su panel según el rol guardado en la sesión del servidor.
const PANEL_POR_ROL = { alumno: 'alumno.html', docente: 'docente.html' };

(async () => {
  const res = await api.perfil();
  if (res.status === 401) { window.location.replace('login.html'); return; }
  if (!res.ok) {
    const m = document.getElementById('message');
    m.textContent = res.data.message || 'No se pudo cargar el panel';
    m.className = 'alert alert-danger';
    return;
  }
  window.location.replace(PANEL_POR_ROL[res.data.data.rol] || 'login.html');
})();
