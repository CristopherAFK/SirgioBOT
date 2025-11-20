// =========================================
// SISTEMA DE SUGERENCIAS - VERSION FINAL
// =========================================

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

// CONFIG
const CANAL_PUBLICO = "1440873532580954112";
const CANAL_STAFF = "1435091853308461179";
const STAFF_ROLE = "1230949715127042098";

module.exports = (client) => {

  // ========== Registrar el comando ==========
  client.on("ready", async () => {
    const comandos = [
      new SlashCommandBuilder()
        .setName("sugerir")
        .setDescription("Envía una sugerencia al servidor.")
        .addStringOption(opt =>
          opt.setName("texto")
            .setDescription("Tu sugerencia")
            .setRequired(true)
        )
    ].map(c => c.toJSON());

    await client.application.commands.set(comandos);
    console.log("[Sugerencias] Comando /sugerir cargado.");
  });

  // ========== ÚNICO LISTENER DE INTERACCIONES ==========
  client.on("interactionCreate", async (interaction) => {

    // -------------------------------------
    // 💬 1. /sugerir
    // -------------------------------------
    if (interaction.isChatInputCommand() && interaction.commandName === "sugerir") {

      const texto = interaction.options.getString("texto");
      const canalPublico = await client.channels.fetch(CANAL_PUBLICO);

      // Embed público
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

      // Reacciones (sin emojis inválidos)
      await msgPublica.react("👍");
      await msgPublica.react("👎");

      // Notificar al staff
      const canalStaff = await client.channels.fetch(CANAL_STAFF);

      const embedStaff = EmbedBuilder.from(embedPublico)
        .setFooter({ text: `MSG:${msgPublica.id}` });

      const botones = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("aprobar")
          .setLabel("Aprobar")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("rechazar")
          .setLabel("Rechazar")
          .setStyle(ButtonStyle.Danger)
      );

      await canalStaff.send({ embeds: [embedStaff], components: [botones] });

      return interaction.reply({
        content: "Tu sugerencia fue enviada correctamente.",
        flags: 64
      });
    }


    // -------------------------------------
    // 🔘 2. BOTONES (solo staff)
    // -------------------------------------
    if (interaction.isButton()) {

      if (!interaction.member.roles.cache.has(STAFF_ROLE)) {
        return interaction.reply({
          content: "❌ No tienes permisos.",
          flags: 64
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(
          interaction.customId === "aprobar"
            ? "modal_aprobar"
            : "modal_rechazar"
        )
        .setTitle(
          interaction.customId === "aprobar"
            ? "Aprobar Sugerencia"
            : "Rechazar Sugerencia"
        );

      const razon = new TextInputBuilder()
        .setCustomId("razon")
        .setLabel("Razón")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(razon));

      return interaction.showModal(modal);
    }


    // -------------------------------------
    // 📝 3. MODALES (staff)
    // -------------------------------------
    if (interaction.isModalSubmit()) {

      const razon = interaction.fields.getTextInputValue("razon");
      const aprobado = interaction.customId === "modal_aprobar";

      const embed = interaction.message.embeds[0];
      if (!embed) {
        return interaction.reply({ content: "Error interno.", flags: 64 });
      }

      // Obtener ID del mensaje público
      const idMsg = embed.footer.text.replace("MSG:", "");

      const canalPublico = await client.channels.fetch(CANAL_PUBLICO);
      const msgPublica = await canalPublico.messages.fetch(idMsg);

      // Actualizar embed
      const embedEditado = EmbedBuilder.from(msgPublica.embeds[0])
        .setFields(
          { name: "Autor", value: embed.fields[0].value },
          {
            name: "Estado",
            value: aprobado
              ? "✅ **Aprobada**"
              : "❌ **Rechazada**"
          },
          { name: "Razón", value: razon }
        )
        .setColor(aprobado ? "Green" : "Red")
        .setFooter({ text: `Revisado por ${interaction.user.tag}` })
        .setTimestamp();

      await msgPublica.edit({ embeds: [embedEditado] });

      return interaction.reply({
        content: `La sugerencia fue **${aprobado ? "aprobada" : "rechazada"}**.`,
        flags: 64
      });
    }

  });
};