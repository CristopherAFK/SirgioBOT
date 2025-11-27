// =========================
// SirgioBOT - Sistema de Tickets completo (único archivo)
// - !panel -> envía embed verde + select (no botón intermedio)
// - Confirmación (Aceptar / Cancelar)
// - Un ticket por usuario
// - ticket-username-001
// - Persistencia en tickets.json
// - Mensaje en el canal del ticket con botón "Atender ticket" (staff)
// - Claim: staff al pulsar "Atender ticket" anuncia que atenderá
// - !cerrar / !close / !eliminar / !borrar -> solo staff: genera transcripción .txt -> envía a canal logs -> elimina canal
// =========================

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const os = require("os");
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
  AttachmentBuilder
} = require("discord.js");
const express = require("express");

// -------------------------
// CONFIG
// -------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

// =========================
// CARGAR SISTEMAS
// =========================
require('./automod')(client);
require('./welcome.js')(client);
require('./postulaciones')(client);
require('./embed')(client);
require('./autoroles.js')(client);
require('./anuncio')(client):

// STAFF ROLES (admin, mod, headadmin)
const STAFF_ROLE_IDS = [
  "1212891335929897030", // admin
  "1229140504310972599", // mod
  "1230952139015327755"  // headadmin (incluido por si acaso)
];

// ID de la categoría donde se crearán los tickets
const TICKET_CATEGORY_ID = "1228437209628020736";

// Canal donde se enviarán las transcripciones (logs)
const LOGS_CHANNEL_ID = "1431416957160259764";

// Archivo de persistencia
const DATA_FILE = path.join(__dirname, "tickets.json");

// Emojis personalizados (objeto usado por select/embeds)
const EMOJI_IDS = {
  discord_bots: { id: "1431413172513804348", name: "emoji_104" },
  report_user:  { id: "1431408998887981147", name: "emoji_99" },
  streams:      { id: "1268414311509004460", name: "Twitch" },
  lives:        { id: "1268414284077994034", name: "TikTok" },
  dudas:        { id: "1431412814345404618", name: "emoji_103" },
  otro:         { id: "1431415219367842032", name: "emoji_106" }
};

// Thumbnail para el embed del panel (aparecerá arriba a la derecha)
const PANEL_THUMBNAIL = "https://media.discordapp.net/attachments/1420914042251509990/1430698897927307347/79794618.png";

// -------------------------
// PERSISTENCIA - cargar / guardar
// -------------------------
let data = { lastTicket: 0, userHasTicket: {}, channels: {} };
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    data = JSON.parse(raw);
    if (!data.lastTicket) data.lastTicket = 0;
    if (!data.userHasTicket) data.userHasTicket = {};
    if (!data.channels) data.channels = {};
    console.log(`📁 tickets.json cargado (lastTicket=${data.lastTicket})`);
  } catch (err) {
    console.error("⚠️ Error leyendo tickets.json, se recreará uno nuevo:", err);
    data = { lastTicket: 0, userHasTicket: {}, channels: {} };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  }
} else {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("⚠️ Error guardando tickets.json:", err);
  }
}

function sanitizeChannelName(name) {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 90);
}

function isStaff(member) {
  if (!member) return false;
  return member.roles.cache.some(r => STAFF_ROLE_IDS.includes(r.id));
}

// -------------------------
// !panel -> enviar embed + select (visible donde lo invoquen staff)
// -------------------------
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

