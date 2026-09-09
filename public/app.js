const PERSON_LABEL = { Tobias: 'Tobías', Camila: 'Camila' };
const EFFORT_COLOR = { bajo: '#8FAE97', medio: '#D3A248', alto: '#B65C38' };
const ICON_LABELS = {
  plate: 'Plato', trash: 'Basura', plant: 'Planta', box: 'Caja / orden', clothes: 'Ropa doblada',
  bed: 'Cama', broom: 'Escoba', vacuum: 'Aspiradora', washer: 'Lavarropas', cart: 'Carrito de compras',
  iron: 'Plancha', window: 'Ventana', sponge: 'Esponja', pot: 'Olla', bath: 'Baño', default: 'Genérico',
};

const state = {
  month: monthInputValue(new Date()),
  tasks: [],
  selectedPerson: null,
  selectedTaskId: null,
  newTaskEffort: null,
};

// ---------- helpers ----------
function monthInputValue(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function todayInputValue(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}`;
}

function setIcon(elId, name) {
  const el = document.getElementById(elId);
  if (el) el.innerHTML = iconSvg(name);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    let msg = 'Error de red';
    try { msg = (await res.json()).error || msg; } catch (e) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---------- static icons ----------
setIcon('header-house', 'house');
setIcon('calendar-icon', 'calendar');
setIcon('plus-icon', 'plus');
setIcon('submit-icon', 'plus');
setIcon('list-icon', 'list');
setIcon('trophy-icon', 'trophy');
setIcon('legend-arrow', 'plus');
setIcon('add-task-icon', 'plus');
setIcon('new-task-header-icon', 'plus');
setIcon('new-task-submit-icon', 'plus');
setIcon('close-icon', 'close');

// select de íconos del modal "nueva tarea"
(function fillIconSelect() {
  const sel = document.getElementById('new-task-icon');
  for (const [key, label] of Object.entries(ICON_LABELS)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = label;
    sel.appendChild(opt);
  }
})();
document.querySelector('[data-person="Tobias"] .icon').innerHTML = iconSvg('person');
document.querySelector('[data-person="Camila"] .icon').innerHTML = iconSvg('person');

// ---------- task catalog + form ----------
async function loadCatalog() {
  state.tasks = await api('/api/tasks');
  renderTaskGrid();
  renderLegend();
}

function renderTaskGrid() {
  const grid = document.getElementById('task-grid');
  grid.innerHTML = '';
  for (const t of state.tasks) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'task-chip';
    btn.dataset.taskId = t.id;
    btn.innerHTML = `
      <span class="icon">${iconSvg(t.icon)}</span>
      <span class="txt">${escapeHtml(t.name)}</span>
      <span class="pts" style="background:${EFFORT_COLOR[t.effort]}">${t.points} pt${t.points === 1 ? '' : 's'}</span>
      <button type="button" class="task-edit-btn" title="Editar" aria-label="Editar tarea"><span class="icon">${iconSvg('pencil')}</span></button>
    `;
    btn.addEventListener('click', () => selectTask(t.id));
    btn.querySelector('.task-edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditTaskModal(t);
    });
    grid.appendChild(btn);
  }
}

function selectTask(taskId) {
  state.selectedTaskId = taskId;
  document.querySelectorAll('.task-chip').forEach((el) => {
    el.classList.toggle('selected', Number(el.dataset.taskId) === Number(taskId));
  });
  updateSubmitState();
}

function renderLegend() {
  const grid = document.getElementById('legend-grid');
  grid.innerHTML = '';
  for (const t of state.tasks) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="icon">${iconSvg(t.icon)}</span>
      <span class="txt">${escapeHtml(t.name)}</span>
      <span class="pts" style="background:${EFFORT_COLOR[t.effort]}">${t.points} pt${t.points === 1 ? '' : 's'}</span>
    `;
    grid.appendChild(item);
  }
}

