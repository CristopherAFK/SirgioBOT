const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  SlashCommandBuilder,
  Routes,
  REST,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const fs = require('fs');

// ========================= CONFIG =========================
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
const CLIENT_ID = '1421087461052060437';
const GUILD_ID = '121288062645147768';
const canalPostulaciones = '1435091853308461179'; // Canal donde se enviarán las postulaciones
const canalPanel = '1435093988196618383'; // Canal donde se publica el embed principal
const adminRole = '121289139529897030'; // Rol que puede aprobar/rechazar
let postulacionesActivas = true;

// ========================= COMANDOS =========================
const commands = [
  new SlashCommandBuilder()
    .setName('panelpostulaciones')
    .setDescription('Envía el panel principal de postulaciones (solo staff).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('postular')
    .setDescription('Inicia el proceso de postulación.'),

  new SlashCommandBuilder()
    .setName('postulaciones')
    .setDescription('Activa o desactiva el sistema de postulaciones (solo staff).')
    .addStringOption(option =>
      option
        .setName('estado')
        .setDescription('on/off')
        .setRequired(true)
        .addChoices(
          { name: 'on', value: 'on' },
          { name: 'off', value: 'off' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
];

(async () => {
  try {
    console.log('⌛ Registrando comandos de postulaciones...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Comandos de postulaciones registrados correctamente.');
  } catch (error) {
    console.error('❌ Error al registrar comandos:', error);
  }
})();

// ========================= SISTEMA =========================
module.exports = (client) => {
  const respuestasParciales = new Map();

  client.on('ready', () => {
    console.log('✅ Módulo de postulaciones cargado correctamente.');
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand() && !interaction.isButton() && !interaction.isModalSubmit()) return;

    // ========================= /panelpostulaciones =========================
    if (interaction.isCommand() && interaction.commandName === 'panelpostulaciones') {
      const embed = new EmbedBuilder()
        .setTitle('📋 Sistema de Postulaciones')
        .setDescription('Presiona el botón de abajo para enviar tu postulación.')
        .setColor('Blue');

      const boton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('abrir_postulacion')
          .setLabel('Postularse')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.reply({ content: '✅ Panel enviado.', ephemeral: true });
      const canal = interaction.guild.channels.cache.get(canalPanel);
      if (canal) canal.send({ embeds: [embed], components: [boton] });
      return;
    }

    // ========================= /postulaciones on/off =========================
    if (interaction.isCommand() && interaction.commandName === 'postulaciones') {
      const estado = interaction.options.getString('estado');
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', ephemeral: true });

      postulacionesActivas = estado === 'on';
      return interaction.reply({
        content: `🔧 El sistema de postulaciones ha sido **${estado === 'on' ? 'activado' : 'desactivado'}**.`,
        ephemeral: true,
      });
    }

    // ========================= /postular =========================
    if (interaction.isCommand() && interaction.commandName === 'postular') {
      if (!postulacionesActivas)
        return interaction.reply({ content: '🚫 Las postulaciones están cerradas temporalmente.', ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId('form_postulacion')
        .setTitle('Formulario de Postulación');

      const preguntas = [
        { id: 'nombre', label: '¿Cuál es tu nombre completo?', style: TextInputStyle.Short },
        { id: 'edad', label: '¿Cuál es tu edad?', style: TextInputStyle.Short },
        { id: 'experiencia', label: '¿Tienes experiencia previa en staff?', style: TextInputStyle.Paragraph },
        { id: 'tiempo', label: '¿Cuánto tiempo puedes dedicar al servidor?', style: TextInputStyle.Short },
        { id: 'motivacion', label: '¿Por qué quieres ser parte del staff?', style: TextInputStyle.Paragraph },
      ];

      const componentes = preguntas.map(p =>
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(p.id)
            .setLabel(p.label)
            .setStyle(p.style)
            .setRequired(true)
        )
      );

      modal.addComponents(componentes);
      await interaction.showModal(modal);
    }

    // ========================= Botón de postulación =========================
    if (interaction.isButton() && interaction.customId === 'abrir_postulacion') {
      if (!postulacionesActivas)
        return interaction.reply({ content: '🚫 Las postulaciones están cerradas temporalmente.', ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId('form_postulacion')
        .setTitle('Formulario de Postulación');

      const preguntas = [
        { id: 'nombre', label: '¿Cuál es tu nombre completo?', style: TextInputStyle.Short },
        { id: 'edad', label: '¿Cuál es tu edad?', style: TextInputStyle.Short },
        { id: 'experiencia', label: '¿Tienes experiencia previa en staff?', style: TextInputStyle.Paragraph },
        { id: 'tiempo', label: '¿Cuánto tiempo puedes dedicar al servidor?', style: TextInputStyle.Short },
        { id: 'motivacion', label: '¿Por qué quieres ser parte del staff?', style: TextInputStyle.Paragraph },
      ];

      const componentes = preguntas.map(p =>
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(p.id)
            .setLabel(p.label)
            .setStyle(p.style)
            .setRequired(true)
        )
      );

      modal.addComponents(componentes);
      await interaction.showModal(modal);
    }

    // ========================= Modal Submit =========================
    if (interaction.isModalSubmit() && interaction.customId === 'form_postulacion') {
      const respuestas = {
        nombre: interaction.fields.getTextInputValue('nombre'),
        edad: interaction.fields.getTextInputValue('edad'),
        experiencia: interaction.fields.getTextInputValue('experiencia'),
        tiempo: interaction.fields.getTextInputValue('tiempo'),
        motivacion: interaction.fields.getTextInputValue('motivacion'),
      };

      const embed = new EmbedBuilder()
        .setTitle('📝 Nueva Postulación')
        .setColor('Green')
        .setDescription(`**Usuario:** <@${interaction.user.id}>`)
        .addFields(
          { name: '👤 Nombre', value: respuestas.nombre },
          { name: '🎂 Edad', value: respuestas.edad },
          { name: '💼 Experiencia', value: respuestas.experiencia },
          { name: '🕒 Tiempo disponible', value: respuestas.tiempo },
          { name: '⭐ Motivación', value: respuestas.motivacion }
        )
        .setTimestamp();

      try {
        const canal = interaction.guild.channels.cache.get(canalPostulaciones);
        if (!canal) throw new Error('Canal no encontrado.');

        await canal.send({ embeds: [embed] });

        // Guardar en postulaciones.json
        const dataPath = './postulaciones.json';
        const data = fs.existsSync(dataPath) ? JSON.parse(fs.readFileSync(dataPath, 'utf8')) : [];
        data.push({ usuario: interaction.user.id, respuestas, fecha: new Date().toISOString() });
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

        await interaction.reply({
          content: '✅ Tu postulación fue enviada correctamente. ¡Gracias por postularte!',
          ephemeral: true,
        });
      } catch (err) {
        console.error('Error al enviar postulación:', err);
        await interaction.reply({
          content: '❌ Hubo un error al enviar tu postulación. Contacta con un administrador.',
          ephemeral: true,
        });
      }
    }
  });
};
