// ===============================
// 📋 Sistema de Postulaciones - SirgioBOT
// ===============================

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

module.exports = (client) => {
  client.once("ready", async () => {
    // ===== Registrar comando directamente =====
    const commandData = new SlashCommandBuilder()
      .setName("panelpostulaciones")
      .setDescription("📋 Envía el panel principal de postulaciones.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

    try {
      await client.application.commands.create(commandData);
      console.log("✅ Comando /panelpostulaciones registrado correctamente.");
    } catch (err) {
      console.error("❌ Error al registrar /panelpostulaciones:", err);
    }
  });

  // ===== Evento principal =====
  client.on("interactionCreate", async (interaction) => {
    // ======================
    // Slash Command
    // ======================
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName !== "panelpostulaciones") return;

      const CANAL_PERMITIDO = "1435093988196618383"; // 📂│postulaciones
      if (interaction.channelId !== CANAL_PERMITIDO) {
        return interaction.reply({
          content: "❌ Este comando solo puede usarse en <#1435093988196618383>.",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("📋 | Postulaciones del Staff")
        .setDescription(
          `¿Quieres formar parte del equipo? Estos son los **requisitos mínimos**:\n\n` +
            `🕓 Tener más de **16 años**\n` +
            `📅 Haber estado al menos **3 meses** en el servidor\n` +
            `💬 Ser **activo** en la comunidad\n` +
            `🧾 Tener un **buen historial** de comportamiento\n` +
            `🚫 No haber tenido problemas graves con otros miembros\n` +
            `🗒️ Responder con sinceridad el siguiente **cuestionario**\n\n` +
            `Selecciona el tipo de postulación que deseas enviar 👇`
        )
        .setColor("Blue")
        .setThumbnail(interaction.guild.iconURL())
        .setFooter({ text: "SirgioBOT - Sistema de Postulaciones" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("postular_helper")
          .setLabel("🧭 Helper")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("postular_editor")
          .setLabel("🎬 Editor (Sirgio)")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("postular_programador")
          .setLabel("💻 Programador (Server)")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("postular_organizador")
          .setLabel("🎉 Organizador de eventos")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        embeds: [embed],
        components: [row],
      });
    }

    // ======================
    // Botones de postulación
    // ======================
    if (interaction.isButton()) {
      const id = interaction.customId;

      // Crear modal según el tipo de postulación
      const modal = new ModalBuilder()
        .setCustomId(`form_${id}`)
        .setTitle("📋 Formulario de Postulación");

      const preguntas = [
        new TextInputBuilder()
          .setCustomId("nombre")
          .setLabel("¿Cuál es tu nombre o apodo?")
          .setStyle(TextInputStyle.Short)
          .setRequired(true),

        new TextInputBuilder()
          .setCustomId("edad")
          .setLabel("¿Cuál es tu edad?")
          .setStyle(TextInputStyle.Short)
          .setRequired(true),

        new TextInputBuilder()
          .setCustomId("tiempo")
          .setLabel("¿Hace cuánto tiempo estás en el servidor?")
          .setStyle(TextInputStyle.Short)
          .setRequired(true),

        new TextInputBuilder()
          .setCustomId("motivo")
          .setLabel("¿Por qué deseas unirte al staff?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true),

        new TextInputBuilder()
          .setCustomId("experiencia")
          .setLabel("¿Tienes experiencia previa en el rol?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true),
      ];

      // Añadir campos al modal
      modal.addComponents(
        ...preguntas.map((p) => new ActionRowBuilder().addComponents(p))
      );

      await interaction.showModal(modal);
    }

    // ======================
    // Cuando se envía el formulario
    // ======================
    if (interaction.isModalSubmit()) {
      const { customId } = interaction;

      if (
        ![
          "form_postular_helper",
          "form_postular_editor",
          "form_postular_programador",
          "form_postular_organizador",
        ].includes(customId)
      )
        return;

      const nombre = interaction.fields.getTextInputValue("nombre");
      const edad = interaction.fields.getTextInputValue("edad");
      const tiempo = interaction.fields.getTextInputValue("tiempo");
      const motivo = interaction.fields.getTextInputValue("motivo");
      const experiencia = interaction.fields.getTextInputValue("experiencia");

      const tipo =
        customId === "form_postular_helper"
          ? "🧭 Helper"
          : customId === "form_postular_editor"
          ? "🎬 Editor (Sirgio)"
          : customId === "form_postular_programador"
          ? "💻 Programador (Server)"
          : "🎉 Organizador de eventos";

      const embed = new EmbedBuilder()
        .setTitle(`${tipo} - Nueva Postulación`)
        .setColor("Green")
        .addFields(
          { name: "👤 Usuario", value: `${interaction.user}`, inline: true },
          { name: "🕵️ Nombre / Apodo", value: nombre, inline: true },
          { name: "🎂 Edad", value: edad, inline: true },
          { name: "📅 Tiempo en el servidor", value: tiempo, inline: false },
          { name: "💭 Motivación", value: motivo, inline: false },
          { name: "🧰 Experiencia", value: experiencia, inline: false }
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();

      // Canal donde se envían las postulaciones
      const CANAL_STAFF = "1255251210173153342"; // 🔎 Canal de revisión
      const canal = interaction.guild.channels.cache.get(CANAL_STAFF);
      if (canal) await canal.send({ embeds: [embed] });

      await interaction.reply({
        content:
          "✅ Tu postulación fue enviada correctamente. El equipo del staff la revisará pronto.",
        ephemeral: true,
      });
    }
  });
};
