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
const { Suggestion } = require('./database');

const GUILD_ID = '1212886282645147768';
const SUGGESTIONS_CHANNEL_ID = '1440873532580954112';
const STAFF_REVIEW_CHANNEL_ID = '1435091853308461179';
const STAFF_ROLE_ID = '1230949715127042098';
const SUGGESTER_ROLE_ID = '1313716079998140536';

const SUGGESTION_ICON = 'attachment://suggestion_icon.gif';
const ICON_PATH = path.join(__dirname, 'suggestion_icon.gif');

module.exports = (client) => {
  client.once('ready', async () => {
    console.log('✅ Sistema de Sugerencias cargado (MongoDB)');

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
        } else {
          console.log('✅ Comando /sugerir ya existe');
        }
      }
    } catch (error) {
      console.error('Error registrando comandos de sugerencias:', error);
    }
  });

  // Detectar mensajes normales en el canal de sugerencias y rechazarlos
  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (message.channelId === SUGGESTIONS_CHANNEL_ID) {
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
      if ((interaction.isChatInputCommand() && interaction.commandName === 'sugerir') || 
          (interaction.isButton() && interaction.customId === 'create_suggestion_btn')) {
        
        const modal = new ModalBuilder()
          .setCustomId(`sugerencia_modal|${interaction.user.id}`)
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
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('sugerencia_modal|')) {
          // Check if this modal submission has already been processed to prevent duplicates
          if (interaction.replied || interaction.deferred) return;

          const title = interaction.fields.getTextInputValue('suggestion_title');
          const description = interaction.fields.getTextInputValue('suggestion_description');
          
          const suggestionId = `sug_${Date.now()}`;

          const publicEmbed = new EmbedBuilder()
            .setTitle(`💡 ${title}`)
            .setDescription(description)
            .setColor(0x3498db)
            .setAuthor({
              name: interaction.user.tag,
              iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            })
            .setThumbnail(SUGGESTION_ICON)
            .addFields(
              { name: '📊 Estado', value: '🔵 Sin revisar', inline: true },
              { name: '👤 Sugerido por', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setFooter({ text: `ID: ${suggestionId}` })
            .setTimestamp();

          const suggestionsChannel = await client.channels.fetch(SUGGESTIONS_CHANNEL_ID).catch(() => null);
          if (!suggestionsChannel) {
            return interaction.reply({ content: '❌ No se encontró el canal de sugerencias.', ephemeral: true });
          }

          let publicMessage;
          const createSugBtn = new ButtonBuilder()
            .setCustomId('create_suggestion_btn')
            .setLabel('Hacer una sugerencia')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💡');
          const publicRow = new ActionRowBuilder().addComponents(createSugBtn);

          if (fs.existsSync(ICON_PATH)) {
            const attachment = new AttachmentBuilder(ICON_PATH, { name: 'suggestion_icon.gif' });
            publicMessage = await suggestionsChannel.send({
              content: '¡Nueva sugerencia!',
              embeds: [publicEmbed],
              files: [attachment],
              components: [publicRow]
            });
          } else {
            publicEmbed.setThumbnail(null);
            publicMessage = await suggestionsChannel.send({ 
              content: '¡Nueva sugerencia!',
              embeds: [publicEmbed],
              components: [publicRow]
            });
          }

          await publicMessage.react('1465220343550578718').catch(() => {}); // verificado (Sí)
          await publicMessage.react('1465219129291051150').catch(() => {}); // negado (No)

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

          const acceptButton = new ButtonBuilder().setCustomId(`sug_accept|${suggestionId}`).setLabel('Aceptar').setStyle(ButtonStyle.Success).setEmoji('✅');
          const rejectButton = new ButtonBuilder().setCustomId(`sug_reject|${suggestionId}`).setLabel('Rechazar').setStyle(ButtonStyle.Danger).setEmoji('❌');
          const indefiniteButton = new ButtonBuilder().setCustomId(`sug_indefinite|${suggestionId}`).setLabel('Indefinido').setStyle(ButtonStyle.Secondary).setEmoji('❓');

          const row = new ActionRowBuilder().addComponents(acceptButton, rejectButton, indefiniteButton);
          const staffChannel = await client.channels.fetch(STAFF_REVIEW_CHANNEL_ID).catch(() => null);
          
          if (staffChannel) {
            await staffChannel.send({ embeds: [staffEmbed], components: [row] });
            
            // Guardar en MongoDB
            await Suggestion.create({
              odId: suggestionId,
              messageId: publicMessage.id,
              content: `**Título:** ${title}\n\n**Descripción:**\n${description}`,
              status: 'pending'
            });
          }

          await interaction.reply({
            content: `✅ Tu sugerencia ha sido enviada correctamente. Puedes verla en <#${SUGGESTIONS_CHANNEL_ID}>`,
            ephemeral: true
          });
        }

        if (interaction.customId.startsWith('sug_reason|')) {
          const parts = interaction.customId.split('|');
          const action = parts[1];
          const suggestionId = parts[2];
          const reason = interaction.fields.getTextInputValue('reason');

          const suggestionData = await Suggestion.findOne({ odId: suggestionId });
          if (!suggestionData) {
            return interaction.reply({ content: '❌ No se encontró la sugerencia en la base de datos.', ephemeral: true });
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

            // Reconstruir el embed original (esto es un compromiso ya que no guardamos todo en DB)
            // En una implementación real, guardaríamos el objeto embed completo.
            const oldEmbed = publicMessage.embeds[0];
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
              .setColor(color)
              .spliceFields(0, 1, { name: '📊 Estado', value: `${statusEmoji} ${statusText}`, inline: true })
              .addFields(
                { name: '👮 Revisado por', value: `<@${interaction.user.id}>`, inline: true },
                { name: '📝 Razón', value: reason, inline: false }
              )
              .setTimestamp();

            await publicMessage.edit({ embeds: [updatedEmbed] });

            // Actualizar mensaje de staff
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

            suggestionData.status = dbStatus;
            await suggestionData.save();

            await interaction.reply({ content: `✅ Sugerencia marcada como **${statusText}**.`, ephemeral: true });
          } catch (error) {
            console.error('Error actualizando sugerencia:', error);
            await interaction.reply({ content: '❌ Hubo un error al actualizar la sugerencia (mensaje original no encontrado o permisos).', ephemeral: true });
          }
        }
      }

      if (interaction.isButton()) {
        if (interaction.customId.startsWith('sug_accept|') || interaction.customId.startsWith('sug_reject|') || interaction.customId.startsWith('sug_indefinite|')) {
          const hasStaffRole = interaction.member.roles.cache.has(STAFF_ROLE_ID);
          if (!hasStaffRole) {
            return interaction.reply({ content: '❌ Solo el staff puede revisar sugerencias.', ephemeral: true });
          }

          const parts = interaction.customId.split('|');
          const action = parts[0].replace('sug_', '');
          const suggestionId = parts[1];

          const suggestionData = await Suggestion.findOne({ odId: suggestionId });
          if (!suggestionData) {
            return interaction.reply({ content: '❌ No se encontró la sugerencia en la base de datos.', ephemeral: true });
          }

          let actionText = action === 'accept' ? 'Aceptar' : (action === 'reject' ? 'Rechazar' : 'Indefinida');

          const modal = new ModalBuilder().setCustomId(`sug_reason|${action}|${suggestionId}`).setTitle(`${actionText} Sugerencia`);
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
    }
  });
};