// ---------- modal: agregar / editar tarea ----------
const newTaskOverlay = document.getElementById('new-task-overlay');
const newTaskTitle = document.getElementById('new-task-title');
const newTaskSubtitle = document.getElementById('new-task-subtitle');
const newTaskName = document.getElementById('new-task-name');
const newTaskPoints = document.getElementById('new-task-points');
const newTaskIconSelect = document.getElementById('new-task-icon');
const newTaskError = document.getElementById('new-task-error');
const newTaskSubmit = document.getElementById('new-task-submit');
const newTaskSubmitLabel = document.getElementById('new-task-submit-label');
const newTaskDelete = document.getElementById('new-task-delete');

setIcon('delete-task-icon', 'trash2');

function setModalEffort(effort) {
  state.newTaskEffort = effort;
  document.querySelectorAll('.effort-toggle button').forEach((b) => {
    b.classList.toggle('active', b.dataset.effort === effort);
  });
}

function openNewTaskModal() {
  state.editingTaskId = null;
  newTaskTitle.textContent = 'Nueva tarea';
  newTaskSubtitle.textContent = 'Se agrega al catálogo con sus puntos y queda disponible para las próximas cargas.';
  newTaskSubmitLabel.textContent = 'Agregar tarea';
  newTaskDelete.style.display = 'none';
  newTaskName.value = '';
  newTaskPoints.value = '';
  newTaskIconSelect.value = 'default';
  newTaskError.classList.remove('show');
  setModalEffort(null);
  updateNewTaskSubmitState();
  newTaskOverlay.classList.add('open');
  setTimeout(() => newTaskName.focus(), 50);
}

function openEditTaskModal(task) {
  state.editingTaskId = task.id;
  newTaskTitle.textContent = 'Editar tarea';
  newTaskSubtitle.textContent = 'Los cambios se aplican para las próximas cargas — el historial ya guardado no cambia.';
  newTaskSubmitLabel.textContent = 'Guardar cambios';
  newTaskDelete.style.display = 'flex';
  newTaskName.value = task.name;
  newTaskPoints.value = task.points;
  newTaskIconSelect.value = task.icon;
  newTaskError.classList.remove('show');
  setModalEffort(task.effort);
  updateNewTaskSubmitState();
  newTaskOverlay.classList.add('open');
  setTimeout(() => newTaskName.focus(), 50);
}

function closeNewTaskModal() {
  newTaskOverlay.classList.remove('open');
}

document.getElementById('add-task-btn').addEventListener('click', openNewTaskModal);
document.getElementById('new-task-close').addEventListener('click', closeNewTaskModal);
newTaskOverlay.addEventListener('click', (e) => {
  if (e.target === newTaskOverlay) closeNewTaskModal();
});

document.querySelectorAll('.effort-toggle button').forEach((btn) => {
  btn.addEventListener('click', () => {
    setModalEffort(btn.dataset.effort);
    if (!newTaskPoints.value) newTaskPoints.value = btn.dataset.suggested;
    updateNewTaskSubmitState();
  });
});

newTaskName.addEventListener('input', updateNewTaskSubmitState);
newTaskPoints.addEventListener('input', updateNewTaskSubmitState);

function updateNewTaskSubmitState() {
  const pts = Number(newTaskPoints.value);
  const ok = newTaskName.value.trim().length > 0 && state.newTaskEffort && pts >= 1 && pts <= 20;
  newTaskSubmit.disabled = !ok;
}

newTaskSubmit.addEventListener('click', async () => {
  newTaskError.classList.remove('show');
  newTaskSubmit.disabled = true;
  const payload = {
    name: newTaskName.value.trim(),
    effort: state.newTaskEffort,
    points: Number(newTaskPoints.value),
    icon: newTaskIconSelect.value,
  };
  try {
    const saved = state.editingTaskId
      ? await api(`/api/tasks/${state.editingTaskId}`, { method: 'PATCH', body: JSON.stringify(payload) })
      : await api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
    await loadCatalog();
    selectTask(saved.id);
    closeNewTaskModal();
    showToast(state.editingTaskId
      ? `"${saved.name}" actualizada ✏️`
      : `"${saved.name}" agregada al catálogo 🎉`);
  } catch (e) {
    newTaskError.textContent = e.message || 'No se pudo guardar la tarea.';
    newTaskError.classList.add('show');
  } finally {
    updateNewTaskSubmitState();
  }
});

