const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  InteractionType,
  EmbedBuilder
} = require("discord.js");

module.exports = (client) => {
  // ======== REGISTRAR COMANDO ========
  client.on("ready", async () => {
    const datos = new SlashCommandBuilder()
      .setName("embed")
      .setDescription("Crea un embed personalizado (solo visible para ti)");

    // Registramos el comando de forma global
    await client.application.commands.create(datos);
    console.log("✅ Comando /embed cargado correctamente.");
  });

  // ======== INTERACCIÓN DEL COMANDO ========
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "embed") return;

    const modal = new ModalBuilder()
      .setCustomId("crear_embed_modal")
      .setTitle("📝 Crear Embed Personalizado");

    const titulo = new TextInputBuilder()
      .setCustomId("titulo")
      .setLabel("Título (opcional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const descripcion = new TextInputBuilder()
      .setCustomId("descripcion")
      .setLabel("Descripción (opcional)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    const color = new TextInputBuilder()
      .setCustomId("color")
      .setLabel("Color en HEX (#00FF80 opcional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const imagen = new TextInputBuilder()
      .setCustomId("imagen")
      .setLabel("URL de imagen (opcional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const footer = new TextInputBuilder()
      .setCustomId("footer")
      .setLabel("Texto del pie (opcional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titulo),
      new ActionRowBuilder().addComponents(descripcion),
      new ActionRowBuilder().addComponents(color),
      new ActionRowBuilder().addComponents(imagen),
      new ActionRowBuilder().addComponents(footer)
    );

    await interaction.showModal(modal);
  });

  // ======== PROCESAR EL MODAL ========
  client.on("interactionCreate", async (interaction) => {
    if (interaction.type !== InteractionType.ModalSubmit) return;
    if (interaction.customId !== "crear_embed_modal") return;

    const titulo = interaction.fields.getTextInputValue("titulo") || null;
    const descripcion = interaction.fields.getTextInputValue("descripcion") || null;
    const color = interaction.fields.getTextInputValue("color") || "#00FF80";
    const imagen = interaction.fields.getTextInputValue("imagen") || null;
    const footer = interaction.fields.getTextInputValue("footer") || null;

    const embed = new EmbedBuilder().setColor(color).setTimestamp();
    if (titulo) embed.setTitle(titulo);
    if (descripcion) embed.setDescription(descripcion);
    if (imagen) embed.setImage(imagen);
    if (footer) embed.setFooter({ text: footer });

    await interaction.reply({
      content: "✅ Tu embed se ha generado (solo tú puedes verlo).",
      embeds: [embed],
      ephemeral: true
    });
  });
};