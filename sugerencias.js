const fs = require('fs');
const path = require('path');
const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} = require('discord.js');
const { db, mongoose } = require('./database');
const {
  GUILD_ID,
  SUGGESTIONS_CHANNEL_ID,
  STAFF_REVIEW_CHANNEL_ID,
  STAFF_ROLE_ID,
  SUGGESTER_ROLE_ID,
} = require('./config');

const SUGGESTION_ICON_URL = 'https://media.discordapp.net/attachments/1420914042251509990/1430698897927307347/79794618.png';

const processedInteractions = new Set();

function cleanupProcessedInteractions() {
  if (processedInteractions.size > 1000) {
    const entries = Array.from(processedInteractions);
    entries.slice(0, 500).forEach(id => processedInteractions.delete(id));
  }
}

module.exports = (client) => {
  client.once('ready', async () => {
    console.log('✅ Sistema de Sugerencias cargado (PostgreSQL)');

    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (guild) {
        const existingCommands = await guild.commands.fetch();
        const hasCommand = existingCommands.some(cmd => cmd.name === 'sugerir');
        
        if (!hasCommand) {
          const command = new SlashCommandBuilder()
            .setName('sugerir')
            .setDescription('Envía una sugerencia para el servidor');

          await guild.commands.create(command);
          console.log('🟢 Comando /sugerir registrado en el servidor');
        }
      }
    } catch (error) {
      console.error('Error registrando comandos de sugerencias:', error);
    }
  });

  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (message.channelId === SUGGESTIONS_CHANNEL_ID) {
        const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
        if (member && member.roles.cache.has(STAFF_ROLE_ID)) return;
        try { await message.delete(); } catch (e) {}
        try {
          await message.author.send({
            content: '❌ **No se pueden enviar mensajes normales en el canal de sugerencias.**\n\n' +
                     'Para hacer una sugerencia, usa el comando:\n' +
                     '`/sugerir`\n\n' +
                     '¡Gracias por tu comprensión! 😊'
          }).catch(() => {});
        } catch (dmError) {}
      }
    } catch (error) {
      console.error('Error en messageCreate sugerencias:', error);
    }
  });

  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand() && interaction.commandName === 'sugerir') {
        const interactionKey = `cmd_${interaction.id}`;
        if (processedInteractions.has(interactionKey)) return;
        processedInteractions.add(interactionKey);
        cleanupProcessedInteractions();

        const modal = new ModalBuilder()
          .setCustomId(`sugerencia_modal_${interaction.user.id}_${Date.now()}`)
          .setTitle('Nueva Sugerencia');

        const titleInput = new TextInputBuilder()
          .setCustomId('suggestion_title')
          .setLabel('Título de la sugerencia')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Escribe un título breve...')
          .setMaxLength(100)
          .setRequired(true);

        const descriptionInput = new TextInputBuilder()
          .setCustomId('suggestion_description')
          .setLabel('Descripción de la sugerencia')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Describe tu sugerencia en detalle...')
          .setMaxLength(1000)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(titleInput),
          new ActionRowBuilder().addComponents(descriptionInput)
        );

        await interaction.showModal(modal);
        return;
      }

      if (interaction.isButton() && interaction.customId === 'create_suggestion_btn') {
        const interactionKey = `btn_${interaction.id}`;
        if (processedInteractions.has(interactionKey)) return;
        processedInteractions.add(interactionKey);
        cleanupProcessedInteractions();

        const modal = new ModalBuilder()
          .setCustomId(`sugerencia_modal_${interaction.user.id}_${Date.now()}`)
          .setTitle('Nueva Sugerencia');

        const titleInput = new TextInputBuilder()
          .setCustomId('suggestion_title')
          .setLabel('Título de la sugerencia')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Escribe un título breve...')
          .setMaxLength(100)
          .setRequired(true);

        const descriptionInput = new TextInputBuilder()
          .setCustomId('suggestion_description')
          .setLabel('Descripción de la sugerencia')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Describe tu sugerencia en detalle...')
          .setMaxLength(1000)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(titleInput),
          new ActionRowBuilder().addComponents(descriptionInput)
        );

        await interaction.showModal(modal);
        return;
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith('sugerencia_modal_')) {
        const interactionKey = `modal_${interaction.id}`;
        if (processedInteractions.has(interactionKey)) return;
        processedInteractions.add(interactionKey);
        cleanupProcessedInteractions();

        await interaction.deferReply({ ephemeral: true });

        try {
          if (client.rateLimit) {
            const rl = await client.rateLimit.checkAndSet(interaction.user.id, 'sugerir');
            if (rl.limited) return interaction.editReply({ content: client.rateLimit.getMessage(rl) });
          }
          const title = interaction.fields.getTextInputValue('suggestion_title');
          const description = interaction.fields.getTextInputValue('suggestion_description');
          
          const suggestionId = `sug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          const publicEmbed = new EmbedBuilder()
            .setTitle(`💡 ${title}`)
            .setDescription(description)
            .setColor(0x3498db)
            .setAuthor({
              name: interaction.user.tag,
              iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            })
            .addFields(
              { name: '📊 Estado', value: '🔵 Sin revisar', inline: true },
              { name: '👤 Sugerido por', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setFooter({ text: `ID: ${suggestionId}` })
            .setTimestamp();

          const suggestionsChannel = await client.channels.fetch(SUGGESTIONS_CHANNEL_ID).catch(() => null);
          if (!suggestionsChannel) {
            return interaction.editReply({ content: '❌ No se encontró el canal de sugerencias.' });
          }

          let publicMessage;
          const createSugBtn = new ButtonBuilder()
            .setCustomId('create_suggestion_btn')
            .setLabel('Hacer una sugerencia')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💡');
          const publicRow = new ActionRowBuilder().addComponents(createSugBtn);

          if (SUGGESTION_ICON_URL) publicEmbed.setThumbnail(SUGGESTION_ICON_URL);
          publicMessage = await suggestionsChannel.send({
            embeds: [publicEmbed],
            components: [publicRow]
          });

          await publicMessage.react('1465220343550578718').catch(() => publicMessage.react('✅').catch(() => {}));
          await publicMessage.react('1465219129291051150').catch(() => publicMessage.react('❌').catch(() => {}));

          const staffEmbed = new EmbedBuilder()
            .setTitle(`📋 Nueva Sugerencia para Revisar`)
            .setDescription(`**Título:** ${title}\n\n**Descripción:**\n${description}`)
            .setColor(0x3498db)
            .setAuthor({
              name: interaction.user.tag,
              iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            })
            .addFields(
              { name: '👤 Usuario', value: `<@${interaction.user.id}>`, inline: true },
              { name: '🆔 ID Usuario', value: interaction.user.id, inline: true }
            )
            .setFooter({ text: `ID: ${suggestionId}` })
            .setTimestamp();

          const acceptButton = new ButtonBuilder()
            .setCustomId(`sug_accept_${suggestionId}`)
            .setLabel('Aceptar')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅');
          const rejectButton = new ButtonBuilder()
            .setCustomId(`sug_reject_${suggestionId}`)
            .setLabel('Rechazar')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌');
          const indefiniteButton = new ButtonBuilder()
            .setCustomId(`sug_indefinite_${suggestionId}`)
            .setLabel('Indefinido')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❓');

          const row = new ActionRowBuilder().addComponents(acceptButton, rejectButton, indefiniteButton);
          const staffChannel = await client.channels.fetch(STAFF_REVIEW_CHANNEL_ID).catch(() => null);
          
          if (staffChannel) {
            await staffChannel.send({ embeds: [staffEmbed], components: [row] });
          }

          await db.createSuggestion(suggestionId, interaction.user.id, publicMessage.id, title, description);

          await db.addAuditLog('SUGGESTION_CREATE', interaction.user.id, null, null, {
            suggestionId,
            title,
            messageId: publicMessage.id
          });

          await interaction.editReply({
            content: `✅ Tu sugerencia ha sido enviada correctamente. Puedes verla en <#${SUGGESTIONS_CHANNEL_ID}>`
          });
        } catch (error) {
          console.error('Error procesando sugerencia:', error);
          await interaction.editReply({
            content: '❌ Hubo un error al procesar tu sugerencia. Por favor, intenta de nuevo.'
          }).catch(() => {});
        }
        return;
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith('sug_reason_')) {
        const interactionKey = `reason_${interaction.id}`;
        if (processedInteractions.has(interactionKey)) return;
        processedInteractions.add(interactionKey);
        cleanupProcessedInteractions();

        await interaction.deferReply({ ephemeral: true });

        try {
          const parts = interaction.customId.split('_');
          const action = parts[2];
          const suggestionId = parts.slice(3).join('_');
          const reason = interaction.fields.getTextInputValue('reason');

          const suggestionData = await db.getSuggestion(suggestionId);
          if (!suggestionData) {
            return interaction.editReply({ content: '❌ No se encontró la sugerencia en la base de datos.' });
          }

          let statusText, statusEmoji, color, dbStatus;
          if (action === 'accept') {
            statusText = 'Aceptada'; statusEmoji = '🟢'; color = 0x2ecc71; dbStatus = 'approved';
          } else if (action === 'reject') {
            statusText = 'Rechazada'; statusEmoji = '🔴'; color = 0xe74c3c; dbStatus = 'denied';
          } else {
            statusText = 'Indefinida'; statusEmoji = '🟠'; color = 0xf39c12; dbStatus = 'pending';
          }

          try {
            const publicChannel = await client.channels.fetch(SUGGESTIONS_CHANNEL_ID);
            const publicMessage = await publicChannel.messages.fetch(suggestionData.messageId);

            const oldEmbed = publicMessage.embeds[0];
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
              .setColor(color)
              .spliceFields(0, 1, { name: '📊 Estado', value: `${statusEmoji} ${statusText}`, inline: true })
              .addFields(
                { name: '👮 Revisado por', value: `<@${interaction.user.id}>`, inline: true },
                { name: '📝 Razón', value: reason, inline: false }
              )
              .setTimestamp();

            const createSugBtn = new ButtonBuilder()
              .setCustomId('create_suggestion_btn')
              .setLabel('Hacer una sugerencia')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('💡');
            const publicRow = new ActionRowBuilder().addComponents(createSugBtn);

            const editOptions = { embeds: [updatedEmbed], components: [publicRow] };
            if (SUGGESTION_ICON_URL) {
              updatedEmbed.setThumbnail(SUGGESTION_ICON_URL);
            }

            await publicMessage.edit(editOptions);

            const staffEmbed = EmbedBuilder.from(interaction.message.embeds[0])
              .setTitle(`📋 Sugerencia Revisada`)
              .setColor(color)
              .addFields(
                { name: '📊 Estado', value: `${statusEmoji} ${statusText}`, inline: true },
                { name: '👮 Revisado por', value: `<@${interaction.user.id}>`, inline: true },
                { name: '📝 Razón', value: reason, inline: false }
              )
              .setTimestamp();

            await interaction.message.edit({ embeds: [staffEmbed], components: [] });

            await db.updateSuggestionStatus(suggestionId, dbStatus, interaction.user.id, reason);

            await db.addAuditLog('SUGGESTION_REVIEW', suggestionData.odId, null, interaction.user.id, {
              suggestionId,
              status: dbStatus,
              reason
            });

            await interaction.editReply({ content: `✅ Sugerencia marcada como **${statusText}**.` });
          } catch (error) {
            console.error('Error actualizando sugerencia:', error);
            await interaction.editReply({ content: '❌ Hubo un error al actualizar la sugerencia.' });
          }
        } catch (error) {
          console.error('Error en modal de razón:', error);
          await interaction.editReply({ content: '❌ Error procesando la revisión.' }).catch(() => {});
        }
        return;
      }

      if (interaction.isButton()) {
        const customId = interaction.customId;
        
        if (customId.startsWith('sug_accept_') || customId.startsWith('sug_reject_') || customId.startsWith('sug_indefinite_')) {
          const interactionKey = `sugbtn_${interaction.id}`;
          if (processedInteractions.has(interactionKey)) return;
          processedInteractions.add(interactionKey);
          cleanupProcessedInteractions();

          const hasStaffRole = interaction.member.roles.cache.has(STAFF_ROLE_ID);
          if (!hasStaffRole) {
            return interaction.reply({ content: '❌ Solo el staff puede revisar sugerencias.', ephemeral: true });
          }

          const parts = customId.split('_');
          const action = parts[1];
          const suggestionId = parts.slice(2).join('_');

          const suggestionData = await db.getSuggestion(suggestionId);
          if (!suggestionData) {
            return interaction.reply({ content: '❌ No se encontró la sugerencia en la base de datos.', ephemeral: true });
          }

          if (suggestionData.status !== 'pending') {
            return interaction.reply({ content: '❌ Esta sugerencia ya fue revisada.', ephemeral: true });
          }

          let actionText = action === 'accept' ? 'Aceptar' : (action === 'reject' ? 'Rechazar' : 'Marcar como Indefinida');

          const modal = new ModalBuilder()
            .setCustomId(`sug_reason_${action}_${suggestionId}`)
            .setTitle(`${actionText} Sugerencia`);
          
          const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Razón de tu decisión')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Escribe la razón...')
            .setMaxLength(500)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
          await interaction.showModal(modal);
        }
      }
    } catch (error) {
      console.error('Error en sistema de sugerencias:', error);
      if (!interaction.replied && !interaction.deferred) {
        interaction.reply({ content: '❌ Ocurrió un error.', ephemeral: true }).catch(() => {});
      }
    }
  });
};
