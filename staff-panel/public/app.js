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
  if (page === 'notes') loadNotesPage();
  if (page === 'settings') renderThemeSettings();

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
    toast(`Canal recreado: #${r.channel}`, 'success');
    closeModal();
    loadChannels();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeClearMessages() {
  const channelId = document.getElementById('clear-channel').value;
  const amount = parseInt(document.getElementById('clear-amount').value);
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
    toast(`Bloqueo de enlaces ${enabled ? 'activado' : 'desactivado'}`, 'success');
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
    toast(`Warns reducidos. Total actual: ${r.warnCount}`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeViewHistory() {
  const userId = document.getElementById('history-user_id').value;
  if (!userId) return toast('Selecciona un usuario', 'error');
  try {
    const r = await api('GET', '/action/history/' + userId);
    let html = `<div style="max-height:400px;overflow-y:auto;">`;
    html += `<p><strong>Usuario:</strong> ${r.user || userId}</p>`;
    html += `<p><strong>Warns actuales:</strong> ${r.warnCount || 0}</p>`;
    if (r.history && r.history.length > 0) {
      html += r.history.map(h => {
        const date = new Date(h.date).toLocaleString('es');
        return `<div class="log-entry" style="margin:8px 0">
          <span class="log-type ${getLogTypeClass(h.type)}">${h.type}</span>
          <span class="log-time">${date}</span>
          <span class="log-details">${h.reason || 'Sin razon'}</span>
        </div>`;
      }).join('');
    } else {
      html += '<p style="color:var(--text-muted)">Sin historial de sanciones</p>';
    }
    html += '</div>';
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-footer').innerHTML = `<button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cerrar</button>`;
  } catch (e) { toast(e.message, 'error'); }
}

async function executeServerInfo() {
  try {
    const r = await api('GET', '/guild/info');
    openModal('Server Info', `
      <div style="text-align:center;margin-bottom:16px;">
        ${r.icon ? `<img src="${r.icon}" style="width:80px;height:80px;border-radius:50%;margin-bottom:8px;">` : ''}
        <h3 style="margin:0">${r.name}</h3>
      </div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Miembros</span><span class="info-value">${r.memberCount}</span></div>
        <div class="info-item"><span class="info-label">Canales</span><span class="info-value">${r.channelCount}</span></div>
        <div class="info-item"><span class="info-label">Roles</span><span class="info-value">${r.roleCount}</span></div>
        <div class="info-item"><span class="info-label">Creado</span><span class="info-value">${new Date(r.createdAt).toLocaleDateString('es')}</span></div>
      </div>
    `, `<button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cerrar</button>`);
  } catch (e) { toast(e.message, 'error'); }
}

async function executeUserInfo() {
  const userId = document.getElementById('userinfo-user_id').value;
  if (!userId) return toast('Selecciona un usuario', 'error');
  try {
    const r = await api('GET', '/guild/user/' + userId);
    document.getElementById('modal-body').innerHTML = `
      <div style="text-align:center;margin-bottom:16px;">
        ${r.avatar ? `<img src="${r.avatar}" style="width:80px;height:80px;border-radius:50%;margin-bottom:8px;">` : ''}
        <h3 style="margin:0">${r.tag}</h3>
        <p style="color:var(--text-muted);font-size:12px">${r.id}</p>
      </div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Se unio</span><span class="info-value">${new Date(r.joinedAt).toLocaleDateString('es')}</span></div>
        <div class="info-item"><span class="info-label">Cuenta creada</span><span class="info-value">${new Date(r.createdAt).toLocaleDateString('es')}</span></div>
        <div class="info-item"><span class="info-label">Roles</span><span class="info-value">${r.roles ? r.roles.join(', ') : 'Ninguno'}</span></div>
      </div>
    `;
    document.getElementById('modal-footer').innerHTML = `<button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cerrar</button>`;
  } catch (e) { toast(e.message, 'error'); }
}

async function executeRoleInfo() {
  const roleId = document.getElementById('roleinfo-role').value;
  if (!roleId) return toast('Selecciona un rol', 'error');
  try {
    const r = await api('GET', '/guild/role/' + roleId);
    document.getElementById('modal-body').innerHTML = `
      <div style="text-align:center;margin-bottom:16px;">
        <h3 style="margin:0;color:${r.color || 'var(--text-primary)'}">${r.name}</h3>
      </div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">ID</span><span class="info-value">${r.id}</span></div>
        <div class="info-item"><span class="info-label">Miembros</span><span class="info-value">${r.memberCount || 0}</span></div>
        <div class="info-item"><span class="info-label">Posicion</span><span class="info-value">${r.position}</span></div>
        <div class="info-item"><span class="info-label">Mencionable</span><span class="info-value">${r.mentionable ? 'Si' : 'No'}</span></div>
      </div>
    `;
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
    if (!res.ok) throw new Error(data.error || 'Error desconocido');
    removeAITypingIndicator();

    if (data.conversationId) {
      aiConversationId = data.conversationId;
    }

    addAIMessage('assistant', data.response);
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
  toast('Conversacion limpiada', 'info');
}

function handleAIChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendAIMessage();
  }
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

const THEMES = {
  default: {
    name: 'Default', preview: '#5865f2',
    font: "'Segoe UI', system-ui, -apple-system, sans-serif",
    vars: { '--bg-primary': '#1a1a2e', '--bg-secondary': '#16213e', '--bg-card': '#1e2746', '--bg-input': '#0f1629', '--accent': '#5865f2', '--accent-hover': '#4752c4', '--text-primary': '#ffffff', '--text-secondary': '#b9bbbe', '--text-muted': '#72767d', '--border': '#2c2f47' }
  },
  lofi: {
    name: 'Lo-fi', preview: '#c4a882',
    font: "Georgia, serif",
    vars: { '--bg-primary': '#2d2a24', '--bg-secondary': '#262320', '--bg-card': '#35322b', '--bg-input': '#23201b', '--accent': '#c4a882', '--accent-hover': '#b09570', '--text-primary': '#f5f0e8', '--text-secondary': '#c9c0b1', '--text-muted': '#8a8070', '--border': '#4a4539' }
  },
  anime: {
    name: 'Anime', preview: '#ff6bcb',
    font: "'Quicksand', sans-serif",
    vars: { '--bg-primary': '#1a0a2e', '--bg-secondary': '#150826', '--bg-card': '#2d1b4e', '--bg-input': '#130720', '--accent': '#ff6bcb', '--accent-hover': '#e055b0', '--text-primary': '#f8f0ff', '--text-secondary': '#c8b0e0', '--text-muted': '#8a6aaa', '--border': '#3d2560' }
  },
  cartoon: {
    name: 'Cartoon', preview: '#ffd166',
    font: "'Comic Sans MS', 'Chalkboard SE', cursive",
    vars: { '--bg-primary': '#1e3a5f', '--bg-secondary': '#1a3050', '--bg-card': '#264b73', '--bg-input': '#152840', '--accent': '#ffd166', '--accent-hover': '#e6b84d', '--text-primary': '#ffffff', '--text-secondary': '#c0d8f0', '--text-muted': '#7a9ab8', '--border': '#345a80' }
  },
  simple: {
    name: 'Simple', preview: '#4a90d9',
    font: "'Inter', system-ui, sans-serif",
    vars: { '--bg-primary': '#1e1e1e', '--bg-secondary': '#1a1a1a', '--bg-card': '#2d2d2d', '--bg-input': '#171717', '--accent': '#4a90d9', '--accent-hover': '#3a7bc0', '--text-primary': '#f0f0f0', '--text-secondary': '#b0b0b0', '--text-muted': '#707070', '--border': '#3a3a3a' }
  },
  videojuegos: {
    name: 'Videojuegos', preview: '#00ff88',
    font: "'Orbitron', monospace",
    vars: { '--bg-primary': '#0a0e17', '--bg-secondary': '#080c14', '--bg-card': '#131a2a', '--bg-input': '#060a12', '--accent': '#00ff88', '--accent-hover': '#00cc6e', '--text-primary': '#e0ffe8', '--text-secondary': '#80c898', '--text-muted': '#40785a', '--border': '#1a2840' }
  }
};

function applyTheme(themeName) {
  const theme = THEMES[themeName];
  if (!theme) return;
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  document.body.style.fontFamily = theme.font;
  saveThemeToStorage({ theme: themeName });
}

function applyCustomColors(options) {
  const root = document.documentElement;
  if (options.font) document.body.style.fontFamily = options.font;
  if (options.accent) {
    root.style.setProperty('--accent', options.accent);
    const r = parseInt(options.accent.slice(1,3),16), g = parseInt(options.accent.slice(3,5),16), b = parseInt(options.accent.slice(5,7),16);
    root.style.setProperty('--accent-hover', `rgb(${Math.max(0,r-20)},${Math.max(0,g-20)},${Math.max(0,b-20)})`);
  }
  if (options.bg) {
    root.style.setProperty('--bg-primary', options.bg);
    const r = parseInt(options.bg.slice(1,3),16), g = parseInt(options.bg.slice(3,5),16), b = parseInt(options.bg.slice(5,7),16);
    root.style.setProperty('--bg-secondary', `rgb(${Math.max(0,r-4)},${Math.max(0,g-4)},${Math.max(0,b-4)})`);
  }
  if (options.text) root.style.setProperty('--text-primary', options.text);
  saveThemeToStorage({ custom: options });
}

function applyCustomFromControls() {
  const font = document.getElementById('custom-font').value;
  const accent = document.getElementById('custom-accent').value;
  const bg = document.getElementById('custom-bg').value;
  const text = document.getElementById('custom-text').value;
  document.getElementById('custom-accent-text').textContent = accent;
  document.getElementById('custom-bg-text').textContent = bg;
  document.getElementById('custom-text-text').textContent = text;
  applyCustomColors({ font, accent, bg, text });
}

function resetTheme() {
  applyTheme('default');
  if (currentUsername) localStorage.removeItem('panelTheme_' + currentUsername);
  toast('Tema restablecido', 'success');
  renderThemeSettings();
}

function saveThemeToStorage(data) {
  if (!currentUsername) return;
  localStorage.setItem('panelTheme_' + currentUsername, JSON.stringify(data));
}

function loadSavedTheme() {
  if (!currentUsername) return;
  const saved = localStorage.getItem('panelTheme_' + currentUsername);
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    if (data.theme) applyTheme(data.theme);
    if (data.custom) {
      const root = document.documentElement;
      if (data.custom.font) document.body.style.fontFamily = data.custom.font;
      if (data.custom.accent) {
        root.style.setProperty('--accent', data.custom.accent);
        const r = parseInt(data.custom.accent.slice(1,3),16), g = parseInt(data.custom.accent.slice(3,5),16), b = parseInt(data.custom.accent.slice(5,7),16);
        root.style.setProperty('--accent-hover', `rgb(${Math.max(0,r-20)},${Math.max(0,g-20)},${Math.max(0,b-20)})`);
      }
      if (data.custom.bg) {
        root.style.setProperty('--bg-primary', data.custom.bg);
        const r = parseInt(data.custom.bg.slice(1,3),16), g = parseInt(data.custom.bg.slice(3,5),16), b = parseInt(data.custom.bg.slice(5,7),16);
        root.style.setProperty('--bg-secondary', `rgb(${Math.max(0,r-4)},${Math.max(0,g-4)},${Math.max(0,b-4)})`);
      }
      if (data.custom.text) root.style.setProperty('--text-primary', data.custom.text);
    }
  } catch (e) {}
}

function renderThemeSettings() {
  const grid = document.getElementById('themes-grid');
  if (!grid) return;
  grid.innerHTML = Object.entries(THEMES).map(([key, theme]) => `
    <div class="theme-card" onclick="applyTheme('${key}')">
      <div class="theme-preview" style="background:${theme.vars['--bg-primary']}">
        <div class="theme-preview-accent" style="background:${theme.preview}"></div>
        <div class="theme-preview-text" style="color:${theme.vars['--text-primary']};font-family:${theme.font}">Aa</div>
      </div>
      <div class="theme-name">${theme.name}</div>
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
