const API_BASE = '/api';
const AI_SERVICE_URL = 'https://sirgio-bot.replit.app';
const AI_SERVICE_API_KEY = 'ff7e5970a7019e9b4c435a0b760177c598f1bd8bb8614a1a87af528e3838bffc';
let sessionToken = null;
let currentRole = null;
let currentUsername = null;
let currentDiscordId = null;
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
    let data;
    try {
      const text = await r.text();
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error(r.ok ? 'La respuesta del servidor no es válida.' : (r.status === 404 ? 'Ruta no encontrada.' : 'Error del servidor.'));
    }
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
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  if (!username || !password) return toast('Ingresa usuario y contraseña', 'error');
  try {
    const data = await api('POST', '/login', { username, password });
    sessionToken = data.token;
    currentRole = data.role;
    currentUsername = data.username;
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
  currentUsername = null;
  currentDiscordId = null;
  permissions = [];
  document.getElementById('app-page').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
}

async function initApp() {
  const badge = document.getElementById('role-badge');
  const roleLabels = { helper: 'Helper', moderator: 'Moderador', admin: 'Admin', owner: 'Dueño' };
  badge.textContent = roleLabels[currentRole] || currentRole;
  badge.className = 'role-badge ' + currentRole;
  document.getElementById('username-display').textContent = currentUsername || '-';

  try {
    const status = await api('GET', '/status');
    permissions = status.permissions || [];
    currentDiscordId = status.discordId || null;
    const botStatus = document.getElementById('bot-status');
    if (status.botOnline) {
      botStatus.textContent = (status.guildName || 'Servidor') + ' - Online';
      botStatus.className = 'bot-status online';
    } else {
      botStatus.textContent = 'Bot desconectado';
      botStatus.className = 'bot-status';
    }
    const avatar = document.getElementById('user-avatar');
    if (status.avatarUrl) {
      avatar.src = status.avatarUrl;
      avatar.style.display = 'block';
    } else {
      avatar.style.display = 'none';
    }
    updatePermissions();
    loadDashboard(status);
    loadChannels();
    loadRoles();
    loadSavedTheme();
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
  const parts = [];
  if (log.targetId) parts.push(`Target: ${log.targetId}`);
  if (log.staffId) parts.push(`Por: <@${log.staffId}>`);
  if (d.staffName) parts.push(`Staff: ${d.staffName}`);
  if (d.reason) { const r = String(d.reason); parts.push(`Razon: ${r.substring(0, 80)}${r.length > 80 ? '...' : ''}`); }
  if (d.channelName) parts.push(`Canal: #${d.channelName}`);
  if (d.duration) parts.push(`Duracion: ${d.duration}`);
  if (d.count != null) parts.push(`Cantidad: ${d.count}`);
  if (d.warnCount != null) parts.push(`Warns: ${d.warnCount}`);
  if (d.removed != null) parts.push(`Quitados: ${d.removed}`);
  if (d.remaining != null) parts.push(`Restantes: ${d.remaining}`);
  if (d.title) parts.push(`Titulo: ${String(d.title).substring(0, 40)}`);
  if (d.messagePreview) parts.push(`Mensaje: ${String(d.messagePreview).substring(0, 50)}...`);
  if (d.enabled !== undefined) parts.push(d.enabled ? 'Activado' : 'Desactivado');
  if (d.previousRolesCount != null) parts.push(`Roles previos: ${d.previousRolesCount}`);
  if (d.previousRoles != null && Array.isArray(d.previousRoles)) parts.push(`Roles previos: ${d.previousRoles.length}`);
  if (d.suggestionId) parts.push(`Sugerencia: ${d.suggestionId}`);
  if (d.ticketNumber) parts.push(`Ticket #${d.ticketNumber}`);
  if (d.status) parts.push(`Estado: ${d.status}`);
  return parts.length ? parts.join(' | ') : 'Sin detalles';
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
  if (page === 'notes') loadNotesPage();
  if (page === 'settings') renderThemeSettings();
  var aiChat = document.getElementById('ai-chat-messages');
  if (aiChat && aiChat.offsetParent !== null) loadAIUsage();

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
    toast(`Canal #${r.channel} recreado`, 'success');
    closeModal();
    loadChannels();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeClearMessages() {
  const channelId = document.getElementById('clear-channel').value;
  const amount = parseInt(document.getElementById('clear-amount').value);
  if (!channelId) return toast('Selecciona un canal', 'error');
  if (!amount || amount < 1 || amount > 100) return toast('Cantidad invalida (1-100)', 'error');
  try {
    const r = await api('POST', '/action/clear-messages', { channelId, amount });
    toast(`${r.deleted} mensajes eliminados en #${r.channel}`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeSendEmbed() {
  const channelId = document.getElementById('embed-channel').value;
  const title = document.getElementById('embed-title').value;
  const description = document.getElementById('embed-desc').value;
  const color = document.getElementById('embed-color').value;
  if (!channelId || !title) return toast('Completa canal y titulo', 'error');
  try {
    await api('POST', '/action/send-embed', { channelId, title, description, color });
    toast('Embed enviado', 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeSendDM() {
  const userId = document.getElementById('dm-user_id').value;
  const message = document.getElementById('dm-message').value;
  if (!userId || !message) return toast('Completa todos los campos', 'error');
  try {
    await api('POST', '/action/send-dm', { userId, message });
    toast('DM enviado', 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeEditMessage() {
  const channelId = document.getElementById('edit-channel').value;
  const messageId = document.getElementById('edit-msgid').value;
  const content = document.getElementById('edit-content').value;
  if (!channelId || !messageId || !content) return toast('Completa todos los campos', 'error');
  try {
    await api('POST', '/action/edit-message', { channelId, messageId, content });
    toast('Mensaje editado', 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeBlockLinks() {
  const channelId = document.getElementById('blocklinks-channel').value;
  const enabled = document.getElementById('blocklinks-enabled').checked;
  if (!channelId) return toast('Selecciona un canal', 'error');
  try {
    await api('POST', '/action/block-links', { channelId, enabled });
    toast(`Bloqueo de links ${enabled ? 'activado' : 'desactivado'}`, 'success');
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
  const amount = parseInt(document.getElementById('reducewarn-amount').value);
  if (!userId) return toast('Selecciona un usuario', 'error');
  try {
    const r = await api('POST', '/action/reduce-warn', { userId, amount });
    toast(`Warns reducidos. ${r.user} ahora tiene ${r.warnCount} warns`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeViewHistory() {
  const userId = document.getElementById('history-user_id').value;
  if (!userId) return toast('Selecciona un usuario', 'error');
  try {
    const r = await api('GET', '/action/view-history/' + userId);
    const history = r.history || [];
    let html = `<h4 style="margin-bottom:12px">${r.user} - ${r.warnCount} warns activos</h4>`;
    if (history.length === 0) {
      html += '<p style="color:var(--text-muted)">No hay historial de sanciones</p>';
    } else {
      html += history.map(h => {
        const date = new Date(h.date).toLocaleString('es');
        return `<div class="log-entry">
          <span class="log-type ${getLogTypeClass(h.type)}">${h.type}</span>
          <span class="log-time">${date}</span>
          <span class="log-details">${h.reason || 'Sin razon'}</span>
        </div>`;
      }).join('');
    }
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-footer').innerHTML = `<button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cerrar</button>`;
  } catch (e) { toast(e.message, 'error'); }
}

async function executeServerInfo() {
  try {
    const r = await api('GET', '/info/server');
    openModal('Server Info', `
      <div style="text-align:center;margin-bottom:16px;">
        ${r.icon ? `<img src="${r.icon}" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;">` : ''}
        <h3>${r.name}</h3>
      </div>
      <div class="stats-grid" style="grid-template-columns:repeat(2,1fr);gap:8px;">
        <div class="stat-card"><div class="stat-value">${r.memberCount}</div><div class="stat-label">Miembros</div></div>
        <div class="stat-card"><div class="stat-value">${r.channelCount}</div><div class="stat-label">Canales</div></div>
        <div class="stat-card"><div class="stat-value">${r.roleCount}</div><div class="stat-label">Roles</div></div>
        <div class="stat-card"><div class="stat-value">${r.boostLevel}</div><div class="stat-label">Nivel Boost</div></div>
      </div>
    `, `<button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cerrar</button>`);
  } catch (e) { toast(e.message, 'error'); }
}

async function executeUserInfo() {
  const userId = document.getElementById('userinfo-user_id').value;
  if (!userId) return toast('Selecciona un usuario', 'error');
  try {
    const r = await api('GET', '/info/user/' + userId);
    let html = `<div style="text-align:center;margin-bottom:16px;">
      ${r.avatar ? `<img src="${r.avatar}" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;">` : ''}
      <h3>${r.tag}</h3>
      <p style="color:var(--text-muted);font-size:13px;">ID: ${r.id}</p>
    </div>
    <div class="stats-grid" style="grid-template-columns:repeat(2,1fr);gap:8px;">
      <div class="stat-card"><div class="stat-value">${new Date(r.joinedAt).toLocaleDateString('es')}</div><div class="stat-label">Se unio</div></div>
      <div class="stat-card"><div class="stat-value">${new Date(r.createdAt).toLocaleDateString('es')}</div><div class="stat-label">Cuenta creada</div></div>
      <div class="stat-card"><div class="stat-value">${r.roles?.length || 0}</div><div class="stat-label">Roles</div></div>
      <div class="stat-card"><div class="stat-value">${r.bot ? 'Si' : 'No'}</div><div class="stat-label">Es Bot</div></div>
    </div>`;
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-footer').innerHTML = `<button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cerrar</button>`;
  } catch (e) { toast(e.message, 'error'); }
}

async function executeRoleInfo() {
  const roleId = document.getElementById('roleinfo-role').value;
  if (!roleId) return toast('Selecciona un rol', 'error');
  try {
    const r = await api('GET', '/info/role/' + roleId);
    let html = `<h3 style="color:${r.color || 'inherit'};margin-bottom:12px;">${r.name}</h3>
    <div class="stats-grid" style="grid-template-columns:repeat(2,1fr);gap:8px;">
      <div class="stat-card"><div class="stat-value">${r.memberCount}</div><div class="stat-label">Miembros</div></div>
      <div class="stat-card"><div class="stat-value">${r.position}</div><div class="stat-label">Posicion</div></div>
      <div class="stat-card"><div class="stat-value">${r.mentionable ? 'Si' : 'No'}</div><div class="stat-label">Mencionable</div></div>
      <div class="stat-card"><div class="stat-value">${r.hoisted ? 'Si' : 'No'}</div><div class="stat-label">Separado</div></div>
    </div>`;
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-footer').innerHTML = `<button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cerrar</button>`;
  } catch (e) { toast(e.message, 'error'); }
}

let aiConversationId = null;
let aiIsStreaming = false;

function formatAIMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/\n/g, '<br>');
}

function addAIMessage(role, content) {
  const container = document.getElementById('ai-chat-messages');
  const div = document.createElement('div');
  div.className = 'ai-message ' + role;
  const avatarEmoji = role === 'user' ? '&#128100;' : '&#129302;';
  const bubbleContent = role === 'user' ? content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') : formatAIMarkdown(content);

  div.innerHTML = `
    <div class="ai-message-avatar">${avatarEmoji}</div>
    <div class="ai-message-bubble">${bubbleContent}</div>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function addAITypingIndicator() {
  const container = document.getElementById('ai-chat-messages');
  const div = document.createElement('div');
  div.className = 'ai-message assistant';
  div.id = 'ai-typing';
  div.innerHTML = `
    <div class="ai-message-avatar">&#129302;</div>
    <div class="ai-message-bubble">
      <div class="ai-typing-indicator"><span></span><span></span><span></span></div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function removeAITypingIndicator() {
  const typing = document.getElementById('ai-typing');
  if (typing) typing.remove();
}

function showAIUsageInChat(usagePercent, costThisMessage) {
  const percent = Math.min(usagePercent, 100);
  const remaining = (100 - percent).toFixed(1);
  let color;
  if (percent >= 90) {
    color = '#e74c3c';
  } else if (percent >= 70) {
    color = '#f39c12';
  } else {
    color = '#2ecc71';
  }

  const container = document.getElementById('ai-chat-messages');
  if (!container) return;

  let existing = document.getElementById('ai-usage-info');
  if (existing) existing.remove();

  const costText = costThisMessage ? ' (-' + costThisMessage.toFixed(1) + '%)' : '';
  const warningText = percent >= 90 ? '<br><span style="color:#e74c3c;">Se reinicia a medianoche hora Venezuela</span>' : '';

  const div = document.createElement('div');
  div.id = 'ai-usage-info';
  div.style.cssText = 'text-align:center;padding:6px 12px;margin:4px auto;max-width:320px;';
  div.innerHTML = '<div style="font-size:11px;color:#8892b0;">' +
    '<span style="color:' + color + ';font-weight:700;">&#9889; ' + percent.toFixed(1) + '% usado</span>' + costText +
    ' | Disponible: ' + remaining + '%' +
    '<div style="width:100%;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;margin-top:4px;">' +
    '<div style="width:' + percent + '%;height:100%;border-radius:2px;background:' + color + ';"></div>' +
    '</div>' + warningText + '</div>';

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function loadAIUsage() {
  try {
    const res = await fetch(AI_SERVICE_URL + '/api/ai/usage', {
      headers: {
        'X-API-Key': AI_SERVICE_API_KEY,
        'X-Staff-Username': currentUsername || 'unknown',
        'X-Staff-Role': currentRole || 'unknown'
      }
    });
    if (res.ok) {
      const data = await res.json();
      showAIUsageInChat(data.usagePercent);
    }
  } catch (e) {}
}

async function sendAIMessage() {
  if (aiIsStreaming) return;
  const input = document.getElementById('ai-chat-input');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  input.style.height = 'auto';
  addAIMessage('user', message);
  addAITypingIndicator();

  aiIsStreaming = true;
  const sendBtn = document.getElementById('ai-send-btn');
  sendBtn.disabled = true;

  try {
    const res = await fetch(AI_SERVICE_URL + '/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AI_SERVICE_API_KEY,
        'X-Staff-Username': currentUsername || 'unknown',
        'X-Staff-Role': currentRole || 'unknown'
      },
      body: JSON.stringify({ message, conversationId: aiConversationId })
    });
    const data = await res.json();

    removeAITypingIndicator();

    if (res.status === 429 && data.error === 'usage_limit_reached') {
      addAIMessage('assistant', data.message);
      showAIUsageInChat(100);
      return;
    }

    if (!res.ok) throw new Error(data.error || 'Error desconocido');

    if (data.conversationId) {
      aiConversationId = data.conversationId;
    }

    let responseText = data.response;
    if (data.usage) {
      const pct = data.usage.currentPercent;
      const cost = data.usage.costThisMessage;
      const rem = data.usage.remaining;
      responseText += '\n\n---\n*Uso diario: **' + pct + '%** usado (-' + cost + '%) | Disponible: ' + rem + '%*';
    }
    addAIMessage('assistant', responseText);
  } catch (e) {
    removeAITypingIndicator();
    toast('Error del asistente: ' + e.message, 'error');
    addAIMessage('assistant', 'Lo siento, hubo un error al procesar tu consulta. Intenta de nuevo.');
  } finally {
    aiIsStreaming = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

function sendAISuggestion(text) {
  document.getElementById('ai-chat-input').value = text;
  sendAIMessage();
}

async function clearAIChat() {
  if (aiConversationId) {
    try {
      await fetch(AI_SERVICE_URL + '/api/ai/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': AI_SERVICE_API_KEY
        },
        body: JSON.stringify({ conversationId: aiConversationId })
      });
    } catch (e) {}
  }
  aiConversationId = null;
  const container = document.getElementById('ai-chat-messages');
  container.innerHTML = `
    <div class="ai-welcome-message">
      <div class="ai-welcome-icon">&#129302;</div>
      <h3>Hola, soy el Asistente de Moderacion</h3>
      <p>Puedo ayudarte con:</p>
      <div class="ai-suggestions">
        <button class="ai-suggestion-btn" onclick="sendAISuggestion('Un usuario esta haciendo spam en el chat general, que hago?')">Un usuario hace spam</button>
        <button class="ai-suggestion-btn" onclick="sendAISuggestion('Que sancion aplico si alguien envia contenido NSFW?')">Contenido NSFW</button>
        <button class="ai-suggestion-btn" onclick="sendAISuggestion('Explicame la regla 7 sobre multicuentas')">Regla de multicuentas</button>
        <button class="ai-suggestion-btn" onclick="sendAISuggestion('Un usuario tiene 5 warns, que deberia pasar?')">Escalacion de warns</button>
      </div>
    </div>
  `;
  loadAIUsage();
  toast('Conversacion limpiada', 'info');
}

function handleAIChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendAIMessage();
  }
}

const themes = {
  dark: {
    name: 'Oscuro',
    vars: {
      '--bg-primary': '#1a1a2e',
      '--bg-secondary': '#16213e',
      '--bg-card': '#1e2a45',
      '--bg-input': '#0f1729',
      '--text-primary': '#e0e0e0',
      '--text-muted': '#8892b0',
      '--border': '#2d3a5c',
      '--accent': '#5865F2',
      '--success': '#43b581',
      '--danger': '#f04747',
      '--warning': '#faa61a',
      '--info': '#00b0f4'
    }
  },
  midnight: {
    name: 'Medianoche',
    vars: {
      '--bg-primary': '#0d0d1a',
      '--bg-secondary': '#12121f',
      '--bg-card': '#181828',
      '--bg-input': '#0a0a14',
      '--text-primary': '#d4d4e8',
      '--text-muted': '#6b6b8d',
      '--border': '#252540',
      '--accent': '#7c3aed',
      '--success': '#10b981',
      '--danger': '#ef4444',
      '--warning': '#f59e0b',
      '--info': '#3b82f6'
    }
  },
  ocean: {
    name: 'Oceano',
    vars: {
      '--bg-primary': '#0a192f',
      '--bg-secondary': '#0d2137',
      '--bg-card': '#112240',
      '--bg-input': '#071525',
      '--text-primary': '#ccd6f6',
      '--text-muted': '#8892b0',
      '--border': '#1d3557',
      '--accent': '#64ffda',
      '--success': '#64ffda',
      '--danger': '#ff6b6b',
      '--warning': '#ffd93d',
      '--info': '#6ec6ff'
    }
  },
  crimson: {
    name: 'Carmesi',
    vars: {
      '--bg-primary': '#1a0a0a',
      '--bg-secondary': '#2d1515',
      '--bg-card': '#3a1c1c',
      '--bg-input': '#120808',
      '--text-primary': '#f0d0d0',
      '--text-muted': '#a07070',
      '--border': '#4a2525',
      '--accent': '#dc3545',
      '--success': '#28a745',
      '--danger': '#ff4757',
      '--warning': '#ffc107',
      '--info': '#17a2b8'
    }
  }
};

function applyTheme(themeKey) {
  const theme = themes[themeKey];
  if (!theme) return;
  const root = document.documentElement;
  for (const [prop, val] of Object.entries(theme.vars)) {
    root.style.setProperty(prop, val);
  }
  localStorage.setItem('selectedTheme', themeKey);
}

function loadSavedTheme() {
  const saved = localStorage.getItem('selectedTheme');
  if (saved && themes[saved]) {
    applyTheme(saved);
  }
}

function renderThemeSettings() {
  const container = document.getElementById('theme-options');
  if (!container) return;
  const currentTheme = localStorage.getItem('selectedTheme') || 'dark';
  container.innerHTML = Object.entries(themes).map(([key, theme]) => `
    <div class="theme-option ${key === currentTheme ? 'active' : ''}" onclick="applyTheme('${key}'); renderThemeSettings();">
      <div class="theme-preview" style="background:${theme.vars['--bg-primary']};">
        <div style="width:60%;height:6px;border-radius:3px;background:${theme.vars['--accent']};margin-bottom:4px;"></div>
        <div style="width:40%;height:6px;border-radius:3px;background:${theme.vars['--text-muted']};"></div>
      </div>
      <span>${theme.name}</span>
    </div>
  `).join('');
}

let currentNotesUserId = null;
let currentNotesUserTag = null;

function loadNotesPage() {
  currentNotesUserId = null;
  currentNotesUserTag = null;
  document.getElementById('notes-container').innerHTML = '';
  document.getElementById('notes-form').style.display = 'none';
  const userInput = document.getElementById('notes-user');
  if (userInput) userInput.value = '';
  const userIdInput = document.getElementById('notes-user_id');
  if (userIdInput) userIdInput.value = '';
}

async function loadNotes() {
  const userId = document.getElementById('notes-user_id').value;
  const userTag = document.getElementById('notes-user').value;
  if (!userId) return toast('Selecciona un usuario primero', 'error');
  currentNotesUserId = userId;
  currentNotesUserTag = userTag;
  document.getElementById('notes-form').style.display = 'block';
  try {
    const notes = await api('GET', '/notes/' + userId);
    const container = document.getElementById('notes-container');
    if (notes.length === 0) {
      container.innerHTML = '<div class="card" style="margin-top:16px"><div class="card-body"><div class="empty-state"><div class="empty-icon">&#128221;</div><p>No hay notas para este usuario</p></div></div></div>';
      return;
    }
    container.innerHTML = '<div class="card" style="margin-top:16px"><div class="card-header">&#128203; Notas de ' + userTag + '</div><div class="card-body">' +
      notes.map(n => {
        const date = new Date(n.createdAt).toLocaleString('es');
        const canDelete = n.authorId === currentDiscordId || ['admin', 'owner'].includes(currentRole);
        const deleteBtn = canDelete ? `<button class="btn btn-sm btn-danger" onclick="deleteNote('${n._id}')">Eliminar</button>` : '';
        return `<div class="note-card">
          <div class="note-header">
            <span class="note-author">${n.authorName}</span>
            <span class="note-date">${date}</span>
          </div>
          <div class="note-content">${n.content.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}</div>
          ${deleteBtn ? '<div class="note-footer">' + deleteBtn + '</div>' : ''}
        </div>`;
      }).join('') + '</div></div>';
  } catch (e) {
    toast('Error cargando notas: ' + e.message, 'error');
  }
}

async function createNote() {
  if (!currentNotesUserId) return toast('Selecciona un usuario primero', 'error');
  const content = document.getElementById('note-content').value.trim();
  if (!content) return toast('Escribe el contenido de la nota', 'error');
  try {
    await api('POST', '/notes', { targetUserId: currentNotesUserId, targetTag: currentNotesUserTag, content });
    toast('Nota guardada', 'success');
    document.getElementById('note-content').value = '';
    loadNotes();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function deleteNote(noteId) {
  if (!confirm('Eliminar esta nota?')) return;
  try {
    await api('DELETE', '/notes/' + noteId);
    toast('Nota eliminada', 'success');
    loadNotes();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}