// -------------------------
// Interactions: select -> confirm buttons, buttons -> confirm/cancel/claim
// -------------------------
client.on("interactionCreate", async (interaction) => {
  try {
    // ---- Select menu: user eligió categoría ----
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_category_select") {
      const chosen = interaction.values[0];
      const userId = interaction.user.id;

      // Verificar ticket existente
      if (data.userHasTicket[userId]) {
        const chId = data.userHasTicket[userId];
        const ch = interaction.guild.channels.cache.get(chId) || await interaction.guild.channels.fetch(chId).catch(()=>null);
        return interaction.reply({ content: `❗️ Ya tienes un ticket abierto: ${ch ? ch.toString() : chId}`, ephemeral: true });
      }

      // Crear botones confirm/cancel
      const confirmId = `confirm_ticket_${userId}_${Date.now()}_${chosen}`;
      const cancelId = `cancel_ticket_${userId}_${Date.now()}_${chosen}`;
      const confirmBtn = new ButtonBuilder().setCustomId(confirmId).setLabel("Aceptar ✅").setStyle(ButtonStyle.Success);
      const cancelBtn = new ButtonBuilder().setCustomId(cancelId).setLabel("Cancelar ❌").setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

      const embed = new EmbedBuilder()
        .setTitle("🟢 Confirmar apertura de ticket")
        .setDescription(`${EMOJI_IDS[chosen] ? `<:${EMOJI_IDS[chosen].name}:${EMOJI_IDS[chosen].id}> ` : ""}Has elegido: **${chosen.replace(/_/g, " ")}**\n\nSi continúas se abrirá un ticket en el que podrás explicar tu problema.`)
        .setColor(0x00FF80)
        .setTimestamp();

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    // ---- Botones ----
    if (interaction.isButton()) {
      const id = interaction.customId;

      // Cancel button
      if (id.startsWith("cancel_ticket_")) {
        const parts = id.split("_");
        const userId = parts[2];
        // Solo el que inició o staff puede cancelar
        if (userId !== interaction.user.id && !isStaff(interaction.member)) {
          return interaction.reply({ content: "❗ Solo quien inició la apertura o el staff puede cancelar.", ephemeral: true });
        }
        return interaction.update({ content: "❌ Apertura de ticket cancelada.", embeds: [], components: [] });
      }

      // Confirm button -> crear ticket
      if (id.startsWith("confirm_ticket_")) {
        const parts = id.split("_");
        const userId = parts[2];
        const chosen = parts.slice(4).join("_") || "otro";

        // Solo el que inició o staff puede confirmar
        if (userId !== interaction.user.id && !isStaff(interaction.member)) {
          return interaction.reply({ content: "❗ Solo quien inició la apertura o el staff puede confirmar.", ephemeral: true });
        }

        // doble-check ticket abierto
        if (data.userHasTicket[userId]) {
          const existingId = data.userHasTicket[userId];
          const ch = interaction.guild.channels.cache.get(existingId) || await interaction.guild.channels.fetch(existingId).catch(()=>null);
          return interaction.update({ content: `❗️ Ya tienes un ticket abierto: ${ch ? ch.toString() : existingId}`, embeds: [], components: [] });
        }

        // Generar nuevo ticket
        data.lastTicket = (data.lastTicket || 0) + 1;
        const number = String(data.lastTicket).padStart(3, "0");
        const username = interaction.user.username || "user";
        const rawName = `${username}-${number}`;
        const chanName = sanitizeChannelName(rawName);

        // Preparar overwrites
        const overwrites = [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
          ...STAFF_ROLE_IDS.map(roleId => ({
            id: roleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          }))
        ];

        // Intentar crear canal en la categoría; si falla, crear sin parent
        let channel;
        try {
          // si la categoría existe, la usamos; si no, Discord ignorará parent si es inválido -> atrapamos error
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

        // Guardar referencias
        data.userHasTicket[interaction.user.id] = channel.id;
        data.channels[channel.id] = {
          ownerId: interaction.user.id,
          number,
          category: chosen,
          createdAt: new Date().toISOString(),
          claimedBy: null
        };
        saveData();

        // Mensaje en el canal del ticket con botón "Atender ticket"
        const claimBtn = new ButtonBuilder().setCustomId(`claim_ticket_${channel.id}`).setLabel("🧑‍💼 Atender ticket").setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(claimBtn);

        const embedTicket = new EmbedBuilder()
          .setTitle("👋 ¡Bienvenido!")
          .setDescription(`<@${interaction.user.id}> Bienvenido\n\nEl Staff atenderá tu caso en breve.`)
          .setColor(0x00FF80)
          .setFooter({ text: `Ticket #${number}` })
          .setTimestamp();

        await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embedTicket], components: [row] });

        // Responder al usuario (ephemeral)
        try {
          await interaction.update({ content: `✅ Ticket creado: ${channel}`, embeds: [], components: [] });
        } catch {
          await interaction.reply({ content: `✅ Ticket creado: ${channel}`, ephemeral: true });
        }

        return;
      }

      // Claim button -> staff atendiendo
      if (id.startsWith("claim_ticket_")) {
        const channelId = id.replace("claim_ticket_", "");
        const ticket = data.channels[channelId];
        if (!ticket) return interaction.reply({ content: "❗ Ticket no encontrado en registros.", ephemeral: true });

        // Solo staff puede claim
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "❌ Solo moderadores/administradores pueden atender tickets.", ephemeral: true });
        }

        // Intentar dar permiso específico al claimer (no estrictamente necesario si roles ya tienen acceso)
        try {
          await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
          });
        } catch (err) {
          console.warn("No se pudieron editar permisos al claim:", err);
        }

        ticket.claimedBy = interaction.user.id;
        saveData();

        // Mensaje anunciando quien atenderá
        const ownerId = ticket.ownerId;
        await interaction.channel.send({ content: `💬 Hola <@${ownerId}>, gracias por comunicarte con el staff. <@${interaction.user.id}> atenderá tu ticket.` });
        return interaction.reply({ content: `Has atendido el ticket ${interaction.channel}.`, ephemeral: true });
      }
    }
  } catch (err) {
    console.error("Error en interactionCreate:", err);
    try { if (!interaction.replied) await interaction.reply({ content: "Ocurrió un error.", ephemeral: true }); } catch {}
  }
});

