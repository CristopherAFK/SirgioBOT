require("dotenv").config();
const fs = require("fs");
const path = require("path");
const os = require("os");
const { connectDB, db, mongoose } = require('./database');
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder
} = require("discord.js");
const express = require("express");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User]
});

client.setMaxListeners(25);

connectDB().then(async connected => {
  if (connected) {
    console.log("🗄️ Base de datos MongoDB inicializada correctamente.");
    
    // Iniciar el bot solo después de que la DB esté lista
    try {
      await client.login(process.env.DISCORD_TOKEN || process.env.TOKEN);
    } catch (err) {
      console.error("❌ Fallo crítico al iniciar sesión en Discord:", err);
    }
  } else {
    console.error("❌ Error inicializando base de datos MongoDB.");
  }
});

require('./automod')(client);
require('./welcome.js')(client);
require('./postulaciones')(client);
require('./embed')(client);
require('./anuncio')(client);
require('./autoroles.js')(client);
require('./sugerencias.js')(client);
require('./notificaciones')(client);
require('./avisos')(client);
require('./utils/commands')(client);
require('./utils/stats')(client);
require('./utils/reminders')(client);
require('./utils/ratelimit')(client);
require('./utils/backup')(client);
require('./utils/audit')(client);

const STAFF_ROLE_IDS = [
  "1212891335929897030",
  "1229140504310972599",
  "1230952139015327755",
  "1230949752733175888"
];

const MOD_ROLE_IDS = [
  "1229140504310972599",
  "1212891335929897030",
  "1230952139015327755"
];

const TICKET_CATEGORY_ID = "1228437209628020736";
const LOGS_CHANNEL_ID = "1431416957160259764";
const GUILD_ID = "1212886282645147768";

const EMOJI_IDS = {
  discord_bots: { id: "1431413172513804348", name: "emoji_104" },
  report_user:  { id: "1431408998887981147", name: "emoji_99" },
  streams:      { id: "1268414311509004460", name: "Twitch" },
  lives:        { id: "1268414284077994034", name: "TikTok" },
  dudas:        { id: "1431412814345404618", name: "emoji_103" },
  otro:         { id: "1431415219367842032", name: "emoji_106" }
};

const PANEL_THUMBNAIL = "https://media.discordapp.net/attachments/1420914042251509990/1430698897927307347/79794618.png";

const CATEGORY_MESSAGES = {
  discord_bots: "Este ticket es para consultas sobre bots de Discord. Por favor, describe qué bot necesitas o qué problema tienes con algún bot.",
  report_user: "Este ticket es para reportar a un usuario. Por favor, proporciona:\n• El nombre/ID del usuario\n• Qué hizo\n• Pruebas (capturas, videos)",
  streams: "Este ticket es sobre Streams. Describe tu consulta o problema relacionado con los streams de Sirgio.",
  lives: "Este ticket es sobre Lives de TikTok. Describe tu consulta relacionada con los lives.",
  dudas: "Este ticket es para dudas generales. El staff te ayudará lo antes posible. Describe tu duda detalladamente.",
  sancion_injusta: "Este ticket es para apelar una sanción. Por favor, explica:\n• Qué sanción recibiste\n• Por qué crees que fue injusta\n• Cualquier contexto adicional",
  otro: "Este ticket es para otros temas. Describe detalladamente tu situación y el staff te ayudará.",
  apelacion: "Este ticket es una apelación de sanción. El staff revisará tu caso."
};

