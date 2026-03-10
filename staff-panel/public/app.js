const API_BASE = '/api';
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

let pendingCodeId = null;

async function login() {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  if (!username || !password) return toast('Ingresa usuario y contraseña', 'error');
  try {
    const data = await api('POST', '/login', { username, password });
    if (data.requireCode) {
      pendingCodeId = data.codeId;
      document.getElementById('login-form-fields').style.display = 'none';
      document.getElementById('login-code-fields').style.display = 'block';
      document.getElementById('login-code-input').value = '';
      document.getElementById('login-code-input').focus();
      toast('Codigo de verificacion enviado a tu DM de Discord', 'info');
      return;
    }
    completeLogin(data);
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function verifyCode() {
  const code = document.getElementById('login-code-input').value.trim();
  if (!code || !pendingCodeId) return toast('Ingresa el codigo de 5 digitos', 'error');
  try {
    const data = await api('POST', '/verify-code', { codeId: pendingCodeId, code });
    pendingCodeId = null;
    document.getElementById('login-form-fields').style.display = 'block';
    document.getElementById('login-code-fields').style.display = 'none';
    completeLogin(data);
  } catch (e) {
    toast(e.message, 'error');
    if (e.message.includes('expirado') || e.message.includes('invalido') || e.message.includes('bloqueada')) {
      cancelCode();
    }
  }
}

function cancelCode() {
  pendingCodeId = null;
  document.getElementById('login-form-fields').style.display = 'block';
  document.getElementById('login-code-fields').style.display = 'none';
}

function completeLogin(data) {
  sessionToken = data.token;
  currentRole = data.role;
  currentUsername = data.username;
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app-page').style.display = 'flex';
  initApp();
  const loginHash = window.location.hash.replace('#', '');
  if (loginHash && document.getElementById('page-' + loginHash)) {
    navigateTo(loginHash, true);
  }
}

function logout() {
  if (auditSSE) { auditSSE.close(); auditSSE = null; auditSSEConnected = false; }
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

  loadRecentLogs('recent-logs', 10);
  loadStaffLogins();
}

async function loadStaffLogins() {
  try {
    const result = await api('GET', '/logs?actionType=STAFF_LOGIN&limit=20');
    const logs = result.logs || [];
    const container = document.getElementById('staff-logins');
    if (!container) return;
    if (logs.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No hay logins registrados</p></div>';
      return;
    }
    container.innerHTML = `<table class="staff-logins-table">
      <thead><tr><th>Usuario</th><th>Rol</th><th>Fecha</th><th>Hora</th></tr></thead>
      <tbody>${logs.map(log => {
        const d = log.details || {};
        const date = new Date(log.createdAt);
        const dateStr = date.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `<tr>
          <td><strong>${escapeHtml(d.staffName || '-')}</strong></td>
          <td><span class="login-role-badge">${escapeHtml(d.role || '-')}</span></td>
          <td>${dateStr}</td>
          <td>${timeStr}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  } catch (e) {
    const container = document.getElementById('staff-logins');
    if (container) container.innerHTML = '<p style="color:var(--text-muted)">Error cargando logins</p>';
  }
}

let auditCurrentPage = 1;
let auditFullscreenPage = 1;
let auditSearchTimer = null;
let auditFSSearchTimer = null;
let auditRefreshInterval = null;
let cachedAuditLogs = [];
let cachedAuditLogsFull = [];

async function loadRecentLogs(containerId, limit) {
  try {
    const result = await api('GET', '/logs?limit=' + (limit || 10));
    const logs = result.logs || [];
    const container = document.getElementById(containerId);
    const items = [...logs].reverse();
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
        <span class="log-details">${formatLogSummary(log)}</span>
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

function formatLogSummary(log) {
  const d = log.details || {};
  const parts = [];
  if (d.userTag) parts.push(d.userTag);
  else if (d.authorTag) parts.push(d.authorTag);
  else if (d.targetName) parts.push(d.targetName);
  else if (log.targetId) parts.push(log.targetId);
  if (d.staffName) parts.push(`Staff: ${d.staffName}`);
  if (d.reason) { const r = String(d.reason); parts.push(`${r.substring(0, 60)}${r.length > 60 ? '...' : ''}`); }
  if (d.channelName) parts.push(`#${d.channelName}`);
  if (d.duration) parts.push(d.duration);
  if (d.count != null) parts.push(`x${d.count}`);
  if (d.warnCount != null) parts.push(`Warns: ${d.warnCount}`);
  if (d.oldContent && d.newContent) {
    const old = String(d.oldContent).substring(0, 50);
    const nw = String(d.newContent).substring(0, 50);
    parts.push(`${old} → ${nw}`);
  }
  if (d.content && log.actionType === 'MESSAGE_DELETE') {
    parts.push(String(d.content).substring(0, 80));
  }
  if (d.attachments && Array.isArray(d.attachments) && d.attachments.length > 0) {
    const icons = { image: '🖼️', video: '🎬', audio: '🎵', file: '📎' };
    const attSummary = d.attachments.map(a => `${icons[a.type] || '📎'} ${a.name}`).join(', ');
    parts.push(attSummary);
  }
  if (d.oldAttachments && Array.isArray(d.oldAttachments) && d.removedAttachments) {
    const icons = { image: '🖼️', video: '🎬', audio: '🎵', file: '📎' };
    parts.push('Archivos eliminados: ' + d.removedAttachments.join(', '));
  }
  if (d.role && log.actionType === 'STAFF_LOGIN') {
    parts.push(`Rol: ${d.role}`);
  }
  if (d.roles && Array.isArray(d.roles)) parts.push(d.roles.join(', '));
  if (d.changes && Array.isArray(d.changes)) parts.push(d.changes.join(', '));
  return parts.length ? escapeHtml(parts.join(' | ')) : 'Sin detalles';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadAuditLogs(page) {
  auditCurrentPage = page || 1;
  const params = buildAuditParams('audit');
  params.set('page', auditCurrentPage);
  params.set('limit', 30);
  try {
    const result = await api('GET', '/logs?' + params.toString());
    cachedAuditLogs = result.logs || [];
    renderAuditTable(result.logs || [], 'audit-logs-list');
    renderAuditPagination(result.page, result.totalPages, result.total, 'audit-pagination', loadAuditLogs);
    setTimeout(() => {
      const logsContainer = document.getElementById('audit-logs-container');
      if (logsContainer) {
        logsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        logsContainer.scrollTo({ top: logsContainer.scrollHeight, behavior: 'smooth' });
        const lastItem = logsContainer.querySelector('.audit-log-item:last-child');
        if (lastItem) {
          lastItem.classList.add('highlight-newest');
          setTimeout(() => lastItem.classList.remove('highlight-newest'), 1000);
        }
      }
    }, 150);
  } catch (e) {
    document.getElementById('audit-logs-list').innerHTML = '<div class="empty-state"><p>Error cargando logs</p></div>';
  }
}

async function loadAuditLogsFull(page) {
  auditFullscreenPage = page || 1;
  const params = buildAuditParams('audit-fs');
  params.set('page', auditFullscreenPage);
  params.set('limit', 50);
  try {
    const result = await api('GET', '/logs?' + params.toString());
    cachedAuditLogsFull = result.logs || [];
    renderAuditTable(cachedAuditLogsFull, 'audit-fullscreen-body');
    renderAuditPagination(result.page, result.totalPages, result.total, 'audit-fullscreen-pagination', loadAuditLogsFull);
    setTimeout(() => {
      const fsBody = document.getElementById('audit-fullscreen-body');
      if (fsBody) {
        fsBody.scrollTo({ top: fsBody.scrollHeight, behavior: 'smooth' });
        const lastItem = fsBody.querySelector('.audit-log-item:last-child');
        if (lastItem) {
          lastItem.classList.add('highlight-newest');
          setTimeout(() => lastItem.classList.remove('highlight-newest'), 1000);
        }
      }
    }, 150);
  } catch (e) {
    document.getElementById('audit-fullscreen-body').innerHTML = '<div class="empty-state"><p>Error cargando logs</p></div>';
  }
}

function buildAuditParams(prefix) {
  const params = new URLSearchParams();
  const search = document.getElementById(prefix + '-search');
  const category = document.getElementById(prefix + '-category');
  const severity = document.getElementById(prefix + '-severity');
  const actionType = document.getElementById(prefix + '-action-type');
  const dateFrom = document.getElementById(prefix + '-date-from');
  const dateTo = document.getElementById(prefix + '-date-to');

  if (search && search.value) params.set('search', search.value);
  if (category && category.value) params.set('category', category.value);
  if (severity && severity.value) params.set('severity', severity.value);
  if (actionType && actionType.value) params.set('actionType', actionType.value);
  if (dateFrom && dateFrom.value) params.set('dateFrom', dateFrom.value);
  if (dateTo && dateTo.value) params.set('dateTo', dateTo.value + 'T23:59:59');

  const userIdField = document.getElementById(prefix.replace('-fs', '') + '-user-search_id');
  if (userIdField && userIdField.value) params.set('userId', userIdField.value);

  return params;
}

function renderAuditTable(logs, containerId) {
  const container = document.getElementById(containerId);
  if (!logs || logs.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128220;</div><p>No se encontraron registros</p></div>';
    return;
  }
  const items = [...logs].reverse();
  container.innerHTML = items.map((log, i) => {
    const date = new Date(log.createdAt);
    const timeStr = date.toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const cat = log.category || 'SYSTEM';
    const sev = log.severity || 'INFO';
    const summary = formatLogSummary(log);
    const idx = logs.length - 1 - i;
    const d = log.details || {};
    let msgPreview = '';
    if (log.actionType === 'MESSAGE_EDIT' && (d.oldContent || d.newContent)) {
      msgPreview = `<div class="audit-msg-preview audit-msg-edit"><span class="msg-label">Antes:</span> <span class="msg-old">${escapeHtml(String(d.oldContent || '').substring(0, 120))}</span><br><span class="msg-label">Despues:</span> <span class="msg-new">${escapeHtml(String(d.newContent || '').substring(0, 120))}</span></div>`;
      if (d.removedAttachments && d.removedAttachments.length > 0) {
        msgPreview += `<div class="audit-msg-preview audit-msg-attachment"><span class="msg-label">📎 Archivos eliminados:</span> ${escapeHtml(d.removedAttachments.join(', '))}</div>`;
      }
    } else if (log.actionType === 'MESSAGE_DELETE') {
      if (d.content) {
        msgPreview = `<div class="audit-msg-preview audit-msg-delete"><span class="msg-label">Mensaje:</span> ${escapeHtml(String(d.content).substring(0, 200))}</div>`;
      }
      if (d.attachments && d.attachments.length > 0) {
        const icons = { image: '🖼️', video: '🎬', audio: '🎵', file: '📎' };
        const thumbs = d.attachments.filter(a => a.type === 'image' && a.url).slice(0, 3);
        const thumbHtml = thumbs.length > 0 ? '<div class="audit-inline-thumbs">' + thumbs.map(a => `<img src="${escapeHtml(a.url)}" alt="${escapeHtml(a.name)}" class="audit-inline-thumb" onclick="event.stopPropagation();window.open('${escapeHtml(a.url)}','_blank')">`).join('') + '</div>' : '';
        const attHtml = d.attachments.map(a => `${icons[a.type] || '📎'} ${escapeHtml(a.name)}`).join(', ');
        msgPreview += `<div class="audit-msg-preview audit-msg-attachment"><span class="msg-label">Archivos:</span> ${attHtml}${thumbHtml}</div>`;
      }
    } else if (log.actionType === 'STAFF_LOGIN') {
      msgPreview = `<div class="audit-msg-preview audit-msg-login"><span class="msg-label">👤 Login:</span> ${escapeHtml(d.staffName || '')} — Rol: ${escapeHtml(d.role || '')}</div>`;
    }
    const sevClass = sev === 'CRITICAL' ? ' severity-critical-row' : sev === 'HIGH' ? ' severity-high-row' : '';
    return `<div class="audit-log-item ${msgPreview ? 'has-preview' : ''}${sevClass}" onclick="showAuditDetail(${idx}, '${containerId}')">
      <span class="audit-log-time">${timeStr}</span>
      <span class="audit-log-type category-${cat}">${log.actionType.replace(/_/g, ' ')}</span>
      <span class="audit-log-severity severity-${sev}">${sev}</span>
      <span class="audit-log-summary">${summary}</span>
      <span class="audit-log-category category-${cat}">${cat}</span>
      ${msgPreview}
    </div>`;
  }).join('');
}

function renderAuditPagination(currentPage, totalPages, total, containerId, loadFn) {
  const container = document.getElementById(containerId);
  if (!totalPages || totalPages <= 1) {
    container.innerHTML = total ? `<span class="audit-page-info">${total} registros</span>` : '';
    return;
  }
  let html = `<button ${currentPage <= 1 ? 'disabled' : ''} onclick="${loadFn.name}(${currentPage - 1})">&#9664;</button>`;
  const maxVisible = 7;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
  if (start > 1) {
    html += `<button onclick="${loadFn.name}(1)">1</button>`;
    if (start > 2) html += '<span class="audit-page-info">...</span>';
  }
  for (let p = start; p <= end; p++) {
    html += `<button class="${p === currentPage ? 'active' : ''}" onclick="${loadFn.name}(${p})">${p}</button>`;
  }
  if (end < totalPages) {
    if (end < totalPages - 1) html += '<span class="audit-page-info">...</span>';
    html += `<button onclick="${loadFn.name}(${totalPages})">${totalPages}</button>`;
  }
  html += `<button ${currentPage >= totalPages ? 'disabled' : ''} onclick="${loadFn.name}(${currentPage + 1})">&#9654;</button>`;
  html += `<span class="audit-page-info">${total} registros</span>`;
  container.innerHTML = html;
}

async function loadAuditStats() {
  try {
    const stats = await api('GET', '/logs/stats');
    const row = document.getElementById('audit-stats-row');
    const catLabels = { USER: 'Usuarios', CHANNEL: 'Canales', MESSAGE: 'Mensajes', AUTOMOD: 'AutoMod', STAFF: 'Staff', SYSTEM: 'Sistema' };
    const sevColors = { INFO: 'var(--info)', LOW: 'var(--success)', MEDIUM: 'var(--warning)', HIGH: 'var(--danger)', CRITICAL: '#ef4444' };
    let html = `<div class="audit-stat-card"><div class="audit-stat-value">${stats.total}</div><div class="audit-stat-label">Total</div></div>`;
    html += `<div class="audit-stat-card"><div class="audit-stat-value">${stats.today}</div><div class="audit-stat-label">Hoy</div></div>`;
    Object.entries(stats.byCategory || {}).forEach(([cat, count]) => {
      html += `<div class="audit-stat-card"><div class="audit-stat-value">${count}</div><div class="audit-stat-label">${catLabels[cat] || cat}</div></div>`;
    });
    row.innerHTML = html;
  } catch (e) {
    document.getElementById('audit-stats-row').innerHTML = '';
  }
}

async function loadAuditActionTypes() {
  try {
    const types = await api('GET', '/logs/action-types');
    ['audit-action-type', 'audit-fs-action-type'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const current = sel.value;
      sel.innerHTML = '<option value="">Todos</option>' + types.map(t => `<option value="${t}" ${t === current ? 'selected' : ''}>${t.replace(/_/g, ' ')}</option>`).join('');
    });
  } catch (e) {}
}

function debounceAuditSearch() {
  clearTimeout(auditSearchTimer);
  auditSearchTimer = setTimeout(() => loadAuditLogs(1), 400);
}

function debounceAuditFSSearch() {
  clearTimeout(auditFSSearchTimer);
  auditFSSearchTimer = setTimeout(() => loadAuditLogsFull(1), 400);
}

function applyAuditUserFilter() {
  loadAuditLogs(1);
}

function clearAuditFilters() {
  ['audit-search', 'audit-category', 'audit-severity', 'audit-action-type', 'audit-date-from', 'audit-date-to', 'audit-user-search', 'audit-user-search_id'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  loadAuditLogs(1);
}

let userMessagesUserId = null;
let userMessagesPage = 1;
let cachedUserMessages = [];

function searchUserMessages() {
  const userId = document.getElementById('audit-user-search_id').value;
  const userName = document.getElementById('audit-user-search').value;
  if (!userId) {
    toast('Selecciona un usuario primero', 'error');
    return;
  }
  userMessagesUserId = userId;
  document.getElementById('user-messages-name').textContent = userName || userId;
  document.getElementById('user-messages-section').style.display = 'block';
  loadUserMessages(1);
}

async function loadUserMessages(page) {
  userMessagesPage = page || 1;
  try {
    const result = await api('GET', `/logs?userId=${userMessagesUserId}&category=MESSAGE&page=${userMessagesPage}&limit=30`);
    cachedUserMessages = result.logs || [];
    const container = document.getElementById('user-messages-list');
    if (cachedUserMessages.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No se encontraron mensajes de este usuario</p></div>';
    } else {
      renderAuditTable(cachedUserMessages, 'user-messages-list');
    }
    renderAuditPagination(result.page, result.totalPages, result.total, 'user-messages-pagination', loadUserMessages);
    document.getElementById('user-messages-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    document.getElementById('user-messages-list').innerHTML = '<div class="empty-state"><p>Error cargando mensajes</p></div>';
  }
}

function closeUserMessages() {
  document.getElementById('user-messages-section').style.display = 'none';
  userMessagesUserId = null;
  cachedUserMessages = [];
}

function toggleAuditFullscreen() {
  const overlay = document.getElementById('audit-fullscreen-overlay');
  const isActive = overlay.classList.contains('active');
  if (isActive) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  } else {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    loadAuditActionTypes();
    loadAuditLogsFull(1);
  }
}

function renderAttachmentSection(title, attachments) {
  const icons = { image: '🖼️', video: '🎬', audio: '🎵', file: '📎' };
  let html = `<div class="audit-detail-field"><div class="detail-label">${escapeHtml(title)}</div><div class="detail-value attachment-list">`;
  attachments.forEach(a => {
    const icon = icons[a.type] || '📎';
    const sizeStr = a.size ? (a.size > 1048576 ? (a.size / 1048576).toFixed(1) + ' MB' : (a.size / 1024).toFixed(1) + ' KB') : '';
    let mediaPreview = '';
    if (a.url) {
      if (a.type === 'image') {
        mediaPreview = `<div class="attachment-media-preview"><img src="${escapeHtml(a.url)}" alt="${escapeHtml(a.name)}" loading="lazy" onclick="event.stopPropagation();window.open('${escapeHtml(a.url)}','_blank')"></div>`;
      } else if (a.type === 'video') {
        mediaPreview = `<div class="attachment-media-preview"><video src="${escapeHtml(a.url)}" controls preload="metadata" onclick="event.stopPropagation()"></video></div>`;
      } else if (a.type === 'audio') {
        mediaPreview = `<div class="attachment-media-preview"><audio src="${escapeHtml(a.url)}" controls preload="metadata" onclick="event.stopPropagation()"></audio></div>`;
      }
    }
    html += `<div class="attachment-item${mediaPreview ? ' has-media' : ''}">
      <div class="attachment-info-row">
        <span class="attachment-icon">${icon}</span>
        <span class="attachment-name">${escapeHtml(a.name)}</span>
        <span class="attachment-meta">${escapeHtml(a.type || 'archivo')}${sizeStr ? ' - ' + sizeStr : ''}</span>
        ${a.url ? `<a href="${escapeHtml(a.url)}" target="_blank" class="attachment-link" onclick="event.stopPropagation()">Descargar</a>` : ''}
      </div>
      ${mediaPreview}
    </div>`;
  });
  html += '</div></div>';
  return html;
}

let currentDetailIdx = 0;
let currentDetailContainer = '';

function showAuditDetail(idx, containerId) {
  const logs = containerId === 'audit-logs-list' ? cachedAuditLogs : containerId === 'user-messages-list' ? cachedUserMessages : cachedAuditLogsFull;
  const log = logs[idx];
  if (!log) return;
  currentDetailIdx = idx;
  currentDetailContainer = containerId;

  const panel = document.getElementById('audit-detail-panel');
  const backdrop = document.getElementById('audit-detail-backdrop');
  const body = document.getElementById('audit-detail-body');

  const date = new Date(log.createdAt).toLocaleString('es', { dateStyle: 'full', timeStyle: 'medium' });
  const d = log.details || {};

  const fieldLabels = {
    userTag: 'Usuario', staffName: 'Staff', reason: 'Razon', channelName: 'Canal', channelId: 'ID del Canal',
    duration: 'Duracion', count: 'Cantidad', warnCount: 'Advertencias', oldContent: 'Contenido Anterior',
    newContent: 'Contenido Nuevo', content: 'Contenido', roles: 'Roles', changes: 'Cambios',
    messageId: 'ID del Mensaje', authorTag: 'Autor', authorId: 'ID del Autor', oldNick: 'Apodo Anterior',
    newNick: 'Apodo Nuevo', added: 'Agregados', removed: 'Removidos', channelType: 'Tipo de Canal',
    oldName: 'Nombre Anterior', newName: 'Nombre Nuevo', oldTopic: 'Tema Anterior', newTopic: 'Tema Nuevo',
    ticketNumber: 'Numero de Ticket', category: 'Categoria', suggestionId: 'ID de Sugerencia',
    title: 'Titulo', status: 'Estado', rating: 'Calificacion', comment: 'Comentario',
    filename: 'Archivo', collections: 'Colecciones', timestamp: 'Fecha', ip: 'IP',
    targetId: 'ID del Objetivo', staffId: 'ID del Staff', guildId: 'ID del Servidor',
    voiceChannel: 'Canal de Voz', oldChannel: 'Canal Anterior', newChannel: 'Canal Nuevo',
    accountAge: 'Antigüedad', oldNickname: 'Apodo Anterior', newNickname: 'Apodo Nuevo',
    roleName: 'Nombre del Rol', roleColor: 'Color del Rol', emojiName: 'Nombre del Emoji'
  };

  const idToNameMap = {
    targetId: d.userTag || d.targetName,
    staffId: d.staffName,
    authorId: d.authorTag
  };

  const attachmentKeys = ['attachments', 'oldAttachments', 'newAttachments', 'removedAttachments'];

  let detailsHtml = '';
  Object.entries(d).forEach(([key, val]) => {
    if (val === null || val === undefined) return;
    if (attachmentKeys.includes(key)) return;
    let displayVal = val;
    if (Array.isArray(val)) displayVal = val.join(', ');
    else if (typeof val === 'object') displayVal = JSON.stringify(val, null, 2);
    else displayVal = String(val);
    if (idToNameMap[key] && idToNameMap[key] !== val) {
      displayVal = `${idToNameMap[key]} (${val})`;
    }
    const label = fieldLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
    detailsHtml += `<div class="audit-detail-field"><div class="detail-label">${escapeHtml(label)}</div><div class="detail-value">${escapeHtml(displayVal)}</div></div>`;
  });

  if (d.attachments && Array.isArray(d.attachments) && d.attachments.length > 0) {
    detailsHtml += renderAttachmentSection('Archivos adjuntos eliminados', d.attachments);
  }
  if (d.oldAttachments && Array.isArray(d.oldAttachments) && d.oldAttachments.length > 0) {
    detailsHtml += renderAttachmentSection('Archivos antes de editar', d.oldAttachments);
  }
  if (d.newAttachments && Array.isArray(d.newAttachments) && d.newAttachments.length > 0) {
    detailsHtml += renderAttachmentSection('Archivos despues de editar', d.newAttachments);
  }
  if (d.removedAttachments && Array.isArray(d.removedAttachments) && d.removedAttachments.length > 0) {
    detailsHtml += `<div class="audit-detail-field"><div class="detail-label">Archivos eliminados en edicion</div><div class="detail-value" style="color:var(--danger)">${escapeHtml(d.removedAttachments.join(', '))}</div></div>`;
  }

  const targetClickable = log.targetId ? `<span class="detail-value clickable" onclick="openUserProfile('${log.targetId}')">${escapeHtml(d.userTag || d.targetName || log.targetId)}</span>` : '<span class="detail-value">-</span>';

  const hasPrev = idx > 0;
  const hasNext = idx < logs.length - 1;

  body.innerHTML = `
    <div class="audit-detail-nav">
      <button class="btn btn-sm" onclick="navigateAuditDetail(-1)" ${!hasPrev ? 'disabled' : ''}>&#9664; Anterior</button>
      <span class="audit-detail-counter">${idx + 1} / ${logs.length}</span>
      <button class="btn btn-sm" onclick="navigateAuditDetail(1)" ${!hasNext ? 'disabled' : ''}>Siguiente &#9654;</button>
      <button class="btn btn-sm btn-info" onclick="copyLogJSON()" title="Copiar JSON">&#128203; Copiar</button>
    </div>
    <div class="audit-detail-field">
      <div class="detail-label">Fecha y Hora</div>
      <div class="detail-value">${date}</div>
    </div>
    <div class="audit-detail-field">
      <div class="detail-label">Tipo de Accion</div>
      <div class="detail-value"><span class="audit-log-type category-${log.category || 'SYSTEM'}">${log.actionType}</span></div>
    </div>
    <div class="audit-detail-field">
      <div class="detail-label">Categoria</div>
      <div class="detail-value"><span class="audit-log-category category-${log.category || 'SYSTEM'}">${log.category || 'SYSTEM'}</span></div>
    </div>
    <div class="audit-detail-field">
      <div class="detail-label">Gravedad</div>
      <div class="detail-value"><span class="audit-log-severity severity-${log.severity || 'INFO'}">${log.severity || 'INFO'}</span></div>
    </div>
    <div class="audit-detail-field">
      <div class="detail-label">Objetivo</div>
      ${targetClickable}
    </div>
    <div class="audit-detail-field">
      <div class="detail-label">Staff</div>
      <div class="detail-value">${escapeHtml(d.staffName || log.staffId || '-')}</div>
    </div>
    <hr style="border-color:var(--border);margin:12px 0">
    <h4 style="font-size:13px;color:var(--text-muted);text-transform:uppercase;margin-bottom:10px">Detalles</h4>
    ${detailsHtml || '<p style="color:var(--text-muted)">Sin detalles adicionales</p>'}
  `;

  panel.classList.add('active');
  backdrop.classList.add('active');
}

function navigateAuditDetail(direction) {
  const newIdx = currentDetailIdx + direction;
  const logs = currentDetailContainer === 'audit-logs-list' ? cachedAuditLogs : currentDetailContainer === 'user-messages-list' ? cachedUserMessages : cachedAuditLogsFull;
  if (newIdx >= 0 && newIdx < logs.length) {
    showAuditDetail(newIdx, currentDetailContainer);
  }
}

function copyLogJSON() {
  const logs = currentDetailContainer === 'audit-logs-list' ? cachedAuditLogs : currentDetailContainer === 'user-messages-list' ? cachedUserMessages : cachedAuditLogsFull;
  const log = logs[currentDetailIdx];
  if (!log) return;
  const text = JSON.stringify(log, null, 2);
  navigator.clipboard.writeText(text).then(() => {
    toast('Log copiado al portapapeles', 'success');
  }).catch(() => {
    toast('Error al copiar', 'error');
  });
}

function closeAuditDetail() {
  document.getElementById('audit-detail-panel').classList.remove('active');
  document.getElementById('audit-detail-backdrop').classList.remove('active');
}

async function openUserProfile(userId) {
  closeAuditDetail();
  const overlay = document.getElementById('user-profile-overlay');
  const body = document.getElementById('user-profile-body');
  body.innerHTML = '<div class="empty-state"><div class="loading"></div><p>Cargando perfil...</p></div>';
  overlay.classList.add('active');

  try {
    const profile = await api('GET', '/user/' + userId + '/profile');
    const joinDate = new Date(profile.joinedAt).toLocaleDateString('es');
    const createDate = new Date(profile.createdAt).toLocaleDateString('es');
    const statusColors = { online: 'var(--success)', idle: 'var(--warning)', dnd: 'var(--danger)', offline: 'var(--text-muted)' };
    const statusLabels = { online: 'En linea', idle: 'Ausente', dnd: 'No molestar', offline: 'Desconectado' };

    let sanctionsHtml = '';
    if (profile.sanctions && profile.sanctions.length > 0) {
      sanctionsHtml = profile.sanctions.slice(0, 10).map(s => {
        const sDate = new Date(s.date).toLocaleDateString('es');
        return `<div class="user-profile-sanction-item">
          <span class="sanction-type" style="color:${s.type === 'BAN' ? 'var(--danger)' : s.type === 'MUTE' ? 'var(--info)' : 'var(--warning)'}">${s.type}</span>
          - ${escapeHtml(s.reason || '-')} ${s.duration ? '(' + s.duration + ')' : ''}
          <div class="sanction-date">${sDate}</div>
        </div>`;
      }).join('');
    } else {
      sanctionsHtml = '<p style="color:var(--text-muted);font-size:13px">Sin sanciones registradas</p>';
    }

    let warningsHtml = '';
    if (profile.warnings && profile.warnings.length > 0) {
      warningsHtml = profile.warnings.slice(0, 10).map(w => {
        const wDate = new Date(w.date).toLocaleDateString('es');
        return `<div class="user-profile-sanction-item">
          <span class="sanction-type" style="color:var(--warning)">WARN</span>
          - ${escapeHtml(w.reason || '-')}
          <div class="sanction-date">${wDate}</div>
        </div>`;
      }).join('');
    } else {
      warningsHtml = '<p style="color:var(--text-muted);font-size:13px">Sin advertencias</p>';
    }

    const rolesHtml = profile.roles.map(r => `<span class="user-profile-role"><span class="role-dot" style="background:${r.color}"></span>${escapeHtml(r.name)}</span>`).join('');

    const isAdmin = ['admin', 'owner'].includes(currentRole);
    let editSection = '';
    if (isAdmin) {
      const roleOptions = rolesCache.map(r => {
        const hasRole = profile.roles.some(pr => pr.id === r.id);
        return `<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);cursor:pointer">
          <input type="checkbox" class="profile-role-check" value="${r.id}" ${hasRole ? 'checked' : ''} data-was="${hasRole}">${escapeHtml(r.name)}
        </label>`;
      }).join('');
      editSection = `
        <div class="user-profile-edit-section">
          <h4 style="font-size:13px;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Modificar Usuario</h4>
          <div class="form-group" style="margin-bottom:10px">
            <label style="font-size:11px">Apodo</label>
            <input type="text" id="profile-edit-nickname" value="${escapeHtml(profile.displayName)}" placeholder="Nuevo apodo...">
          </div>
          <div class="form-group" style="margin-bottom:10px;max-height:150px;overflow-y:auto">
            <label style="font-size:11px">Roles</label>
            <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px">${roleOptions}</div>
          </div>
          <button class="btn btn-sm btn-primary" onclick="saveUserProfile('${profile.id}')">Guardar Cambios</button>
        </div>`;
    }

    let actionsHtml = '';
    if (permissions.includes('warn')) actionsHtml += `<button class="btn btn-sm btn-warning" onclick="closeUserProfile();openTool('warn');setTimeout(()=>{selectUser('warn-user','${profile.id}','${escapeHtml(profile.tag)}')},200)">Warn</button>`;
    if (permissions.includes('mute')) actionsHtml += `<button class="btn btn-sm btn-info" onclick="closeUserProfile();openTool('mute');setTimeout(()=>{selectUser('mute-user','${profile.id}','${escapeHtml(profile.tag)}')},200)">Mute</button>`;
    if (permissions.includes('ban')) actionsHtml += `<button class="btn btn-sm btn-danger" onclick="closeUserProfile();openTool('ban');setTimeout(()=>{selectUser('ban-user','${profile.id}','${escapeHtml(profile.tag)}')},200)">Ban</button>`;
    if (permissions.includes('send_dm')) actionsHtml += `<button class="btn btn-sm btn-primary" onclick="closeUserProfile();openTool('send_dm');setTimeout(()=>{selectUser('dm-user','${profile.id}','${escapeHtml(profile.tag)}')},200)">DM</button>`;

    body.innerHTML = `
      <div class="user-profile-top">
        <img src="${profile.avatar}" class="user-profile-avatar" alt="">
        <div class="user-profile-info">
          <h3>${escapeHtml(profile.displayName)}</h3>
          <div style="font-size:13px;color:var(--text-secondary)">${escapeHtml(profile.tag)}</div>
          <div class="user-profile-id">${profile.id}</div>
          <div class="user-profile-status" style="color:${statusColors[profile.status] || 'var(--text-muted)'}">${statusLabels[profile.status] || profile.status}</div>
        </div>
      </div>
      <div class="user-profile-section">
        <h4>Informacion</h4>
        <div class="info-grid">
          <div class="info-item"><div class="info-label">Se unio</div><div class="info-value">${joinDate}</div></div>
          <div class="info-item"><div class="info-label">Cuenta creada</div><div class="info-value">${createDate}</div></div>
          <div class="info-item"><div class="info-label">Warns activos</div><div class="info-value" style="color:var(--warning)">${profile.totalWarns}</div></div>
          <div class="info-item"><div class="info-label">Sanciones</div><div class="info-value" style="color:var(--danger)">${profile.totalSanctions}</div></div>
        </div>
      </div>
      <div class="user-profile-section">
        <h4>Roles (${profile.roles.length})</h4>
        <div class="user-profile-roles">${rolesHtml || '<span style="color:var(--text-muted);font-size:13px">Sin roles</span>'}</div>
      </div>
      <div class="user-profile-section">
        <h4>Advertencias</h4>
        <div class="user-profile-sanctions-list">${warningsHtml}</div>
      </div>
      <div class="user-profile-section">
        <h4>Sanciones</h4>
        <div class="user-profile-sanctions-list">${sanctionsHtml}</div>
      </div>
      ${actionsHtml ? '<div class="user-profile-actions">' + actionsHtml + '</div>' : ''}
      ${editSection}
    `;
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">Error: ${escapeHtml(e.message)}</p></div>`;
  }
}

function closeUserProfile() {
  document.getElementById('user-profile-overlay').classList.remove('active');
}

async function saveUserProfile(userId) {
  const nickname = document.getElementById('profile-edit-nickname').value;
  const checks = document.querySelectorAll('.profile-role-check');
  const addRoles = [];
  const removeRoles = [];
  checks.forEach(ch => {
    const was = ch.dataset.was === 'true';
    if (ch.checked && !was) addRoles.push(ch.value);
    if (!ch.checked && was) removeRoles.push(ch.value);
  });
  try {
    const result = await api('POST', '/user/' + userId + '/update', { nickname, addRoles, removeRoles });
    toast('Perfil actualizado: ' + (result.changes || []).join(', '), 'success');
    openUserProfile(userId);
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function exportAuditLogs() {
  const formatSelect = document.getElementById('export-format');
  const format = formatSelect ? formatSelect.value : 'csv';
  const params = buildAuditParams('audit');
  params.set('format', format);
  try {
    const response = await fetch(API_BASE + '/logs/export?' + params.toString(), {
      headers: sessionToken ? { 'X-Session-Token': sessionToken } : {}
    });
    if (!response.ok) throw new Error('Error del servidor');
    const blob = await response.blob();
    const ext = format === 'json' ? 'json' : format === 'tsv' ? 'tsv' : 'csv';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit_logs_' + new Date().toISOString().split('T')[0] + '.' + ext;
    a.click();
    URL.revokeObjectURL(url);
    toast('Logs exportados en formato ' + format.toUpperCase(), 'success');
  } catch (e) {
    toast('Error exportando: ' + e.message, 'error');
  }
}

let auditSSE = null;
let auditSSEConnected = false;

function initAuditPage() {
  loadAuditStats();
  loadAuditActionTypes();
  loadAuditLogs(1);
  loadAuditTimeline();
  loadStaffActivity();
  loadRetentionSettings();
  connectAuditSSE();
  if (auditRefreshInterval) clearInterval(auditRefreshInterval);
  auditRefreshInterval = setInterval(() => {
    const logsPage = document.getElementById('page-logs');
    if (logsPage && logsPage.style.display !== 'none') {
      loadAuditStats();
    }
  }, 30000);
}

function connectAuditSSE() {
  if (auditSSE) { auditSSE.close(); auditSSE = null; }
  if (!sessionToken) return;
  const indicator = document.getElementById('sse-indicator');

  auditSSE = new EventSource(API_BASE + '/logs/stream?token=' + sessionToken);

  auditSSE.onopen = () => {
    auditSSEConnected = true;
    if (indicator) { indicator.classList.add('connected'); indicator.title = 'En vivo'; }
  };

  auditSSE.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'newLog' && data.log) {
        cachedAuditLogs.unshift(data.log);
        if (cachedAuditLogs.length > 30) cachedAuditLogs.pop();
        renderAuditTable(cachedAuditLogs, 'audit-logs-list');
        const container = document.getElementById('audit-logs-container');
        if (container) {
          container.scrollIntoView({ behavior: 'smooth', block: 'start' });
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
          const lastItem = container.querySelector('.audit-log-item:last-child');
          if (lastItem) {
            lastItem.classList.add('highlight-newest');
            setTimeout(() => lastItem.classList.remove('highlight-newest'), 1000);
          }
        }
        loadAuditStats();
      }
    } catch (e) {}
  };

  auditSSE.onerror = () => {
    auditSSEConnected = false;
    if (indicator) { indicator.classList.remove('connected'); indicator.title = 'Desconectado'; }
    auditSSE.close();
    auditSSE = null;
    setTimeout(() => {
      const logsPage = document.getElementById('page-logs');
      if (logsPage && logsPage.style.display !== 'none') connectAuditSSE();
    }, 5000);
  };
}

async function loadAuditTimeline() {
  try {
    const timeline = await api('GET', '/logs/stats/timeline?days=30');
    renderTimelineChart(timeline);
  } catch (e) {}
}

function renderTimelineChart(timeline) {
  const container = document.getElementById('audit-timeline-chart');
  if (!container) return;
  const canvas = document.createElement('canvas');
  canvas.width = container.clientWidth || 700;
  canvas.height = 180;
  container.innerHTML = '';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const dates = Object.keys(timeline).sort();
  if (dates.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '13px sans-serif';
    ctx.fillText('Sin datos para mostrar', canvas.width / 2 - 70, 90);
    return;
  }

  const values = dates.map(d => timeline[d].total || 0);
  const max = Math.max(...values, 1);
  const barW = Math.max(4, Math.floor((canvas.width - 60) / dates.length) - 2);
  const chartH = canvas.height - 40;
  const startX = 40;

  const catColors = { USER: '#38bdf8', CHANNEL: '#43b581', MESSAGE: '#0ea5e9', AUTOMOD: '#f97316', STAFF: '#ef4444', SYSTEM: '#8b5cf6' };
  const categories = ['USER', 'CHANNEL', 'MESSAGE', 'AUTOMOD', 'STAFF', 'SYSTEM'];

  ctx.fillStyle = '#64748b';
  ctx.font = '10px sans-serif';
  for (let i = 0; i <= 4; i++) {
    const y = 10 + (chartH / 4) * i;
    const val = Math.round(max - (max / 4) * i);
    ctx.fillText(val, 0, y + 4);
    ctx.strokeStyle = 'rgba(30,58,95,0.4)';
    ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  dates.forEach((date, i) => {
    const x = startX + i * (barW + 2);
    const total = timeline[date].total || 0;
    let currentY = 10 + chartH;

    categories.forEach(cat => {
      const count = timeline[date][cat] || 0;
      if (count === 0) return;
      const h = (count / max) * chartH;
      currentY -= h;
      ctx.fillStyle = catColors[cat] || '#8b5cf6';
      ctx.fillRect(x, currentY, barW, h);
    });

    if (i % Math.max(1, Math.floor(dates.length / 7)) === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '9px sans-serif';
      const label = date.substring(5);
      ctx.fillText(label, x, canvas.height - 5);
    }
  });
}

async function loadStaffActivity() {
  try {
    const stats = await api('GET', '/logs/stats/staff-activity');
    renderStaffActivity(stats);
  } catch (e) {}
}

function renderStaffActivity(stats) {
  const container = document.getElementById('audit-staff-activity');
  if (!container || !stats || stats.length === 0) {
    if (container) container.innerHTML = '<div class="empty-state"><p>Sin actividad de staff</p></div>';
    return;
  }
  container.innerHTML = stats.slice(0, 10).map((s, i) => {
    const timeAgo = s.lastAction ? timeSince(new Date(s.lastAction)) : 'N/A';
    const avatarHtml = s.avatar ? `<img src="${s.avatar}" class="staff-activity-avatar" alt="">` : `<div class="staff-activity-avatar-placeholder">${(s.displayName || '?')[0]}</div>`;
    const rawName = (s.displayName || s.staffId).replace(/"/g, '&quot;');
    return `<div class="staff-activity-item" data-staff-id="${s.staffId}" data-staff-name="${rawName}" onclick="filterByStaff(this.dataset.staffId, this.dataset.staffName)">
      <span class="staff-rank">#${i + 1}</span>
      ${avatarHtml}
      <div class="staff-activity-info">
        <div class="staff-activity-name">${escapeHtml(s.displayName || s.staffId)}</div>
        <div class="staff-activity-meta">${s.totalActions} acciones - Ultima: ${timeAgo}</div>
      </div>
      <div class="staff-activity-count">${s.totalActions}</div>
    </div>`;
  }).join('');
}

function timeSince(date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return 'hace ' + s + 's';
  if (s < 3600) return 'hace ' + Math.floor(s / 60) + 'm';
  if (s < 86400) return 'hace ' + Math.floor(s / 3600) + 'h';
  return 'hace ' + Math.floor(s / 86400) + 'd';
}

function filterByStaff(staffId, displayName) {
  const searchEl = document.getElementById('audit-search');
  if (searchEl) searchEl.value = displayName || staffId;
  loadAuditLogs(1);
}

function applyQuickFilter(type) {
  clearAuditFilters();
  const now = new Date();
  switch (type) {
    case 'sanctions-today':
      document.getElementById('audit-category').value = 'STAFF';
      document.getElementById('audit-date-from').value = now.toISOString().split('T')[0];
      break;
    case 'critical':
      document.getElementById('audit-severity').value = 'CRITICAL';
      break;
    case 'high':
      document.getElementById('audit-severity').value = 'HIGH';
      break;
    case 'last-hour':
      document.getElementById('audit-search').value = '';
      const oneHourAgo = new Date(now.getTime() - 3600000);
      document.getElementById('audit-date-from').value = oneHourAgo.toISOString().split('T')[0];
      document.getElementById('audit-date-to').value = now.toISOString().split('T')[0];
      break;
    case 'deleted-messages':
      document.getElementById('audit-search').value = 'MESSAGE_DELETE';
      break;
    case 'voice':
      document.getElementById('audit-search').value = 'VOICE';
      break;
  }
  loadAuditLogs(1);
}

async function loadRetentionSettings() {
  const container = document.getElementById('retention-settings');
  if (!container) return;
  if (!['admin', 'owner'].includes(currentRole)) {
    container.style.display = 'none';
    return;
  }
  try {
    const data = await api('GET', '/logs/retention');
    const retentionSelect = document.getElementById('retention-days');
    if (retentionSelect) retentionSelect.value = data.days || 0;
    const info = document.getElementById('retention-info');
    if (info) info.textContent = `Total: ${data.totalLogs} logs${data.days > 0 ? ` | Se purgarian: ${data.preview}` : ''}`;
  } catch (e) {}
}

async function saveRetention() {
  const days = parseInt(document.getElementById('retention-days').value) || 0;
  try {
    const result = await api('POST', '/logs/retention', { days });
    toast(`Retencion configurada: ${days === 0 ? 'ilimitada' : days + ' dias'}${result.purged > 0 ? ` (${result.purged} logs purgados)` : ''}`, 'success');
    loadRetentionSettings();
    loadAuditStats();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function previewRetention() {
  const days = parseInt(document.getElementById('retention-days').value) || 90;
  try {
    const result = await api('GET', '/logs/retention/preview?days=' + days);
    const info = document.getElementById('retention-info');
    if (info) info.textContent = `Con ${days} dias se purgarian: ${result.count} logs`;
  } catch (e) {}
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

function navigateTo(page, skipHash) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (!pageEl) return;
  pageEl.style.display = 'block';
  pageEl.classList.remove('page-fade-in');
  void pageEl.offsetWidth;
  pageEl.classList.add('page-fade-in');
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  if (!skipHash) window.location.hash = page;

  if (page === 'logs') initAuditPage();
  if (page === 'dashboard') initApp();
  if (page === 'notes') loadNotesPage();
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) sidebar.classList.remove('open');
}

function handleHashNavigation() {
  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById('page-' + hash)) {
    navigateTo(hash, true);
  }
}

window.addEventListener('hashchange', handleHashNavigation);
window.addEventListener('DOMContentLoaded', function() {
  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById('page-' + hash)) {
    const checkLogin = setInterval(function() {
      if (document.getElementById('app-page').style.display !== 'none') {
        clearInterval(checkLogin);
        navigateTo(hash, true);
      }
    }, 200);
    setTimeout(function() { clearInterval(checkLogin); }, 10000);
  }
});

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

function multiChannelSelect(id) {
  const grouped = {};
  channelsCache.forEach(c => {
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category].push(c);
  });
  let html = `<div class="multi-channel-select" style="max-height:200px;overflow-y:auto;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;padding:8px;">`;
  for (const [cat, chs] of Object.entries(grouped)) {
    html += `<div style="font-size:11px;color:var(--text-muted);font-weight:600;padding:4px 0;margin-top:4px;">${escapeHtml(cat)}</div>`;
    chs.forEach(c => {
      html += `<label style="display:flex;align-items:center;gap:6px;padding:3px 4px;cursor:pointer;font-size:13px;"><input type="checkbox" class="multi-ch-cb" value="${c.id}"><span>#${escapeHtml(c.name)}</span></label>`;
    });
  }
  html += '</div>';
  return html;
}

let dmUsersList = [];

function addDMUser() {
  const userId = document.getElementById('dm-user_id').value;
  const userTag = document.getElementById('dm-user').value;
  if (!userId) return toast('Selecciona un usuario primero', 'error');
  if (dmUsersList.find(u => u.id === userId)) return toast('Usuario ya agregado', 'error');
  dmUsersList.push({ id: userId, tag: userTag });
  document.getElementById('dm-user').value = '';
  document.getElementById('dm-user_id').value = '';
  renderDMUsersList();
}

function removeDMUser(userId) {
  dmUsersList = dmUsersList.filter(u => u.id !== userId);
  renderDMUsersList();
}

function renderDMUsersList() {
  const container = document.getElementById('dm-users-list');
  if (!container) return;
  container.innerHTML = dmUsersList.map(u =>
    `<span class="multi-recipient-tag">${escapeHtml(u.tag)} <span class="multi-recipient-remove" onclick="removeDMUser('${u.id}')">&times;</span></span>`
  ).join('');
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
        <div class="form-group"><label>Canales (selecciona uno o varios)</label><div id="embed-channels-container">${multiChannelSelect('embed-channel')}</div></div>
        <div class="form-group"><label>Mensaje de texto (opcional, encima del embed)</label><textarea id="embed-message" placeholder="Texto plano que aparecera antes del embed..."></textarea></div>
        <div class="form-group"><label>Titulo</label><input type="text" id="embed-title" placeholder="Titulo del embed"></div>
        <div class="form-group"><label>Descripcion</label><textarea id="embed-desc" placeholder="Descripcion del embed..."></textarea></div>
        <div class="form-group"><label>Color</label>
          <div class="color-picker-wrapper">
            <input type="color" id="embed-color" value="#38bdf8">
            <span id="embed-color-text">#38bdf8</span>
          </div>
        </div>
        <div class="form-group"><label>Pie de pagina (opcional)</label><input type="text" id="embed-footer" placeholder="Texto del pie"></div>
        <div class="form-group"><label>URL imagen (opcional)</label><input type="url" id="embed-image" placeholder="https://..."></div>
        <div class="form-group"><label>URL thumbnail / logo (opcional)</label><input type="url" id="embed-thumbnail" placeholder="https://..."></div>
        <div class="form-group"><label>Autor - nombre (opcional)</label><input type="text" id="embed-author-name" placeholder="Nombre"></div>
        <div class="form-group"><label>Autor - URL icono (opcional)</label><input type="url" id="embed-author-icon" placeholder="https://..."></div>
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
      dmUsersList = [];
      openModal('Send DM - Mensaje Privado', `
        <div class="form-group"><label>Usuarios</label>${userSearchField('dm-user')}<div id="dm-users-list" class="multi-recipients-list"></div><button type="button" class="btn btn-sm" style="margin-top:6px;background:var(--accent);" onclick="addDMUser()">+ Agregar usuario</button></div>
        <div class="form-group" style="display:flex;align-items:center;gap:12px;">
          <label style="margin:0">Enviar como embed</label>
          <label class="toggle-switch">
            <input type="checkbox" id="dm-use-embed">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div id="dm-plain-section">
          <div class="form-group"><label>Mensaje (texto plano)</label><textarea id="dm-message" placeholder="Escribe el mensaje..."></textarea></div>
        </div>
        <div id="dm-embed-section" style="display:none;">
          <div class="form-group"><label>Mensaje adicional (opcional, encima del embed)</label><textarea id="dm-embed-message" placeholder="Texto opcional..."></textarea></div>
          <div class="form-group"><label>Titulo del embed</label><input type="text" id="dm-embed-title" placeholder="Titulo"></div>
          <div class="form-group"><label>Descripcion</label><textarea id="dm-embed-desc" placeholder="Descripcion..."></textarea></div>
          <div class="form-group"><label>Color</label><div class="color-picker-wrapper"><input type="color" id="dm-embed-color" value="#38bdf8"><span id="dm-embed-color-text">#38bdf8</span></div></div>
          <div class="form-group"><label>Pie de pagina</label><input type="text" id="dm-embed-footer" placeholder="Opcional"></div>
          <div class="form-group"><label>URL imagen</label><input type="url" id="dm-embed-image" placeholder="Opcional"></div>
          <div class="form-group"><label>URL thumbnail</label><input type="url" id="dm-embed-thumbnail" placeholder="Opcional"></div>
          <div class="form-group"><label>Autor - nombre</label><input type="text" id="dm-embed-author-name" placeholder="Opcional"></div>
          <div class="form-group"><label>Autor - URL icono</label><input type="url" id="dm-embed-author-icon" placeholder="Opcional"></div>
        </div>
      `, `<button class="btn btn-primary" onclick="executeSendDM()">Enviar DM</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      setTimeout(() => {
        const dmEmbedCheck = document.getElementById('dm-use-embed');
        const plainSec = document.getElementById('dm-plain-section');
        const embedSec = document.getElementById('dm-embed-section');
        if (dmEmbedCheck) dmEmbedCheck.addEventListener('change', function() {
          if (plainSec) plainSec.style.display = this.checked ? 'none' : 'block';
          if (embedSec) embedSec.style.display = this.checked ? 'block' : 'none';
        });
        const dmColorInput = document.getElementById('dm-embed-color');
        if (dmColorInput) dmColorInput.addEventListener('input', e => {
          const t = document.getElementById('dm-embed-color-text');
          if (t) t.textContent = e.target.value;
        });
      }, 100);
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

    case 'create_role':
      openModal('Crear Rol', `
        <div class="form-group"><label>Nombre</label><input type="text" id="crole-name" placeholder="Nombre del rol"></div>
        <div class="form-group"><label>Color</label><div class="color-picker-wrapper"><input type="color" id="crole-color" value="#38bdf8"><span id="crole-color-text">#38bdf8</span></div></div>
        <div class="form-group" style="display:flex;align-items:center;gap:12px;"><label style="margin:0">Mencionable</label><label class="toggle-switch"><input type="checkbox" id="crole-mentionable"><span class="toggle-slider"></span></label></div>
        <div class="form-group" style="display:flex;align-items:center;gap:12px;"><label style="margin:0">Separar en lista</label><label class="toggle-switch"><input type="checkbox" id="crole-hoist"><span class="toggle-slider"></span></label></div>
      `, `<button class="btn btn-success" onclick="executeCreateRole()">Crear Rol</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      setTimeout(() => {
        const ci = document.getElementById('crole-color');
        if (ci) ci.addEventListener('input', e => { document.getElementById('crole-color-text').textContent = e.target.value; });
      }, 100);
      break;

    case 'edit_role':
      openModal('Editar Rol', `
        <div class="form-group"><label>Rol</label>${roleSelect('erole-role')}</div>
        <div class="form-group"><label>Nuevo nombre (opcional)</label><input type="text" id="erole-name" placeholder="Dejar vacio para no cambiar"></div>
        <div class="form-group"><label>Nuevo color (opcional)</label><div class="color-picker-wrapper"><input type="color" id="erole-color" value="#38bdf8"><span id="erole-color-text">#38bdf8</span></div></div>
        <input type="hidden" id="erole-color-changed" value="0">
        <div class="form-group" style="display:flex;align-items:center;gap:12px;"><label style="margin:0">Mencionable</label><label class="toggle-switch"><input type="checkbox" id="erole-mentionable"><span class="toggle-slider"></span></label></div>
        <div class="form-group" style="display:flex;align-items:center;gap:12px;"><label style="margin:0">Separar en lista</label><label class="toggle-switch"><input type="checkbox" id="erole-hoist"><span class="toggle-slider"></span></label></div>
      `, `<button class="btn btn-primary" onclick="executeEditRole()">Editar Rol</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      setTimeout(() => {
        const ci = document.getElementById('erole-color');
        if (ci) ci.addEventListener('input', e => {
          document.getElementById('erole-color-text').textContent = e.target.value;
          document.getElementById('erole-color-changed').value = '1';
        });
      }, 100);
      break;

    case 'delete_role':
      openModal('Eliminar Rol', `
        <div class="form-group"><label>Rol</label>${roleSelect('drole-role')}</div>
        <p style="color:var(--danger);font-size:13px;margin-top:8px;">Esta accion es irreversible. El rol sera eliminado permanentemente.</p>
      `, `<button class="btn btn-danger" onclick="executeDeleteRole()">Eliminar Rol</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'create_channel':
      loadCategories('cchannel-category');
      openModal('Crear Canal', `
        <div class="form-group"><label>Nombre</label><input type="text" id="cchannel-name" placeholder="nombre-del-canal"></div>
        <div class="form-group"><label>Tipo</label>
          <select id="cchannel-type" style="width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);">
            <option value="text">Texto</option><option value="voice">Voz</option><option value="category">Categoria</option>
          </select>
        </div>
        <div class="form-group"><label>Categoria (opcional)</label><select id="cchannel-category" style="width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);"><option value="">Sin categoria</option></select></div>
        <div class="form-group"><label>Tema (opcional, solo texto)</label><input type="text" id="cchannel-topic" placeholder="Tema del canal"></div>
      `, `<button class="btn btn-success" onclick="executeCreateChannel()">Crear Canal</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'edit_channel':
      loadCategories('echannel-category');
      openModal('Editar Canal', `
        <div class="form-group"><label>Canal</label>${channelSelect('echannel-channel')}</div>
        <div class="form-group"><label>Nuevo nombre (opcional)</label><input type="text" id="echannel-name" placeholder="Dejar vacio para no cambiar"></div>
        <div class="form-group"><label>Nuevo tema (opcional)</label><input type="text" id="echannel-topic" placeholder="Dejar vacio para no cambiar"></div>
        <div class="form-group"><label>Slowmode (segundos, 0=desactivado)</label><input type="number" id="echannel-slowmode" min="0" max="21600" value="0"></div>
        <div class="form-group"><label>Mover a categoria</label><select id="echannel-category" style="width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);"><option value="">No cambiar</option></select></div>
        <div class="form-group" style="display:flex;align-items:center;gap:12px;"><label style="margin:0">NSFW</label><label class="toggle-switch"><input type="checkbox" id="echannel-nsfw"><span class="toggle-slider"></span></label></div>
      `, `<button class="btn btn-primary" onclick="executeEditChannel()">Editar Canal</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'delete_channel':
      openModal('Eliminar Canal', `
        <div class="form-group"><label>Canal</label>${channelSelect('dchannel-channel')}</div>
        <p style="color:var(--danger);font-size:13px;margin-top:8px;">Esta accion es irreversible. El canal y todos sus mensajes seran eliminados.</p>
      `, `<button class="btn btn-danger" onclick="executeDeleteChannel()">Eliminar Canal</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'channel_info':
      openModal('Info de Canal', `
        <div class="form-group"><label>Canal</label>${channelSelect('chinfo-channel')}</div>
      `, `<button class="btn btn-primary" onclick="executeChannelInfo()">Ver Info</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'member_list':
      openModal('Miembros por Rol', `
        <div class="form-group"><label>Rol</label>${roleSelect('memlist-role')}</div>
      `, `<button class="btn btn-primary" onclick="executeMemberList()">Ver Miembros</button>
         <button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cancelar</button>`);
      break;

    case 'emoji_list':
      executeEmojiList();
      break;

    case 'invite_list':
      executeInviteList();
      break;

    case 'ban_list':
      executeBanList();
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
  const checkedChannels = [...document.querySelectorAll('.multi-ch-cb:checked')].map(cb => cb.value);
  if (checkedChannels.length === 0) return toast('Selecciona al menos un canal', 'error');
  const title = document.getElementById('embed-title').value;
  const description = document.getElementById('embed-desc').value;
  const color = document.getElementById('embed-color').value;
  const message = document.getElementById('embed-message')?.value?.trim() || undefined;
  const footer = document.getElementById('embed-footer')?.value?.trim() || undefined;
  const image = document.getElementById('embed-image')?.value?.trim() || undefined;
  const thumbnail = document.getElementById('embed-thumbnail')?.value?.trim() || undefined;
  const authorName = document.getElementById('embed-author-name')?.value?.trim() || undefined;
  const authorIconUrl = document.getElementById('embed-author-icon')?.value?.trim() || undefined;
  if (!title) return toast('Indica el titulo del embed', 'error');
  try {
    const r = await api('POST', '/action/send-embed', { channelIds: checkedChannels, title, description, color, message, footer, image, thumbnail, authorName, authorIconUrl });
    toast(`Embed enviado a ${r.sent} canal(es)${r.failed ? `, ${r.failed} fallaron` : ''}`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeSendDM() {
  const singleUserId = document.getElementById('dm-user_id').value;
  const allUsers = [...dmUsersList];
  if (singleUserId && !allUsers.find(u => u.id === singleUserId)) {
    allUsers.push({ id: singleUserId, tag: document.getElementById('dm-user').value });
  }
  if (allUsers.length === 0) return toast('Agrega al menos un usuario', 'error');
  const useEmbed = document.getElementById('dm-use-embed').checked;
  const message = document.getElementById('dm-message')?.value?.trim();
  const embedMessage = document.getElementById('dm-embed-message')?.value?.trim();
  if (!useEmbed && !message) return toast('Escribe el mensaje o activa embed', 'error');
  if (useEmbed) {
    const embedTitle = document.getElementById('dm-embed-title')?.value?.trim();
    if (!embedTitle) return toast('Indica el titulo del embed', 'error');
  }
  const body = {
    userIds: allUsers.map(u => u.id),
    message: useEmbed ? (embedMessage || '') : message,
    useEmbed
  };
  if (useEmbed) {
    body.embedTitle = document.getElementById('dm-embed-title')?.value?.trim();
    body.embedDescription = document.getElementById('dm-embed-desc')?.value?.trim() || undefined;
    body.embedColor = document.getElementById('dm-embed-color')?.value;
    body.embedFooter = document.getElementById('dm-embed-footer')?.value?.trim() || undefined;
    body.embedImage = document.getElementById('dm-embed-image')?.value?.trim() || undefined;
    body.embedThumbnail = document.getElementById('dm-embed-thumbnail')?.value?.trim() || undefined;
    body.embedAuthorName = document.getElementById('dm-embed-author-name')?.value?.trim() || undefined;
    body.embedAuthorIconUrl = document.getElementById('dm-embed-author-icon')?.value?.trim() || undefined;
  }
  try {
    const r = await api('POST', '/action/send-dm', body);
    toast(`DM enviado a ${r.sent} usuario(s)${r.failed ? `, ${r.failed} fallaron` : ''}`, 'success');
    dmUsersList = [];
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

async function executeCreateRole() {
  const name = document.getElementById('crole-name').value.trim();
  if (!name) return toast('Indica el nombre del rol', 'error');
  const color = document.getElementById('crole-color').value;
  const mentionable = document.getElementById('crole-mentionable').checked;
  const hoist = document.getElementById('crole-hoist').checked;
  try {
    const r = await api('POST', '/action/create-role', { name, color, mentionable, hoist });
    toast(`Rol "${escapeHtml(r.role.name)}" creado`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeEditRole() {
  const roleId = document.getElementById('erole-role').value;
  if (!roleId) return toast('Selecciona un rol', 'error');
  const body = { roleId };
  const name = document.getElementById('erole-name').value.trim();
  if (name) body.name = name;
  const colorChanged = document.getElementById('erole-color-changed');
  if (colorChanged && colorChanged.value === '1') body.color = document.getElementById('erole-color').value;
  const mentionable = document.getElementById('erole-mentionable');
  const hoist = document.getElementById('erole-hoist');
  body.mentionable = mentionable.checked;
  body.hoist = hoist.checked;
  if (Object.keys(body).length <= 1) return toast('No hay cambios para aplicar', 'error');
  try {
    const r = await api('POST', '/action/edit-role', body);
    toast(`Rol "${escapeHtml(r.role.name)}" editado`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeDeleteRole() {
  const roleId = document.getElementById('drole-role').value;
  if (!roleId) return toast('Selecciona un rol', 'error');
  if (!confirm('Estas seguro de eliminar este rol? Esta accion es irreversible.')) return;
  try {
    const r = await api('POST', '/action/delete-role', { roleId });
    toast(`Rol "${escapeHtml(r.roleName)}" eliminado`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function loadCategories(selectId) {
  try {
    const cats = await api('GET', '/guild/categories');
    setTimeout(() => {
      const sel = document.getElementById(selectId);
      if (!sel) return;
      cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        sel.appendChild(opt);
      });
    }, 150);
  } catch (e) {}
}

async function executeCreateChannel() {
  const name = document.getElementById('cchannel-name').value.trim();
  if (!name) return toast('Indica el nombre del canal', 'error');
  const type = document.getElementById('cchannel-type').value;
  const categoryId = document.getElementById('cchannel-category').value || undefined;
  const topic = document.getElementById('cchannel-topic').value.trim() || undefined;
  try {
    const r = await api('POST', '/action/create-channel', { name, type, categoryId, topic });
    toast(`Canal "#${escapeHtml(r.channel.name)}" creado`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeEditChannel() {
  const channelId = document.getElementById('echannel-channel').value;
  if (!channelId) return toast('Selecciona un canal', 'error');
  const body = { channelId };
  const name = document.getElementById('echannel-name').value.trim();
  const topic = document.getElementById('echannel-topic').value.trim();
  const slowmodeEl = document.getElementById('echannel-slowmode');
  const nsfwEl = document.getElementById('echannel-nsfw');
  const categoryId = document.getElementById('echannel-category').value;
  if (name) body.name = name;
  if (topic) body.topic = topic;
  if (slowmodeEl && slowmodeEl.value !== '0') body.slowmode = slowmodeEl.value;
  if (nsfwEl && nsfwEl.checked) body.nsfw = true;
  if (categoryId) body.categoryId = categoryId;
  if (Object.keys(body).length <= 1) return toast('No hay cambios para aplicar', 'error');
  try {
    const r = await api('POST', '/action/edit-channel', body);
    toast(`Canal "#${escapeHtml(r.channel.name)}" editado`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeDeleteChannel() {
  const channelId = document.getElementById('dchannel-channel').value;
  if (!channelId) return toast('Selecciona un canal', 'error');
  if (!confirm('Estas seguro? El canal y todos sus mensajes seran eliminados permanentemente.')) return;
  try {
    const r = await api('POST', '/action/delete-channel', { channelId });
    toast(`Canal "#${escapeHtml(r.channelName)}" eliminado`, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeChannelInfo() {
  const channelId = document.getElementById('chinfo-channel').value;
  if (!channelId) return toast('Selecciona un canal', 'error');
  try {
    const r = await api('GET', '/info/channel/' + channelId);
    let html = `<h3 style="margin-bottom:12px;">#${escapeHtml(r.name)}</h3>
    <div class="stats-grid" style="grid-template-columns:repeat(2,1fr);gap:8px;">
      <div class="stat-card"><div class="stat-value">${escapeHtml(r.type)}</div><div class="stat-label">Tipo</div></div>
      <div class="stat-card"><div class="stat-value">${escapeHtml(r.category)}</div><div class="stat-label">Categoria</div></div>
      <div class="stat-card"><div class="stat-value">${r.nsfw ? 'Si' : 'No'}</div><div class="stat-label">NSFW</div></div>
      <div class="stat-card"><div class="stat-value">${parseInt(r.slowmode) || 0}s</div><div class="stat-label">Slowmode</div></div>
      <div class="stat-card"><div class="stat-value">${parseInt(r.position)}</div><div class="stat-label">Posicion</div></div>
      <div class="stat-card"><div class="stat-value">${new Date(r.createdAt).toLocaleDateString('es')}</div><div class="stat-label">Creado</div></div>
    </div>
    <p style="color:var(--text-muted);margin-top:12px;font-size:13px;">Tema: ${escapeHtml(r.topic)}</p>`;
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-footer').innerHTML = `<button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cerrar</button>`;
  } catch (e) { toast(e.message, 'error'); }
}

async function executeMemberList() {
  const roleId = document.getElementById('memlist-role').value;
  if (!roleId) return toast('Selecciona un rol', 'error');
  try {
    const r = await api('GET', '/info/members-by-role/' + roleId);
    let html = `<h3 style="color:${escapeHtml(r.roleColor || 'inherit')};margin-bottom:12px;">${escapeHtml(r.roleName)} (${r.members.length} miembros)</h3>`;
    if (r.members.length === 0) {
      html += '<p style="color:var(--text-muted)">No hay miembros con este rol</p>';
    } else {
      html += '<div style="max-height:400px;overflow-y:auto;">' + r.members.map(m =>
        `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);">
          <img src="${escapeHtml(m.avatar)}" style="width:24px;height:24px;border-radius:50%;">
          <span>${escapeHtml(m.displayName)}</span>
          <span style="color:var(--text-muted);font-size:12px;margin-left:auto;">${escapeHtml(m.tag)}</span>
        </div>`
      ).join('') + '</div>';
    }
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-footer').innerHTML = `<button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cerrar</button>`;
  } catch (e) { toast(e.message, 'error'); }
}

async function executeEmojiList() {
  try {
    const emojis = await api('GET', '/info/emojis');
    let html = `<h3 style="margin-bottom:12px;">Emojis del servidor (${parseInt(emojis.length)})</h3>`;
    if (emojis.length === 0) {
      html += '<p style="color:var(--text-muted)">No hay emojis personalizados</p>';
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px;max-height:400px;overflow-y:auto;">' +
        emojis.map(e =>
          `<div style="text-align:center;padding:8px;background:var(--bg-input);border-radius:8px;">
            <img src="${escapeHtml(e.url)}" style="width:32px;height:32px;" title="${escapeHtml(e.name)}">
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;overflow:hidden;text-overflow:ellipsis;">:${escapeHtml(e.name)}:</div>
          </div>`
        ).join('') + '</div>';
    }
    openModal('Emojis del Servidor', html, `<button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cerrar</button>`);
  } catch (e) { toast(e.message, 'error'); }
}

async function executeInviteList() {
  try {
    const invites = await api('GET', '/info/invites');
    let html = `<h3 style="margin-bottom:12px;">Invitaciones (${parseInt(invites.length)})</h3>`;
    if (invites.length === 0) {
      html += '<p style="color:var(--text-muted)">No hay invitaciones activas</p>';
    } else {
      html += '<div style="max-height:400px;overflow-y:auto;">' + invites.map(i =>
        `<div style="padding:8px;background:var(--bg-input);border-radius:8px;margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="color:var(--accent);font-weight:600;">${escapeHtml(i.code)}</span>
            <span style="font-size:12px;color:var(--text-muted);">${parseInt(i.uses)}/${escapeHtml(String(i.maxUses))} usos</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
            Por: ${escapeHtml(i.inviter)} | Canal: #${escapeHtml(i.channel)} | ${new Date(i.createdAt).toLocaleDateString('es')}
          </div>
        </div>`
      ).join('') + '</div>';
    }
    openModal('Invitaciones del Servidor', html, `<button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cerrar</button>`);
  } catch (e) { toast(e.message, 'error'); }
}

async function executeBanList() {
  try {
    const bans = await api('GET', '/info/bans');
    let html = `<h3 style="margin-bottom:12px;">Usuarios Baneados (${parseInt(bans.length)})</h3>`;
    if (bans.length === 0) {
      html += '<p style="color:var(--text-muted)">No hay usuarios baneados</p>';
    } else {
      html += '<div style="max-height:400px;overflow-y:auto;">' + bans.map(b =>
        `<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg-input);border-radius:8px;margin-bottom:6px;">
          <img src="${escapeHtml(b.avatar)}" style="width:32px;height:32px;border-radius:50%;">
          <div style="flex:1;">
            <div style="font-weight:600;">${escapeHtml(b.tag)}</div>
            <div style="font-size:12px;color:var(--text-muted);">ID: ${escapeHtml(b.id)}</div>
          </div>
          <div style="font-size:12px;color:var(--danger);text-align:right;max-width:200px;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(b.reason)}</div>
        </div>`
      ).join('') + '</div>';
    }
    openModal('Lista de Bans', html, `<button class="btn btn-sm" style="background:var(--border)" onclick="closeModal()">Cerrar</button>`);
  } catch (e) { toast(e.message, 'error'); }
}

let currentNotesUserId = null;
let currentNotesUserTag = null;

function loadNotesPage() {
  currentNotesUserId = null;
  currentNotesUserTag = null;
  const userInput = document.getElementById('notes-user');
  if (userInput) userInput.value = '';
  const userIdInput = document.getElementById('notes-user_id');
  if (userIdInput) userIdInput.value = '';
  loadAllNotes();
}

async function loadAllNotes() {
  try {
    const notes = await api('GET', '/notes/all');
    renderNotes(notes, 'Todas las Notas');
  } catch (e) {
    toast('Error cargando notas: ' + e.message, 'error');
  }
}

async function loadNotes() {
  const userId = document.getElementById('notes-user_id').value;
  const userTag = document.getElementById('notes-user').value;
  if (!userId) return toast('Selecciona un usuario para filtrar', 'error');
  currentNotesUserId = userId;
  currentNotesUserTag = userTag;
  try {
    const notes = await api('GET', '/notes/' + userId);
    renderNotes(notes, 'Notas de ' + userTag);
  } catch (e) {
    toast('Error cargando notas: ' + e.message, 'error');
  }
}

function clearNotesFilter() {
  currentNotesUserId = null;
  currentNotesUserTag = null;
  const userInput = document.getElementById('notes-user');
  if (userInput) userInput.value = '';
  const userIdInput = document.getElementById('notes-user_id');
  if (userIdInput) userIdInput.value = '';
  loadAllNotes();
}

function renderNotes(notes, title) {
  const container = document.getElementById('notes-container');
  if (notes.length === 0) {
    container.innerHTML = '<div class="card" style="margin-top:16px"><div class="card-body"><div class="empty-state"><div class="empty-icon">&#128221;</div><p>No hay notas</p></div></div></div>';
    return;
  }
  container.innerHTML = '<div class="card" style="margin-top:16px"><div class="card-header">&#128203; ' + title + ' (' + notes.length + ')</div><div class="card-body">' +
    notes.map(n => {
      const date = new Date(n.createdAt).toLocaleString('es');
      const isAuthor = n.authorId === currentDiscordId;
      const canModify = isAuthor || ['admin', 'owner'].includes(currentRole);
      const editBtn = canModify ? `<button class="btn btn-sm btn-primary" onclick="startEditNote('${n._id}')">Editar</button>` : '';
      const deleteBtn = canModify ? `<button class="btn btn-sm btn-danger" onclick="deleteNote('${n._id}')">Eliminar</button>` : '';
      const editedInfo = n.editedAt ? `<span style="font-size:11px;color:var(--text-muted);margin-left:8px;">(editado ${new Date(n.editedAt).toLocaleString('es')} por ${escapeHtml(n.editedBy || '?')})</span>` : '';
      return `<div class="note-card" id="note-${escapeHtml(String(n._id))}">
        <div class="note-header">
          <span class="note-author">${escapeHtml(n.authorName)}</span>
          <span style="color:var(--accent);font-size:12px;">&#8594; ${escapeHtml(n.targetTag || n.targetUserId)}</span>
          <span class="note-date">${date}${editedInfo}</span>
        </div>
        <div class="note-content" id="note-content-${n._id}">${n.content.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}</div>
        ${(editBtn || deleteBtn) ? '<div class="note-footer">' + editBtn + ' ' + deleteBtn + '</div>' : ''}
      </div>`;
    }).join('') + '</div></div>';
}

function startEditNote(noteId) {
  const contentEl = document.getElementById('note-content-' + noteId);
  if (!contentEl) return;
  const currentContent = contentEl.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const noteCard = document.getElementById('note-' + noteId);
  const footer = noteCard.querySelector('.note-footer');
  contentEl.innerHTML = `<textarea id="note-edit-${noteId}" style="width:100%;min-height:80px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:8px;resize:vertical;">${currentContent}</textarea>`;
  if (footer) {
    footer.innerHTML = `<button class="btn btn-sm btn-success" onclick="saveEditNote('${noteId}')">Guardar</button> <button class="btn btn-sm" style="background:var(--border)" onclick="cancelEditNote()">Cancelar</button>`;
  }
}

async function saveEditNote(noteId) {
  const textarea = document.getElementById('note-edit-' + noteId);
  if (!textarea) return;
  const content = textarea.value.trim();
  if (!content) return toast('El contenido no puede estar vacio', 'error');
  try {
    await api('PUT', '/notes/' + noteId, { content });
    toast('Nota editada', 'success');
    if (currentNotesUserId) {
      loadNotes();
    } else {
      loadAllNotes();
    }
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

function cancelEditNote() {
  if (currentNotesUserId) {
    loadNotes();
  } else {
    loadAllNotes();
  }
}

async function createNote() {
  const userId = document.getElementById('notes-new-user_id')?.value;
  const userInput = document.getElementById('notes-new-user');
  const userTag = userInput ? userInput.value : '';
  if (!userId) return toast('Selecciona un usuario para la nota', 'error');
  const content = document.getElementById('note-content').value.trim();
  if (!content) return toast('Escribe el contenido de la nota', 'error');
  try {
    await api('POST', '/notes', { targetUserId: userId, targetTag: userTag, content });
    toast('Nota guardada', 'success');
    document.getElementById('note-content').value = '';
    if (userInput) userInput.value = '';
    document.getElementById('notes-new-user_id').value = '';
    if (currentNotesUserId) {
      loadNotes();
    } else {
      loadAllNotes();
    }
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function deleteNote(noteId) {
  if (!confirm('Eliminar esta nota?')) return;
  try {
    await api('DELETE', '/notes/' + noteId);
    toast('Nota eliminada', 'success');
    if (currentNotesUserId) {
      loadNotes();
    } else {
      loadAllNotes();
    }
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}