// -------------------------
// Cerrar ticket: !cerrar / !close / !eliminar / !borrar (solo staff)
// - genera transcripción .txt, la envía al canal LOGS_CHANNEL_ID con embed y adjunto
// - elimina referencias y borra canal
// -------------------------
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
    const ticket = data.channels[channel.id];
    if (!ticket) {
      return message.reply("⚠️ Este canal no parece ser un ticket gestionado por el sistema.");
    }

    // Crear transcripción: leer todos los mensajes (últimos hasta cubrir todo)
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
      // ordenar cronológicamente
      allMessages = allMessages.sort((a,b) => a.createdTimestamp - b.createdTimestamp);
    } catch (err) {
      console.warn("No se pudieron leer todos los mensajes para transcripción:", err);
    }

    // Construir texto de transcripción
    let transcript = `Transcripción - Ticket #${ticket.number} - ${channel.name}\nCreado por: <@${ticket.ownerId}>\nCategoría: ${ticket.category}\nCerrado por: <@${message.author.id}>\nFecha: ${new Date().toISOString()}\n\n--- Mensajes ---\n\n`;
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

    // Crear archivo temporal
    const filename = `transcript-${channel.name || ticket.number}.txt`;
    const tmpPath = path.join(os.tmpdir(), `${Date.now()}-${filename}`);
    try {
      fs.writeFileSync(tmpPath, transcript, "utf8");
    } catch (err) {
      console.error("Error creando archivo temporal de transcripción:", err);
    }

    // Enviar embed + adjunto al canal de logs
    try {
      const logsChannel = await message.guild.channels.fetch(LOGS_CHANNEL_ID).catch(()=>null);
      const embed = new EmbedBuilder()
        .setTitle("📁 Transcripción de ticket")
        .setDescription(`Se ha cerrado el ticket **#${ticket.number}** (${channel.name}).`)
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
      } else {
        console.warn("Canal de logs no encontrado, omitiendo envío de transcripción.");
      }
    } catch (err) {
      console.error("Error enviando transcripción al canal logs:", err);
    }

    // Limpiar referencias y eliminar canal tras breve delay
    delete data.userHasTicket[ticket.ownerId];
    delete data.channels[channel.id];
    saveData();

    await message.reply("🗑️ Ticket cerrado. Eliminando canal en 5 segundos...");
    setTimeout(async () => {
      try {
        await channel.delete("Ticket cerrado por staff");
      } catch (err) {
        console.error("Error eliminando canal de ticket:", err);
      } finally {
        // eliminar archivo temporal
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
      }
    }, 5000);

  } catch (err) {
    console.error("Error en comando de cierre de ticket:", err);
  }
});

// -------------------------
// READY, Express y login
// -------------------------
client.once("ready", () => {
  console.log(`✅ SirgioBOT conectado como ${client.user.tag}`);
  client.user.setActivity("LagSupport", { type: 3 });
});

const app = express();
app.get("/", (req, res) => res.send("SirgioBOT is alive!"));
app.listen(process.env.PORT || 3000, () => console.log("🌐 Servidor web activo para mantener el bot despierto."));

client.login(process.env.DISCORD_TOKEN || process.env.TOKEN);
