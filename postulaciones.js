// =========================
// Sistema de Postulaciones - SirgioBOT
// =========================

module.exports = (client) => {
  const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ChannelType,
    PermissionFlagsBits,
  } = require("discord.js");

  // =========================
  // CONFIGURACIÓN
  // =========================

  const POST_CHANNEL_ID = "1435093988196618383"; // canal donde se hacen las postulaciones
  const STAFF_ROLE_ID = "1435091853308461179"; // solo el staff puede usar /postular normalmente

  // =========================
  // REGISTRO DEL COMANDO
  // =========================

  client.commands.set(
    "postular",
    new SlashCommandBuilder()
      .setName("postular")
      .setDescription("Crea una postulación para un puesto en el servidor.")
      .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
      .toJSON()
  );

  // =========================
  // SISTEMA DE POSTULACIONES
  // =========================

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "postular") return;

    // Restricción: solo el canal permitido
    if (interaction.channel.id !== POST_CHANNEL_ID) {
      return interaction.reply({
        content: "❌ Este comando solo puede usarse en el canal de postulaciones.",
        ephemeral: true,
      });
    }

    // Restricción: solo staff (cuando el sistema esté cerrado)
    if (
      !interaction.member.roles.cache.has(STAFF_ROLE_ID) &&
      !interaction.channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.SendMessages)
    ) {
      return interaction.reply({
        content: "🚫 Actualmente las postulaciones están cerradas. Espera al próximo período de apertura.",
        ephemeral: true,
      });
    }

    // Embed con las instrucciones y requisitos
    const requisitos = new EmbedBuilder()
      .setColor("#f7b731")
      .setTitle("📋 Requisitos para Postularte")
      .setDescription(
        "Antes de postularte, asegúrate de cumplir con los siguientes requisitos:\n\n" +
          "✅ Tener más de **16 años**\n" +
          "✅ Haber entrado hace **mínimo 3 meses** al servidor\n" +
          "✅ Ser **activo** en la comunidad\n" +
          "✅ Tener un **buen historial** (sin sanciones frecuentes)\n" +
          "✅ No haber tenido **problemas graves** con otros miembros\n" +
          "✅ **Responder con sinceridad** al siguiente cuestionario\n\n" +
          "Selecciona el tipo de postulación que deseas realizar:"
      )
      .setFooter({ text: "SirgioBOT | Sistema de Postulaciones" })
      .setTimestamp();

    const menu = new StringSelectMenuBuilder()
      .setCustomId("tipo_postulacion")
      .setPlaceholder("📌 Selecciona un tipo de postulación")
      .addOptions([
        {
          label: "Helper 🧹",
          description: "Ayuda a moderar y apoyar la comunidad.",
          value: "helper",
        },
        {
          label: "Editor 🎬",
          description: "Edita contenido para Sirgio.",
          value: "editor",
        },
        {
          label: "Programador 💻",
          description: "Apoya en desarrollo técnico y del bot.",
          value: "programador",
        },
        {
          label: "Organizador 🎉",
          description: "Crea y gestiona eventos del servidor.",
          value: "organizador",
        },
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({ embeds: [requisitos], components: [row] });
  });

  // =========================
  // MANEJO DE SELECCIÓN
  // =========================

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "tipo_postulacion") return;

    const tipo = interaction.values[0];
    const channel = interaction.channel;

    const confirm = new EmbedBuilder()
      .setColor("#00ff99")
      .setTitle("✅ Postulación Iniciada")
      .setDescription(
        `Has seleccionado el puesto de **${tipo.toUpperCase()}**.\n\nPor favor, espera a que se te envíe el formulario o instrucciones correspondientes.`
      )
      .setFooter({ text: "SirgioBOT | Sistema de Postulaciones" })
      .setTimestamp();

    await interaction.reply({ embeds: [confirm], ephemeral: true });
  });
};
