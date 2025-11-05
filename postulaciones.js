// postulaciones.js
// SirgioBOT - Sistema de Postulaciones completo (único archivo)
// Requisitos: discord.js v14, Node 18+

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
} = require('discord.js');

const POST_CHANNEL_ID = '1435091853308461179';       // canal donde llegan postulaciones (staff)
const PANEL_CHANNEL_ID = '1435093988196618383';      // canal donde se puede usar /postular
const STAFF_ROLE_1 = '1212891335929897030';          // staff principal
const STAFF_ROLE_2 = '1229140504310972599';          // staff secundario autorizado
let postulacionesAbiertas = false;

// =============================
// Comandos slash
// =============================
const COMMANDS = [
  new SlashCommandBuilder()
    .setName('abrirpostulaciones')
    .setDescription('Abre las postulaciones para todos.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('cerrarpostulaciones')
    .setDescription('Cierra las postulaciones.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('postular')
    .setDescription('Postúlate a una categoría.')
    .addStringOption(opt =>
      opt
        .setName('categoria')
        .setDescription('Selecciona la categoría')
        .setRequired(true)
        .addChoices(
          { name: 'Twitch MOD', value: 'twitch' },
          { name: 'TikTok MOD', value: 'tiktok' },
          { name: 'Discord Programador', value: 'programador' },
          { name: 'Editor de Sirgio', value: 'editor' },
          { name: 'Discord Helper', value: 'helper' }
        )
    ),
].map(c => c.toJSON());

// =============================
// Export principal
// =============================
module.exports = async (client) => {
  // Registrar comandos (guild si existe GUILD_ID)
  client.once('ready', async () => {
    try {
      const rest = new REST({ version: '10' }).setToken(process.env.TOKEN || client.token);
      if (process.env.GUILD_ID) {
        await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID), { body: COMMANDS });
        console.log('✅ Comandos registrados en guild', process.env.GUILD_ID);
      } else {
        await rest.put(Routes.applicationCommands(client.user.id), { body: COMMANDS });
        console.log('✅ Comandos registrados globalmente.');
      }
    } catch (err) {
      console.error('Error registrando comandos:', err);
    }
    console.log(`${client.user.tag} listo.`);
  });

  // =============================
  // Sistema principal
  // =============================
  client.on('interactionCreate', async (interaction) => {
    try {
      // -----------------------
      // Slash Commands
      // -----------------------
      if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        // /abrirpostulaciones
        if (commandName === 'abrirpostulaciones') {
          if (!interaction.member.roles.cache.has(STAFF_ROLE_1) && !interaction.member.roles.cache.has(STAFF_ROLE_2)) {
            return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', ephemeral: true });
          }
          postulacionesAbiertas = true;
          return interaction.reply({ content: '✅ Las postulaciones se han abierto. /postular disponible en <#' + PANEL_CHANNEL_ID + '>.', ephemeral: true });
        }

        // /cerrarpostulaciones
        if (commandName === 'cerrarpostulaciones') {
          if (!interaction.member.roles.cache.has(STAFF_ROLE_1) && !interaction.member.roles.cache.has(STAFF_ROLE_2)) {
            return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', ephemeral: true });
          }
          postulacionesAbiertas = false;
          return interaction.reply({ content: '❌ Las postulaciones se han cerrado.', ephemeral: true });
        }

        // /postular
        if (commandName === 'postular') {
          if (interaction.channelId !== PANEL_CHANNEL_ID) {
            return interaction.reply({ content: `❌ El comando /postular solo funciona en <#${PANEL_CHANNEL_ID}>.`, ephemeral: true });
          }

          // ✅ ahora si están abiertas, cualquiera puede usarlo
          if (!postulacionesAbiertas && !interaction.member.roles.cache.has(STAFF_ROLE_1) && !interaction.member.roles.cache.has(STAFF_ROLE_2)) {
            return interaction.reply({ content: '🚫 Las postulaciones están cerradas actualmente.', ephemeral: true });
          }

          const categoria = interaction.options.getString('categoria');
          const modal = new ModalBuilder()
            .setCustomId(`postu_modal::${categoria}`)
            .setTitle(`Postulación — ${categoria.toUpperCase()}`);

          const in1 = new TextInputBuilder().setCustomId('q_name').setLabel('Tu nombre/apodo').setStyle(TextInputStyle.Short);
          const in2 = new TextInputBuilder().setCustomId('q_age').setLabel('Edad').setStyle(TextInputStyle.Short);
          const in3 = new TextInputBuilder().setCustomId('q_exp').setLabel('¿Experiencia en esta área?').setStyle(TextInputStyle.Paragraph);
          const in4 = new TextInputBuilder().setCustomId('q_time').setLabel('Tiempo semanal disponible').setStyle(TextInputStyle.Short);

          const extraLabel =
            categoria === 'twitch'
              ? '¿Qué harías si alguien spamea o causa peleas?'
              : categoria === 'tiktok'
              ? '¿Tienes experiencia moderando chats en directo?'
              : categoria === 'programador'
              ? '¿Lenguajes o proyectos que manejas?'
              : categoria === 'editor'
              ? '¿Programas que usas para editar?'
              : '¿Qué harías si un usuario necesita ayuda y no hay staff?';

          const in5 = new TextInputBuilder().setCustomId('q_extra').setLabel(extraLabel).setStyle(TextInputStyle.Paragraph);

          modal.addComponents(
            new ActionRowBuilder().addComponents(in1),
            new ActionRowBuilder().addComponents(in2),
            new ActionRowBuilder().addComponents(in3),
            new ActionRowBuilder().addComponents(in4),
            new ActionRowBuilder().addComponents(in5)
          );

          return interaction.showModal(modal);
        }
      }

      // -----------------------
      // Modal submit (postulación)
      // -----------------------
      if (interaction.isModalSubmit() && interaction.customId.startsWith('postu_modal::')) {
        const categoria = interaction.customId.split('::')[1];
        const name = interaction.fields.getTextInputValue('q_name') || 'No respondió';
        const age = interaction.fields.getTextInputValue('q_age') || 'No respondió';
        const exp = interaction.fields.getTextInputValue('q_exp') || 'No respondió';
        const time = interaction.fields.getTextInputValue('q_time') || 'No respondió';
        const extra = interaction.fields.getTextInputValue('q_extra') || 'No respondió';

        const texto = [
          `📨 **Nueva Postulación - ${categoria.toUpperCase()}**`,
          `👤 Usuario: ${interaction.user.tag} (${interaction.user.id})`,
          '',
          `• Nombre/apodo: ${name}`,
          `• Edad: ${age}`,
          `• Experiencia: ${exp}`,
          `• Tiempo disponible: ${time}`,
          `• Extra: ${extra}`
        ].join('\n');

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`aceptar::${interaction.user.id}::${interaction.id}`).setLabel('Aceptar').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`rechazar::${interaction.user.id}::${interaction.id}`).setLabel('Rechazar').setStyle(ButtonStyle.Danger)
        );

        const postChannel = await client.channels.fetch(POST_CHANNEL_ID).catch(() => null);
        if (!postChannel) return interaction.reply({ content: '❌ Error: canal no encontrado.', ephemeral: true });

        await postChannel.send({ content: texto, components: [row] });
        await interaction.reply({ content: '✅ Tu postulación fue enviada correctamente.', ephemeral: true });
        return;
      }

      // -----------------------
      // Botones Aceptar / Rechazar
      // -----------------------
      if (interaction.isButton() && (interaction.customId.startsWith('aceptar::') || interaction.customId.startsWith('rechazar::'))) {
        const member = interaction.member;
        if (
          !member.roles.cache.has(STAFF_ROLE_1) &&
          !member.roles.cache.has(STAFF_ROLE_2) &&
          !member.permissions.has(PermissionFlagsBits.ManageGuild)
        ) {
          return interaction.reply({ content: '❌ No tienes permiso para realizar esta acción.', ephemeral: true });
        }

        const parts = interaction.customId.split('::');
        const accion = parts[0];
        const userId = parts[1];
        const originId = parts[2];

        // Verificar si ya fue gestionada
        if (interaction.message.components[0].components[0].data.disabled) {
          return interaction.reply({ content: '⚠️ Esta postulación ya fue gestionada por otro miembro del staff.', ephemeral: true });
        }

        const modal = new ModalBuilder()
          .setCustomId(`staff_motivo::${accion}::${userId}::${interaction.message.id}`)
          .setTitle(accion === 'aceptar' ? 'Aceptar Postulación' : 'Rechazar Postulación');

        const motivoInput = new TextInputBuilder()
          .setCustomId('staff_motivo_text')
          .setLabel('Carta o motivo (opcional)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(motivoInput));
        return interaction.showModal(modal);
      }

      // -----------------------
      // Modal submit (motivo staff)
      // -----------------------
      if (interaction.isModalSubmit() && interaction.customId.startsWith('staff_motivo::')) {
        const parts = interaction.customId.split('::');
        const accion = parts[1];
        const targetUserId = parts[2];
        const messageId = parts[3];

        const motivo = interaction.fields.getTextInputValue('staff_motivo_text') || 'Sin motivo especificado.';

        try {
          const ch = await client.channels.fetch(POST_CHANNEL_ID);
          if (ch) {
            const msg = await ch.messages.fetch(messageId).catch(() => null);
            if (msg && msg.components?.length) {
              const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Aceptar').setStyle(ButtonStyle.Success).setDisabled(true),
                new ButtonBuilder().setLabel('Rechazar').setStyle(ButtonStyle.Danger).setDisabled(true)
              );
              await msg.edit({ components: [disabledRow] }).catch(() => {});
            }
          }
        } catch {}

        const targetUser = await client.users.fetch(targetUserId).catch(() => null);
        const color = accion === 'aceptar' ? 0x2ecc71 : 0xe74c3c;
        const title = accion === 'aceptar' ? '✅ Postulación Aceptada' : '❌ Postulación Rechazada';

        const dmEmbed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(`Tu postulación ha sido **${accion === 'aceptar' ? 'aceptada' : 'rechazada'}**.\n\n**Carta del staff:**\n${motivo}`)
          .setColor(color)
          .setTimestamp();

        if (targetUser) await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});

        await interaction.reply({ content: `✅ Postulación ${accion === 'aceptar' ? 'aceptada' : 'rechazada'} y usuario notificado.`, ephemeral: true });
      }

    } catch (err) {
      console.error('Error en interactionCreate (postulaciones):', err);
      if (interaction && !interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ content: 'Ocurrió un error interno.', ephemeral: true });
        } catch {}
      }
    }
  });
};
