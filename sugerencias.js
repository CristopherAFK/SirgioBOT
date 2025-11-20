// =========================================
// Sistema de Sugerencias FINAL y CORREGIDO
// =========================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

// CONFIG
const CANAL_PUBLICO = "1440873532580954112";
const CANAL_STAFF = "1435091853308461179";
const STAFF_ROLE = "1230949715127042098";

module.exports = (client) => {

  // Registrar comando /sugerir
  client.on("ready", async () => {
    const data = [
      new SlashCommandBuilder()
        .setName("sugerir")
        .setDescription("Envía una sugerencia.")
        .addStringOption(opt =>
          opt.setName("texto")
             .setDescription("Escribe tu sugerencia")
             .setRequired(true)
        )
    ].map(cmd => cmd.toJSON());

    await client.application.commands.set(data);
    console.log("[Sugerencias] Comando /sugerir cargado.");
  });


  // ---------------------------------------------
  // MANEJO DEL COMANDO /SUGERIR
  // ---------------------------------------------
  client.on("interactionCreate", async (interaction) => {

    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "sugerir") return;

    const texto = interaction.options.getString("texto");
    const canalPublico = await client.channels.fetch(CANAL_PUBLICO);

    // EMBED PÚBLICO INICIAL
    const embedPublico = new EmbedBuilder()
      .setTitle("📩 Nueva Sugerencia")
      .setDescription(texto)
      .addFields(
        { name: "Autor", value: `<@${interaction.user.id}>` },
        { name: "Estado", value: "🕓 **Sin revisar**" }
      )
      .setColor("#3498db")
      .setTimestamp();

    const msgPublica = await canalPublico.send({ embeds: [embedPublico] });

    // Reacciones (solo emojis seguros)
    await msgPublica.react("👍");
    await msgPublica.react("👎");

    // STAFF
    const embedStaff = new EmbedBuilder(embedPublico)
      .setFooter({ text: `MSG:${msgPublica.id}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("aprobar_sug")
        .setLabel("Aprobar")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("rechazar_sug")
        .setLabel("Rechazar")
        .setStyle(ButtonStyle.Danger)
    );

    const canalStaff = await client.channels.fetch(CANAL_STAFF);
    await canalStaff.send({ embeds: [embedStaff], components: [row] });

    // Respuesta correcta con FLAGS
    await interaction.reply({
      content: "Tu sugerencia fue enviada correctamente.",
      flags: 64 // << EPHEMERAL
    });
  });


  // ---------------------------------------------
  // MANEJO DE BOTONES (solo staff)
  // ---------------------------------------------
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    // Verificar que sea staff
    if (!interaction.member.roles.cache.has(STAFF_ROLE)) {
      return interaction.reply({
        content: "❌ No tienes permisos.",
        flags: 64
      });
    }

    // Abrir modal
    const modal = new ModalBuilder()
      .setCustomId(
        interaction.customId === "aprobar_sug"
          ? "modal_aprobar"
          : "modal_rechazar"
      )
      .setTitle(
        interaction.customId === "aprobar_sug"
          ? "Aprobar Sugerencia"
          : "Rechazar Sugerencia"
      );

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("razon")
          .setLabel("Razón")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    await interaction.showModal(modal);
  });


  // ---------------------------------------------
  // MANEJO DE LOS MODALES (aprobado/rechazado)
  // ---------------------------------------------
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    const razon = interaction.fields.getTextInputValue("razon");
    const aprobado = interaction.customId === "modal_aprobar";

    const embed = interaction.message.embeds[0];
    if (!embed)
      return interaction.reply({ content: "Error interno.", flags: 64 });

    // Extraer ID del mensaje público
    const id = embed.footer.text.replace("MSG:", "");

    const canalPublico = await client.channels.fetch(CANAL_PUBLICO);
    const mensajePublico = await canalPublico.messages.fetch(id);

    const embedEditado = EmbedBuilder.from(mensajePublico.embeds[0])
      .setFields(
        { name: "Autor", value: embed.fields[0].value },
        { name: "Estado", value: aprobado ? "✅ **Aprobada**" : "❌ **Rechazada**" },
        { name: "Razón", value: razon }
      )
      .setColor(aprobado ? "Green" : "Red")
      .setFooter({ text: `Revisado por ${interaction.user.tag}` });

    await mensajePublico.edit({ embeds: [embedEditado] });

    await interaction.reply({
      content: `La sugerencia fue ${aprobado ? "aprobada" : "rechazada"}.`,
      flags: 64
    });
  });

};