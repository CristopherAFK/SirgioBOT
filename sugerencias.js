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

const GUILD_ID = '1212886282645147768';
const SUGGESTIONS_CHANNEL_ID = '1440873532580954112';
const STAFF_REVIEW_CHANNEL_ID = '1435091853308461179';
const STAFF_ROLE_ID = '1230949715127042098';
const SUGGESTER_ROLE_ID = '1313716079998140536';

const SUGGESTION_ICON = 'attachment://suggestion_icon.gif';
const ICON_PATH = path.join(__dirname, 'suggestion_icon.gif');
const DATA_FILE = path.join(__dirname, 'suggestions.json');

let suggestionsData = { lastId: 0, suggestions: {} };

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      suggestionsData = JSON.parse(raw);
      if (!suggestionsData.lastId) suggestionsData.lastId = 0;
      if (!suggestionsData.suggestions) suggestionsData.suggestions = {};
      console.log(`📁 suggestions.json cargado (${Object.keys(suggestionsData.suggestions).length} sugerencias)`);
    } else {
      saveData();
    }
  } catch (err) {
    console.error('⚠️ Error leyendo suggestions.json:', err);
    suggestionsData = { lastId: 0, suggestions: {} };
    saveData();
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(suggestionsData, null, 2));
  } catch (err) {
    console.error('⚠️ Error guardando suggestions.json:', err);
  }
}

