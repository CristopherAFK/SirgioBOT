const { db } = require('./database');

function setupAuditEvents(client) {
  function extractAttachments(message) {
    if (!message.attachments || message.attachments.size === 0) return [];
    return message.attachments.map(att => ({
      name: att.name || 'unknown',
      url: att.url || '',
      proxyURL: att.proxyURL || '',
      size: att.size || 0,
      contentType: att.contentType || '',
      width: att.width || null,
      height: att.height || null
    }));
  }

  function getAttachmentType(contentType, name) {
    if (!contentType && name) {
      const ext = name.split('.').pop().toLowerCase();
      if (['png','jpg','jpeg','gif','webp','bmp','svg'].includes(ext)) return 'image';
      if (['mp4','webm','mov','avi','mkv'].includes(ext)) return 'video';
      if (['mp3','ogg','wav','flac','aac'].includes(ext)) return 'audio';
      return 'file';
    }
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    if (contentType.startsWith('audio/')) return 'audio';
    return 'file';
  }

  client.on('messageUpdate', async (oldMessage, newMessage) => {
    try {
      if (!oldMessage.author || oldMessage.author.bot) return;
      const contentChanged = oldMessage.content !== newMessage.content;
      const oldAttachments = extractAttachments(oldMessage);
      const newAttachments = extractAttachments(newMessage);
      const attachmentsChanged = oldAttachments.length !== newAttachments.length ||
        oldAttachments.some((a, i) => !newAttachments[i] || a.url !== newAttachments[i].url);
      if (!contentChanged && !attachmentsChanged) return;
      const details = {
        channelId: oldMessage.channel.id,
        channelName: oldMessage.channel.name,
        messageId: oldMessage.id,
        userTag: oldMessage.author.tag,
        oldContent: (oldMessage.content || '').substring(0, 500),
        newContent: (newMessage.content || '').substring(0, 500)
      };
      if (oldAttachments.length > 0) {
        details.oldAttachments = oldAttachments.map(a => ({ name: a.name, url: a.url, type: getAttachmentType(a.contentType, a.name), size: a.size }));
      }
      if (newAttachments.length > 0) {
        details.newAttachments = newAttachments.map(a => ({ name: a.name, url: a.url, type: getAttachmentType(a.contentType, a.name), size: a.size }));
      }
      if (oldAttachments.length > 0 && newAttachments.length < oldAttachments.length) {
        const removedNames = oldAttachments.filter(oa => !newAttachments.some(na => na.url === oa.url)).map(a => a.name);
        details.removedAttachments = removedNames;
      }
      const severity = (oldAttachments.length > 0 && newAttachments.length < oldAttachments.length) ? 'LOW' : 'INFO';
      await db.addAuditLog('MESSAGE_EDIT', null, oldMessage.author.id, null, details, 'MESSAGE', severity);
    } catch (e) {
      console.error('[AuditEvents] Error logging messageUpdate:', e.message);
    }
  });

  client.on('messageDelete', async (message) => {
    try {
      if (!message.author || message.author.bot) return;
      const attachments = extractAttachments(message);
      const details = {
        channelId: message.channel.id,
        channelName: message.channel.name,
        messageId: message.id,
        userTag: message.author.tag,
        content: (message.content || '').substring(0, 500),
        hadAttachments: attachments.length > 0
      };
      if (attachments.length > 0) {
        details.attachments = attachments.map(a => ({
          name: a.name,
          url: a.url,
          proxyURL: a.proxyURL,
          type: getAttachmentType(a.contentType, a.name),
          size: a.size,
          width: a.width,
          height: a.height
        }));
      }
      const severity = attachments.length > 0 ? 'MEDIUM' : 'LOW';
      await db.addAuditLog('MESSAGE_DELETE', null, message.author.id, null, details, 'MESSAGE', severity);
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

      const oldBoosting = oldMember.premiumSince;
      const newBoosting = newMember.premiumSince;
      if (!oldBoosting && newBoosting) {
        await db.addAuditLog('MEMBER_BOOST', null, newMember.id, null, {
          userTag: newMember.user.tag,
          boostSince: newBoosting.toISOString()
        }, 'USER', 'INFO');
      } else if (oldBoosting && !newBoosting) {
        await db.addAuditLog('MEMBER_UNBOOST', null, newMember.id, null, {
          userTag: newMember.user.tag
        }, 'USER', 'INFO');
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

  client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
      const member = newState.member || oldState.member;
      if (!member || member.user.bot) return;

      if (!oldState.channelId && newState.channelId) {
        await db.addAuditLog('VOICE_JOIN', null, member.id, null, {
          userTag: member.user.tag,
          channelId: newState.channelId,
          channelName: newState.channel?.name || 'Desconocido'
        }, 'USER', 'INFO');
      } else if (oldState.channelId && !newState.channelId) {
        await db.addAuditLog('VOICE_LEAVE', null, member.id, null, {
          userTag: member.user.tag,
          channelId: oldState.channelId,
          channelName: oldState.channel?.name || 'Desconocido'
        }, 'USER', 'INFO');
      } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        await db.addAuditLog('VOICE_MOVE', null, member.id, null, {
          userTag: member.user.tag,
          fromChannelId: oldState.channelId,
          fromChannelName: oldState.channel?.name || 'Desconocido',
          toChannelId: newState.channelId,
          toChannelName: newState.channel?.name || 'Desconocido'
        }, 'USER', 'INFO');
      }
    } catch (e) {
      console.error('[AuditEvents] Error logging voiceStateUpdate:', e.message);
    }
  });

  client.on('emojiCreate', async (emoji) => {
    try {
      await db.addAuditLog('EMOJI_CREATE', null, null, null, {
        emojiName: emoji.name,
        emojiId: emoji.id,
        animated: emoji.animated || false
      }, 'SYSTEM', 'INFO');
    } catch (e) {
      console.error('[AuditEvents] Error logging emojiCreate:', e.message);
    }
  });

  client.on('emojiDelete', async (emoji) => {
    try {
      await db.addAuditLog('EMOJI_DELETE', null, null, null, {
        emojiName: emoji.name,
        emojiId: emoji.id,
        animated: emoji.animated || false
      }, 'SYSTEM', 'INFO');
    } catch (e) {
      console.error('[AuditEvents] Error logging emojiDelete:', e.message);
    }
  });

  client.on('roleCreate', async (role) => {
    try {
      await db.addAuditLog('ROLE_CREATE', null, null, null, {
        roleName: role.name,
        roleId: role.id,
        color: role.hexColor,
        mentionable: role.mentionable,
        hoisted: role.hoist
      }, 'SYSTEM', 'INFO');
    } catch (e) {
      console.error('[AuditEvents] Error logging roleCreate:', e.message);
    }
  });

  client.on('roleDelete', async (role) => {
    try {
      await db.addAuditLog('ROLE_DELETE', null, null, null, {
        roleName: role.name,
        roleId: role.id,
        color: role.hexColor
      }, 'SYSTEM', 'MEDIUM');
    } catch (e) {
      console.error('[AuditEvents] Error logging roleDelete:', e.message);
    }
  });

  client.on('roleUpdate', async (oldRole, newRole) => {
    try {
      const changes = [];
      if (oldRole.name !== newRole.name) changes.push(`Nombre: ${oldRole.name} -> ${newRole.name}`);
      if (oldRole.hexColor !== newRole.hexColor) changes.push(`Color: ${oldRole.hexColor} -> ${newRole.hexColor}`);
      if (oldRole.hoist !== newRole.hoist) changes.push(`Destacado: ${newRole.hoist}`);
      if (oldRole.mentionable !== newRole.mentionable) changes.push(`Mencionable: ${newRole.mentionable}`);
      if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) changes.push('Permisos modificados');
      if (changes.length === 0) return;
      await db.addAuditLog('ROLE_UPDATE', null, null, null, {
        roleName: newRole.name,
        roleId: newRole.id,
        changes
      }, 'SYSTEM', 'LOW');
    } catch (e) {
      console.error('[AuditEvents] Error logging roleUpdate:', e.message);
    }
  });

  console.log('[AuditEvents] Eventos de auditoria registrados');
}

module.exports = { setupAuditEvents };
