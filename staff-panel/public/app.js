const API_BASE = '/api';
let sessionToken = null;
let currentRole = null;
let permissions = [];
let channelsCache = [];
let rolesCache = [];

function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (sessionToken) opts.headers['X-Session-Token'] = sessionToken;
  if (body) opts.body = JSON.stringify(body);
  return fetch(API_BASE + path, opts).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error desconocido');
    return data;
  });
}

function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

async function login() {
  const key = document.getElementById('login-key').value;
  const role = document.getElementById('login-role').value;
  if (!key) return toast('Ingresa la clave', 'error');
  try {
    const data = await api('POST', '/login', { key, role });
    sessionToken = data.token;
    currentRole = data.role;
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app-page').style.display = 'flex';
    initApp();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function logout() {
  api('POST', '/logout').catch(() => {});
  sessionToken = null;
  currentRole = null;
  permissions = [];
  document.getElementById('app-page').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('login-key').value = '';
}

async function initApp() {
  const badge = document.getElementById('role-badge');
  badge.textContent = currentRole;
  badge.className = 'role-badge ' + currentRole;

  try {
    const status = await api('GET', '/status');
    permissions = status.permissions || [];
    const botStatus = document.getElementById('bot-status');
    if (status.botOnline) {
      botStatus.textContent = (status.guildName || 'Servidor') + ' - Online';
      botStatus.className = 'bot-status online';
    } else {
      botStatus.textContent = 'Bot desconectado';
      botStatus.className = 'bot-status';
    }
    updatePermissions();
    loadDashboard(status);
    loadChannels();
    loadRoles();
  } catch (e) {
    toast('Error al conectar: ' + e.message, 'error');
  }
}

function updatePermissions() {
  document.querySelectorAll('.tool-btn[data-action]').forEach(btn => {
    const action = btn.dataset.action;
    if (!permissions.includes(action)) {
      btn.classList.add('disabled');
    } else {
      btn.classList.remove('disabled');
    }
  });
}

function loadDashboard(status) {
  const grid = document.getElementById('stats-grid');
  const stats = [
    { icon: '&#128101;', value: status.memberCount || 0, label: 'Miembros' },
    { icon: '&#128994;', value: status.botOnline ? 'Online' : 'Offline', label: 'Bot Status' },
    { icon: '&#128737;', value: currentRole, label: 'Tu Rol' },
    { icon: '&#128273;', value: permissions.length, label: 'Permisos' }
  ];
  grid.innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');

  loadLogs('recent-logs', 10);
}

async function loadLogs(containerId, limit) {
  try {
    const logs = await api('GET', '/logs');
    const container = document.getElementById(containerId);
    const items = limit ? logs.slice(0, limit) : logs;
    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128220;</div><p>No hay registros aun</p></div>';
      return;
    }
    container.innerHTML = items.map(log => {
      const typeClass = getLogTypeClass(log.actionType);
      const date = new Date(log.createdAt).toLocaleString('es');
      return `<div class="log-entry">
        <span class="log-type ${typeClass}">${log.actionType}</span>
        <span class="log-time">${date}</span>
        <span class="log-details">${formatLogDetails(log)}</span>
      </div>`;
    }).join('');
  } catch (e) {
    document.getElementById(containerId).innerHTML = '<p style="color:var(--text-muted)">Error cargando logs</p>';
  }
}

function getLogTypeClass(type) {
  if (type.includes('WARN')) return 'warn';
  if (type.includes('MUTE') || type.includes('UNMUTE')) return 'mute';
  if (type.includes('BAN')) return 'ban';
  if (type.includes('TIMEOUT')) return 'timeout';
  if (type.includes('CHANNEL') || type.includes('LOCK') || type.includes('UNLOCK') || type.includes('NUKE') || type.includes('CLEAR')) return 'channel';
  return 'other';
}

function formatLogDetails(log) {
  const d = log.details || {};
  let text = '';
  if (log.targetId) text += `Target: ${log.targetId} `;
  if (d.reason) text += `| Razon: ${d.reason} `;
  if (d.channelName) text += `| Canal: #${d.channelName} `;
  if (d.duration) text += `| Duracion: ${d.duration} `;
  if (d.count) text += `| Cantidad: ${d.count} `;
  if (d.warnCount) text += `| Warns: ${d.warnCount} `;
  return text || 'Sin detalles';
}

async function loadChannels() {
  try {
    channelsCache = await api('GET', '/guild/channels');
  } catch (e) {
    channelsCache = [];
  }
}

async function loadRoles() {
  try {
    rolesCache = await api('GET', '/guild/roles');
  } catch (e) {
    rolesCache = [];
  }
}

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).style.display = 'block';
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');

  if (page === 'logs') loadLogs('all-logs');
  if (page === 'dashboard') initApp();

  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) sidebar.classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function channelSelect(id) {
  const grouped = {};
  channelsCache.forEach(c => {
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category].push(c);
  });
  let html = `<select id="${id}" class="form-group-select" style="width:100%;padding:10px 14px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:14px;">`;
  html += '<option value="">Seleccionar canal...</option>';
  for (const [cat, chs] of Object.entries(grouped)) {
    html += `<optgroup label="${cat}">`;
    chs.forEach(c => html += `<option value="${c.id}">#${c.name}</option>`);
    html += '</optgroup>';
  }
  html += '</select>';
  return html;
}

