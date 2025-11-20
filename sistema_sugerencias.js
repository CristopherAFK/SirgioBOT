// ===============================
// SISTEMA DE SUGERENCIAS - Discord.js v14
// Estilo SpreenBOT
// ===============================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

// CANALES Y ROLES CONFIGURADOS
const PUBLIC_CHANNEL = "1440873532580954112";   // Canal donde se publican sugerencias
const STAFF_CHANNEL = "1435091853308461179";    // Canal donde llega la sugerencia al staff
const STAFF_ROLE = "1230949715127042098";       // Rol que tiene permiso para aprobar/rechazar

// GIF estilo SpreenBOT (thumbnail)
const GIF_PATH = "./suggestion_icon.gif";

module.exports = (client) => {

  // Colección necesaria si no existe
  if (!client.suggestions) client.suggestions = {};

  // Registrar comando
  client.commands.set(
    "suggest",
    new SlashCommandBuilder()
      .setName("suggest")
      .setDescription("Envía una sugerencia al servidor")
      .addStringOption(opt =>
        opt.setName("contenido")
          .setDescription("Escribe tu sugerencia")
          .setRequired(true)
      )
  );

  // Handler del comando
  client.commandHandlers.set("suggest", async (interaction) => {

    const suggestion = interaction.options.getString("contenido");

    const publicChannel = interaction.guild.channels.cache.get(PUBLIC_CHANNEL);
    const staffChannel = interaction.guild.channels.cache.get(STAFF_CHANNEL);

    if (!publicChannel || !staffChannel) {
      return interaction.reply({ content: "❌ No se encontraron los canales configurados.", ephemeral: true });
    }

    // Embed público
    const publicEmbed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
      .setDescription(`📨 **Nueva sugerencia:**\n${suggestion}`)
      .setThumbnail("attachment://suggestion_icon.gif")
      .setFooter({ text: `ID: ${interaction.user.id}` })
      .setTimestamp();

    // Enviar a canal público
    const msg = await publicChannel.send({
      embeds: [publicEmbed],
      files: [{ attachment: GIF_PATH, name: "suggestion_icon.gif" }]
    });

    await msg.react("👍");
    await msg.react("👎");

    // Embed para staff
    const staffEmbed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("📨 Nueva Sugerencia")
      .addFields(
        { name: "Autor", value: `<@${interaction.user.id}> (${interaction.user.id})` },
        { name: "Contenido", value: suggestion }
      )
      .setThumbnail("attachment://suggestion_icon.gif")
      .setTimestamp();

    const btns = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_${msg.id}`)
        .setLabel("Aprobar")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`reject_${msg.id}`)
        .setLabel("Rechazar")
        .setStyle(ButtonStyle.Danger)
    );

    await staffChannel.send({
      embeds: [staffEmbed],
      components: [btns],
      files: [{ attachment: GIF_PATH, name: "suggestion_icon.gif" }]
    });

    interaction.reply({ content: "✅ Tu sugerencia fue enviada correctamente.", ephemeral: true });

    client.suggestions[msg.id] = {
      author: interaction.user.id,
      content: suggestion
    };
  });


  // ===============================
  // BOTONES + MODALES
  // ===============================
  client.on("interactionCreate", async (interaction) => {

    // --- BOTONES ---
    if (interaction.isButton()) {

      // Verificar si es staff
      if (!interaction.member.roles.cache.has(STAFF_ROLE)) {
        return interaction.reply({ content: "❌ No tienes permiso para usar esto.", ephemeral: true });
      }

      const [action, msgId] = interaction.customId.split("_");

      const modal = new ModalBuilder()
        .setCustomId(`${action}Modal_${msgId}`)
        .setTitle(action === "approve" ? "Aprobar Sugerencia" : "Rechazar Sugerencia");

      const input = new TextInputBuilder()
        .setCustomId("razon")
        .setLabel("Razón")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      return interaction.showModal(modal);
    }

    // --- MODAL ---
    if (interaction.isModalSubmit()) {

      const [action, msgId] = interaction.customId.split("Modal_");
      const razon = interaction.fields.getTextInputValue("razon");

      const data = client.suggestions[msgId];
      if (!data) {
        return interaction.reply({ content: "❌ Error interno: no se encontró la sugerencia.", ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(action === "approve" ? "#00ff6a" : "#ff3333")
        .setTitle(action === "approve" ? "✅ Sugerencia Aprobada" : "❌ Sugerencia Rechazada")
        .addFields(
          { name: "Autor", value: `<@${data.author}> (${data.author})` },
          { name: "Sugerencia", value: data.content },
          { name: "Razón del Staff", value: razon }
        )
        .setThumbnail("attachment://suggestion_icon.gif")
        .setTimestamp();

      interaction.reply({
        embeds: [embed],
        files: [{ attachment: GIF_PATH, name: "suggestion_icon.gif" }]
      });
    }
  });
};