module.exports = (client) => {
  loadData();

  client.once('ready', async () => {
    console.log('✅ Sistema de Sugerencias cargado');

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
      // Ignorar bots
      if (message.author.bot) return;
      
      // Verificar si el mensaje está en el canal de sugerencias
      if (message.channelId === SUGGESTIONS_CHANNEL_ID) {
        // Borrar el mensaje de inmediato
        try {
          await message.delete();
        } catch (e) {
          console.error("Error al borrar mensaje en sugerencias:", e);
        }
        
        // Enviar mensaje privado al usuario
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
        const hasRole = interaction.member.roles.cache.has(SUGGESTER_ROLE_ID);
        
        if (!hasRole) {
          return interaction.reply({
            content: '❌ No tienes el rol necesario para hacer sugerencias.',
            ephemeral: true
          });
        }

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
          const title = interaction.fields.getTextInputValue('suggestion_title');
          const description = interaction.fields.getTextInputValue('suggestion_description');
          
          suggestionsData.lastId++;
          const suggestionId = `sug_${suggestionsData.lastId}`;

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
            return interaction.reply({
              content: '❌ No se encontró el canal de sugerencias.',
              ephemeral: true
            });
          }

          let publicMessage;
          
          if (fs.existsSync(ICON_PATH)) {
            const attachment = new AttachmentBuilder(ICON_PATH, { name: 'suggestion_icon.gif' });
            publicMessage = await suggestionsChannel.send({
              content: '¡Nueva sugerencia!',
              embeds: [publicEmbed],
              files: [attachment]
            });
          } else {
            publicEmbed.setThumbnail(null);
            publicMessage = await suggestionsChannel.send({ 
              content: '¡Nueva sugerencia!',
              embeds: [publicEmbed] 
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

          const acceptButton = new ButtonBuilder()
            .setCustomId(`sug_accept|${suggestionId}`)
            .setLabel('Aceptar')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅');

          const rejectButton = new ButtonBuilder()
            .setCustomId(`sug_reject|${suggestionId}`)
            .setLabel('Rechazar')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌');

          const indefiniteButton = new ButtonBuilder()
            .setCustomId(`sug_indefinite|${suggestionId}`)
            .setLabel('Indefinido')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❓');

          const row = new ActionRowBuilder().addComponents(acceptButton, rejectButton, indefiniteButton);

          const staffChannel = await client.channels.fetch(STAFF_REVIEW_CHANNEL_ID).catch(() => null);
          if (staffChannel) {
            const staffMessage = await staffChannel.send({
              embeds: [staffEmbed],
              components: [row]
            });

            suggestionsData.suggestions[suggestionId] = {
              title,
              description,
              userId: interaction.user.id,
              userTag: interaction.user.tag,
              userAvatar: interaction.user.displayAvatarURL({ dynamic: true }),
              publicMessageId: publicMessage.id,
              publicChannelId: suggestionsChannel.id,
              staffMessageId: staffMessage.id,
              staffChannelId: staffChannel.id,
              status: 'pending',
              createdAt: new Date().toISOString()
            };
            saveData();
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

          const suggestion = suggestionsData.suggestions[suggestionId];
          if (!suggestion) {
            return interaction.reply({
              content: '❌ No se encontró la sugerencia.',
              ephemeral: true
            });
          }

          let statusText, statusEmoji, color;
          if (action === 'accept') {
            statusText = 'Aceptada';
            statusEmoji = '🟢';
            color = 0x2ecc71;
          } else if (action === 'reject') {
            statusText = 'Rechazada';
            statusEmoji = '🔴';
            color = 0xe74c3c;
          } else {
            statusText = 'Indefinida';
            statusEmoji = '🟠';
            color = 0xf39c12;
          }

          try {
            const publicChannel = await client.channels.fetch(suggestion.publicChannelId);
            const publicMessage = await publicChannel.messages.fetch(suggestion.publicMessageId);

            const updatedEmbed = new EmbedBuilder()
              .setTitle(`💡 ${suggestion.title}`)
              .setDescription(suggestion.description)
              .setColor(color)
              .setAuthor({
                name: suggestion.userTag,
                iconURL: suggestion.userAvatar
              })
              .setThumbnail(fs.existsSync(ICON_PATH) ? SUGGESTION_ICON : null)
              .addFields(
                { name: '📊 Estado', value: `${statusEmoji} ${statusText}`, inline: true },
                { name: '👤 Sugerido por', value: `<@${suggestion.userId}>`, inline: true },
                { name: '👮 Revisado por', value: `<@${interaction.user.id}>`, inline: true },
                { name: '📝 Razón', value: reason, inline: false }
              )
              .setFooter({ text: `ID: ${suggestionId}` })
              .setTimestamp();

            if (fs.existsSync(ICON_PATH)) {
              const attachment = new AttachmentBuilder(ICON_PATH, { name: 'suggestion_icon.gif' });
              await publicMessage.edit({
                embeds: [updatedEmbed],
                files: [attachment]
              });
            } else {
              await publicMessage.edit({ embeds: [updatedEmbed] });
            }

            const staffChannel = await client.channels.fetch(suggestion.staffChannelId);
            const staffMessage = await staffChannel.messages.fetch(suggestion.staffMessageId);

            const staffUpdatedEmbed = new EmbedBuilder()
              .setTitle(`📋 Sugerencia Revisada`)
              .setDescription(`**Título:** ${suggestion.title}\n\n**Descripción:**\n${suggestion.description}`)
              .setColor(color)
              .setAuthor({
                name: suggestion.userTag,
                iconURL: suggestion.userAvatar
              })
              .addFields(
                { name: '📊 Estado', value: `${statusEmoji} ${statusText}`, inline: true },
                { name: '👮 Revisado por', value: `<@${interaction.user.id}>`, inline: true },
                { name: '📝 Razón', value: reason, inline: false }
              )
              .setFooter({ text: `ID: ${suggestionId}` })
              .setTimestamp();

            await staffMessage.edit({
              embeds: [staffUpdatedEmbed],
              components: []
            });

            suggestion.status = action;
            suggestion.reviewedBy = interaction.user.id;
            suggestion.reviewedAt = new Date().toISOString();
            suggestion.reason = reason;
            suggestionsData.suggestions[suggestionId] = suggestion;
            saveData();

            await interaction.reply({
              content: `✅ Sugerencia marcada como **${statusText}**.`,
              ephemeral: true
            });

          } catch (error) {
            console.error('Error actualizando sugerencia:', error);
            await interaction.reply({
              content: '❌ Hubo un error al actualizar la sugerencia.',
              ephemeral: true
            });
          }
        }
      }

      if (interaction.isButton()) {
        if (interaction.customId.startsWith('sug_accept|') ||
            interaction.customId.startsWith('sug_reject|') ||
            interaction.customId.startsWith('sug_indefinite|')) {

          const hasStaffRole = interaction.member.roles.cache.has(STAFF_ROLE_ID);
          if (!hasStaffRole) {
            return interaction.reply({
              content: '❌ Solo el staff puede revisar sugerencias.',
              ephemeral: true
            });
          }

          const parts = interaction.customId.split('|');
          const action = parts[0].replace('sug_', '');
          const suggestionId = parts[1];

          const suggestion = suggestionsData.suggestions[suggestionId];
          if (!suggestion) {
            return interaction.reply({
              content: '❌ No se encontró la sugerencia en el sistema.',
              ephemeral: true
            });
          }

          if (suggestion.status !== 'pending') {
            return interaction.reply({
              content: '❌ Esta sugerencia ya ha sido revisada.',
              ephemeral: true
            });
          }

          let actionText;
          if (action === 'accept') actionText = 'Aceptar';
          else if (action === 'reject') actionText = 'Rechazar';
          else actionText = 'Marcar como Indefinida';

          const modal = new ModalBuilder()
            .setCustomId(`sug_reason|${action}|${suggestionId}`)
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
    }
  });
};
