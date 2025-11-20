// =========================================
// Sistema de Sugerencias Completo
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
  PermissionFlagsBits,
} = require("discord.js");

// CONFIG
const SUGGESTIONS_PUBLIC = "1440873532580954112"; // Sugerencias (público)
const STAFF_CHANNEL = "1435091853308461179"; // Canal privado donde revisa staff
const STAFF_ROLE = "1230949715127042098"; // Rol de staff

module.exports = (client) => {
  // Registrar comando /sugerir
  client.on("ready", async () => {
    const data = [
      new SlashCommandBuilder()
        .setName("sugerir")
        .setDescription("Envía una sugerencia al staff.")
        .addStringOption((opt) =>
          opt
            .setName("texto")
            .setDescription("Escribe tu sugerencia")
            .setRequired(true)
        ),
    ].map((cmd) => cmd.toJSON());

    await client.application.commands.set(data);
    console.log("[Sugerencias] Comando /sugerir cargado.");
  });

  // Listener del comando
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "sugerir") return;

    const texto = interaction.options.getString("texto");

    const embed = new EmbedBuilder()
      .setTitle("📩 Nueva Sugerencia")
      .setDescription(texto)
      .addFields({
        name: "Autor",
        value: `<@${interaction.user.id}>`,
      })
      .setColor("#00A6FF")
      .setTimestamp();

    const staffRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("aprobar_sug")
        .setLabel("Aprobar")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("rechazar_sug")
        .setLabel("Rechazar")
        .setStyle(ButtonStyle.Danger)
    );

    const staffChannel = await client.channels.fetch(STAFF_CHANNEL);
    const staffMessage = await staffChannel.send({
      embeds: [embed],
      components: [staffRow],
    });

    await interaction.reply({
      content: "✅ Tu sugerencia ha sido enviada al staff.",
      ephemeral: true,
    });

    // Para guardar el ID del autor dentro del mensaje
    staffMessage.sugerenciaAutor = interaction.user.id;
    staffMessage.sugerenciaTexto = texto;
  });

  // Manejo de botones del staff
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    // Verificar que sea staff
    if (!interaction.member.roles.cache.has(STAFF_ROLE)) {
      return interaction.reply({
        content: "❌ No tienes permisos para usar esto.",
        ephemeral: true,
      });
    }

    const tipo = interaction.customId;

    // Modal de razón
    const modal = new ModalBuilder()
      .setCustomId(tipo === "aprobar_sug" ? "modal_aprobar" : "modal_rechazar")
      .setTitle(
        tipo === "aprobar_sug" ? "Aprobar sugerencia" : "Rechazar sugerencia"
      );

    const razonInput = new TextInputBuilder()
      .setCustomId("razon")
      .setLabel("Razón")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(razonInput));

    await interaction.showModal(modal);
  });

  // Cuando staff envía la razón en el modal
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    const razon = interaction.fields.getTextInputValue("razon");
    const staff = interaction.user;
    const aprobado = interaction.customId === "modal_aprobar";

    const mensajeOriginal = await interaction.channel.messages.fetch(
      interaction.message?.id
    ).catch(()=>null)

    // Buscar embed original
    const embedOriginal = interaction.message?.embeds?.[0];

    // Si no existe, no se puede procesar
    if (!embedOriginal)
      return interaction.reply({
        content: "❌ Error: no se pudo encontrar la sugerencia original.",
        ephemeral: true,
      });

    const autorID = embedOriginal.fields?.find((f) =>
      f.name === "Autor"
    )?.value.replace(/\D/g, "");

    const canalPublico = await client.channels.fetch(SUGGESTIONS_PUBLIC);

    const embedFinal = new EmbedBuilder()
      .setTitle(aprobado ? "✅ Sugerencia Aprobada" : "❌ Sugerencia Rechazada")
      .setDescription(embedOriginal.description)
      .addFields(
        { name: "Autor", value: `<@${autorID}>` },
        { name: "Revisado por", value: `<@${staff.id}>` },
        { name: "Razón", value: razon }
      )
      .setColor(aprobado ? "Green" : "Red")
      .setTimestamp();

    const msg = await canalPublico.send({ embeds: [embedFinal] });

    // Votaciones (reacciones)
    await msg.react("👍");
    await msg.react("👎");

    await interaction.reply({
      content: `✔ La sugerencia ha sido ${
        aprobado ? "aprobada" : "rechazada"
      }.`,
      ephemeral: true,
    });
  });
};