// postulaciones.js
// SirgioBOT - Sistema de Postulaciones completo (único archivo)
// Requisitos: discord.js v14, Node 18+
// IMPORTANT: set process.env.TOKEN (o usa client.token) y opcionalmente process.env.GUILD_ID

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
const PANEL_CHANNEL_ID = '1435093988196618383';      // canal donde se puede usar /panelpostulaciones y /postular
const STAFF_ROLE_ID = '1212891335929897030';         // rol que puede usar /panelpostulaciones
let postulacionesAbiertas = false;

const COMMANDS = [
  new SlashCommandBuilder()
    .setName('panelpostulaciones')
    .setDescription('Envía el panel con las categorías de postulación.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild), // solo staff
  new SlashCommandBuilder()
    .setName('abrirpostulaciones')
    .setDescription('Abre las postulaciones para todos.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild), // solo staff
  new SlashCommandBuilder()
    .setName('cerrarpostulaciones')
    .setDescription('Cierra las postulaciones.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild), // solo staff
  new SlashCommandBuilder()
    .setName('postular')
    .setDescription('Postularse a una categoría.')
    .addStringOption(opt =>
      opt.setName('categoria')
        .setDescription('Selecciona la categoría')
        .setRequired(true)
        .addChoices(
          { name: 'Twitch MOD', value: 'twitch' },
          { name: 'TikTok MOD', value: 'tiktok' },
          { name: 'Discord Programador', value: 'programador' },
          { name: 'Editor de Sirgio', value: 'editor' },
          { name: 'Discord Helper', value: 'helper' },
        )
    )
    // 🔹 Aquí NO ponemos permisos, así todos pueden usarlo
].map(c => c.toJSON());

    .addStringOption(opt => 
      opt.setName('categoria')
         .setDescription('Selecciona la categoría')
         .setRequired(true)
         .addChoices(
           { name: 'Twitch MOD', value: 'twitch' },
           { name: 'TikTok MOD', value: 'tiktok' },
           { name: 'Discord Programador', value: 'programador' },
           { name: 'Editor de Sirgio', value: 'editor' },
           { name: 'Discord Helper', value: 'helper' },
         )
    )
].map(c => c.toJSON());

// Este módulo exporta una función que inicializa el sistema en tu client
module.exports = async (client) => {
  // Registrar comandos (guild si GUILD_ID existe, si no global)
  client.once('ready', async () => {
    try {
      const rest = new REST({ version: '10' }).setToken(process.env.TOKEN || client.token);
      if (process.env.GUILD_ID) {
        await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID), { body: COMMANDS });
        console.log('Comandos registrados en guild', process.env.GUILD_ID);
      } else {
        await rest.put(Routes.applicationCommands(client.user.id), { body: COMMANDS });
        console.log('Comandos registrados globalmente (puede tardar en propagarse).');
      }
    } catch (err) {
      console.error('Error registrando comandos:', err);
    }
    console.log(`${client.user.tag} listo.`);
  });

  // Construcción de embeds de panel (banners y colores según lo pedido)
  function buildPanelEmbeds() {
    const arr = [];

    arr.push(new EmbedBuilder()
      .setTitle('🎥 Twitch MOD')
      .setDescription([
        '**Requisitos para poder postularse:**',
        '• Tener 15 años.',
        '• Ser activo en los directos de Twitch.',
        '• Tener criterio.',
        '• No ser tóxico.',
        '• Followage mínimo de 6 meses.',
        '• Tener la madurez para conllevar conflictos en el chat.',
        '• Tener experiencia moderando en Twitch.'
      ].join('\n'))
      .setImage('https://media.discordapp.net/attachments/1420914042251509990/1435393164000104628/58_sin_titulo_20251104154707.png')
      .setColor(0x9b59b6)
    );

    arr.push(new EmbedBuilder()
      .setTitle('📱 TikTok MOD')
      .setDescription([
        '**Requisitos para poder postularse:**',
        '• Tener 14 años.',
        '• Ser activo en los directos de TikTok.',
        '• Tener criterio.',
        '• No ser tóxico.',
        '• Followage mínimo de 3 meses.',
        '• Tener la madurez para conllevar conflictos en el chat.'
      ].join('\n'))
      .setImage('https://media.discordapp.net/attachments/1420914042251509990/1435393163559698583/58_sin_titulo_20251104155824.png')
      .setColor(0x00ffff)
    );

    arr.push(new EmbedBuilder()
      .setTitle('💻 Discord Programador')
      .setDescription([
        '**Requisitos para poder postularse:**',
        '• Tener 15 años.',
        '• Ser activo en la comunidad de Discord.',
        '• Tener conocimientos en JavaScript y/o Node.js.',
        '• Experiencia programando bots de Discord.'
      ].join('\n'))
      .setImage('https://media.discordapp.net/attachments/1420914042251509990/1435393162913779744/58_sin_titulo_20251104160615.png')
      .setColor(0x000000)
    );

    arr.push(new EmbedBuilder()
      .setTitle('🎬 Editor de Sirgio')
      .setDescription([
        '**Requisitos para poder postularse:**',
        '• Tener 16 años.',
        '• Ser activo en la comunidad de Discord.',
        '• Tener conocimientos en edición de streams a videos.',
        '• Tener disponibilidad cuando sea necesario.'
      ].join('\n'))
      .setImage('https://media.discordapp.net/attachments/1420914042251509990/1435393163216027781/58_sin_titulo_20251104160431.png')
      .setColor(0xff8c00)
    );

    arr.push(new EmbedBuilder()
      .setTitle('📘 Discord Helper')
      .setDescription([
        '**Requisitos para poder postularse:**',
        '• Tener 15 años.',
        '• Ser activo en la comunidad de Discord.',
        '• Virtudes como: Paciencia, Responsabilidad.',
        '• Tener 3 meses de antigüedad en el Servidor.',
        '',
        '**Para poder ascender a Discord MOD:**',
        '• Tener experiencia moderando servidores de Discord.',
        '• Tener 17 años.',
        '• Saber cómo atender tickets correctamente.',
        '• Tener 6 meses de antigüedad en el servidor.',
        '• Virtudes: Paciencia, Responsabilidad, Madurez, Resolución de problemas, trabajo en equipo.',
        '• Antigüedad mínima de 5 meses como Helper.',
        '',
        '*Incluyendo todos los requisitos de Helper*',
        '',
        '⚠️ Los postulantes se someterán a un periodo de prueba de 7 días aproximadamente para evaluar su desempeño con el rol.'
      ].join('\n'))
      .setImage('https://media.discordapp.net/attachments/1420914042251509990/1435393162561454220/58_sin_titulo_20251104161848.png')
      .setColor(0x3498db)
    );

    return arr;
  }

  // Maneja abrir/cerrar postu y comandos principales + botones/modals
  client.on('interactionCreate', async (interaction) => {
    try {
      // -----------------------
      // Chat Input Commands
      // -----------------------
      if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        // /panelpostulaciones - solo staff role y solo en canal PANEL_CHANNEL_ID
        if (commandName === 'panelpostulaciones') {
          if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
            return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', ephemeral: true });
          }
          if (interaction.channelId !== PANEL_CHANNEL_ID) {
            return interaction.reply({ content: `❌ Este comando solo puede usarse en <#${PANEL_CHANNEL_ID}>.`, ephemeral: true });
          }

          await interaction.deferReply({ ephemeral: true });

          const embeds = buildPanelEmbeds();
          // mandamos los embeds en un solo mensaje por simplicidad (si prefieres separados, se puede cambiar)
          for (const e of embeds) {
            await interaction.channel.send({ embeds: [e] });
          }

          // mensaje plano con pasos (no embed)
          await interaction.channel.send(
            '⚠️ **Pasos a seguir** ⚠️\n1. En este mismo canal deberás usar el comando **/postular** y elegir la categoría.\n2. Leer y rellenar el formulario con la información pedida.'
          );

          return interaction.editReply({ content: '✅ Panel de postulaciones enviado.' });
        }

        // /abrirpostulaciones
        if (commandName === 'abrirpostulaciones') {
          if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
            return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', ephemeral: true });
          }
          postulacionesAbiertas = true;
          return interaction.reply({ content: '✅ Las postulaciones se han abierto. /postular disponible en <#' + PANEL_CHANNEL_ID + '>.', ephemeral: true });
        }

        // /cerrarpostulaciones
        if (commandName === 'cerrarpostulaciones') {
          if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
            return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', ephemeral: true });
          }
          postulacionesAbiertas = false;
          return interaction.reply({ content: '❌ Las postulaciones se han cerrado.', ephemeral: true });
        }

        // /postular
        if (commandName === 'postular') {
          // validamos canal
          if (interaction.channelId !== PANEL_CHANNEL_ID) {
            return interaction.reply({ content: `❌ El comando /postular solo funciona en <#${PANEL_CHANNEL_ID}>.`, ephemeral: true });
          }
          // si no están abiertas, solo staff puede usarlo
          if (!postulacionesAbiertas && !interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
            return interaction.reply({ content: '🚫 Las postulaciones están cerradas actualmente.', ephemeral: true });
          }

          const categoria = interaction.options.getString('categoria');
          if (!categoria) return interaction.reply({ content: '❌ Debes elegir una categoría.', ephemeral: true });

          // abrir modal con preguntas (labels <= 45 chars)
          const modal = new ModalBuilder().setCustomId(`postu_modal::${categoria}`).setTitle(`Postulación — ${categoria.toUpperCase()}`);

          const in1 = new TextInputBuilder().setCustomId('q_name').setLabel('Tu nombre/apodo') .setStyle(TextInputStyle.Short).setRequired(false);
          const in2 = new TextInputBuilder().setCustomId('q_age').setLabel('Edad') .setStyle(TextInputStyle.Short).setRequired(false);
          const in3 = new TextInputBuilder().setCustomId('q_exp').setLabel('¿Experiencia en esta área?') .setStyle(TextInputStyle.Paragraph).setRequired(false);
          const in4 = new TextInputBuilder().setCustomId('q_time').setLabel('Tiempo semanal disponible') .setStyle(TextInputStyle.Short).setRequired(false);

          // pregunta específica por categoría
          const extraLabel = categoria === 'twitch'
            ? '¿Qué harías si alguien spamea o causa peleas?'
            : categoria === 'tiktok'
              ? '¿Tienes experiencia moderando chats en directo?'
              : categoria === 'programador'
                ? '¿Lenguajes o proyectos que manejas?'
                : categoria === 'editor'
                  ? '¿Programas que usas para editar?'
                  : '¿Qué harías si un usuario necesita ayuda y no hay staff?';

          const in5 = new TextInputBuilder().setCustomId('q_extra').setLabel(extraLabel).setStyle(TextInputStyle.Paragraph).setRequired(false);

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

        // construir mensaje plano (no embed) para canal staff
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

        // botones aceptar / rechazar
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`aceptar::${interaction.user.id}::${interaction.id}`).setLabel('Aceptar').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`rechazar::${interaction.user.id}::${interaction.id}`).setLabel('Rechazar').setStyle(ButtonStyle.Danger)
        );

        const postChannel = await client.channels.fetch(POST_CHANNEL_ID).catch(() => null);
        if (!postChannel) {
          await interaction.reply({ content: '❌ Error: canal de postulaciones no encontrado. Avisar al admin.', ephemeral: true });
          return;
        }

        const sent = await postChannel.send({ content: texto, components: [row] });
        // guardamos message id en customId (ya incluimos interaction.id para referencia)
        await interaction.reply({ content: '✅ Tu postulación fue enviada correctamente.', ephemeral: true });
        return;
      }

      // -----------------------
      // Botones Aceptar / Rechazar en canal staff
      // -----------------------
      if (interaction.isButton() && (interaction.customId.startsWith('aceptar::') || interaction.customId.startsWith('rechazar::'))) {
        // Solo miembros con rol staff pueden tomar acción (o con permisos ManageGuild)
        const member = interaction.member;
        if (!member.roles.cache.has(STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ content: '❌ No tienes permiso para realizar esta acción.', ephemeral: true });
        }

        const parts = interaction.customId.split('::'); // [accion, userId, originInteractionId]
        const accion = parts[0]; // 'aceptar' o 'rechazar'
        const userId = parts[1];
        const originInteractionId = parts[2];

        // Mostrar modal para motivo/carta del staff
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
        // formato: staff_motivo::accion::userId::messageId
        const parts = interaction.customId.split('::');
        const accion = parts[1]; // aceptar / rechazar
        const targetUserId = parts[2];
        const messageId = parts[3];

        const motivo = interaction.fields.getTextInputValue('staff_motivo_text') || 'Sin motivo especificado.';

        // intentar buscar mensaje original y deshabilitar botones
        try {
          const ch = await client.channels.fetch(POST_CHANNEL_ID);
          if (ch) {
            const msg = await ch.messages.fetch(messageId).catch(() => null);
            if (msg && msg.components && msg.components.length) {
              // crear botones deshabilitados
              const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('disabled').setLabel('Aceptar').setStyle(ButtonStyle.Success).setDisabled(true),
                new ButtonBuilder().setCustomId('disabled').setLabel('Rechazar').setStyle(ButtonStyle.Danger).setDisabled(true)
              );
              await msg.edit({ components: [disabledRow] }).catch(() => {});
            }
          }
        } catch (e) {
          // no crítico
        }

        // enviar DM al postulante con embed verde/rojo
        const targetUser = await client.users.fetch(targetUserId).catch(() => null);
        const color = accion === 'aceptar' ? 0x2ecc71 : 0xe74c3c;
        const title = accion === 'aceptar' ? '✅ Postulación Aceptada' : '❌ Postulación Rechazada';

        const dmEmbed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(`Tu postulación ha sido **${accion === 'aceptar' ? 'aceptada' : 'rechazada'}**.\n\n**Carta del staff:**\n${motivo}`)
          .setColor(color)
          .setTimestamp();

        if (targetUser) {
          await targetUser.send({ embeds: [dmEmbed] }).catch(() => {
            console.log('No se pudo DM a', targetUserId);
          });
        }

        await interaction.reply({ content: `✅ Postulación ${accion === 'aceptar' ? 'aceptada' : 'rechazada'} y usuario notificado.`, ephemeral: true });
      }

    } catch (err) {
      console.error('Error en interactionCreate (postulaciones):', err);
      if (interaction && !interaction.replied && !interaction.deferred) {
        try { await interaction.reply({ content: 'Ocurrió un error interno.', ephemeral: true }); } catch (e) {}
      }
    }
  });
};
