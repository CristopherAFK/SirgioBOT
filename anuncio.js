const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");

const { GUILD_ID, STAFF_ROLE_ID } = require("./config");

module.exports = (client) => {
  client.on("ready", async () => {
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return console.log("⚠️ No se encontró el servidor.");

      const datos = new SlashCommandBuilder()
        .setName("anuncio")
        .setDescription("Envía un anuncio con vista previa automática de enlaces.")
        .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
        .addChannelOption((option) =>
          option
            .setName("canal")
            .setDescription("Canal donde se enviará el anuncio")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        );

      const existing = await guild.commands.fetch().catch(() => new Map());
      if (!existing.find(c => c.name === "anuncio")) {
        await guild.commands.create(datos);
        console.log("✅ Comando /anuncio registrado en el servidor.");
      }
    } catch (error) {
      console.error("❌ Error al registrar /anuncio:", error);
    }
  });

  // 📩 Al usar el comando
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "anuncio") return;

    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({
        content: "🚫 No tienes permiso para usar este comando.",
        ephemeral: true,
      });
    }

    const canal = interaction.options.getChannel("canal");

    // 📋 Mostrar modal
    const modal = new ModalBuilder()
      .setCustomId("anuncio_modal")
      .setTitle("Crear anuncio");

    const mensajeInput = new TextInputBuilder()
      .setCustomId("mensaje")
      .setLabel("Mensaje del anuncio (puede incluir links)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Escribe tu mensaje aquí...")
      .setRequired(true);

    const fila1 = new ActionRowBuilder().addComponents(mensajeInput);
    modal.addComponents(fila1);

    // Guardar datos del canal para usar después
    interaction.client.anuncioCanal = canal.id;

    await interaction.showModal(modal);
  });

  // 💬 Cuando el modal se envía
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (interaction.customId !== "anuncio_modal") return;

    const canalId = interaction.client.anuncioCanal;
    const canal = interaction.guild.channels.cache.get(canalId);
    const mensaje = interaction.fields.getTextInputValue("mensaje");

    if (!canal) {
      return interaction.reply({
        content: "⚠️ No se encontró el canal seleccionado.",
        ephemeral: true,
      });
    }

    try {
      await canal.send(mensaje); // Mensaje normal → Discord genera vista previa
      await interaction.reply({
        content: `✅ Anuncio enviado a ${canal}.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("❌ Error al enviar el anuncio:", error);
      await interaction.reply({
        content: "⚠️ Hubo un error al enviar el anuncio.",
        ephemeral: true,
      });
    }
  });
};
