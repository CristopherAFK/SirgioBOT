// =========================
// SirgioBOT - Sistema de Tickets
// =========================

const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  AttachmentBuilder,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = (client) => {
  const STAFF_ROLES = ['1212891335929897030', '1229140504310972599', '1230952139015327755'];
  const LOG_CHANNEL_ID = '1431416957160259764';
  const PANEL_IMAGE = 'https://media.discordapp.net/attachments/1420914042251509990/1430698897927307347/79794618.png';

  // ========== COMANDO !panel ==========
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.content.toLowerCase() !== '!panel') return;
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
      return message.reply('❌ Solo administradores pueden usar este comando.');

    const embed = new EmbedBuilder()
      .setTitle('🎟️ LagSupport')
      .setColor('#00FF80')
      .setThumbnail(PANEL_IMAGE)
      .setDescription(
        `¿Tienes alguna duda respecto al servidor? ¿Alguien te está molestando y deseas reportarlo? ¿Deseas apelar una sanción injusta?\n\n` +
          `En este canal podrás abrir un ticket para hablar directamente con el staff de **Sirgio**, quienes te ayudarán con los problemas o dudas que tengas.\n\n` +
          `Simplemente elige una opción con el menú de abajo según el tipo de ayuda que necesites.`
      );

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_categoria')
      .setPlaceholder('📋 Selecciona una categoría...')
      .addOptions([
        { label: 'Discord Bots', value: 'bots', emoji: '<:emoji_104:1431413172513804348>' },
        { label: 'Reportar usuario', value: 'report', emoji: '<:emoji_99:1431408998887981147>' },
        { label: 'Streams', value: 'streams', emoji: '<:Twitch:1268414311509004460>' },
        { label: 'Lives', value: 'lives', emoji: '<:TikTok:1268414284077994034>' },
        { label: 'Dudas', value: 'dudas', emoji: '<:emoji_103:1431412814345404618>' },
        { label: 'Otro', value: 'otro', emoji: '<:emoji_106:1431415219367842032>' },
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    await message.channel.send({ embeds: [embed], components: [row] });
  });

  // ========== SELECCIÓN DE CATEGORÍA ==========
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'ticket_categoria') return;

    const categoria = interaction.values[0];
    const user = interaction.user;

    if (client.ticketData.activeTickets.has(user.id)) {
      return interaction.reply({ content: '⚠️ Ya tienes un ticket abierto.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor('#00FF80')
      .setTitle('🟢 Confirmación de ticket')
      .setDescription(
        `¿Deseas abrir un ticket para **${categoria}**?\n\n` +
          `⚠️ **Advertencia:** Crear tickets sin propósito o de manera de meme puede llevar a sanciones.\n\n` +
          `Confirma tu elección:`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket_confirm_${categoria}`).setLabel('Aceptar ✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket_cancel').setLabel('Cancelar ❌').setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  });

  // ========== CONFIRMAR / CANCELAR ==========
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId, user, guild } = interaction;

    if (customId === 'ticket_cancel') {
      return interaction.update({ content: '❌ Ticket cancelado.', embeds: [], components: [] });
    }

    if (!customId.startsWith('ticket_confirm_')) return;

    const categoria = customId.replace('ticket_confirm_', '');
    const existingTicket = client.ticketData.activeTickets.get(user.id);
    if (existingTicket) {
      return interaction.reply({ content: '⚠️ Ya tienes un ticket abierto.', ephemeral: true });
    }

    client.ticketData.counter++;
    const ticketNumber = String(client.ticketData.counter).padStart(3, '0');

    const channel = await guild.channels.create({
      name: `ticket-${user.username}-${ticketNumber}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
        ...STAFF_ROLES.map((r) => ({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] })),
      ],
    });

    client.ticketData.activeTickets.set(user.id, channel.id);

    const embed = new EmbedBuilder()
      .setColor('#00FF80')
      .setDescription(`👋 **¡Bienvenido ${user}!**\n\nEl staff atenderá tu caso en breve.`);

    const atenderBtn = new ButtonBuilder()
      .setCustomId('atender_ticket')
      .setLabel('🧑‍💼 Atender Ticket')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(atenderBtn);

    await channel.send({ content: `<@&${STAFF_ROLES.join('> <@&')}>`, embeds: [embed], components: [row] });

    await interaction.update({
      content: `✅ Ticket creado: ${channel}`,
      embeds: [],
      components: [],
    });
  });

  // ========== ATENDER TICKET ==========
  const activeTickets = new Map(); // channelId => staffId

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'atender_ticket') return;

    const member = interaction.member;
    if (!STAFF_ROLES.some((r) => member.roles.cache.has(r))) {
      return interaction.reply({ content: '🚫 No tienes permiso para atender tickets.', ephemeral: true });
    }

    const channel = interaction.channel;
    if (activeTickets.has(channel.id)) {
      const staffId = activeTickets.get(channel.id);
      return interaction.reply({
        content: `⚠️ Este ticket ya está siendo atendido por <@${staffId}>.`,
        ephemeral: true,
      });
    }

    activeTickets.set(channel.id, member.id);

    const userId = [...client.ticketData.activeTickets.entries()].find(([u, ch]) => ch === channel.id)?.[0];
    if (userId) {
      const user = await client.users.fetch(userId);
      await channel.permissionOverwrites.edit(user.id, { SendMessages: true });
      await channel.send({
        content: `💬 Hola <@${user.id}>, gracias por comunicarte con el staff.\n🧑‍💼 <@${member.id}> atenderá tu ticket.`,
      });
    }

    const disabledButton = new ButtonBuilder()
      .setCustomId('atender_ticket_disabled')
      .setLabel('🧑‍💼 Ticket en atención')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    await interaction.update({ components: [new ActionRowBuilder().addComponents(disabledButton)] });
  });

  // ========== CERRAR TICKET ==========
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (!['!cerrar', '!eliminar'].includes(message.content.toLowerCase())) return;
    if (!STAFF_ROLES.some((r) => message.member.roles.cache.has(r))) return;

    const userId = [...client.ticketData.activeTickets.entries()].find(([_, ch]) => ch === message.channel.id)?.[0];
    if (!userId) return message.reply('⚠️ Este canal no parece ser un ticket.');

    const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!logChannel) return message.reply('⚠️ Canal de logs no encontrado.');

    const messages = await message.channel.messages.fetch({ limit: 100 });
    const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    const transcript = sorted
      .map((m) => `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content}`)
      .join('\n');

    const filePath = path.join(__dirname, `transcript-${message.channel.id}.txt`);
    fs.writeFileSync(filePath, transcript);

    const embed = new EmbedBuilder()
      .setColor('#00FF80')
      .setTitle('📄 Ticket Cerrado')
      .addFields(
        { name: '👤 Usuario', value: `<@${userId}>`, inline: true },
        { name: '🧑‍💼 Cerrado por', value: `<@${message.author.id}>`, inline: true },
        { name: '🕒 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
      );

    await logChannel.send({
      embeds: [embed],
      files: [new AttachmentBuilder(filePath)],
    });

    fs.unlinkSync(filePath);
    await message.channel.delete();
    client.ticketData.activeTickets.delete(userId);
  });
};