newTaskDelete.addEventListener('click', async () => {
  if (!state.editingTaskId) return;
  if (!confirm('¿Eliminar esta tarea del catálogo? El historial ya cargado no se toca, pero no vas a poder elegirla de nuevo.')) return;
  try {
    await api(`/api/tasks/${state.editingTaskId}`, { method: 'DELETE' });
    if (state.selectedTaskId === state.editingTaskId) {
      state.selectedTaskId = null;
      updateSubmitState();
    }
    await loadCatalog();
    closeNewTaskModal();
    showToast('Tarea eliminada del catálogo.');
  } catch (e) {
    newTaskError.textContent = e.message || 'No se pudo eliminar la tarea.';
    newTaskError.classList.add('show');
  }
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

document.querySelectorAll('.person-toggle button').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.selectedPerson = btn.dataset.person;
    document.querySelectorAll('.person-toggle button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    updateSubmitState();
  });
});

function updateSubmitState() {
  document.getElementById('submit-entry').disabled = !(state.selectedPerson && state.selectedTaskId);
}

document.getElementById('entry-date').value = todayInputValue(new Date());

document.getElementById('submit-entry').addEventListener('click', async () => {
  const btn = document.getElementById('submit-entry');
  btn.disabled = true;
  try {
    await api('/api/entries', {
      method: 'POST',
      body: JSON.stringify({
        date: document.getElementById('entry-date').value,
        person: state.selectedPerson,
        task_id: state.selectedTaskId,
        comment: document.getElementById('entry-comment').value.trim(),
      }),
    });
    showToast('¡Guardado! Se avisó por notificación 🎉');
    document.getElementById('entry-comment').value = '';
    state.selectedTaskId = null;
    document.querySelectorAll('.task-chip').forEach((el) => el.classList.remove('selected'));
    await Promise.all([loadSummary(), loadEntries()]);
  } catch (e) {
    showToast(e.message || 'No se pudo guardar');
  } finally {
    updateSubmitState();
  }
});

// ---------- month summary ----------
const monthInput = document.getElementById('month-input');
monthInput.value = state.month;
monthInput.addEventListener('change', () => {
  state.month = monthInput.value;
  loadSummary();
  loadEntries();
});

async function loadSummary() {
  const s = await api(`/api/summary?month=${state.month}`);
  document.getElementById('pts-tobias').textContent = s.totals.Tobias;
  document.getElementById('pts-camila').textContent = s.totals.Camila;

  const total = Math.max(1, s.totals.Tobias + s.totals.Camila);
  document.getElementById('bar-tobias').style.width = `${(s.totals.Tobias / total) * 100}%`;
  document.getElementById('bar-camila').style.width = `${(s.totals.Camila / total) * 100}%`;

  const pill = document.getElementById('status-pill');
  const banner = document.getElementById('winner-banner');
  if (s.isFinal) {
    pill.className = 'status-pill final';
    pill.innerHTML = '🏁 Resultado final';
    const w = s.finalResult.winner;
    banner.style.display = 'flex';
    banner.className = 'winner-banner';
    banner.innerHTML = `
      <span class="icon">${iconSvg('trophy')}</span>
      <div>${w === 'Empate' ? '<b>¡Empate!</b> este mes quedaron iguales.' : `<b>¡Ganó ${PERSON_LABEL[w]}!</b> este mes.`}</div>
    `;
  } else {
    pill.className = 'status-pill live';
    pill.innerHTML = s.totals.Tobias === s.totals.Camila
      ? '🤝 Van empatados (parcial)'
      : `🔥 Va ganando ${PERSON_LABEL[s.leader]} (parcial)`;
    banner.style.display = 'none';
  }

  document.getElementById('defines-on').textContent = s.isCurrentMonth
    ? `El resultado de este mes se define el ${s.definesOn}.`
    : `Mes cerrado — resultado definido el ${s.definesOn}.`;
}