const FAQ_CONTENT = `**¿Puedo comunicarme con Sirgio mediante Tickets?**
R// No, Puedes comunicarte con el equipo de Sirgio los cuales te ayudaran en dado caso quieras comunicarte con el para una colaboración o promoción.

**¿Cuando abren las postulaciones?**
R// No hay fecha definida, se avisara unos dias antes o el mismo dia de la apertura de postulaciones en el canal de anuncios.

**¿Que Rol necesito para mandar sugerencias?**
R// Necesitas ser Minimo Nivel 5.

**¿Que hago si un usuario me esta molestando o me ofendio?**
R// Crea un ticket con la categoria "Reportar usuario"

**¿Que dias Sirgio Hace Streams/Lives?**
R// Sirgio No tiene un horario fijo, siempre anuncia unos minutos antes de prender Live.

**¿Que recompensas obtengo por boostear el server?**
R// Una tarjeta personalizada en el sistema de Niveles, Un 200% mas de XP en el sistema de Niveles, Acceso a canales exclusivos y a información como spoilers de actualizaciones futuras.

**¿Que Recompensas obtengo por ser VIP en tiktok o Twitch?**
R// Acceso a canales exclusivos, Un 200% mas de XP en el sistema de niveles y una tarjeta personalizada en el mismo.

**¿Puedo postularme otra vez si me rechazaron cuando me postule?**
R// Si, pero debes esperar a la siguente ronda de postulaciones y cumplir los requisitos de tu area a postular.

**¿Cada cuando se reinicia el Leaderboard de niveles?**
R// Cada inicio de mes

**¿Cada cuanto se reinicia el sistema de economia?**
R// Cada 60 dias.

**¿Cada cuanto hay una actualización en el servidor?**
R// Cada 30 o 35 dias dependiendo el mes.

**¿Cuales son las recompensas por subir de nivel?**
R// puedes verlas haciendo /rewards list.`;

function sanitizeChannelName(name) {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 90);
}

function isStaff(member) {
  if (!member) return false;
  return member.roles.cache.some(r => STAFF_ROLE_IDS.includes(r.id));
}

