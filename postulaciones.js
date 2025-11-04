// =========================
// SirgioBOT - Sistema de Postulaciones para Staff
// Comando: /postular
// Solo usable por el staff (salvo en el canal habilitado)
// Envia las postulaciones a un canal interno del staff
// =========================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');

// IDs del servidor y canales
const GUILD_ID = "1212886282645147768";
const CANAL_POSTULACIONES_ID = "1435093988196618383"; // Canal público de postulaciones
const CANAL_STAFF_ID = "1435091853308461179"; // Canal donde llegan las postulaciones

module.exports = {
  data: new SlashCommandBuilder()
    .setName('postular')
    .setDescription('Sistema de postulaciones para staff del servidor.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    // Verificar que esté en el canal correcto
    if (interaction.channel.id !== CANAL_POSTULACIONES_ID && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: "❌ Solo puedes usar este comando en el canal de postulaciones oficial.",
        ephemeral: true,
      });
    }

    // Crear el embed principal con los requisitos
    const requisitosEmbed = new EmbedBuilder()
      .setColor("#00BFFF")
      .setTitle("📋 Postulaciones para el Staff")
      .setDescription(
        `> ¡Gracias por tu interés en formar parte del equipo de **SirgioBOT**!\n\n` +
        `Asegúrate de cumplir con todos los requisitos antes de postularte:\n\n` +
        `**✅ Requisitos:**\n` +
        `- 👤 Tener más de **16 años**\n` +
        `- 📅 Haber entrado hace **mínimo 3 meses** al servidor\n` +
        `- 💬 Ser **activo** en la comunidad\n` +
        `- ⚖️ Tener **buen historial de sanciones** (sin castigos frecuentes)\n` +
        `- 🤝 No haber tenido **problemas graves** con otros miembros\n` +
        `- 🧠 Responder con **sinceridad** al siguiente cuestionario`
      )
      .setFooter({ text: "SirgioBOT - Sistema de Postulaciones", iconURL: interaction.client.user.displayAvatarURL() })
      .setTimestamp();

    // Menú de tipos de postulación
    const menu = new StringSelectMenuBuilder()
      .setCustomId('tipo_postulacion')
      .setPlaceholder('🧩 Selecciona el tipo de postulación...')
      .addOptions([
        { label: 'Helper', value: 'helper', emoji: '🧰', description: 'Apoyar a los usuarios y mantener el orden.' },
        { label: 'Editor (de Sirgio)', value: 'editor', emoji: '🎬', description: 'Ayudar en la edición de contenido audiovisual.' },
        { label: 'Programador (del servidor)', value: 'programador', emoji: '💻', description: 'Apoyar en el desarrollo técnico o bots.' },
        { label: 'Organizador de eventos', value: 'organizador', emoji: '🎉', description: 'Planificar y ejecutar eventos de la comunidad.' },
      ]);

    const boton = new ButtonBuilder()
      .setCustomId('abrir_postulacion')
      .setLabel('📝 Postularse')
      .setStyle(ButtonStyle.Primary);

    const rowMenu = new ActionRowBuilder().addComponents(menu);
    const rowBoton = new ActionRowBuilder().addComponents(boton);

    await interaction.reply({
      embeds: [requisitosEmbed],
      components: [rowMenu, rowBoton],
    });
  },
};

// =========================
// EVENTOS DEL SISTEMA
// =========================

module.exports.registerEvents = (client) => {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

    // Guardar tipo de postulación seleccionado
    if (interaction.isStringSelectMenu() && interaction.customId === 'tipo_postulacion') {
      interaction.client.tipoPostulacion = interaction.values[0];
      return interaction.reply({ content: `✅ Tipo de postulación seleccionado: **${interaction.values[0]}**`, ephemeral: true });
    }

    // Abrir formulario modal
    if (interaction.isButton() && interaction.customId === 'abrir_postulacion') {
      const modal = new ModalBuilder()
        .setCustomId('form_postulacion')
        .setTitle('📝 Formulario de Postulación');

      const p1 = new TextInputBuilder()
        .setCustomId('disponibilidad')
        .setLabel('⏱️ ¿Cuál es tu disponibilidad y horario habitual?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const p2 = new TextInputBuilder()
        .setCustomId('criterio')
        .setLabel('⚖️ ¿Qué harías si un usuario popular rompe una regla?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const p3 = new TextInputBuilder()
        .setCustomId('conflictos')
        .setLabel('💬 ¿Cómo manejarías una pelea en un canal de voz?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const p4 = new TextInputBuilder()
        .setCustomId('proactividad')
        .setLabel('🧠 ¿Qué harías si notas que una regla es malinterpretada?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const p5 = new TextInputBuilder()
        .setCustomId('spam')
        .setLabel('👻 ¿Qué harías ante un caso de spam o trolling?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const rows = [p1, p2, p3, p4, p5].map(q => new ActionRowBuilder().addComponents(q));
      modal.addComponents(rows);

      await interaction.showModal(modal);
    }

    // Cuando el usuario envía el formulario
    if (interaction.isModalSubmit() && interaction.customId === 'form_postulacion') {
      const tipo = interaction.client.tipoPostulacion || "No especificado";
      const respuestas = {
        disponibilidad: interaction.fields.getTextInputValue('disponibilidad'),
        criterio: interaction.fields.getTextInputValue('criterio'),
        conflictos: interaction.fields.getTextInputValue('conflictos'),
        proactividad: interaction.fields.getTextInputValue('proactividad'),
        spam: interaction.fields.getTextInputValue('spam'),
      };

      const canal = await interaction.client.channels.fetch(CANAL_STAFF_ID);
      const embed = new EmbedBuilder()
        .setColor("#2ecc71")
        .setTitle(`📨 Nueva Postulación - ${tipo}`)
        .addFields(
          { name: "👤 Usuario", value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: false },
          { name: "🧩 Tipo de Postulación", value: tipo, inline: true },
          { name: "⏱️ Disponibilidad", value: respuestas.disponibilidad },
          { name: "⚖️ Aplicación de reglas", value: respuestas.criterio },
          { name: "💬 Manejo de conflictos", value: respuestas.conflictos },
          { name: "🧠 Proactividad", value: respuestas.proactividad },
          { name: "👻 Abordaje de spam/trolling", value: respuestas.spam },
        )
        .setFooter({ text: "SirgioBOT - Sistema de Postulaciones", iconURL: interaction.client.user.displayAvatarURL() })
        .setTimestamp();

      await canal.send({ embeds: [embed] });
      await interaction.reply({ content: "✅ Tu postulación ha sido enviada exitosamente. ¡Gracias por postularte!", ephemeral: true });
    }
  });
};
