const {
  Collection,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  InteractionType,
} = require("discord.js");

// Conversión de nombres comunes a HEX
const colorNames = {
  red: "#ff0000",
  blue: "#3498db",
  green: "#2ecc71",
  yellow: "#f1c40f",
  purple: "#9b59b6",
  pink: "#ff66b2",
  orange: "#e67e22",
  white: "#ffffff",
  black: "#000000",
  gray: "#95a5a6",
  cyan: "#00ffff",
  lime: "#00ff00",
};

const { GUILD_ID, STAFF_ROLE_ID } = require("./config");

module.exports = (client) => {
  client.once("ready", async () => {
    const guild = client.guilds.cache.get(GUILD_ID);

    const commandData = new SlashCommandBuilder()
      .setName("embed")
      .setDescription("Crea un embed personalizado (solo para staff)")
      .addStringOption((option) =>
        option
          .setName("color")
          .setDescription("Color del embed (por ejemplo #00FF80 o blue)")
          .setRequired(false)
      )
      .addChannelOption((option) =>
        option
          .setName("canal")
          .setDescription("Canal donde se enviará el embed")
          .setRequired(false)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

    if (guild) {
      const existing = await guild.commands.fetch().catch(() => new Collection());
      if (!existing.find(c => c.name === "embed")) {
        await guild.commands.create(commandData);
        console.log("✅ Comando /embed registrado correctamente en el servidor.");
      }
    } else {
      console.log("⚠️ No se encontró el servidor, no se registró el comando /embed.");
    }
  });

  // Al ejecutar el comando /embed
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "embed") return;

    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({
        content: "❌ No tienes permiso para usar este comando.",
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("crear_embed_modal")
      .setTitle("Crear embed");

    const titulo = new TextInputBuilder()
      .setCustomId("titulo")
      .setLabel("Título")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const miniatura = new TextInputBuilder()
      .setCustomId("miniatura")
      .setLabel("URL de la miniatura")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const descripcion = new TextInputBuilder()
      .setCustomId("descripcion")
      .setLabel("Descripción")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const imagen = new TextInputBuilder()
      .setCustomId("imagen")
      .setLabel("URL de la imagen")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const pie = new TextInputBuilder()
      .setCustomId("pie")
      .setLabel("Pie de página")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titulo),
      new ActionRowBuilder().addComponents(miniatura),
      new ActionRowBuilder().addComponents(descripcion),
      new ActionRowBuilder().addComponents(imagen),
      new ActionRowBuilder().addComponents(pie)
    );

    // Guardar canal y color temporalmente ANTES de mostrar el modal
    client.embedTempData = {
      [interaction.user.id]: {
        channel: interaction.options.getChannel("canal") || interaction.channel,
        color: interaction.options.getString("color") || "#00FF80",
      },
    };

    try {
      await interaction.showModal(modal);
    } catch (err) {
      console.error('Error mostrando modal de embed:', err.message);
    }
  });

  // Al enviar el modal
  client.on("interactionCreate", async (interaction) => {
    if (interaction.type !== InteractionType.ModalSubmit) return;
    if (interaction.customId !== "crear_embed_modal") return;

    const { titulo, miniatura, descripcion, imagen, pie } = {
      titulo: interaction.fields.getTextInputValue("titulo") || null,
      miniatura: interaction.fields.getTextInputValue("miniatura") || null,
      descripcion: interaction.fields.getTextInputValue("descripcion"),
      imagen: interaction.fields.getTextInputValue("imagen") || null,
      pie: interaction.fields.getTextInputValue("pie") || null,
    };

    const tempData = client.embedTempData?.[interaction.user.id];
    let colorInput = tempData?.color?.toLowerCase() || "#00FF80";
    const canal = tempData?.channel || interaction.channel;

    // Convertir nombres de color a HEX
    if (colorNames[colorInput]) colorInput = colorNames[colorInput];

    // Asegurar que empiece con #
    if (!colorInput.startsWith("#")) colorInput = `#${colorInput}`;

    const embed = new EmbedBuilder()
      .setDescription(descripcion)
      .setColor(colorInput);

    if (titulo) embed.setTitle(titulo);
    if (miniatura) embed.setThumbnail(miniatura);
    if (imagen) embed.setImage(imagen);
    if (pie) embed.setFooter({ text: pie });

    try {
      await canal.send({ embeds: [embed] });
      await interaction.reply({
        content: `✅ Embed enviado correctamente en ${canal}`,
        ephemeral: true,
      });
    } catch (err) {
      console.error('Error enviando embed:', err.message);
      try {
        await interaction.reply({
          content: '❌ Hubo un error al enviar el embed.',
          ephemeral: true,
        });
      } catch {}
    }
  });
};