function isMod(member) {
  if (!member) return false;
  return member.roles.cache.some(r => MOD_ROLE_IDS.includes(r.id));
}

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (message.content.toLowerCase() !== "!panel") return;

    if (!message.member) await message.guild.members.fetch(message.author.id).catch(() => {});
    if (!isStaff(message.member)) {
      return message.reply("❌ Solo el staff puede usar este comando.");
    }

    const embed = new EmbedBuilder()
      .setTitle("🎟️ LagSupport")
      .setDescription(
        "¿Tienes alguna duda respecto al servidor? ¿Alguien te está molestando y deseas reportarlo? ¿Deseas apelar una sanción injusta?\n\n" +
        "En este canal podrás abrir un ticket para hablar directamente con el staff de Sirgio, quienes te ayudarán con los problemas o dudas que tengas. " +
        "Simplemente tienes que elegir una opción con el menú de abajo el tipo de ayuda que necesitas y después explicar el problema que tienes."
      )
      .setColor(0x00FF80)
      .setThumbnail(PANEL_THUMBNAIL)
      .setTimestamp();

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_category_select")
      .setPlaceholder("Selecciona una categoría")
      .addOptions([
        { label: "Discord Bots", value: "discord_bots", emoji: EMOJI_IDS.discord_bots },
        { label: "Reportar usuario", value: "report_user", emoji: EMOJI_IDS.report_user },
        { label: "Streams", value: "streams", emoji: EMOJI_IDS.streams },
        { label: "Lives", value: "lives", emoji: EMOJI_IDS.lives },
        { label: "Dudas", value: "dudas", emoji: EMOJI_IDS.dudas },
        { label: "Sanción injusta", value: "sancion_injusta", emoji: "🚫" },
        { label: "Otro", value: "otro", emoji: EMOJI_IDS.otro }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);
    await message.channel.send({ embeds: [embed], components: [row] });
    await message.reply({ content: "✅ Panel de tickets enviado correctamente.", ephemeral: true }).catch(()=>{});
  } catch (err) {
    console.error("Error en !panel:", err);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_category_select") {
      const chosen = interaction.values[0];
      const userId = interaction.user.id;

      const existingTicket = await db.getTicketByOwner(userId);
      if (existingTicket) {
        const ch = interaction.guild.channels.cache.get(existingTicket.channelId) || 
                   await interaction.guild.channels.fetch(existingTicket.channelId).catch(()=>null);
        return interaction.reply({ content: `❗️ Ya tienes un ticket abierto: ${ch ? ch.toString() : existingTicket.channelId}`, ephemeral: true });
      }

      const confirmId = `confirm_ticket_${userId}_${Date.now()}_${chosen}`;
      const cancelId = `cancel_ticket_${userId}_${Date.now()}_${chosen}`;
      const faqId = `faq_ticket_${userId}_${Date.now()}`;
      
      const confirmBtn = new ButtonBuilder().setCustomId(confirmId).setLabel("Aceptar ✅").setStyle(ButtonStyle.Success);
      const cancelBtn = new ButtonBuilder().setCustomId(cancelId).setLabel("Cancelar ❌").setStyle(ButtonStyle.Danger);
      const faqBtn = new ButtonBuilder().setCustomId(faqId).setLabel("📋 Ver Preguntas Frecuentes").setStyle(ButtonStyle.Secondary);
      const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn, faqBtn);

      const embed = new EmbedBuilder()
        .setTitle("🟢 Confirmar apertura de ticket")
        .setDescription(`${EMOJI_IDS[chosen] ? `<:${EMOJI_IDS[chosen].name}:${EMOJI_IDS[chosen].id}> ` : ""}Has elegido: **${chosen.replace(/_/g, " ")}**\n\nSi continúas se abrirá un ticket en el que podrás explicar tu problema.`)
        .setColor(0x00FF80)
        .setTimestamp();

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id.startsWith("faq_ticket_")) {
        const faqEmbed = new EmbedBuilder()
          .setTitle("📋 Preguntas Frecuentes")
          .setDescription(FAQ_CONTENT)
          .setColor(0x5865F2)
          .setFooter({ text: "Si tu duda no está aquí, continúa con el ticket" })
          .setTimestamp();
        
        return interaction.reply({ embeds: [faqEmbed], ephemeral: true });
      }

      if (id.startsWith("cancel_ticket_")) {
        const parts = id.split("_");
        const odId = parts[2];
        if (odId !== interaction.user.id && !isStaff(interaction.member)) {
          return interaction.reply({ content: "❗ Solo quien inició la apertura o el staff puede cancelar.", ephemeral: true });
        }
        return interaction.update({ content: "❌ Apertura de ticket cancelada.", embeds: [], components: [] });
      }

      if (id.startsWith("confirm_ticket_")) {
        const parts = id.split("_");
        const odId = parts[2];
        const chosen = parts.slice(4).join("_") || "otro";

        if (odId !== interaction.user.id && !isStaff(interaction.member)) {
          return interaction.reply({ content: "❗ Solo quien inició la apertura o el staff puede confirmar.", ephemeral: true });
        }

        const existingTicket = await db.getTicketByOwner(odId);
        if (existingTicket) {
          const ch = interaction.guild.channels.cache.get(existingTicket.channelId) || 
                     await interaction.guild.channels.fetch(existingTicket.channelId).catch(()=>null);
          return interaction.update({ content: `❗️ Ya tienes un ticket abierto: ${ch ? ch.toString() : existingTicket.channelId}`, embeds: [], components: [] });
        }

        const lastTicket = await db.getLastTicketNumber();
        const ticketNum = lastTicket + 1;
        const number = String(ticketNum).padStart(3, "0");
        const username = interaction.user.username || "user";
        const rawName = `${username}-${number}`;
        const chanName = sanitizeChannelName(rawName);

        const overwrites = [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
          ...STAFF_ROLE_IDS.map(roleId => ({
            id: roleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          }))
        ];

        let channel;
        try {
          channel = await interaction.guild.channels.create({
            name: chanName,
            type: ChannelType.GuildText,
            parent: TICKET_CATEGORY_ID,
            permissionOverwrites: overwrites,
            reason: `Ticket creado por ${interaction.user.tag}`
          });
        } catch (err) {
          console.warn("No se pudo crear canal con parent (categoria):", err);
          channel = await interaction.guild.channels.create({
            name: chanName,
            type: ChannelType.GuildText,
            permissionOverwrites: overwrites,
            reason: `Ticket creado por ${interaction.user.tag} (categoria fallback)`
          });
        }

        await db.createTicket(channel.id, interaction.user.id, number, chosen);

        await db.addAuditLog('TICKET_CREATE', interaction.user.id, null, null, {
          channelId: channel.id,
          ticketNumber: number,
          category: chosen
        });

        const claimBtn = new ButtonBuilder().setCustomId(`claim_ticket_${channel.id}`).setLabel("🧑‍💼 Atender ticket").setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(claimBtn);

        const categoryMessage = CATEGORY_MESSAGES[chosen] || CATEGORY_MESSAGES.otro;

        const embedTicket = new EmbedBuilder()
          .setTitle("👋 ¡Bienvenido!")
          .setDescription(`<@${interaction.user.id}> Bienvenido a tu ticket.\n\n**Categoría:** ${chosen.replace(/_/g, " ")}\n\n${categoryMessage}\n\nEl Staff atenderá tu caso en breve.`)
          .setColor(0x00FF80)
          .setFooter({ text: `Ticket #${number}` })
          .setTimestamp();

        await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embedTicket], components: [row] });

        try {
          await interaction.update({ content: `✅ Ticket creado: ${channel}`, embeds: [], components: [] });
        } catch {
          await interaction.reply({ content: `✅ Ticket creado: ${channel}`, ephemeral: true });
        }

        return;
      }

      if (id.startsWith("claim_ticket_")) {
        const channelId = id.replace("claim_ticket_", "");
        const ticket = await db.getTicketByChannel(channelId);
        
        if (!ticket) {
          return interaction.reply({ content: "❗ Ticket no encontrado en registros.", ephemeral: true });
        }

        if (!isMod(interaction.member)) {
          return interaction.reply({ content: "❌ Solo moderadores pueden atender tickets.", ephemeral: true });
        }

        if (ticket.claimedBy) {
          return interaction.reply({ content: `❗ Este ticket ya fue atendido por <@${ticket.claimedBy}>.`, ephemeral: true });
        }

        try {
          await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
          });
        } catch (err) {
          console.warn("No se pudieron editar permisos al claim:", err);
        }

        await db.claimTicket(channelId, interaction.user.id);
        await db.updateStaffStats(interaction.user.id, 'claim');

        await db.addAuditLog('TICKET_CLAIM', ticket.ownerId, null, interaction.user.id, {
          channelId,
          ticketNumber: ticket.ticketNumber
        });

        const ownerId = ticket.ownerId;
        await interaction.channel.send({ content: `💬 Hola <@${ownerId}>, gracias por comunicarte con el staff. <@${interaction.user.id}> atenderá tu ticket.` });
        
        try {
          await interaction.message.edit({ components: [] });
        } catch {}
        
        return interaction.reply({ content: `Has atendido el ticket ${interaction.channel}.`, ephemeral: true });
      }

      if (id.startsWith("rate_ticket_")) {
        const parts = id.split("_");
        const rating = parseInt(parts[2]);
        const ticketNumber = parts[3];

        const modal = new ModalBuilder()
          .setCustomId(`rating_comment_${rating}_${ticketNumber}`)
          .setTitle("Comentario sobre la atención");

        const commentInput = new TextInputBuilder()
          .setCustomId("comment")
          .setLabel("¿Algún comentario adicional? (opcional)")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setPlaceholder("Cuéntanos tu experiencia...");

        modal.addComponents(new ActionRowBuilder().addComponents(commentInput));
        return interaction.showModal(modal);
      }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("rating_comment_")) {
      const parts = interaction.customId.split("_");
      const rating = parseInt(parts[2]);
      const ticketNumber = parts[3];
      const comment = interaction.fields.getTextInputValue("comment") || "Sin comentario";

      const stars = "⭐".repeat(rating) + "☆".repeat(5 - rating);

      try {
        const ticketData = await db.getTicketByNumber(ticketNumber);
        
        if (ticketData) {
          await db.rateTicket(ticketNumber, rating, comment);
          
          if (ticketData.claimedBy) {
            await db.updateStaffStats(ticketData.claimedBy, 'rate', null, rating);
          }

          await db.addAuditLog('TICKET_RATE', interaction.user.id, ticketData.claimedBy, null, {
            ticketNumber,
            rating,
            comment
          });
        }

        const guild = interaction.guild || client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID).catch(() => null);
        
        if (guild) {
          const logsChannel = await guild.channels.fetch(LOGS_CHANNEL_ID).catch(() => null);
          
          if (logsChannel) {
            const staffMemberTag = ticketData?.claimedBy ? `<@${ticketData.claimedBy}>` : "No asignado";
            
            const ratingEmbed = new EmbedBuilder()
              .setTitle("⭐ Calificación de Ticket #" + ticketNumber)
              .setDescription(`El usuario ha calificado su experiencia con el soporte`)
              .addFields(
                { name: "Usuario", value: `<@${interaction.user.id}>`, inline: true },
                { name: "Staff que atendió", value: staffMemberTag, inline: true },
                { name: "Calificación", value: `${stars} (${rating}/5)`, inline: true },
                { name: "Comentario", value: comment || "Sin comentario", inline: false }
              )
              .setColor(rating >= 4 ? 0x00ff00 : rating >= 3 ? 0xffff00 : 0xff0000)
              .setTimestamp();

            await logsChannel.send({ embeds: [ratingEmbed] });
            console.log(`📊 Calificación de ticket #${ticketNumber} enviada al canal de logs`);
          }
        }
      } catch (err) {
        console.error("Error procesando calificación:", err);
      }

      return interaction.reply({ content: `¡Gracias por tu calificación! ${stars}`, ephemeral: true });
    }

  } catch (err) {
    console.error("Error en interactionCreate:", err);
    try { if (!interaction.replied) await interaction.reply({ content: "Ocurrió un error.", ephemeral: true }); } catch {}
  }
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    const parts = message.content.trim().toLowerCase().split(/\s+/);
    const cmd = parts[0];
    const closeCmds = ["!cerrar", "!close", "!eliminar", "!borrar"];
    if (!closeCmds.includes(cmd)) return;

    if (!message.member) await message.guild.members.fetch(message.author.id).catch(()=>{});
    if (!isStaff(message.member)) return message.reply("❌ Solo el staff puede usar este comando.");

    const channel = message.channel;
    const ticket = await db.getTicketByChannel(channel.id);
    
    if (!ticket) {
      return message.reply("⚠️ Este canal no parece ser un ticket gestionado por el sistema.");
    }

    let allMessages = [];
    try {
      let lastId;
      while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;
        const fetched = await channel.messages.fetch(options);
        if (!fetched || fetched.size === 0) break;
        const arr = Array.from(fetched.values());
        allMessages.push(...arr);
        lastId = arr[arr.length - 1].id;
        if (fetched.size < 100) break;
      }
      allMessages = allMessages.sort((a,b) => a.createdTimestamp - b.createdTimestamp);
    } catch (err) {
      console.warn("No se pudieron leer todos los mensajes para transcripción:", err);
    }

    let transcript = `Transcripción - Ticket #${ticket.ticketNumber} - ${channel.name}\nCreado por: <@${ticket.ownerId}>\nCategoría: ${ticket.category}\nCerrado por: <@${message.author.id}>\nFecha: ${new Date().toISOString()}\n\n--- Mensajes ---\n\n`;
    for (const m of allMessages) {
      const time = new Date(m.createdTimestamp).toISOString();
      const author = `${m.author.tag} (${m.author.id})`;
      let content = m.content || "";
      if (m.attachments && m.attachments.size > 0) {
        const urls = m.attachments.map(a => a.url).join(", ");
        content += (content ? " " : "") + `[Adjuntos: ${urls}]`;
      }
      transcript += `[${time}] ${author}: ${content}\n`;
    }

    const filename = `transcript-${channel.name || ticket.ticketNumber}.txt`;
    const tmpPath = path.join(os.tmpdir(), `${Date.now()}-${filename}`);
    try {
      fs.writeFileSync(tmpPath, transcript, "utf8");
    } catch (err) {
      console.error("Error creando archivo temporal de transcripción:", err);
    }

    try {
      const logsChannel = await message.guild.channels.fetch(LOGS_CHANNEL_ID).catch(()=>null);
      const embed = new EmbedBuilder()
        .setTitle("📁 Transcripción de ticket")
        .setDescription(`Se ha cerrado el ticket **#${ticket.ticketNumber}** (${channel.name}).`)
        .addFields(
          { name: "Usuario", value: `<@${ticket.ownerId}>`, inline: true },
          { name: "Cerrado por", value: `<@${message.author.id}>`, inline: true },
          { name: "Canal", value: `${channel.name}`, inline: true }
        )
        .setColor(0x00FF80)
        .setTimestamp();

      if (logsChannel) {
        const attachment = new AttachmentBuilder(tmpPath, { name: filename });
        await logsChannel.send({ embeds: [embed], files: [attachment] }).catch(err => {
          console.warn("No se pudo enviar la transcripción al canal logs:", err);
        });
      }
    } catch (err) {
      console.error("Error enviando transcripción al canal logs:", err);
    }

    await db.closeTicket(channel.id, message.author.id);
    
    if (ticket.claimedBy) {
      await db.updateStaffStats(ticket.claimedBy, 'close');
    }

    await db.addAuditLog('TICKET_CLOSE', ticket.ownerId, null, message.author.id, {
      channelId: channel.id,
      ticketNumber: ticket.ticketNumber
    });

    try {
      const ticketOwner = await client.users.fetch(ticket.ownerId).catch(() => null);
      if (ticketOwner) {
        const ratingEmbed = new EmbedBuilder()
          .setTitle("⭐ Califica tu experiencia")
          .setDescription(`Tu ticket #${ticket.ticketNumber} ha sido cerrado.\n\n¿Cómo calificarías la atención recibida?`)
          .setColor(0x5865F2)
          .setFooter({ text: "Tu opinión nos ayuda a mejorar" })
          .setTimestamp();

        const ratingRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`rate_ticket_1_${ticket.ticketNumber}`).setLabel("1").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`rate_ticket_2_${ticket.ticketNumber}`).setLabel("2").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`rate_ticket_3_${ticket.ticketNumber}`).setLabel("3").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`rate_ticket_4_${ticket.ticketNumber}`).setLabel("4").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`rate_ticket_5_${ticket.ticketNumber}`).setLabel("5").setStyle(ButtonStyle.Success)
        );

        await ticketOwner.send({ embeds: [ratingEmbed], components: [ratingRow] }).catch(() => {
          console.warn("No se pudo enviar mensaje de calificación al usuario (DMs cerrados)");
        });
      }
    } catch (err) {
      console.error("Error enviando mensaje de calificación:", err);
    }

    await message.reply("🗑️ Ticket cerrado. Eliminando canal en 5 segundos...");
    setTimeout(async () => {
      try {
        await channel.delete("Ticket cerrado por staff");
      } catch (err) {
        console.error("Error eliminando canal de ticket:", err);
      } finally {
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
      }
    }, 5000);

  } catch (err) {
    console.error("Error en comando de cierre de ticket:", err);
  }
});

client.once("ready", () => {
  console.log(`✅ SirgioBOT conectado como ${client.user.tag}`);
  client.user.setActivity("LagSupport", { type: 3 });
  
  setInterval(async () => {
    try {
      await db.cleanupRateLimits();
      const cleaned = await db.cleanupOldWarnings();
      if (cleaned.length > 0) {
        console.log(`🧹 Limpiados ${cleaned.length} warns antiguos`);
      }
    } catch (err) {
      console.error("Error en limpieza periódica:", err);
    }
  }, 60 * 60 * 1000);
});

const app = express();
app.get("/", (req, res) => res.send("SirgioBOT is alive!"));
app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));
app.listen(process.env.PORT || 3000, () => console.log("🌐 Servidor web activo para mantener el bot despierto."));

client.once("ready", () => {
  console.log(`✅ Bot encendido como ${client.user.tag}`);
  console.log(`🌐 Servidor: ${client.guilds.cache.size} guilds`);
});

client.on("error", (error) => {
  console.error("❌ Error de Discord:", error);
});