function roleSelect(id) {
  let html = `<select id="${id}" style="width:100%;padding:10px 14px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:14px;">`;
  html += '<option value="">Seleccionar rol...</option>';
  rolesCache.forEach(r => html += `<option value="${r.id}">${r.name}</option>`);
  html += '</select>';
  return html;
}

function userSearchField(id) {
  return `<div class="form-group search-input">
    <input type="text" id="${id}" placeholder="Buscar usuario..." oninput="searchUsers('${id}')">
    <input type="hidden" id="${id}_id">
    <div class="search-results" id="${id}_results"></div>
  </div>`;
}

let searchTimeout;
async function searchUsers(inputId) {
  clearTimeout(searchTimeout);
  const input = document.getElementById(inputId);
  const resultsDiv = document.getElementById(inputId + '_results');
  const query = input.value.trim();
  if (query.length < 2) {
    resultsDiv.classList.remove('active');
    return;
  }
  searchTimeout = setTimeout(async () => {
    try {
      const members = await api('GET', '/guild/members/search?q=' + encodeURIComponent(query));
      if (members.length === 0) {
        resultsDiv.innerHTML = '<div style="padding:8px 14px;color:var(--text-muted)">No se encontraron usuarios</div>';
      } else {
        resultsDiv.innerHTML = members.map(m => `
          <div class="search-result-item" onclick="selectUser('${inputId}', '${m.id}', '${m.tag}')">
            <img src="${m.avatar}" alt="">
            <span>${m.tag}</span>
            <span style="color:var(--text-muted);font-size:11px;margin-left:auto">${m.id}</span>
          </div>
        `).join('');
      }
      resultsDiv.classList.add('active');
    } catch (e) {
      resultsDiv.innerHTML = '<div style="padding:8px 14px;color:var(--danger)">Error buscando</div>';
      resultsDiv.classList.add('active');
    }
  }, 300);
}

function selectUser(inputId, userId, userTag) {
  document.getElementById(inputId).value = userTag;
  document.getElementById(inputId + '_id').value = userId;
  document.getElementById(inputId + '_results').classList.remove('active');
}

