// =======================================
// SirgioBOT - Sistema de Postulaciones Completo
// =======================================
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const POST_CHANNEL_ID = "1435091853308461179";
const STAFF_ROLE_ID = "1212891335929897030";
let postulacionesAbiertas = false;

module.exports = (client) => {
  // =====================
  // REGISTRO DE COMANDOS
  // =====================
  client.on("ready", async () => {
    const data = [
      new SlashCommandBuilder()
        .setName("panelpostulaciones")
        .setDescription("Envía el panel con las categorías de postulación.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
      new SlashCommandBuilder()
        .setName("abrirpostulaciones")
        .setDescription("Permite que cualquier usuario pueda postularse."),
      new SlashCommandBuilder()
        .setName("postular")
        .setDescription("Permite postularse a una categoría.")
        .addStringOption((option) =>
          option
            .setName("categoria")
            .setDescription("Selecciona la categoría a la que deseas postularte.")
            .setRequired(true)
            .addChoices(
              { name: "Twitch MOD", value: "twitch" },
              { name: "TikTok MOD", value: "tiktok" },
              { name: "Discord Programador", value: "programador" },
              { name: "Editor de Sirgio", value: "editor" },
              { name: "Discord Helper", value: "helper" }
            )
        ),
    ].map((command) => command.toJSON());

    await client.application.commands.set(data);
    console.log("✅ Comandos de postulaciones registrados.");
  });

  // =====================
  // INTERACCIONES
  // =====================
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand() && !interaction.isButton() && !interaction.isModalSubmit()) return;

    // PANELPOSTULACIONES ============================
    if (interaction.commandName === "panelpostulaciones") {
      if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
        return interaction.reply({
          content: "❌ No tienes permiso para usar este comando.",
          ephemeral: true,
        });

      await interaction.deferReply({ ephemeral: true });

      const categorias = [
        {
          nombre: "Twitch MOD",
          color: 0x9b59b6,
          banner: "https://media.discordapp.net/attachments/1420914042251509990/1435393164000104628/58_sin_titulo_20251104154707.png",
          requisitos: [
            "Tener 15 años.",
            "Ser activo en los directos de Twitch.",
            "Tener Criterios.",
            "No ser tóxico.",
            "Followage mínimo de 6 meses.",
            "Tener la madurez de conllevar conflictos en el chat.",
            "Tener experiencia moderando en Twitch.",
          ],
        },
        {
          nombre: "TikTok MOD",
          color: 0x00fff7,
          banner: "https://media.discordapp.net/attachments/1420914042251509990/1435393163559698583/58_sin_titulo_20251104155824.png",
          requisitos: [
            "Tener 14 años.",
            "Ser activo en los directos de TikTok.",
            "Tener Criterios.",
            "No ser tóxico.",
            "Followage mínimo de 3 meses.",
            "Tener la madurez de conllevar conflictos en el chat.",
          ],
        },
        {
          nombre: "Discord Programador",
          color: 0x000000,
          banner: "https://media.discordapp.net/attachments/1420914042251509990/1435393162913779744/58_sin_titulo_20251104160615.png",
          requisitos: [
            "Tener 15 años.",
            "Ser activo en la comunidad de Discord.",
            "Tener conocimientos en JavaScript y/o Node.js.",
            "Experiencia programando bots de Discord.",
          ],
        },
        {
          nombre: "Editor de Sirgio",
          color: 0xff8c00,
          banner: "https://media.discordapp.net/attachments/1420914042251509990/1435393163216027781/58_sin_titulo_20251104160431.png",
          requisitos: [
            "Tener 16 años.",
            "Ser activo en la comunidad de Discord.",
            "Conocimientos en edición de streams a videos.",
            "Disponibilidad cuando sea necesario.",
          ],
        },
        {
          nombre: "Discord Helper",
          color: 0x3498db,
          banner: "https://media.discordapp.net/attachments/1420914042251509990/1435393162561454220/58_sin_titulo_20251104161848.png",
          requisitos: [
            "Tener 15 años.",
            "Ser activo en la comunidad de Discord.",
            "Virtudes como: Paciencia, Responsabilidad.",
            "Tener 3 meses de antigüedad en el servidor.",
            "",
            "**Para poder ascender a Discord MOD:**",
            "• Tener experiencia moderando servidores de Discord.",
            "• Tener 17 años.",
            "• Saber cómo atender tickets correctamente.",
            "• Tener 6 meses de antigüedad en el servidor.",
            "• Virtudes como: Paciencia, Responsabilidad, Madurez, Resolución de problemas, trabajo en equipo.",
            "• Antigüedad mínima de 5 meses como Helper.",
            "",
            "_⚠️ Los postulantes se someterán a un periodo de prueba de 7 días aproximadamente para evaluar su desempeño con el rol._",
          ],
        },
      ];

      for (const cat of categorias) {
        await interaction.channel.send(cat.banner);
        const embed = new EmbedBuilder()
          .setTitle(cat.nombre)
          .setDescription("**Requisitos para poder postularse:**\n" + cat.requisitos.map((r) => `• ${r}`).join("\n"))
          .setColor(cat.color);
        await interaction.channel.send({ embeds: [embed] });
      }

      await interaction.channel.send(
        "⚠️ **Pasos a seguir** ⚠️\n1. En este mismo canal deberás usar el comando `/postular` y elegir la categoría.\n2. Leer y rellenar el formulario con la información pedida."
      );

      return interaction.editReply({ content: "✅ Panel de postulaciones enviado correctamente." });
    }

    // ABRIRPOSTULACIONES ============================
    if (interaction.commandName === "abrirpostulaciones") {
      if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
        return interaction.reply({
          content: "❌ No tienes permiso para usar este comando.",
          ephemeral: true,
        });

      postulacionesAbiertas = true;
      return interaction.reply("✅ Las postulaciones ahora están abiertas. Los usuarios pueden usar `/postular`.");
    }

    // POSTULAR ======================================
    if (interaction.commandName === "postular") {
      if (!postulacionesAbiertas && !interaction.member.roles.cache.has(STAFF_ROLE_ID))
        return interaction.reply({
          content: "❌ Las postulaciones están cerradas por ahora.",
          ephemeral: true,
        });

      const categoria = interaction.options.getString("categoria");

      const modals = {
        twitch: {
          id: "modal_twitch",
          pregunta: "¿Qué harías si alguien está spameando o causa una pelea en el chat?",
        },
        tiktok: {
          id: "modal_tiktok",
          pregunta: "¿Qué harías si alguien falta el respeto en un directo?",
        },
        programador: {
          id: "modal_programador",
          pregunta: "¿Qué lenguaje de programación dominas mejor?",
        },
        editor: {
          id: "modal_editor",
          pregunta: "¿Qué programa usas para editar y cuánto tiempo llevas haciéndolo?",
        },
        helper: {
          id: "modal_helper",
          pregunta: "¿Qué harías si un usuario necesita ayuda pero nadie del staff está disponible?",
        },
      };

      const modalInfo = modals[categoria];
      const modal = new ModalBuilder().setCustomId(modalInfo.id).setTitle(`Postulación: ${categoria}`);

      const preguntas = [
        { id: "nombre", label: "¿Cuál es tu nombre o apodo?", style: TextInputStyle.Short },
        { id: "edad", label: "¿Cuál es tu edad?", style: TextInputStyle.Short },
        { id: "experiencia", label: "¿Tienes experiencia previa en esta área? Si es así, ¿cuál?", style: TextInputStyle.Paragraph },
        { id: "tiempo", label: "¿Cuánto tiempo puedes dedicarle al rol semanalmente?", style: TextInputStyle.Short },
        { id: "motivo", label: "Motivo por el cual quieres unirte al equipo", style: TextInputStyle.Paragraph },
        { id: "extra", label: modalInfo.pregunta, style: TextInputStyle.Paragraph },
      ];

      preguntas.forEach((p) => {
        const input = new TextInputBuilder()
          .setCustomId(p.id)
          .setLabel(p.label)
          .setStyle(p.style)
          .setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
      });

      return interaction.showModal(modal);
    }

    // RECEPCIÓN DE MODAL ============================
    if (interaction.isModalSubmit()) {
      const user = interaction.user;
      const channel = client.channels.cache.get(POST_CHANNEL_ID);
      if (!channel) return;

      const categoria = interaction.customId.split("_")[1];
      const respuestas = interaction.fields.fields.map((f) => ({
        pregunta: f.components[0].data.label,
        respuesta: f.value || "*No respondió*",
      }));

      const embed = new EmbedBuilder()
        .setTitle(`📋 Nueva Postulación - ${categoria.toUpperCase()}`)
        .setColor(0x2b2d31)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: "Usuario", value: `${user}`, inline: false },
          ...respuestas.map((r) => ({ name: r.pregunta, value: r.respuesta || "*No respondió*" }))
        )
        .setFooter({ text: `ID: ${user.id}` })
        .setTimestamp();

      const botones = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`aceptar_${user.id}`).setLabel("Aceptar").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`rechazar_${user.id}`).setLabel("Rechazar").setStyle(ButtonStyle.Danger)
      );

      await channel.send({ embeds: [embed], components: [botones] });
      return interaction.reply({ content: "✅ Tu postulación fue enviada exitosamente.", ephemeral: true });
    }

    // BOTONES DE ACEPTAR/RECHAZAR ===================
    if (interaction.isButton()) {
      const [accion, userId] = interaction.customId.split("_");
      const miembro = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!miembro) return interaction.reply({ content: "Usuario no encontrado.", ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId(`motivo_${accion}_${userId}`)
        .setTitle(`Motivo de ${accion === "aceptar" ? "aceptación" : "rechazo"}`)
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("motivo")
              .setLabel("Carta o motivo del staff")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
          )
        );

      return interaction.showModal(modal);
    }

    // ENVÍO DE MOTIVO ===============================
    if (interaction.customId.startsWith("motivo_")) {
      const [_, accion, userId] = interaction.customId.split("_");
      const motivo = interaction.fields.getTextInputValue("motivo") || "Sin motivo especificado.";
      const miembro = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!miembro) return interaction.reply({ content: "Usuario no encontrado.", ephemeral: true });

      const color = accion === "aceptar" ? 0x00ff00 : 0xff0000;
      const titulo = accion === "aceptar" ? "✅ Postulación Aceptada" : "❌ Postulación Rechazada";

      const embed = new EmbedBuilder()
        .setTitle(titulo)
        .setDescription(`**Motivo del staff:**\n${motivo}`)
        .setColor(color)
        .setTimestamp();

      await miembro.send({ embeds: [embed] }).catch(() => {});
      return interaction.reply({ content: `✅ Acción completada y notificada a ${miembro.user.tag}.`, ephemeral: true });
    }
  });
};
