const express = require('express');
const { EmbedBuilder } = require('discord.js');
const { db, mongoose } = require('../database');
const path = require('path');
const crypto = require('crypto');
const { GUILD_ID: CONFIG_GUILD_ID, LOG_CHANNEL_ID } = require('../config');

async function sendModLog(client, action, { userTag, userId, staffName, reason, duration, warnCount }) {
  if (!client?.isReady() || !LOG_CHANNEL_ID) return;
  try {
    const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (!channel) return;
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
    } else return;
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
    'katherine_zero': { password: hashPassword('GOHA071020HQRRXLA0'), role: 'helper', discordId: '1307811551729946756', displayName: 'Katherine_Zero' },
    'mzingerkai': { password: hashPassword('Mzin531'), role: 'moderator', discordId: '926219678798454875', displayName: 'Mzingerkai' }
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
    res.json({ token, role: account.role, username: account.displayName });
  });

  router.post('/logout', authenticate, (req, res) => {
    const token = req.headers['x-session-token'];
    sessions.delete(token);
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
      await db.addAuditLog('WARN', null, userId, req.session.discordId, { reason, warnCount, staffName: req.session.username });
      sendModLog(client, 'warn', { userTag: member.user.tag, userId, staffName: req.session.username, reason, warnCount }).catch(() => {});
      try {
        await member.send(`⚠️ Has recibido una advertencia en **${guild.name}**\n📝 Razón: ${reason}\n📊 Total de warns: ${warnCount}`);
      } catch (e) {}
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
      await db.addAuditLog('MUTE', null, userId, req.session.discordId, { reason, duration, staffName: req.session.username });
      sendModLog(client, 'mute', { userTag: member.user.tag, userId, staffName: req.session.username, reason, duration }).catch(() => {});
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
      await db.addAuditLog('UNMUTE', null, userId, req.session.discordId, { staffName: req.session.username });
      sendModLog(client, 'unmute', { userTag: member.user.tag, userId, staffName: req.session.username }).catch(() => {});
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
        try {
          await member.send(`🔨 Has sido baneado de **${guild.name}**\n📝 Razón: ${reason}`);
        } catch (e) {}
      }
      await guild.members.ban(userId, { reason, deleteMessageSeconds: 0 });
      await db.addSanction(userId, 'staff-panel', 'BAN', reason, 'staff-panel');
      await db.addAuditLog('BAN', null, userId, req.session.discordId, { reason, staffName: req.session.username });
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
      await db.addAuditLog('TIMEOUT', null, userId, req.session.discordId, { reason, duration, staffName: req.session.username });
      sendModLog(client, 'timeout', { userTag: member.user.tag, userId, staffName: req.session.username, reason, duration }).catch(() => {});
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
      await db.addAuditLog('LOCK_CHANNEL', null, channelId, req.session.discordId, { channelName: channel.name, channelId, staffName: req.session.username });
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
      await db.addAuditLog('UNLOCK_CHANNEL', null, channelId, req.session.discordId, { channelName: channel.name, channelId, staffName: req.session.username });
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
      await db.addAuditLog('NUKE_CHANNEL', null, channelId, req.session.discordId, { channelName: channel.name, channelId, staffName: req.session.username });
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
      await db.addAuditLog('CLEAR_MESSAGES', null, channelId, req.session.discordId, { channelName: channel.name, channelId, count: deleted.size, staffName: req.session.username });
      res.json({ success: true, channel: channel.name, deleted: deleted.size });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // === COMMUNICATION ===

  router.post('/action/send-embed', authenticate, async (req, res) => {
    if (!hasPermission(req, 'send_embed')) return res.status(403).json({ error: 'Sin permisos' });
    const { channelId, title, description, color } = req.body;
    if (!channelId || !title || !description) return res.status(400).json({ error: 'Faltan campos' });
    try {
      const guild = getGuild();
      if (!guild) return res.status(503).json({ error: 'Bot no conectado' });
      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Canal no encontrado' });
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color ? parseInt(color.replace('#', ''), 16) : 0x5865F2)
        .setTimestamp();
      await channel.send({ embeds: [embed] });
      await db.addAuditLog('SEND_EMBED', null, channelId, req.session.discordId, { title, channelName: channel.name, staffName: req.session.username });
      res.json({ success: true, channel: channel.name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/action/send-dm', authenticate, async (req, res) => {
    if (!hasPermission(req, 'send_dm')) return res.status(403).json({ error: 'Sin permisos' });
    const { userId, message } = req.body;
    if (!userId || !message) return res.status(400).json({ error: 'Faltan campos' });
    try {
      const user = await client.users.fetch(userId).catch(() => null);
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
      await user.send(message);
      await db.addAuditLog('SEND_DM', null, userId, req.session.discordId, { messagePreview: message.substring(0, 100), staffName: req.session.username });
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
      await db.addAuditLog('EDIT_MESSAGE', null, messageId, req.session.discordId, { channelName: channel.name, channelId, staffName: req.session.username });
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
      await db.addAuditLog('BLOCK_LINKS', null, channelId, req.session.discordId, { enabled: !!enabled, channelId, staffName: req.session.username });
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
      await db.addAuditLog('QUARANTINE', null, userId, req.session.discordId, { previousRolesCount: currentRoles.length, staffName: req.session.username });
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
      await db.addAuditLog('REDUCE_WARN', null, userId, req.session.discordId, { removed, remaining, staffName: req.session.username });
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

  // === AI ASSISTANT ===

  const OpenAI = require('openai');
  const serverRules = require('./server-rules.json');
  const sanctionsGuide = require('./sanctions-guide.json');
  const botCommands = require('./bot-commands.json');

  function getOpenAIClient() {
    if (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      return new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
    }
    if (process.env.OPENAI_API_KEY) {
      return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return null;
  }

  const AI_SYSTEM_PROMPT = `Eres el Asistente IA del Staff de ${serverRules.serverName}. Tu trabajo es ayudar a los moderadores a tomar decisiones correctas sobre sanciones y responder preguntas sobre las reglas del servidor.

REGLAS DEL SERVIDOR:
${serverRules.rules.map(r => `${r.number}. ${r.title}: ${r.description}
   Severidad: ${r.severity}
   Sanciones: ${JSON.stringify(r.sanctions)}`).join('\n\n')}

GUIA DE SANCIONES DETALLADA:
${sanctionsGuide.rules.map(r => {
    const sanctions = Object.entries(r.sanctions).map(([k, v]) => `   - ${k.replace(/_/g, ' ')}: ${v}`).join('\n');
    return `${r.number}. ${r.title}${r.description ? ' (' + r.description + ')' : ''}:\n${sanctions}${r.nota ? '\n   NOTA: ' + r.nota : ''}`;
  }).join('\n\n')}

NOTAS IMPORTANTES PARA EL STAFF:
${sanctionsGuide.staffNotes.map(n => `- ${n}`).join('\n')}

CATEGORIAS DE SANCIONES DISPONIBLES:
${serverRules.sanctionCategories.map(c => `- ${c.label} (${c.value}) - Reglas relacionadas: ${c.relatedRules.length > 0 ? c.relatedRules.join(', ') : 'general'}`).join('\n')}

ESCALACION DE WARNS:
${Object.entries(serverRules.escalationGuidelines.warnThresholds).map(([k, v]) => `- ${k.replace('_', ' ')}: ${v}`).join('\n')}

PRINCIPIOS GENERALES:
${serverRules.escalationGuidelines.generalPrinciples.map(p => `- ${p}`).join('\n')}

JERARQUIA DE ROLES:
- Helper: Solo puede ${serverRules.roleHierarchy.helper.canDo.join(', ')}
- Moderator: Puede ${serverRules.roleHierarchy.moderator.canDo.join(', ')}
- Admin: Acceso completo
- Owner: Acceso completo

COMANDOS DEL BOT DISPONIBLES:

Comandos de Moderacion:
${botCommands.slashCommands.moderacion.map(c => {
    let line = `${c.command} - ${c.description}`;
    if (c.options?.length) line += `\n   Opciones: ${c.options.map(o => `${o.name}(${o.required ? 'requerido' : 'opcional'}): ${o.description}${o.choices ? ' [' + (Array.isArray(o.choices) ? o.choices.join(', ') : o.choices) + ']' : ''}`).join(', ')}`;
    if (c.permissions) line += `\n   Permisos: ${c.permissions}`;
    if (c.examples) line += `\n   Ejemplos: ${c.examples.join(' | ')}`;
    if (c.subcommands) line += `\n   Subcomandos: ${c.subcommands.join(', ')}`;
    return line;
  }).join('\n\n')}

Comandos de Estadisticas:
${botCommands.slashCommands.estadisticas.map(c => `${c.command} - ${c.description}`).join('\n')}

Comandos de Auditoria:
${botCommands.slashCommands.auditoria.map(c => `${c.command} - ${c.description}`).join('\n')}

Comandos de Utilidad:
${botCommands.slashCommands.utilidad.map(c => `${c.command} - ${c.description}`).join('\n')}

Otros Comandos:
${botCommands.slashCommands.otros.map(c => `${c.command} - ${c.description}`).join('\n')}

Comandos con Prefijo (!):
${botCommands.prefixCommands.map(c => `${c.command} - ${c.description} (${c.permissions})`).join('\n')}

Formatos de Tiempo: ${botCommands.timeFormats.examples.join(', ')}

INSTRUCCIONES:
1. Responde SIEMPRE en espanol
2. Cuando te describan una situacion, recomienda la sancion EXACTA segun la Guia de Sanciones (duracion especifica, tipo de sancion)
3. Indica que regla se infringe, la categoria de sancion y si es primera falta, reincidencia o caso grave
4. Siempre pregunta si es primera falta o reincidencia para dar la sancion correcta
5. Si hay dudas sobre la severidad, sugiere consultar con un admin
6. Se conciso pero completo en tus respuestas
7. Si te preguntan sobre una regla especifica, explica con detalle incluyendo las duraciones exactas
8. Sugiere el comando COMPLETO y EXACTO que debe usar el staff, incluyendo todas las opciones necesarias (usuario, tipo, categoria, razon, tiempo)
9. Ten en cuenta el rol del staff que pregunta - un Helper no puede banear
10. Si la situacion es ambigua, da multiples opciones con pros y contras
11. Nunca inventes reglas, sanciones ni comandos que no existan
12. Recuerda que el permaban solo debe aplicarse con aprobacion de un Admin
13. Cuando sugiras un comando, usa el formato exacto con las opciones correctas del bot`;

  const aiChatHistories = new Map();

  router.post('/ai/chat', authenticate, async (req, res) => {
    const openaiClient = getOpenAIClient();
    if (!openaiClient) {
      return res.status(503).json({ error: 'Asistente IA no configurado. Configura OPENAI_API_KEY en las variables de entorno.' });
    }

    const { message, conversationId } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensaje requerido' });

    const chatId = conversationId || `${req.session.username}_${Date.now()}`;

    if (!aiChatHistories.has(chatId)) {
      aiChatHistories.set(chatId, []);
    }

    const history = aiChatHistories.get(chatId);
    history.push({ role: 'user', content: message });

    const contextMessage = `[Contexto: El miembro del staff "${req.session.username}" tiene rol "${req.session.role}". Permisos: ${(ROLE_PERMISSIONS[req.session.role] || []).join(', ')}]`;

    try {
      console.log('[AI] Starting chat for:', req.session.username, 'message:', message.substring(0, 50));

      const messages = [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'system', content: contextMessage },
        ...history.slice(-20)
      ];

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 2048,
      });

      const fullResponse = completion.choices[0]?.message?.content || 'No pude generar una respuesta.';
      console.log('[AI] Response length:', fullResponse.length);

      history.push({ role: 'assistant', content: fullResponse });

      if (history.length > 40) {
        history.splice(0, history.length - 40);
      }

      if (aiChatHistories.size > 200) {
        const oldest = aiChatHistories.keys().next().value;
        aiChatHistories.delete(oldest);
      }

      res.json({ response: fullResponse, conversationId: chatId });
    } catch (err) {
      console.error('[AI] Error:', err.message);
      res.status(500).json({ error: 'Error del asistente: ' + err.message });
    }
  });

  router.post('/ai/clear', authenticate, (req, res) => {
    const { conversationId } = req.body;
    if (conversationId && aiChatHistories.has(conversationId)) {
      aiChatHistories.delete(conversationId);
    }
    res.json({ success: true });
  });

  router.get('/ai/rules', authenticate, (req, res) => {
    res.json(serverRules);
  });

  // === AUDIT LOGS ===

  router.get('/logs', authenticate, async (req, res) => {
    try {
      const logs = await db.getAuditLogs({ limit: 100 });
      res.json(logs);
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
}

module.exports = { setupStaffPanel };
