const { db } = require('./database');

function setupAuditEvents(client) {
  client.on('messageUpdate', async (oldMessage, newMessage) => {
    try {
      if (!oldMessage.author || oldMessage.author.bot) return;
      if (oldMessage.content === newMessage.content) return;
      await db.addAuditLog('MESSAGE_EDIT', null, oldMessage.author.id, null, {
        channelId: oldMessage.channel.id,
        channelName: oldMessage.channel.name,
        messageId: oldMessage.id,
        userTag: oldMessage.author.tag,
        oldContent: (oldMessage.content || '').substring(0, 500),
        newContent: (newMessage.content || '').substring(0, 500)
      }, 'MESSAGE', 'INFO');
    } catch (e) {
      console.error('[AuditEvents] Error logging messageUpdate:', e.message);
    }
  });

  client.on('messageDelete', async (message) => {
    try {
      if (!message.author || message.author.bot) return;
      await db.addAuditLog('MESSAGE_DELETE', null, message.author.id, null, {
        channelId: message.channel.id,
        channelName: message.channel.name,
        messageId: message.id,
        userTag: message.author.tag,
        content: (message.content || '').substring(0, 500),
        hadAttachments: message.attachments?.size > 0
      }, 'MESSAGE', 'LOW');
    } catch (e) {
      console.error('[AuditEvents] Error logging messageDelete:', e.message);
    }
  });

  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
      if (oldMember.nickname !== newMember.nickname) {
        await db.addAuditLog('MEMBER_NICKNAME_CHANGE', null, newMember.id, null, {
          userTag: newMember.user.tag,
          oldNickname: oldMember.nickname || oldMember.user.username,
          newNickname: newMember.nickname || newMember.user.username
        }, 'USER', 'INFO');
      }

      const oldRoles = oldMember.roles.cache;
      const newRoles = newMember.roles.cache;
      const addedRoles = newRoles.filter(r => !oldRoles.has(r.id));
      const removedRoles = oldRoles.filter(r => !newRoles.has(r.id));

      if (addedRoles.size > 0) {
        await db.addAuditLog('MEMBER_ROLE_ADD', null, newMember.id, null, {
          userTag: newMember.user.tag,
          roles: addedRoles.map(r => r.name)
        }, 'USER', 'LOW');
      }
      if (removedRoles.size > 0) {
        await db.addAuditLog('MEMBER_ROLE_REMOVE', null, newMember.id, null, {
          userTag: newMember.user.tag,
          roles: removedRoles.map(r => r.name)
        }, 'USER', 'LOW');
      }
    } catch (e) {
      console.error('[AuditEvents] Error logging guildMemberUpdate:', e.message);
    }
  });

  client.on('channelCreate', async (channel) => {
    try {
      if (channel.isDMBased()) return;
      await db.addAuditLog('CHANNEL_CREATE', null, channel.id, null, {
        channelName: channel.name,
        channelType: channel.type,
        category: channel.parent?.name || null
      }, 'CHANNEL', 'LOW');
    } catch (e) {
      console.error('[AuditEvents] Error logging channelCreate:', e.message);
    }
  });

  client.on('channelDelete', async (channel) => {
    try {
      if (channel.isDMBased()) return;
      await db.addAuditLog('CHANNEL_DELETE', null, channel.id, null, {
        channelName: channel.name,
        channelType: channel.type,
        category: channel.parent?.name || null
      }, 'CHANNEL', 'MEDIUM');
    } catch (e) {
      console.error('[AuditEvents] Error logging channelDelete:', e.message);
    }
  });

  client.on('channelUpdate', async (oldChannel, newChannel) => {
    try {
      if (oldChannel.isDMBased()) return;
      const changes = [];
      if (oldChannel.name !== newChannel.name) changes.push(`Nombre: ${oldChannel.name} -> ${newChannel.name}`);
      if (oldChannel.topic !== newChannel.topic) changes.push('Tema cambiado');
      if (oldChannel.nsfw !== newChannel.nsfw) changes.push(`NSFW: ${newChannel.nsfw}`);
      if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) changes.push(`Slowmode: ${newChannel.rateLimitPerUser}s`);
      if (changes.length === 0) return;
      await db.addAuditLog('CHANNEL_UPDATE', null, newChannel.id, null, {
        channelName: newChannel.name,
        changes
      }, 'CHANNEL', 'LOW');
    } catch (e) {
      console.error('[AuditEvents] Error logging channelUpdate:', e.message);
    }
  });

  client.on('guildBanAdd', async (ban) => {
    try {
      await db.addAuditLog('GUILD_BAN_ADD', null, ban.user.id, null, {
        userTag: ban.user.tag,
        reason: ban.reason || 'Sin razon'
      }, 'STAFF', 'HIGH');
    } catch (e) {
      console.error('[AuditEvents] Error logging guildBanAdd:', e.message);
    }
  });

  client.on('guildBanRemove', async (ban) => {
    try {
      await db.addAuditLog('GUILD_BAN_REMOVE', null, ban.user.id, null, {
        userTag: ban.user.tag
      }, 'STAFF', 'MEDIUM');
    } catch (e) {
      console.error('[AuditEvents] Error logging guildBanRemove:', e.message);
    }
  });

  client.on('guildMemberAdd', async (member) => {
    try {
      await db.addAuditLog('MEMBER_JOIN', null, member.id, null, {
        userTag: member.user.tag,
        accountAge: Math.floor((Date.now() - member.user.createdTimestamp) / 86400000) + ' dias'
      }, 'USER', 'INFO');
    } catch (e) {
      console.error('[AuditEvents] Error logging guildMemberAdd:', e.message);
    }
  });

  client.on('guildMemberRemove', async (member) => {
    try {
      await db.addAuditLog('MEMBER_LEAVE', null, member.id, null, {
        userTag: member.user.tag,
        roles: member.roles.cache.filter(r => r.id !== member.guild.id).map(r => r.name)
      }, 'USER', 'INFO');
    } catch (e) {
      console.error('[AuditEvents] Error logging guildMemberRemove:', e.message);
    }
  });

  console.log('[AuditEvents] Eventos de auditoria registrados');
}

module.exports = { setupAuditEvents };