// ---------- entries list ----------
async function loadEntries() {
  const rows = await api(`/api/entries?month=${state.month}`);
  const box = document.getElementById('entries-list');
  box.innerHTML = '';
  if (!rows.length) {
    box.innerHTML = '<div class="empty-state">Todavía no hay tareas cargadas este mes.</div>';
    return;
  }
  for (const r of rows) {
    const row = document.createElement('div');
    row.className = 'entry-row';
    row.innerHTML = `
      <span class="entry-icon ${r.person.toLowerCase()}">${iconSvg(r.icon)}</span>
      <div class="entry-main">
        <div class="task">${escapeHtml(r.task_name)}</div>
        <div class="meta">${PERSON_LABEL[r.person]} · ${formatDate(r.date)}${r.comment ? ' · ' + escapeHtml(r.comment) : ''}</div>
      </div>
      <div class="entry-pts">+${r.points}</div>
      <button class="entry-del" title="Borrar" data-id="${r.id}"><span class="icon">${iconSvg('trash2')}</span></button>
    `;
    row.querySelector('.entry-del').addEventListener('click', async () => {
      if (!confirm('¿Borrar esta carga?')) return;
      await api(`/api/entries/${r.id}`, { method: 'DELETE' });
      await Promise.all([loadSummary(), loadEntries()]);
    });
    box.appendChild(row);
  }
}

// ---------- results history ----------
async function loadResults() {
  const rows = await api('/api/summary/results');
  const box = document.getElementById('results-list');
  box.innerHTML = '';
  if (!rows.length) {
    box.innerHTML = '<div class="empty-state">Todavía no se cerró ningún mes.</div>';
    return;
  }
  for (const r of rows) {
    const row = document.createElement('div');
    row.className = 'result-row';
    row.innerHTML = `
      <span class="rm-month">${r.month}</span>
      <span class="rm-winner">${r.winner !== 'Empate' ? `<span class="icon">${iconSvg('trophy')}</span>` : ''}${r.winner === 'Empate' ? 'Empate' : PERSON_LABEL[r.winner]}</span>
      <span class="rm-pts">Tobías ${r.tobias_points} · Camila ${r.camila_points}</span>
    `;
    box.appendChild(row);
  }
}

// ---------- legend collapse ----------
document.getElementById('legend-toggle').addEventListener('click', () => {
  const body = document.getElementById('legend-body');
  const btn = document.getElementById('legend-toggle');
  const open = body.classList.toggle('open');
  btn.classList.toggle('open', open);
  document.getElementById('legend-toggle').lastChild.textContent = open ? ' Ocultar tabla de puntos' : ' Ver tabla de puntos';
});

// ---------- push notifications ----------
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function refreshBellUi() {
  const icon = document.getElementById('bell-icon');
  const label = document.getElementById('bell-label');
  const btn = document.getElementById('bell-btn');

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    icon.innerHTML = iconSvg('bellOff');
    label.textContent = 'No disponible';
    btn.disabled = true;
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      icon.innerHTML = iconSvg('bell');
      label.textContent = 'Notificaciones activas';
      btn.classList.add('on');
    } else {
      icon.innerHTML = iconSvg('bellOff');
      label.textContent = 'Activar notificaciones';
      btn.classList.remove('on');
    }
  } catch (e) {
    icon.innerHTML = iconSvg('bellOff');
    label.textContent = 'Notificaciones';
  }
}

async function toggleNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    showToast('Este navegador no soporta notificaciones push.');
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();

    if (existing) {
      await api('/api/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: existing.endpoint }) });
      await existing.unsubscribe();
      showToast('Notificaciones desactivadas.');
      return refreshBellUi();
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('No se dio permiso para notificar.');
      return;
    }
    const { publicKey } = await api('/api/push/vapid-public-key');
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    await api('/api/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription: sub }) });
    showToast('¡Notificaciones activadas!');
    refreshBellUi();
  } catch (e) {
    showToast('No se pudieron activar las notificaciones.');
    console.error(e);
  }
}

document.getElementById('bell-btn').addEventListener('click', toggleNotifications);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(refreshBellUi).catch(() => {});
}

// ---------- boot ----------
(async function init() {
  try {
    await loadCatalog();
    await Promise.all([loadSummary(), loadEntries(), loadResults()]);
  } catch (e) {
    console.error(e);
    showToast('No se pudo conectar con el servidor.');
  }
})();
