// sugerencias.js - Versión corregida y robusta
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder
} = require("discord.js");

// CONFIG - ajusta IDs
const CANAL_PUBLICO = "1440873532580954112";
const CANAL_STAFF = "1435091853308461179";
const STAFF_ROLE = "1230949715127042098";

// Ruta local al GIF (ya convertido). Si lo pones en /assets/sugerencia.gif
const GIF_PATH = "./assets/sugerencia.gif";

module.exports = (client) => {

  client.on("ready", async () => {
    const comandos = [
      new SlashCommandBuilder()
        .setName("sugerir")
        .setDescription("Envía una sugerencia.")
        .addStringOption(opt =>
          opt.setName("texto").setDescription("Tu sugerencia").setRequired(true)
        )
    ].map(c => c.toJSON());

    await client.application.commands.set(comandos);
    console.log("[Sugerencias] Comando /sugerir cargado.");
  });

  // ÚNICO listener para todas las interacciones
  client.on("interactionCreate", async (interaction) => {
    try {

      // -----------------------------
      // 1) Comando /sugerir
      // -----------------------------
      if (interaction.isChatInputCommand() && interaction.commandName === "sugerir") {
        try {
          const texto = interaction.options.getString("texto");
          const canalPublico = await client.channels.fetch(CANAL_PUBLICO);

          const gifAttachment = new AttachmentBuilder(GIF_PATH);

          const embedPublico = new EmbedBuilder()
            .setTitle("📩 Nueva Sugerencia")
            .setDescription(texto)
            .addFields(
              { name: "Autor", value: `<@${interaction.user.id}>` },
              { name: "Estado", value: "🕓 **Sin revisar**" }
            )
            .setThumbnail("attachment://sugerencia.gif")
            .setColor("#3498db")
            .setTimestamp();

          const msgPublica = await canalPublico.send({ embeds: [embedPublico], files: [gifAttachment] });

          // Reacciones (emojis seguros)
          await msgPublica.react("👍");
          await msgPublica.react("👎");

          // Enviar al staff con botones y guardar ID del mensaje público en el embed/footer
          const embedStaff = EmbedBuilder.from(embedPublico)
            .setFooter({ text: `MSG:${msgPublica.id}` });

          const botones = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("aprobar").setLabel("Aprobar").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("rechazar").setLabel("Rechazar").setStyle(ButtonStyle.Danger)
          );

          const canalStaff = await client.channels.fetch(CANAL_STAFF);
          await canalStaff.send({ embeds: [embedStaff], components: [botones] });

          // Responder al usuario (ephemeral usando flags)
          if (!interaction.replied && !interaction.deferred) {
            return await interaction.reply({ content: "✅ Tu sugerencia ha sido enviada al staff.", flags: 64 });
          } else {
            return await interaction.followUp({ content: "✅ Tu sugerencia ha sido enviada al staff.", flags: 64 });
          }
        } catch (errCmd) {
          console.error("Error manejando /sugerir:", errCmd);
          if (!interaction.replied && !interaction.deferred) {
            return await interaction.reply({ content: "❌ Ocurrió un error al enviar la sugerencia.", flags: 64 });
          } else {
            return await interaction.followUp({ content: "❌ Ocurrió un error al enviar la sugerencia.", flags: 64 });
          }
        }
      }

      // -----------------------------
      // 2) Botones (aprove/reject)
      // -----------------------------
      if (interaction.isButton()) {
        try {
          // Solo staff
          if (!interaction.member.roles.cache.has(STAFF_ROLE)) {
            if (!interaction.replied && !interaction.deferred) {
              return await interaction.reply({ content: "❌ No tienes permisos.", flags: 64 });
            } else {
              return await interaction.followUp({ content: "❌ No tienes permisos.", flags: 64 });
            }
          }

          // Extraer ID del mensaje público del embed footer del mensaje del staff
          const staffEmbed = interaction.message.embeds?.[0];
          if (!staffEmbed || !staffEmbed.footer?.text) {
            if (!interaction.replied && !interaction.deferred) {
              return await interaction.reply({ content: "❌ No se encontró la referencia a la sugerencia pública.", flags: 64 });
            } else {
              return await interaction.followUp({ content: "❌ No se encontró la referencia a la sugerencia pública.", flags: 64 });
            }
          }

          const footerText = staffEmbed.footer.text; // debería ser "MSG:1234..."
          const publicMsgId = footerText.replace("MSG:", "").trim();

          // Creamos el modal y metemos la info en el customId para usarla luego
          // customId del modal -> "modal_aprobar|<publicMsgId>" o "modal_rechazar|<publicMsgId>"
          const action = interaction.customId === "aprobar" ? "modal_aprobar" : "modal_rechazar";
          const modalCustomId = `${action}|${publicMsgId}`;

          const modal = new ModalBuilder()
            .setCustomId(modalCustomId)
            .setTitle(action === "modal_aprobar" ? "Aprobar sugerencia" : "Rechazar sugerencia");

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("razon")
                .setLabel("Razón")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
            )
          );

          // showModal no envía respuesta final, así que no hay conflicto con replies
          return await interaction.showModal(modal);
        } catch (errBtn) {
          console.error("Error manejando botón:", errBtn);
          if (!interaction.replied && !interaction.deferred) {
            return await interaction.reply({ content: "❌ Error interno (botón).", flags: 64 });
          } else {
            return await interaction.followUp({ content: "❌ Error interno (botón).", flags: 64 });
          }
        }
      }

      // -----------------------------
      // 3) Modal Submit (aprobado/rechazado)
      // -----------------------------
      if (interaction.isModalSubmit()) {
        try {
          // customId tiene la forma: "modal_aprobar|<publicMsgId>"
          const custom = interaction.customId || "";
          const parts = custom.split("|");
          const action = parts[0]; // modal_aprobar o modal_rechazar
          const publicMsgId = parts[1];

          if (!publicMsgId) {
            if (!interaction.replied && !interaction.deferred) {
              return await interaction.reply({ content: "❌ No se encontró referencia a la sugerencia pública.", flags: 64 });
            } else {
              return await interaction.followUp({ content: "❌ No se encontró referencia a la sugerencia pública.", flags: 64 });
            }
          }

          const razon = interaction.fields.getTextInputValue("razon");
          const aprobado = action === "modal_aprobar";

          // Cargar mensaje público y editar embed
          const canalPublico = await client.channels.fetch(CANAL_PUBLICO);
          const mensajePublico = await canalPublico.messages.fetch(publicMsgId);

          // Si por alguna razón no tiene embed, abortamos
          if (!mensajePublico || !mensajePublico.embeds?.[0]) {
            if (!interaction.replied && !interaction.deferred) {
              return await interaction.reply({ content: "❌ No se encontró el mensaje público original.", flags: 64 });
            } else {
              return await interaction.followUp({ content: "❌ No se encontró el mensaje público original.", flags: 64 });
            }
          }

          // Mantener la imagen GIF (attachment). Para editar mensaje y conservar el thumbnail attachment,
          // volvemos a adjuntar el GIF en la edición.
          const gifAttachment = new AttachmentBuilder(GIF_PATH);

          const oldEmbed = mensajePublico.embeds[0];
          const embedEditado = EmbedBuilder.from(oldEmbed)
            .setFields(
              { name: "Autor", value: oldEmbed.fields?.find(f => f.name === "Autor")?.value ?? "Desconocido" },
              { name: "Estado", value: aprobado ? "✅ **Aprobada**" : "❌ **Rechazada**" },
              { name: "Razón", value: razon }
            )
            .setThumbnail("attachment://sugerencia.gif")
            .setColor(aprobado ? "Green" : "Red")
            .setFooter({ text: `Revisado por ${interaction.user.tag}` })
            .setTimestamp();

          await mensajePublico.edit({ embeds: [embedEditado], files: [gifAttachment] });

          if (!interaction.replied && !interaction.deferred) {
            return await interaction.reply({ content: `✔ Sugerencia ${aprobado ? "aprobada" : "rechazada"}.`, flags: 64 });
          } else {
            return await interaction.followUp({ content: `✔ Sugerencia ${aprobado ? "aprobada" : "rechazada"}.`, flags: 64 });
          }

        } catch (errModal) {
          console.error("Error manejando modal submit:", errModal);
          if (!interaction.replied && !interaction.deferred) {
            return await interaction.reply({ content: "❌ Error interno (modal).", flags: 64 });
          } else {
            return await interaction.followUp({ content: "❌ Error interno (modal).", flags: 64 });
          }
        }
      }

    } catch (outerErr) {
      // capturar cualquier otro error inesperado aquí para evitar que el cliente emita 'error' y crashee
      console.error("Error inesperado en interactionCreate:", outerErr);
      try {
        if (interaction && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "❌ Error inesperado.", flags: 64 });
        }
      } catch {}
    }
  });

};