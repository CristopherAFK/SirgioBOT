const express = require('express');
const { EmbedBuilder } = require('discord.js');
const { db, mongoose, auditEmitter } = require('../database');
const path = require('path');
const crypto = require('crypto');
const { GUILD_ID: CONFIG_GUILD_ID, LOG_CHANNEL_ID } = require('../config');

function buildModLogEmbed(action, { userTag, userId, staffName, reason, duration, warnCount }) {
  const staffLabel = staffName || 'Staff Panel';
  let embed;
  if (action === 'warn') {
    embed = new EmbedBuilder()
      .setColor(0xffff00)
      .setTitle('⚠️ Advertencia emitida')
      .addFields(
        { name: 'Usuario', value: `${userTag} (${userId})`, inline: true },
        { name: 'Staff', value: staffLabel, inline: true },
        { name: 'Razón', value: reason || '-', inline: false },
        { name: 'Warns totales', value: String(warnCount ?? 0), inline: true }
      )
      .setTimestamp();
  } else if (action === 'mute') {
    embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('🔇 Mute aplicado')
      .addFields(
        { name: 'Usuario', value: `${userTag} (${userId})`, inline: true },
        { name: 'Staff', value: staffLabel, inline: true },
        { name: 'Razón', value: reason || '-', inline: false },
        { name: 'Duración', value: duration || '-', inline: true }
      )
      .setTimestamp();
  } else if (action === 'unmute') {
    embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🔊 Mute removido')
      .addFields(
        { name: 'Usuario', value: `${userTag} (${userId})`, inline: true },
        { name: 'Staff', value: staffLabel, inline: true }
      )
      .setTimestamp();
  } else if (action === 'ban') {
    embed = new EmbedBuilder()
      .setColor(0x000000)
      .setTitle('🔨 Ban aplicado')
      .addFields(
        { name: 'Usuario', value: `${userTag} (${userId})`, inline: true },
        { name: 'Staff', value: staffLabel, inline: true },
        { name: 'Razón', value: reason || '-', inline: false }
      )
      .setTimestamp();
  } else if (action === 'timeout') {
    embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⏱️ Timeout aplicado')
      .addFields(
        { name: 'Usuario', value: `${userTag} (${userId})`, inline: true },
        { name: 'Staff', value: staffLabel, inline: true },
        { name: 'Razón', value: reason || '-', inline: false },
        { name: 'Duración', value: duration || '-', inline: true }
      )
      .setTimestamp();
  }
  return embed || null;
}

async function sendModLog(client, action, data) {
  if (!client?.isReady() || !LOG_CHANNEL_ID) return;
  const embed = buildModLogEmbed(action, data);
  if (!embed) return;
  try {
    const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (!channel) return;
    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error('[Staff Panel] Error enviando log a Discord:', e.message);
  }
}

