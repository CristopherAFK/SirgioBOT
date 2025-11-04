const { Client, GatewayIntentBits, Partials, EmbedBuilder, SlashCommandBuilder, Routes, REST, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// ==================== CONFIG ====================
const TOKEN = process.env.TOKEN; // ya lo tienes en Render
const CLIENT_ID = '1420178410512060437';
const GUILD_ID = '1212886282645147768'; // pon tu ID del servidor

const canalPostulaciones = '1435091853308461179'; // donde se enviarán las postulaciones
const canalPanel = '1435093988196618383'; // donde se publica el embed principal
const adminRole = '1212891335929897030';
const modRole = '1229140504310972599';

let postulacionesActivas = true; // puedes ponerlo en false para cerrar

// ==================== COMANDOS ====================
const commands = [
  new SlashCommandBuilder()
    .setName('panelpostulaciones')
    .setDescription('Envía el panel principal de postulaciones (solo staff).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('postular')
    .setDescription('Envía tu solicitud para formar parte del staff.'),

  new SlashCommandBuilder()
    .setName('postulaciones')
    .setDescription('Activa o desactiva las postulaciones (solo staff).')
    .addStringOption(option =>
      option
        .setName('estado')
        .setDescription('Elige activar o desactivar postulaciones')
        .setRequired(true)
        .addChoices(
          { name: 'Activar', value: 'on' },
          { name: 'Desactivar', value: 'off' }
        )
    )
].map(cmd => cmd.toJSON());

// ==================== REGISTRO DE COMANDOS ====================
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🔁 Registrando comandos...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Comandos registrados correctamente.');
  } catch (err) {
    console.error('❌ Error registrando comandos:', err);
  }
})();

// ==================== EVENTOS ====================
client.on('ready', () => {
  console.log(`✅ Bot iniciado como ${client.user.tag}`);
});

// ==================== INTERACCIONES ====================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isModalSubmit()) return;

  // ==================== PANEL DE POSTULACIONES ====================
  if (interaction.commandName === 'panelpostulaciones') {
    if (!interaction.member.roles.cache.has(adminRole) && !interaction.member.roles.cache.has(modRole)) {
      return interaction.reply({ content: '🚫 No tienes permiso para usar este comando.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Postulaciones al Staff')
      .setDescription('¿Quieres ser parte del equipo de moderación? Postúlate con el comando `/postular`.\n\n> ⚠️ Asegúrate de responder con sinceridad y detalle. Las postulaciones sin esfuerzo serán descartadas.')
      .setColor('Aqua')
      .setFooter({ text: 'Equipo de Administración' });

    const canal = await client.channels.fetch(canalPanel);
    await canal.send({ embeds: [embed] });

    return interaction.reply({ content: '✅ Panel de postulaciones enviado correctamente.', ephemeral: true });
  }

  // ==================== ACTIVAR / DESACTIVAR POSTULACIONES ====================
  if (interaction.commandName === 'postulaciones') {
    if (!interaction.member.roles.cache.has(adminRole) && !interaction.member.roles.cache.has(modRole)) {
      return interaction.reply({ content: '🚫 No tienes permiso para usar este comando.', ephemeral: true });
    }

    const estado = interaction.options.getString('estado');
    postulacionesActivas = estado === 'on';
    return interaction.reply({
      content: `✅ Las postulaciones han sido **${postulacionesActivas ? 'activadas' : 'desactivadas'}**.`,
      ephemeral: true
    });
  }

  // ==================== POSTULAR ====================
  if (interaction.commandName === 'postular') {
    if (!postulacionesActivas) {
      return interaction.reply({ content: '🚫 Las postulaciones están cerradas actualmente.', ephemeral: true });
    }

    if (interaction.channelId !== canalPanel) {
      return interaction.reply({ content: '❌ Solo puedes postularte en el canal oficial de postulaciones.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('modalPostulacion')
      .setTitle('Formulario de Postulación');

    const preguntas = [
      { id: 'p1', label: '¿Has tenido experiencia moderando? Si es así, ¿cómo fue? ¿Cuál fue tu rol?', style: TextInputStyle.Paragraph },
      { id: 'p2', label: '¿Tienes amistades en el servidor? Si es así, ¿los sancionarías si incumplen una regla?', style: TextInputStyle.Paragraph },
      { id: 'p3', label: '¿Cuál es tu disponibilidad diaria/semanal? ¿En qué horarios eres más activo?', style: TextInputStyle.Paragraph },
      { id: 'p4', label: '¿Qué aportarías al equipo y por qué quieres ser moderador aquí?', style: TextInputStyle.Paragraph },
      { id: 'p5', label: '¿Es por el rol o por un deseo genuino de ayudar?', style: TextInputStyle.Short },
      { id: 'p6', label: 'Estás en un canal de voz y dos usuarios se insultan, ¿cómo actuarías?', style: TextInputStyle.Paragraph },
      { id: 'p7', label: 'Si una regla es malinterpretada por muchos, ¿qué harías?', style: TextInputStyle.Paragraph },
      { id: 'p8', label: 'Un usuario hace spam o envía enlaces maliciosos, ¿qué harías paso a paso?', style: TextInputStyle.Paragraph },
      { id: 'p9', label: 'Un miembro del staff tiene una opinión diferente a la tuya, ¿qué harías?', style: TextInputStyle.Paragraph },
    ];

    const componentes = preguntas.map(p => new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId(p.id).setLabel(p.label).setStyle(p.style).setRequired(true)
    ));

    modal.addComponents(...componentes);
    await interaction.showModal(modal);
  }

  // ==================== RESPUESTAS DEL FORMULARIO ====================
  if (interaction.isModalSubmit() && interaction.customId === 'modalPostulacion') {
    const respuestas = [
      interaction.fields.getTextInputValue('p1'),
      interaction.fields.getTextInputValue('p2'),
      interaction.fields.getTextInputValue('p3'),
      interaction.fields.getTextInputValue('p4'),
      interaction.fields.getTextInputValue('p5'),
      interaction.fields.getTextInputValue('p6'),
      interaction.fields.getTextInputValue('p7'),
      interaction.fields.getTextInputValue('p8'),
      interaction.fields.getTextInputValue('p9')
    ];

    const embed = new EmbedBuilder()
      .setTitle('📨 Nueva Postulación')
      .setColor('Green')
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '👤 Usuario', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: false },
        { name: '🧾 Respuestas', value: respuestas.map((r, i) => `**${i + 1}.** ${r}`).join('\n\n') }
      )
      .setTimestamp();

    const canal = await client.channels.fetch(canalPostulaciones);
    await canal.send({ embeds: [embed] });

    return interaction.reply({ content: '✅ Tu postulación ha sido enviada correctamente. ¡Gracias!', ephemeral: true });
  }
});