function openModal(title, bodyHtml, footerHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-footer').innerHTML = footerHtml;
  document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

function openTool(action) {
  if (!permissions.includes(action)) {
    toast('No tienes permisos para esta accion', 'error');
    return;
  }

  switch (action) {
    case 'warn':
      openModal('Warn - Advertir Usuario', `
        <div class="form-group"><label>Usuario</label>${userSearchField('warn-user')}</div>
        <div class="form-group"><label>Razon</label><textarea id="warn-reason" placeholder="Razon de la advertencia..."></textarea></div>
      `, `<button class="btn btn-warning" onclick="executeWarn()">Enviar Warn</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'mute':
      openModal('Mute - Silenciar Usuario', `
        <div class="form-group"><label>Usuario</label>${userSearchField('mute-user')}</div>
        <div class="form-group"><label>Duracion</label>
          <select id="mute-duration" style="width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);">
            <option value="5m">5 minutos</option><option value="15m">15 minutos</option><option value="30m">30 minutos</option>
            <option value="1h">1 hora</option><option value="6h">6 horas</option><option value="12h">12 horas</option>
            <option value="1d">1 dia</option><option value="7d">7 dias</option>
          </select>
        </div>
        <div class="form-group"><label>Razon</label><textarea id="mute-reason" placeholder="Razon del silencio..."></textarea></div>
      `, `<button class="btn btn-info" onclick="executeMute()">Aplicar Mute</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'unmute':
      openModal('Unmute - Quitar Silencio', `
        <div class="form-group"><label>Usuario</label>${userSearchField('unmute-user')}</div>
      `, `<button class="btn btn-success" onclick="executeUnmute()">Quitar Mute</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'ban':
      openModal('Ban - Banear Usuario', `
        <div class="form-group"><label>Usuario</label>${userSearchField('ban-user')}</div>
        <div class="form-group"><label>Razon</label><textarea id="ban-reason" placeholder="Razon del ban..."></textarea></div>
      `, `<button class="btn btn-danger" onclick="executeBan()">Banear</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'timeout':
      openModal('Timeout - Timeout Temporal', `
        <div class="form-group"><label>Usuario</label>${userSearchField('timeout-user')}</div>
        <div class="form-group"><label>Duracion</label>
          <select id="timeout-duration" style="width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);">
            <option value="1m">1 minuto</option><option value="5m">5 minutos</option><option value="10m">10 minutos</option>
            <option value="30m">30 minutos</option><option value="1h">1 hora</option><option value="1d">1 dia</option><option value="7d">7 dias</option>
          </select>
        </div>
        <div class="form-group"><label>Razon</label><textarea id="timeout-reason" placeholder="Razon del timeout..."></textarea></div>
      `, `<button class="btn btn-danger" onclick="executeTimeout()">Aplicar Timeout</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'lock_channel':
      openModal('Lock Channel - Bloquear Canal', `
        <div class="form-group"><label>Canal</label>${channelSelect('lock-channel')}</div>
      `, `<button class="btn btn-warning" onclick="executeLockChannel()">Bloquear Canal</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'unlock_channel':
      openModal('Unlock Channel - Desbloquear Canal', `
        <div class="form-group"><label>Canal</label>${channelSelect('unlock-channel')}</div>
      `, `<button class="btn btn-success" onclick="executeUnlockChannel()">Desbloquear Canal</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'nuke_channel':
      openModal('Nuke Channel - Recrear Canal', `
        <div class="form-group"><label>Canal</label>${channelSelect('nuke-channel')}</div>
        <p style="color:var(--danger);font-size:13px;margin-top:8px;">Esta accion eliminara TODOS los mensajes del canal y lo recreara.</p>
      `, `<button class="btn btn-danger" onclick="executeNukeChannel()">Nuke Canal</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'clear_messages':
      openModal('Clear Messages - Borrar Mensajes', `
        <div class="form-group"><label>Canal</label>${channelSelect('clear-channel')}</div>
        <div class="form-group"><label>Cantidad (1-100)</label><input type="number" id="clear-amount" min="1" max="100" value="10"></div>
      `, `<button class="btn btn-warning" onclick="executeClearMessages()">Borrar Mensajes</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'send_embed':
      openModal('Send Embed - Enviar Embed', `
        <div class="form-group"><label>Canal</label>${channelSelect('embed-channel')}</div>
        <div class="form-group"><label>Titulo</label><input type="text" id="embed-title" placeholder="Titulo del embed"></div>
        <div class="form-group"><label>Descripcion</label><textarea id="embed-desc" placeholder="Descripcion del embed..."></textarea></div>
        <div class="form-group"><label>Color</label>
          <div class="color-picker-wrapper">
            <input type="color" id="embed-color" value="#5865F2">
            <span id="embed-color-text">#5865F2</span>
          </div>
        </div>
      `, `<button class="btn btn-primary" onclick="executeSendEmbed()">Enviar Embed</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      setTimeout(() => {
        const colorInput = document.getElementById('embed-color');
        if (colorInput) colorInput.addEventListener('input', e => {
          document.getElementById('embed-color-text').textContent = e.target.value;
        });
      }, 100);
      break;

    case 'send_dm':
      openModal('Send DM - Mensaje Privado', `
        <div class="form-group"><label>Usuario</label>${userSearchField('dm-user')}</div>
        <div class="form-group"><label>Mensaje</label><textarea id="dm-message" placeholder="Escribe el mensaje..."></textarea></div>
      `, `<button class="btn btn-primary" onclick="executeSendDM()">Enviar DM</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'edit_message':
      openModal('Edit Message - Editar Mensaje', `
        <div class="form-group"><label>Canal</label>${channelSelect('edit-channel')}</div>
        <div class="form-group"><label>ID del Mensaje</label><input type="text" id="edit-msgid" placeholder="ID del mensaje a editar"></div>
        <div class="form-group"><label>Nuevo Contenido</label><textarea id="edit-content" placeholder="Nuevo contenido del mensaje..."></textarea></div>
      `, `<button class="btn btn-primary" onclick="executeEditMessage()">Editar Mensaje</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'block_links':
      openModal('Block Links - Bloquear Enlaces', `
        <div class="form-group"><label>Canal</label>${channelSelect('blocklinks-channel')}</div>
        <div class="form-group" style="display:flex;align-items:center;gap:12px;">
          <label style="margin:0">Activar bloqueo</label>
          <label class="toggle-switch">
            <input type="checkbox" id="blocklinks-enabled" checked>
            <span class="toggle-slider"></span>
          </label>
        </div>
      `, `<button class="btn btn-primary" onclick="executeBlockLinks()">Aplicar</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'quarantine':
      openModal('Quarantine - Aislar Usuario', `
        <div class="form-group"><label>Usuario</label>${userSearchField('quarantine-user')}</div>
        <p style="color:var(--warning);font-size:13px;margin-top:8px;">Se removeran todos los roles del usuario y se asignara el rol de Cuarentena.</p>
      `, `<button class="btn btn-danger" onclick="executeQuarantine()">Aislar Usuario</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'reduce_warn':
      openModal('Reduce Warn - Reducir Warns', `
        <div class="form-group"><label>Usuario</label>${userSearchField('reducewarn-user')}</div>
        <div class="form-group"><label>Cantidad a reducir</label><input type="number" id="reducewarn-amount" min="1" value="1"></div>
      `, `<button class="btn btn-success" onclick="executeReduceWarn()">Reducir Warns</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'view_history':
      openModal('View History - Historial de Sanciones', `
        <div class="form-group"><label>Usuario</label>${userSearchField('history-user')}</div>
      `, `<button class="btn btn-primary" onclick="executeViewHistory()">Ver Historial</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'server_info':
      executeServerInfo();
      break;

    case 'user_info':
      openModal('User Info - Informacion de Usuario', `
        <div class="form-group"><label>Usuario</label>${userSearchField('userinfo-user')}</div>
      `, `<button class="btn btn-primary" onclick="executeUserInfo()">Ver Info</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'role_info':
      openModal('Role Info - Informacion de Rol', `
        <div class="form-group"><label>Rol</label>${roleSelect('roleinfo-role')}</div>
      `, `<button class="btn btn-primary" onclick="executeRoleInfo()">Ver Info</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;
  }
}

async function executeWarn() {
  const userId = document.getElementById('warn-user_id').value;
  const reason = document.getElementById('warn-reason').value;
  if (!userId || !reason) return toast('Completa todos los campos', 'error');
  try {
    const r = await api('POST', '/action/warn', { userId, reason });
    toast(`Warn enviado a ${r.user} (Total: ${r.warnCount})`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeMute() {
  const userId = document.getElementById('mute-user_id').value;
  const duration = document.getElementById('mute-duration').value;
  const reason = document.getElementById('mute-reason').value;
  if (!userId || !reason) return toast('Completa todos los campos', 'error');
  try {
    const r = await api('POST', '/action/mute', { userId, duration, reason });
    toast(`Mute aplicado a ${r.user} por ${r.duration}`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeUnmute() {
  const userId = document.getElementById('unmute-user_id').value;
  if (!userId) return toast('Selecciona un usuario', 'error');
  try {
    const r = await api('POST', '/action/unmute', { userId });
    toast(`Unmute aplicado a ${r.user}`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeBan() {
  const userId = document.getElementById('ban-user_id').value;
  const reason = document.getElementById('ban-reason').value;
  if (!userId || !reason) return toast('Completa todos los campos', 'error');
  if (!confirm('Estas seguro de banear a este usuario?')) return;
  try {
    const r = await api('POST', '/action/ban', { userId, reason });
    toast(`Usuario ${r.user} baneado`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeTimeout() {
  const userId = document.getElementById('timeout-user_id').value;
  const duration = document.getElementById('timeout-duration').value;
  const reason = document.getElementById('timeout-reason').value;
  if (!userId || !reason) return toast('Completa todos los campos', 'error');
  try {
    const r = await api('POST', '/action/timeout', { userId, duration, reason });
    toast(`Timeout aplicado a ${r.user} por ${r.duration}`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeLockChannel() {
  const channelId = document.getElementById('lock-channel').value;
  if (!channelId) return toast('Selecciona un canal', 'error');
  try {
    const r = await api('POST', '/action/lock-channel', { channelId });
    toast(`Canal #${r.channel} bloqueado`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeUnlockChannel() {
  const channelId = document.getElementById('unlock-channel').value;
  if (!channelId) return toast('Selecciona un canal', 'error');
  try {
    const r = await api('POST', '/action/unlock-channel', { channelId });
    toast(`Canal #${r.channel} desbloqueado`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeNukeChannel() {
  const channelId = document.getElementById('nuke-channel').value;
  if (!channelId) return toast('Selecciona un canal', 'error');
  if (!confirm('ATENCION: Esto eliminara TODOS los mensajes del canal. Continuar?')) return;
  try {
    const r = await api('POST', '/action/nuke-channel', { channelId });
    toast(`Canal #${r.channel} recreado exitosamente`, 'success');
    closeModal();
    loadChannels();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeClearMessages() {
  const channelId = document.getElementById('clear-channel').value;
  const amount = document.getElementById('clear-amount').value;
  if (!channelId) return toast('Selecciona un canal', 'error');
  try {
    const r = await api('POST', '/action/clear-messages', { channelId, amount });
    toast(`${r.deleted} mensajes eliminados de #${r.channel}`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeSendEmbed() {
  const channelId = document.getElementById('embed-channel').value;
  const title = document.getElementById('embed-title').value;
  const description = document.getElementById('embed-desc').value;
  const color = document.getElementById('embed-color').value;
  if (!channelId || !title || !description) return toast('Completa todos los campos', 'error');
  try {
    const r = await api('POST', '/action/send-embed', { channelId, title, description, color });
    toast(`Embed enviado a #${r.channel}`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeSendDM() {
  const userId = document.getElementById('dm-user_id').value;
  const message = document.getElementById('dm-message').value;
  if (!userId || !message) return toast('Completa todos los campos', 'error');
  try {
    const r = await api('POST', '/action/send-dm', { userId, message });
    toast(`DM enviado a ${r.user}`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeEditMessage() {
  const channelId = document.getElementById('edit-channel').value;
  const messageId = document.getElementById('edit-msgid').value;
  const newContent = document.getElementById('edit-content').value;
  if (!channelId || !messageId || !newContent) return toast('Completa todos los campos', 'error');
  try {
    const r = await api('POST', '/action/edit-message', { channelId, messageId, newContent });
    toast(`Mensaje editado en #${r.channel}`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeBlockLinks() {
  const channelId = document.getElementById('blocklinks-channel').value;
  const enabled = document.getElementById('blocklinks-enabled').checked;
  if (!channelId) return toast('Selecciona un canal', 'error');
  try {
    const r = await api('POST', '/action/block-links', { channelId, enabled });
    toast(`Enlaces ${r.enabled ? 'bloqueados' : 'desbloqueados'}`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeQuarantine() {
  const userId = document.getElementById('quarantine-user_id').value;
  if (!userId) return toast('Selecciona un usuario', 'error');
  if (!confirm('Esto aislara al usuario removiendo todos sus roles. Continuar?')) return;
  try {
    const r = await api('POST', '/action/quarantine', { userId });
    toast(`Usuario ${r.user} puesto en cuarentena`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeReduceWarn() {
  const userId = document.getElementById('reducewarn-user_id').value;
  const amount = document.getElementById('reducewarn-amount').value;
  if (!userId) return toast('Selecciona un usuario', 'error');
  try {
    const r = await api('POST', '/action/reduce-warn', { userId, amount });
    toast(`${r.removed} warns removidos. Quedan: ${r.remaining}`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeViewHistory() {
  const userId = document.getElementById('history-user_id').value;
  if (!userId) return toast('Selecciona un usuario', 'error');
  try {
    const data = await api('GET', '/action/view-history/' + userId);
    let html = `<h3 style="margin-bottom:16px">${data.userTag} - Historial</h3>`;
    html += `<p style="margin-bottom:12px;color:var(--text-secondary)">Total Warns: <strong>${data.totalWarns}</strong></p>`;

    html += '<div class="history-section"><h4>Advertencias</h4>';
    if (data.warnings.length === 0) html += '<p style="color:var(--text-muted)">Sin advertencias</p>';
    else data.warnings.forEach(w => {
      html += `<div class="history-item"><strong>${w.reason}</strong><div class="date">${new Date(w.date).toLocaleString('es')}</div></div>`;
    });
    html += '</div>';

    html += '<div class="history-section"><h4>Sanciones</h4>';
    if (data.sanctions.length === 0) html += '<p style="color:var(--text-muted)">Sin sanciones</p>';
    else data.sanctions.forEach(s => {
      html += `<div class="history-item"><span class="log-type ${getLogTypeClass(s.type)}" style="margin-right:8px">${s.type}</span> ${s.reason}${s.duration ? ' | ' + s.duration : ''}<div class="date">${new Date(s.date).toLocaleString('es')}</div></div>`;
    });
    html += '</div>';

    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-footer').innerHTML = '<button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cerrar</button>';
  } catch (e) { toast(e.message, 'error'); }
}

async function executeServerInfo() {
  try {
    const data = await api('GET', '/info/server');
    openModal('Server Info', `
      <div style="text-align:center;margin-bottom:16px">
        ${data.icon ? `<img src="${data.icon}" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px">` : ''}
        <h3>${data.name}</h3>
        <p style="color:var(--text-muted);font-size:12px">ID: ${data.id}</p>
      </div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">Owner</div><div class="info-value">${data.owner}</div></div>
        <div class="info-item"><div class="info-label">Miembros</div><div class="info-value">${data.memberCount}</div></div>
        <div class="info-item"><div class="info-label">Canales</div><div class="info-value">${data.channelCount}</div></div>
        <div class="info-item"><div class="info-label">Roles</div><div class="info-value">${data.roleCount}</div></div>
        <div class="info-item"><div class="info-label">Boost Level</div><div class="info-value">${data.boostLevel}</div></div>
        <div class="info-item"><div class="info-label">Boosts</div><div class="info-value">${data.boostCount}</div></div>
        <div class="info-item"><div class="info-label">Verificacion</div><div class="info-value">${data.verificationLevel}</div></div>
        <div class="info-item"><div class="info-label">Creado</div><div class="info-value">${new Date(data.createdAt).toLocaleDateString('es')}</div></div>
      </div>
    `, '<button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cerrar</button>');
  } catch (e) { toast(e.message, 'error'); }
}

async function executeUserInfo() {
  const userId = document.getElementById('userinfo-user_id').value;
  if (!userId) return toast('Selecciona un usuario', 'error');
  try {
    const data = await api('GET', '/info/user/' + userId);
    document.getElementById('modal-body').innerHTML = `
      <div style="text-align:center;margin-bottom:16px">
        <img src="${data.avatar}" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px">
        <h3>${data.tag}</h3>
        <p style="color:var(--text-muted);font-size:12px">ID: ${data.id}</p>
      </div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">Display Name</div><div class="info-value">${data.displayName}</div></div>
        <div class="info-item"><div class="info-label">Bot</div><div class="info-value">${data.isBot ? 'Si' : 'No'}</div></div>
        <div class="info-item"><div class="info-label">Se unio</div><div class="info-value">${new Date(data.joinedAt).toLocaleDateString('es')}</div></div>
        <div class="info-item"><div class="info-label">Cuenta creada</div><div class="info-value">${new Date(data.createdAt).toLocaleDateString('es')}</div></div>
        <div class="info-item"><div class="info-label">Warns</div><div class="info-value">${data.warnings}</div></div>
        <div class="info-item"><div class="info-label">Sanciones</div><div class="info-value">${data.sanctions}</div></div>
      </div>
      <div style="margin-top:12px"><strong style="font-size:13px">Roles:</strong>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">
          ${data.roles.map(r => `<span style="padding:2px 8px;border-radius:10px;font-size:11px;background:${r.color}22;color:${r.color};border:1px solid ${r.color}44">${r.name}</span>`).join('')}
        </div>
      </div>
    `;
    document.getElementById('modal-footer').innerHTML = '<button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cerrar</button>';
  } catch (e) { toast(e.message, 'error'); }
}

async function executeRoleInfo() {
  const roleId = document.getElementById('roleinfo-role').value;
  if (!roleId) return toast('Selecciona un rol', 'error');
  try {
    const data = await api('GET', '/info/role/' + roleId);
    openModal('Role Info - ' + data.name, `
      <div style="text-align:center;margin-bottom:16px">
        <div style="width:40px;height:40px;border-radius:50%;background:${data.color};margin:0 auto 8px"></div>
        <h3>${data.name}</h3>
      </div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">ID</div><div class="info-value" style="font-size:12px">${data.id}</div></div>
        <div class="info-item"><div class="info-label">Color</div><div class="info-value">${data.color}</div></div>
        <div class="info-item"><div class="info-label">Posicion</div><div class="info-value">${data.position}</div></div>
        <div class="info-item"><div class="info-label">Miembros</div><div class="info-value">${data.members}</div></div>
        <div class="info-item"><div class="info-label">Mencionable</div><div class="info-value">${data.mentionable ? 'Si' : 'No'}</div></div>
        <div class="info-item"><div class="info-label">Separado</div><div class="info-value">${data.hoist ? 'Si' : 'No'}</div></div>
        <div class="info-item"><div class="info-label">Creado</div><div class="info-value">${new Date(data.createdAt).toLocaleDateString('es')}</div></div>
      </div>
      <div style="margin-top:12px"><strong style="font-size:13px">Permisos (${data.permissions.length}):</strong>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;max-height:120px;overflow-y:auto">
          ${data.permissions.map(p => `<span style="padding:2px 8px;border-radius:4px;font-size:10px;background:var(--bg-input);color:var(--text-secondary)">${p}</span>`).join('')}
        </div>
      </div>
    `, '<button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cerrar</button>');
  } catch (e) { toast(e.message, 'error'); }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

document.getElementById('login-key').addEventListener('keypress', e => {
  if (e.key === 'Enter') login();
});
