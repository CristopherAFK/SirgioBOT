// =========================================
// Sistema de Sugerencias con ESTADOS en vivo
// =========================================
// Requisitos: discord.js v14+, Node 16+
// Uso: require('./sugerencias.js')(client);
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
const CANAL_PUBLICO = "1440873532580954112";        // Canal público donde aparece la sugerencia
const CANAL_STAFF = "1435091853308461179";          // Canal privado donde staff revisa
const STAFF_ROLE = "1230949715127042098";           // Rol del staff

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

  // Al usar /sugerir
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "sugerir") return;

    const texto = interaction.options.getString("texto");
    const canalPublico = await client.channels.fetch(CANAL_PUBLICO);

    // Embed inicial en canal público (SIN REVISAR)
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

    // Añadir reacciones de votación
    await msgPublica.react("👍");
    await msgPublica.react("👎");

    // Enviar al staff
    const embedStaff = new EmbedBuilder(embedPublico)
      .setFooter({ text: `ID del mensaje público: ${msgPublica.id}` });

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

    await interaction.reply({
      content: "✅ Tu sugerencia ha sido enviada.",
      ephemeral: true,
    });
  });

  // Botones del staff
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    // Sólo staff
    if (!interaction.member.roles.cache.has(STAFF_ROLE)) {
      return interaction.reply({
        content: "❌ No tienes permisos.",
        ephemeral: true,
      });
    }

    // Crear modal
    const modal = new ModalBuilder()
      .setCustomId(
        interaction.customId === "aprobar_sug"
          ? "modal_aprobar"
          : "modal_rechazar"
      )
      .setTitle(
        interaction.customId === "aprobar_sug"
          ? "Aprobar sugerencia"
          : "Rechazar sugerencia"
      );

    const razon = new TextInputBuilder()
      .setCustomId("razon")
      .setLabel("Razón")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(razon));

    await interaction.showModal(modal);
  });

  // Procesar modal
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    const razon = interaction.fields.getTextInputValue("razon");
    const aprobado = interaction.customId === "modal_aprobar";

    // Obtener embed original del mensaje del staff
    const embed = interaction.message.embeds[0];
    if (!embed)
      return interaction.reply({
        content: "❌ Error al obtener la sugerencia.",
        ephemeral: true,
      });

    // Extraer ID del mensaje público desde el footer
    const footer = embed.footer?.text || "";
    const publicMsgID = footer.replace("ID del mensaje público: ", "").trim();

    // Buscar mensaje original
    const canalPublico = await client.channels.fetch(CANAL_PUBLICO);
    const msgPublica = await canalPublico.messages.fetch(publicMsgID);

    // Crear embed actualizado
    const embedActualizado = EmbedBuilder.from(msgPublica.embeds[0])
      .setFields(
        { name: "Autor", value: embed.fields[0].value },
        {
          name: "Estado",
          value: aprobado
            ? "✅ **Aprobada**"
            : "❌ **Rechazada**",
        },
        {
          name: "Razón",
          value: razon
        }
      )
      .setColor(aprobado ? "Green" : "Red")
      .setFooter({ text: `Revisado por: ${interaction.user.tag}` })
      .setTimestamp();

    // Editar mensaje público
    await msgPublica.edit({ embeds: [embedActualizado] });

    // Respuesta al staff
    await interaction.reply({
      content: `✔ La sugerencia fue **${
        aprobado ? "aprobada" : "rechazada"
      }** correctamente.`,
      ephemeral: true,
    });
  });
};