function setupStaffPanel(app, client) {
  const router = express.Router();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/panel', express.static(path.join(__dirname, 'public')));

  const sessions = new Map();
  const GUILD_ID = process.env.GUILD_ID || CONFIG_GUILD_ID || '';

  function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  const ACCOUNTS = {
    'agustito': { password: hashPassword('maximo202430'), role: 'moderator', discordId: '1196639548877320202', displayName: 'Agustisito' },
    'gars': { password: hashPassword('garcia14052012'), role: 'admin', discordId: '1032482231677108224', displayName: 'Gars' },
    'sirgio': { password: hashPassword('SirgioTeam2026'), role: 'owner', discordId: '956700088103747625', displayName: 'Sirgio' },
    'mzingerkai': { password: hashPassword('Mzin531'), role: 'moderator', discordId: '926219678798454875', displayName: 'Mzingerkai' },
    'gothhxjie': { password: hashPassword('Danganronpa2'), role: 'admin', discordId: '756698430155390986', displayName: 'gothhxjie' }
  };

  const ROLE_PERMISSIONS = {
    helper: ['warn', 'mute', 'unmute'],
    moderator: ['warn', 'mute', 'unmute', 'ban', 'timeout', 'send_embed', 'send_dm', 'edit_message', 'block_links'],
    admin: ['warn', 'mute', 'unmute', 'ban', 'timeout', 'send_embed', 'send_dm', 'edit_message', 'block_links', 'lock_channel', 'unlock_channel', 'nuke_channel', 'clear_messages', 'quarantine', 'reduce_warn', 'view_history', 'user_info', 'server_info', 'role_info'],
    owner: ['warn', 'mute', 'unmute', 'ban', 'timeout', 'send_embed', 'send_dm', 'edit_message', 'block_links', 'lock_channel', 'unlock_channel', 'nuke_channel', 'clear_messages', 'quarantine', 'reduce_warn', 'view_history', 'user_info', 'server_info', 'role_info']
  };

  function authenticate(req, res, next) {
    const token = req.headers['x-session-token'];
    if (!token || !sessions.has(token)) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    req.session = sessions.get(token);
    next();
  }

  function hasPermission(req, action) {
    const role = req.session.role;
    return ROLE_PERMISSIONS[role] && ROLE_PERMISSIONS[role].includes(action);
  }

  function getGuild() {
    if (!client || !client.isReady()) return null;
    if (GUILD_ID) return client.guilds.cache.get(GUILD_ID);
    return client.guilds.cache.first();
  }

  router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }
    const account = ACCOUNTS[username.toLowerCase()];
    if (!account || account.password !== hashPassword(password)) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { role: account.role, username: account.displayName, discordId: account.discordId, loginAt: Date.now() });
    const roleLabels = { helper: 'Helper', moderator: 'Moderador', admin: 'Admin', owner: 'Dueño' };
    db.addAuditLog('STAFF_LOGIN', account.discordId, null, null, {
      staffName: account.displayName,
      role: roleLabels[account.role] || account.role,
      loginTime: new Date().toISOString()
    }, 'STAFF', 'INFO').catch(e => console.error('[Panel] Error logging staff login:', e.message));
    res.json({ token, role: account.role, username: account.displayName });
  });

  const sseClients = new Map();

  router.post('/logout', authenticate, (req, res) => {
    const token = req.headers['x-session-token'];
    sessions.delete(token);
    for (const [sseRes, data] of sseClients.entries()) {
      if (data.token === token) {
        auditEmitter.removeListener('newLog', data.onNewLog);
        sseRes.end();
        sseClients.delete(sseRes);
      }
    }
    res.json({ success: true });
  });

  router.get('/status', authenticate, async (req, res) => {
    const guild = getGuild();
    let avatarUrl = null;
    if (guild && req.session.discordId) {
      try {
        const member = await guild.members.fetch(req.session.discordId);
        avatarUrl = member.user.displayAvatarURL({ size: 64, dynamic: true });
      } catch (e) { avatarUrl = null; }
    }
    res.json({
      botOnline: client && client.isReady(),
      botUser: client && client.isReady() ? { tag: client.user.tag, avatar: client.user.displayAvatarURL() } : null,
      guildConnected: !!guild,
      guildName: guild ? guild.name : null,
      guildIcon: guild ? guild.iconURL() : null,
      memberCount: guild ? guild.memberCount : 0,
      role: req.session.role,
      username: req.session.username,
      discordId: req.session.discordId,
      permissions: ROLE_PERMISSIONS[req.session.role] || [],
      avatarUrl
    });
  });

  router.get('/guild/channels', authenticate, (req, res) => {
    const guild = getGuild();
    if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
    const channels = guild.channels.cache
      .filter(c => c.type === 0)
      .map(c => ({ id: c.id, name: c.name, category: c.parent ? c.parent.name : 'Sin categoría' }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(channels);
  });

  router.get('/guild/roles', authenticate, (req, res) => {
    const guild = getGuild();
    if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor, members: r.members.size, position: r.position }))
      .sort((a, b) => b.position - a.position);
    res.json(roles);
  });

  router.get('/guild/members/search', authenticate, async (req, res) => {
    const guild = getGuild();
    if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
    const query = req.query.q || '';
    try {
      const members = await guild.members.fetch({ query, limit: 25 });
      const result = members.map(m => ({
        id: m.id,
        tag: m.user.tag,
        displayName: m.displayName,
        avatar: m.user.displayAvatarURL({ size: 64 }),
        joinedAt: m.joinedAt
      }));
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // === MODERATION ===

  router.post('/action/warn', authenticate, async (req, res) => {
    if (!hasPermission(req, 'warn')) return res.status(403).json({ error: 'Sin permisos' });
    const { userId, reason } = req.body;
    if (!userId || !reason) return res.status(400).json({ error: 'Faltan campos' });
    try {
      const guild = getGuild();
      if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return res.status(404).json({ error: 'Usuario no encontrado' });
      await db.addWarning(userId, 'staff-panel', reason, 'staff-panel');
      const warnCount = await db.getWarningCount(userId);
      await db.addAuditLog('WARN', null, userId, req.session.discordId, { reason, warnCount, staffName: req.session.username, userTag: member.user.tag }, 'STAFF', 'MEDIUM');
      sendModLog(client, 'warn', { userTag: member.user.tag, userId, staffName: req.session.username, reason, warnCount }).catch(() => {});
      const warnDmEmbed = buildModLogEmbed('warn', { userTag: member.user.tag, userId, staffName: req.session.username, reason, warnCount });
      if (warnDmEmbed) await member.send({ embeds: [warnDmEmbed] }).catch(() => {});
      res.json({ success: true, warnCount, user: member.user.tag });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/action/mute', authenticate, async (req, res) => {
    if (!hasPermission(req, 'mute')) return res.status(403).json({ error: 'Sin permisos' });
    const { userId, duration, reason } = req.body;
    if (!userId || !duration || !reason) return res.status(400).json({ error: 'Faltan campos' });
    try {
      const guild = getGuild();
      if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return res.status(404).json({ error: 'Usuario no encontrado' });
      const ms = parseDuration(duration);
      if (!ms) return res.status(400).json({ error: 'Duración inválida' });
      const expiresAt = new Date(Date.now() + ms);
      const muteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted' || r.name.toLowerCase() === 'silenciado');
      if (muteRole) {
        await member.roles.add(muteRole);
      } else {
        await member.timeout(ms, reason);
      }
      await db.addMute(userId, 'staff-panel', reason, expiresAt);
      await db.addSanction(userId, 'staff-panel', 'MUTE', reason, 'staff-panel', duration);
      await db.addAuditLog('MUTE', null, userId, req.session.discordId, { reason, duration, staffName: req.session.username, userTag: member.user.tag }, 'STAFF', 'MEDIUM');
      sendModLog(client, 'mute', { userTag: member.user.tag, userId, staffName: req.session.username, reason, duration }).catch(() => {});
      const muteDmEmbed = buildModLogEmbed('mute', { userTag: member.user.tag, userId, staffName: req.session.username, reason, duration });
      if (muteDmEmbed) await member.send({ embeds: [muteDmEmbed] }).catch(() => {});
      res.json({ success: true, user: member.user.tag, duration });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/action/unmute', authenticate, async (req, res) => {
    if (!hasPermission(req, 'unmute')) return res.status(403).json({ error: 'Sin permisos' });
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Faltan campos' });
    try {
      const guild = getGuild();
      if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return res.status(404).json({ error: 'Usuario no encontrado' });
      const muteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted' || r.name.toLowerCase() === 'silenciado');
      if (muteRole && member.roles.cache.has(muteRole.id)) {
        await member.roles.remove(muteRole);
      }
      await member.timeout(null);
      await db.removeMute(userId);
      await db.addAuditLog('UNMUTE', null, userId, req.session.discordId, { staffName: req.session.username, userTag: member.user.tag }, 'STAFF', 'MEDIUM');
      sendModLog(client, 'unmute', { userTag: member.user.tag, userId, staffName: req.session.username }).catch(() => {});
      const unmuteDmEmbed = buildModLogEmbed('unmute', { userTag: member.user.tag, userId, staffName: req.session.username });
      if (unmuteDmEmbed) await member.send({ embeds: [unmuteDmEmbed] }).catch(() => {});
      res.json({ success: true, user: member.user.tag });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/action/ban', authenticate, async (req, res) => {
    if (!hasPermission(req, 'ban')) return res.status(403).json({ error: 'Sin permisos' });
    const { userId, reason } = req.body;
    if (!userId || !reason) return res.status(400).json({ error: 'Faltan campos' });
    try {
      const guild = getGuild();
      if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
      const member = await guild.members.fetch(userId).catch(() => null);
      const userTag = member ? member.user.tag : userId;
      if (member) {
        const banDmEmbed = buildModLogEmbed('ban', { userTag: member.user.tag, userId, staffName: req.session.username, reason });
        if (banDmEmbed) await member.send({ embeds: [banDmEmbed] }).catch(() => {});
      }
      await guild.members.ban(userId, { reason, deleteMessageSeconds: 0 });
      await db.addSanction(userId, 'staff-panel', 'BAN', reason, 'staff-panel');
      await db.addAuditLog('BAN', null, userId, req.session.discordId, { reason, staffName: req.session.username, userTag: userTag }, 'STAFF', 'HIGH');
      sendModLog(client, 'ban', { userTag: userTag, userId, staffName: req.session.username, reason }).catch(() => {});
      res.json({ success: true, user: userTag });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/action/timeout', authenticate, async (req, res) => {
    if (!hasPermission(req, 'timeout')) return res.status(403).json({ error: 'Sin permisos' });
    const { userId, duration, reason } = req.body;
    if (!userId || !duration || !reason) return res.status(400).json({ error: 'Faltan campos' });
    try {
      const guild = getGuild();
      if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return res.status(404).json({ error: 'Usuario no encontrado' });
      const ms = parseDuration(duration);
      if (!ms) return res.status(400).json({ error: 'Duración inválida' });
      await member.timeout(ms, reason);
      await db.addSanction(userId, 'staff-panel', 'TIMEOUT', reason, 'staff-panel', duration);
      await db.addAuditLog('TIMEOUT', null, userId, req.session.discordId, { reason, duration, staffName: req.session.username, userTag: member.user.tag }, 'STAFF', 'MEDIUM');
      sendModLog(client, 'timeout', { userTag: member.user.tag, userId, staffName: req.session.username, reason, duration }).catch(() => {});
      const timeoutDmEmbed = buildModLogEmbed('timeout', { userTag: member.user.tag, userId, staffName: req.session.username, reason, duration });
      if (timeoutDmEmbed) await member.send({ embeds: [timeoutDmEmbed] }).catch(() => {});
      res.json({ success: true, user: member.user.tag, duration });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // === CHANNEL MANAGEMENT ===

  router.post('/action/lock-channel', authenticate, async (req, res) => {
    if (!hasPermission(req, 'lock_channel')) return res.status(403).json({ error: 'Sin permisos' });
    const { channelId } = req.body;
    if (!channelId) return res.status(400).json({ error: 'Faltan campos' });
    try {
      const guild = getGuild();
      if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Canal no encontrado' });
      await channel.permissionOverwrites.edit(guild.id, { SendMessages: false });
      await db.addAuditLog('LOCK_CHANNEL', null, channelId, req.session.discordId, { channelName: channel.name, channelId, staffName: req.session.username }, 'CHANNEL', 'LOW');
      res.json({ success: true, channel: channel.name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/action/unlock-channel', authenticate, async (req, res) => {
    if (!hasPermission(req, 'unlock_channel')) return res.status(403).json({ error: 'Sin permisos' });
    const { channelId } = req.body;
    if (!channelId) return res.status(400).json({ error: 'Faltan campos' });
    try {
      const guild = getGuild();
      if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Canal no encontrado' });
      await channel.permissionOverwrites.edit(guild.id, { SendMessages: null });
      await db.addAuditLog('UNLOCK_CHANNEL', null, channelId, req.session.discordId, { channelName: channel.name, channelId, staffName: req.session.username }, 'CHANNEL', 'LOW');
      res.json({ success: true, channel: channel.name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/action/nuke-channel', authenticate, async (req, res) => {
    if (!hasPermission(req, 'nuke_channel')) return res.status(403).json({ error: 'Sin permisos' });
    const { channelId } = req.body;
    if (!channelId) return res.status(400).json({ error: 'Faltan campos' });
    try {
      const guild = getGuild();
      if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Canal no encontrado' });
      const newChannel = await channel.clone();
      if (channel.parent) await newChannel.setParent(channel.parent.id);
      await newChannel.setPosition(channel.position);
      await channel.delete('Nuke - Staff Panel');
      await db.addAuditLog('NUKE_CHANNEL', null, channelId, req.session.discordId, { channelName: channel.name, channelId, staffName: req.session.username }, 'CHANNEL', 'HIGH');
      res.json({ success: true, channel: newChannel.name, newChannelId: newChannel.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/action/clear-messages', authenticate, async (req, res) => {
    if (!hasPermission(req, 'clear_messages')) return res.status(403).json({ error: 'Sin permisos' });
    const { channelId, amount } = req.body;
    if (!channelId || !amount) return res.status(400).json({ error: 'Faltan campos' });
    const count = parseInt(amount);
    if (isNaN(count) || count < 1 || count > 100) return res.status(400).json({ error: 'Cantidad debe ser entre 1 y 100' });
    try {
      const guild = getGuild();
      if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Canal no encontrado' });
      const deleted = await channel.bulkDelete(count, true);
      await db.addAuditLog('CLEAR_MESSAGES', null, channelId, req.session.discordId, { channelName: channel.name, channelId, count: deleted.size, staffName: req.session.username }, 'CHANNEL', 'MEDIUM');
      res.json({ success: true, channel: channel.name, deleted: deleted.size });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // === COMMUNICATION ===

  router.post('/action/send-embed', authenticate, async (req, res) => {
    if (!hasPermission(req, 'send_embed')) return res.status(403).json({ error: 'Sin permisos' });
    const { channelId, title, description, color, footer, image, thumbnail, authorName, authorIconUrl, timestamp } = req.body;
    if (!channelId || !title) return res.status(400).json({ error: 'Faltan canal y título' });
    try {
      const guild = getGuild();
      if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Canal no encontrado' });
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color ? parseInt(String(color).replace('#', ''), 16) : 0x5865F2);
      if (description) embed.setDescription(description);
      if (footer) embed.setFooter({ text: footer });
      if (image) embed.setImage(image);
      if (thumbnail) embed.setThumbnail(thumbnail);
      if (authorName) embed.setAuthor({ name: authorName, iconURL: authorIconUrl || undefined });
      if (timestamp !== false) embed.setTimestamp();
      await channel.send({ embeds: [embed] });
      await db.addAuditLog('SEND_EMBED', null, channelId, req.session.discordId, { title, channelName: channel.name, staffName: req.session.username }, 'STAFF', 'INFO');
      res.json({ success: true, channel: channel.name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/action/send-dm', authenticate, async (req, res) => {
    if (!hasPermission(req, 'send_dm')) return res.status(403).json({ error: 'Sin permisos' });
    const { userId, message, useEmbed, embedTitle, embedDescription, embedColor, embedFooter, embedImage, embedThumbnail, embedAuthorName, embedAuthorIconUrl } = req.body;
    if (!userId) return res.status(400).json({ error: 'Falta usuario' });
    if (!useEmbed && !message) return res.status(400).json({ error: 'Indica mensaje de texto o activa envío como embed' });
    if (useEmbed && !embedTitle) return res.status(400).json({ error: 'Para embed indica al menos el título' });
    try {
      const user = await client.users.fetch(userId).catch(() => null);
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
      if (useEmbed) {
        const dmEmbed = new EmbedBuilder()
          .setTitle(embedTitle)
          .setColor(embedColor ? parseInt(String(embedColor).replace('#', ''), 16) : 0x5865F2)
          .setTimestamp();
        if (embedDescription) dmEmbed.setDescription(embedDescription);
        if (embedFooter) dmEmbed.setFooter({ text: embedFooter });
        if (embedImage) dmEmbed.setImage(embedImage);
        if (embedThumbnail) dmEmbed.setThumbnail(embedThumbnail);
        if (embedAuthorName) dmEmbed.setAuthor({ name: embedAuthorName, iconURL: embedAuthorIconUrl || undefined });
        await user.send({ content: message || undefined, embeds: [dmEmbed] });
      } else {
        await user.send(message);
      }
      const preview = message ? message.substring(0, 100) : (embedTitle || '');
      await db.addAuditLog('SEND_DM', null, userId, req.session.discordId, { messagePreview: preview, staffName: req.session.username, userTag: user.tag }, 'STAFF', 'INFO');
      res.json({ success: true, user: user.tag });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/action/edit-message', authenticate, async (req, res) => {
    if (!hasPermission(req, 'edit_message')) return res.status(403).json({ error: 'Sin permisos' });
    const { channelId, messageId, newContent } = req.body;
    if (!channelId || !messageId || !newContent) return res.status(400).json({ error: 'Faltan campos' });
    try {
      const guild = getGuild();
      if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Canal no encontrado' });
      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (!message) return res.status(404).json({ error: 'Mensaje no encontrado' });
      if (message.author.id !== client.user.id) return res.status(400).json({ error: 'Solo se pueden editar mensajes del bot' });
      await message.edit(newContent);
      await db.addAuditLog('EDIT_MESSAGE', null, messageId, req.session.discordId, { channelName: channel.name, channelId, staffName: req.session.username }, 'MESSAGE', 'LOW');
      res.json({ success: true, channel: channel.name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/action/block-links', authenticate, async (req, res) => {
    if (!hasPermission(req, 'block_links')) return res.status(403).json({ error: 'Sin permisos' });
    const { channelId, enabled } = req.body;
    if (!channelId) return res.status(400).json({ error: 'Faltan campos' });
    try {
      await db.setConfig(`block_links_${channelId}`, !!enabled);
      await db.addAuditLog('BLOCK_LINKS', null, channelId, req.session.discordId, { enabled: !!enabled, channelId, staffName: req.session.username }, 'AUTOMOD', 'LOW');
      res.json({ success: true, enabled: !!enabled });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // === ADMINISTRATION ===

  router.post('/action/quarantine', authenticate, async (req, res) => {
    if (!hasPermission(req, 'quarantine')) return res.status(403).json({ error: 'Sin permisos' });
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Faltan campos' });
    try {
      const guild = getGuild();
      if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return res.status(404).json({ error: 'Usuario no encontrado' });
      const quarantineRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('quarantine') || r.name.toLowerCase().includes('cuarentena'));
      if (!quarantineRole) return res.status(404).json({ error: 'Rol de cuarentena no encontrado. Crea un rol llamado "Cuarentena"' });
      const currentRoles = member.roles.cache.filter(r => r.id !== guild.id).map(r => r.id);
      await db.setConfig(`quarantine_roles_${userId}`, currentRoles);
      await member.roles.set([quarantineRole.id]);
      await db.addSanction(userId, 'staff-panel', 'QUARANTINE', 'Aislado via Staff Panel', 'staff-panel');
      await db.addAuditLog('QUARANTINE', null, userId, req.session.discordId, { previousRolesCount: currentRoles.length, staffName: req.session.username, userTag: member.user.tag }, 'STAFF', 'CRITICAL');
      res.json({ success: true, user: member.user.tag });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/action/reduce-warn', authenticate, async (req, res) => {
    if (!hasPermission(req, 'reduce_warn')) return res.status(403).json({ error: 'Sin permisos' });
    const { userId, amount } = req.body;
    if (!userId) return res.status(400).json({ error: 'Faltan campos' });
    const count = parseInt(amount) || 1;
    try {
      let removed = 0;
      for (let i = 0; i < count; i++) {
        const result = await db.removeLastWarning(userId);
        if (result) removed++;
        else break;
      }
      const remaining = await db.getWarningCount(userId);
      await db.addAuditLog('REDUCE_WARN', null, userId, req.session.discordId, { removed, remaining, staffName: req.session.username }, 'STAFF', 'LOW');
      res.json({ success: true, removed, remaining });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/action/view-history/:userId', authenticate, async (req, res) => {
    if (!hasPermission(req, 'view_history')) return res.status(403).json({ error: 'Sin permisos' });
    const { userId } = req.params;
    try {
      const guild = getGuild();
      let userTag = userId;
      if (guild) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) userTag = member.user.tag;
      }
      const warnings = await db.getWarnings(userId);
      const sanctions = await db.getSanctions(userId);
      const auditLogs = await db.getAuditLogs({ odId: userId });
      res.json({
        userId,
        userTag,
        warnings,
        sanctions,
        auditLogs,
        totalWarns: warnings.length
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // === INFORMATION ===

  router.get('/info/server', authenticate, async (req, res) => {
    if (!hasPermission(req, 'server_info')) return res.status(403).json({ error: 'Sin permisos' });
    try {
      const guild = getGuild();
      if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
      const owner = await guild.fetchOwner().catch(() => null);
      res.json({
        name: guild.name,
        id: guild.id,
        icon: guild.iconURL({ size: 256 }),
        owner: owner ? owner.user.tag : 'Desconocido',
        memberCount: guild.memberCount,
        channelCount: guild.channels.cache.size,
        roleCount: guild.roles.cache.size,
        boostLevel: guild.premiumTier,
        boostCount: guild.premiumSubscriptionCount,
        createdAt: guild.createdAt,
        verificationLevel: guild.verificationLevel
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/info/user/:userId', authenticate, async (req, res) => {
    if (!hasPermission(req, 'user_info')) return res.status(403).json({ error: 'Sin permisos' });
    try {
      const guild = getGuild();
      if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
      const member = await guild.members.fetch(req.params.userId).catch(() => null);
      if (!member) return res.status(404).json({ error: 'Usuario no encontrado' });
      const warnings = await db.getWarnings(req.params.userId);
      const sanctions = await db.getSanctions(req.params.userId);
      res.json({
        id: member.id,
        tag: member.user.tag,
        displayName: member.displayName,
        avatar: member.user.displayAvatarURL({ size: 256 }),
        joinedAt: member.joinedAt,
        createdAt: member.user.createdAt,
        roles: member.roles.cache.filter(r => r.id !== guild.id).map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
        isBot: member.user.bot,
        warnings: warnings.length,
        sanctions: sanctions.length
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/info/role/:roleId', authenticate, async (req, res) => {
    if (!hasPermission(req, 'role_info')) return res.status(403).json({ error: 'Sin permisos' });
    try {
      const guild = getGuild();
      if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
      const role = guild.roles.cache.get(req.params.roleId);
      if (!role) return res.status(404).json({ error: 'Rol no encontrado' });
      res.json({
        id: role.id,
        name: role.name,
        color: role.hexColor,
        position: role.position,
        mentionable: role.mentionable,
        hoist: role.hoist,
        members: role.members.size,
        permissions: role.permissions.toArray(),
        createdAt: role.createdAt
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // === STAFF NOTES ===

  router.get('/notes/:userId', authenticate, async (req, res) => {
    try {
      const notes = await mongoose.connection.db.collection('staff_notes')
        .find({ targetUserId: req.params.userId })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(notes);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/notes', authenticate, async (req, res) => {
    const { targetUserId, targetTag, content } = req.body;
    if (!targetUserId || !content) return res.status(400).json({ error: 'Faltan campos' });
    try {
      const note = {
        authorId: req.session.discordId,
        authorName: req.session.username,
        targetUserId,
        targetTag: targetTag || targetUserId,
        content,
        createdAt: new Date()
      };
      await mongoose.connection.db.collection('staff_notes').insertOne(note);
      res.json({ success: true, note });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/notes/:noteId', authenticate, async (req, res) => {
    try {
      const { ObjectId } = require('mongodb');
      const note = await mongoose.connection.db.collection('staff_notes').findOne({ _id: new ObjectId(req.params.noteId) });
      if (!note) return res.status(404).json({ error: 'Nota no encontrada' });
      if (note.authorId !== req.session.discordId && !['admin', 'owner'].includes(req.session.role)) {
        return res.status(403).json({ error: 'Solo el autor o un admin puede eliminar esta nota' });
      }
      await mongoose.connection.db.collection('staff_notes').deleteOne({ _id: new ObjectId(req.params.noteId) });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // === AUDIT LOGS ===

  router.get('/logs', authenticate, async (req, res) => {
    try {
      const options = {
        page: req.query.page,
        limit: req.query.limit || 50,
        category: req.query.category,
        severity: req.query.severity,
        actionType: req.query.actionType,
        targetId: req.query.userId || req.query.targetId,
        staffId: req.query.staffId,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        search: req.query.search
      };
      Object.keys(options).forEach(k => { if (!options[k]) delete options[k]; });
      const result = await db.getAuditLogs(options);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/logs/stats', authenticate, async (req, res) => {
    try {
      const stats = await db.getAuditLogStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/logs/action-types', authenticate, async (req, res) => {
    try {
      const types = await db.getAuditLogActionTypes();
      res.json(types);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/logs/stats/timeline', authenticate, async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 30;
      const timeline = await db.getAuditTimeline(days);
      res.json(timeline);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/logs/stats/staff-activity', authenticate, async (req, res) => {
    try {
      const stats = await db.getStaffActivityStats();
      const guild = getGuild();
      const enriched = await Promise.all(stats.map(async (s) => {
        let displayName = s.staffId;
        let avatar = null;
        const accountEntry = Object.values(ACCOUNTS).find(a => a.discordId === s.staffId);
        if (accountEntry) displayName = accountEntry.displayName;
        if (guild) {
          try {
            const member = await guild.members.fetch(s.staffId);
            avatar = member.user.displayAvatarURL({ size: 64 });
            if (!accountEntry) displayName = member.displayName;
          } catch (e) {}
        }
        return { ...s, displayName, avatar };
      }));
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/logs/export', authenticate, async (req, res) => {
    try {
      const format = req.query.format || 'csv';
      const options = {
        category: req.query.category,
        severity: req.query.severity,
        actionType: req.query.actionType,
        targetId: req.query.userId || req.query.targetId,
        staffId: req.query.staffId,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        search: req.query.search,
        limit: 10000,
        page: 1
      };
      Object.keys(options).forEach(k => { if (!options[k]) delete options[k]; });
      const result = await db.getAuditLogs(options);
      const logs = result.logs || [];

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=audit_logs.json');
        return res.json(logs.map(l => ({
          date: l.createdAt,
          actionType: l.actionType,
          category: l.category,
          severity: l.severity,
          targetId: l.targetId,
          staffId: l.staffId,
          details: l.details
        })));
      }

      const separator = format === 'tsv' ? '\t' : ',';
      const header = ['Fecha', 'Tipo', 'Categoria', 'Gravedad', 'Target', 'Staff ID', 'Staff', 'Razon', 'Usuario'].join(separator);
      const lines = logs.map(l => {
        const d = l.details || {};
        const fields = [
          new Date(l.createdAt).toISOString(),
          l.actionType || '',
          l.category || '',
          l.severity || '',
          l.targetId || '',
          l.staffId || '',
          d.staffName || '',
          (d.reason || '').replace(/[\r\n,\t]/g, ' '),
          d.userTag || ''
        ];
        if (format === 'csv') return fields.map(f => `"${String(f).replace(/"/g, '""')}"`).join(',');
        return fields.join('\t');
      });

      const bom = format === 'csv' ? '\uFEFF' : '';
      const ext = format === 'tsv' ? 'tsv' : 'csv';
      res.setHeader('Content-Type', format === 'csv' ? 'text/csv; charset=utf-8' : 'text/tab-separated-values');
      res.setHeader('Content-Disposition', `attachment; filename=audit_logs.${ext}`);
      res.send(bom + header + '\n' + lines.join('\n'));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/logs/stream', (req, res) => {
    const token = req.headers['x-session-token'] || req.query.token;
    if (!token || !sessions.has(token)) return res.status(401).json({ error: 'No autorizado' });
    req.session = sessions.get(token);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write('data: {"type":"connected"}\n\n');

    const onNewLog = (log) => {
      if (!sessions.has(token)) { res.end(); return; }
      res.write(`data: ${JSON.stringify({ type: 'newLog', log })}\n\n`);
    };
    auditEmitter.on('newLog', onNewLog);
    sseClients.set(res, { token, onNewLog });

    req.on('close', () => {
      auditEmitter.removeListener('newLog', onNewLog);
      sseClients.delete(res);
    });
  });

  router.get('/logs/retention', authenticate, async (req, res) => {
    try {
      const config = await db.getConfig('audit_retention_days');
      const days = config || 0;
      let preview = 0;
      if (days > 0) {
        preview = await db.getAuditRetentionPreview(days);
      }
      const stats = await db.getAuditLogStats();
      res.json({ days, preview, totalLogs: stats.total });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/logs/retention', authenticate, async (req, res) => {
    if (!['admin', 'owner'].includes(req.session.role)) {
      return res.status(403).json({ error: 'Solo admins pueden configurar retencion' });
    }
    try {
      const days = parseInt(req.body.days) || 0;
      await db.setConfig('audit_retention_days', days);
      let purged = 0;
      if (days > 0) {
        purged = await db.purgeOldAuditLogs(days);
      }
      res.json({ success: true, days, purged });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/logs/retention/preview', authenticate, async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 90;
      const count = await db.getAuditRetentionPreview(days);
      res.json({ days, count });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/user/:userId/profile', authenticate, async (req, res) => {
    try {
      const guild = getGuild();
      if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
      const member = await guild.members.fetch(req.params.userId).catch(() => null);
      if (!member) return res.status(404).json({ error: 'Usuario no encontrado' });
      const [warnings, sanctions, auditResult] = await Promise.all([
        db.getWarnings(req.params.userId),
        db.getSanctions(req.params.userId),
        db.getAuditLogs({ targetId: req.params.userId, limit: 20 })
      ]);
      res.json({
        id: member.id,
        tag: member.user.tag,
        displayName: member.displayName,
        avatar: member.user.displayAvatarURL({ size: 256 }),
        banner: member.user.bannerURL({ size: 512 }) || null,
        joinedAt: member.joinedAt,
        createdAt: member.user.createdAt,
        roles: member.roles.cache.filter(r => r.id !== guild.id).map(r => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position })).sort((a, b) => b.position - a.position),
        isBot: member.user.bot,
        status: member.presence?.status || 'offline',
        warnings,
        sanctions,
        recentLogs: auditResult.logs || [],
        totalWarns: warnings.length,
        totalSanctions: sanctions.length
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/user/:userId/update', authenticate, async (req, res) => {
    if (!['admin', 'owner'].includes(req.session.role)) return res.status(403).json({ error: 'Solo admins pueden modificar usuarios' });
    const { nickname, addRoles, removeRoles } = req.body;
    try {
      const guild = getGuild();
      if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
      const member = await guild.members.fetch(req.params.userId).catch(() => null);
      if (!member) return res.status(404).json({ error: 'Usuario no encontrado' });
      const changes = [];
      if (nickname !== undefined) {
        const oldNick = member.displayName;
        await member.setNickname(nickname || null);
        changes.push(`Apodo: ${oldNick} -> ${nickname || member.user.username}`);
        await db.addAuditLog('USER_NICKNAME_CHANGE', null, req.params.userId, req.session.discordId, { oldNickname: oldNick, newNickname: nickname || member.user.username, staffName: req.session.username, userTag: member.user.tag }, 'USER', 'LOW');
      }
      if (addRoles && addRoles.length > 0) {
        for (const roleId of addRoles) {
          const role = guild.roles.cache.get(roleId);
          if (role) {
            await member.roles.add(role);
            changes.push(`+Rol: ${role.name}`);
          }
        }
        await db.addAuditLog('USER_ROLES_ADD', null, req.params.userId, req.session.discordId, { rolesAdded: addRoles.length, staffName: req.session.username, userTag: member.user.tag }, 'USER', 'MEDIUM');
      }
      if (removeRoles && removeRoles.length > 0) {
        for (const roleId of removeRoles) {
          const role = guild.roles.cache.get(roleId);
          if (role) {
            await member.roles.remove(role);
            changes.push(`-Rol: ${role.name}`);
          }
        }
        await db.addAuditLog('USER_ROLES_REMOVE', null, req.params.userId, req.session.discordId, { rolesRemoved: removeRoles.length, staffName: req.session.username, userTag: member.user.tag }, 'USER', 'MEDIUM');
      }
      res.json({ success: true, changes });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.use('/api', router);

  function parseDuration(str) {
    const match = str.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return null;
    const val = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
      case 's': return val * 1000;
      case 'm': return val * 60000;
      case 'h': return val * 3600000;
      case 'd': return val * 86400000;
      default: return null;
    }
  }

  const SEVERITY_COLORS = { MEDIUM: 0xfaa61a, HIGH: 0xf04747, CRITICAL: 0xff0000 };
  const SEVERITY_LABELS = { MEDIUM: '⚠️ Media', HIGH: '🔴 Alta', CRITICAL: '🚨 Critica' };

  auditEmitter.on('newLog', async (log) => {
    try {
      if (!client || !client.isReady()) return;
      const sev = log.severity;
      if (!['MEDIUM', 'HIGH', 'CRITICAL'].includes(sev)) return;

      const embed = new EmbedBuilder()
        .setColor(SEVERITY_COLORS[sev] || 0xfaa61a)
        .setTitle(`${SEVERITY_LABELS[sev] || sev} - ${(log.actionType || '').replace(/_/g, ' ')}`)
        .addFields(
          { name: 'Categoria', value: log.category || 'SYSTEM', inline: true },
          { name: 'Severidad', value: sev, inline: true }
        )
        .setTimestamp(new Date(log.createdAt));

      const d = log.details || {};
      if (d.userTag) embed.addFields({ name: 'Usuario', value: d.userTag, inline: true });
      if (log.targetId) embed.addFields({ name: 'Target ID', value: log.targetId, inline: true });
      if (d.staffName) embed.addFields({ name: 'Staff', value: d.staffName, inline: true });
      if (d.reason) embed.addFields({ name: 'Razon', value: String(d.reason).substring(0, 200) });
      if (d.channelName) embed.addFields({ name: 'Canal', value: `#${d.channelName}`, inline: true });

      const staffToNotify = Object.values(ACCOUNTS).filter(a => {
        if (sev === 'MEDIUM') return ['admin', 'owner'].includes(a.role);
        return true;
      });

      for (const staff of staffToNotify) {
        if (staff.discordId === log.staffId) continue;
        try {
          const user = await client.users.fetch(staff.discordId);
          await user.send({ embeds: [embed] });
        } catch (e) {}
      }
    } catch (e) {
      console.error('[AuditDM] Error enviando notificacion:', e.message);
    }
  });

  setInterval(async () => {
    try {
      const retentionDays = await db.getConfig('audit_retention_days');
      if (retentionDays && retentionDays > 0) {
        const purged = await db.purgeOldAuditLogs(retentionDays);
        if (purged > 0) console.log(`[AuditRetention] Purgados ${purged} logs antiguos (>${retentionDays} dias)`);
      }
    } catch (e) {
      console.error('[AuditRetention] Error:', e.message);
    }
  }, 6 * 60 * 60 * 1000);
}

module.exports = { setupStaffPanel };
