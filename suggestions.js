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

const SUGGESTIONS_CHANNEL = "1440873532580954112";
const STAFF_CHANNEL = "1435091853308461179";
const STAFF_ROLE = "1230949715127042098";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("Envía una sugerencia al servidor.")
    .addStringOption(o =>
      o.setName("sugerencia")
        .setDescription("Escribe tu sugerencia aquí.")
        .setRequired(true)
    ),

  async execute(interaction) {
    const suggestionText = interaction.options.getString("sugerencia");
    const user = interaction.user;

    // Embed público
    const publicEmbed = new EmbedBuilder()
      .setTitle("📢 Nueva sugerencia")
      .setDescription(suggestionText)
      .addFields({ name: "Autor", value: `${user}` })
      .setColor("#00A6FF")
      .setTimestamp();

    // Enviar al canal público
    const pubChannel = interaction.guild.channels.cache.get(SUGGESTIONS_CHANNEL);
    const pubMsg = await pubChannel.send({ embeds: [publicEmbed] });

    // Reacciones para votación
    await pubMsg.react("👍");
    await pubMsg.react("👎");

    // Embed staff
    const staffEmbed = new EmbedBuilder()
      .setTitle("🛠 Nueva sugerencia pendiente")
      .setDescription(suggestionText)
      .addFields(
        { name: "Autor", value: `${user}` },
        { name: "ID del mensaje público", value: pubMsg.id }
      )
      .setColor("#FFD100")
      .setTimestamp();

    // Botones staff
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`aprove-${pubMsg.id}`)
        .setLabel("Aprobar")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`reject-${pubMsg.id}`)
        .setLabel("Rechazar")
        .setStyle(ButtonStyle.Danger)
    );

    const staffChannel = interaction.guild.channels.cache.get(STAFF_CHANNEL);
    await staffChannel.send({
      embeds: [staffEmbed],
      components: [row],
    });

    return interaction.reply({
      content: "📬 **Tu sugerencia ha sido enviada!**",
      ephemeral: true
    });
  }
};
