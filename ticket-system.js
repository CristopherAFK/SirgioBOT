// ticket-system.js
// Módulo del sistema de tickets (maneja select, confirmación, creación, claim y cierre por comandos)
// Integración pensada para usarse con el index.js anterior.
// Persistencia simple en tickets.json (cuidado: efímero en Render a menos que uses disco persistente o DB).

require("dotenv").config();
const fs = require("fs-extra");
const path = require("path");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
  ChannelType,
  StringSelectMenuBuilder
} = require("discord.js");

const DATA_PATH = path.join(__dirname, "tickets.json");

const TICKET_CATEGORY_NAME = process.env.TICKET_CATEGORY_NAME || "TICKETS";
const ARCHIVE_CATEGORY_NAME = process.env.ARCHIVE_CATEGORY_NAME || "TICKETS-ARCHIVE";
// aceptar LOGS_CHANNEL_ID o fallback a LOG_CHANNEL_ID (por si lo tienes en index)
const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID || process.env.LOG_CHANNEL_ID || "";
const STAFF_ROLE_IDS = (process.env.STAFF_ROLE_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
const MOD_USER_IDS = (process.env.MOD_USER_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
const CLOSE_MODE = process.env.CLOSE_MODE || "archive";
const PANEL_THUMBNAIL_URL = process.env.PANEL_THUMBNAIL_URL || "";
const EMBED_COLOR = process.env.EMBED_COLOR || "#2ecc71";

// Emojis personalizados (orden: discord_bots, report_user, streams, lives, dudas, otro)
const EMOJI_IDS = {
  discord_bots: { id: "1431413172513804348", name: "emoji_104" },
  report_user:  { id: "1431408998887981147", name: "emoji_99" },
  streams:      { id: "1268414311509004460", name: "Twitch" },
  lives:        { id: "1268414284077994034", name: "TikTok" },
  dudas:        { id: "1431412814345404618", name: "emoji_103" },
  otro:         { id: "1431415219367842032", name: "emoji_106" }
};

// Persistencia simple
let data = { counter: 1, channels: {}, userHasTicket: {} };
if (fs.existsSync(DATA_PATH)) {
  try { data = fs.readJSONSync(DATA_PATH); } catch (err) { console.warn("No se pudo leer tickets.json — se recreará", err); }
} else {
  fs.writeJSONSync(DATA_PATH, data, { spaces: 2 });
}
function saveData() { fs.writeJSONSync(DATA_PATH, data, { spaces: 2 }); }

function sanitizeChannelName(name) {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 90);
}

function isMod(member) {
  if (!member) return false;
  if (MOD_USER_IDS.includes(String(member.id))) return true;
  if (STAFF_ROLE_IDS.some(r => member.roles.cache.has(r))) return true;
  return member.permissions?.has(PermissionsBitField.Flags.ManageChannels);
}

function getEmojiObj(value) {
  return EMOJI_IDS[value] || null;
}

function getFriendlyName(value) {
  switch (value) {
    case "discord_bots": return "Discord Bots";
    case "report_user": return "Reportar usuario";
    case "streams": return "Streams";
    case "lives": return "Lives";
    case "dudas": return "Dudas";
    case "otro": return "Otro";
    default: return value;
  }
}

async function ensureCategory(guild, name) {
  let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name);
  if (!cat) cat = await guild.channels.create({ name, type: ChannelType.GuildCategory });
  return cat;
}

function buildPanelEmbed() {
  return new EmbedBuilder()
    .setTitle("💚 LagSupport")
    .setDescription("¿Tienes alguna duda respecto al servidor? ¿Alguien te está molestando y deseas reportarlo? ¿Deseas apelar una sanción injusta?\n\nEn este canal podrás abrir un ticket para hablar directamente con el staff de Sirgio, quienes te ayudarán con los problemas o dudas que tengas. Simplemente elige una opción en el menú de abajo y después explica el problema que tienes.")
    .setColor(EMBED_COLOR.startsWith("#") ? parseInt(EMBED_COLOR.replace(/^#/, ""), 16) : EMBED_COLOR)
    .setThumbnail(PANEL_THUMBNAIL_URL);
}

function buildCategorySelect() {
  return new StringSelectMenuBuilder()
    .setCustomId("ticket_category_select")
    .setPlaceholder("Menú de soporte")
    .addOptions([
      { label: "Discord Bots", value: "discord_bots", emoji: getEmojiObj("discord_bots") },
      { label: "Reportar usuario", value: "report_user", emoji: getEmojiObj("report_user") },
      { label: "Streams", value: "streams", emoji: getEmojiObj("streams") },
      { label: "Lives", value: "lives", emoji: getEmojiObj("lives") },
      { label: "Dudas", value: "dudas", emoji: getEmojiObj("dudas") },
      { label: "Otro", value: "otro", emoji: getEmojiObj("otro") }
    ]);
}

async function createTicketForUser(interactionOrMessage, guild, user, reason, categoryValue, client) {
  const ticketNumber = data.counter || 1;
  const rawName = `${user.username}-${ticketNumber}`;
  const chanName = sanitizeChannelName(rawName);
  const category = await ensureCategory(guild, TICKET_CATEGORY_NAME);

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ReadMessageHistory] }
  ];

  for (const roleId of STAFF_ROLE_IDS) {
    if (roleId) overwrites.push({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] });
  }

  const channel = await guild.channels.create({
    name: chanName,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: overwrites
  });

  data.channels[channel.id] = {
    ownerId: user.id,
    number: ticketNumber,
    createdAt: new Date().toISOString(),
    reason: reason || "",
    claimedBy: null,
    category: categoryValue || "otro"
  };
  data.userHasTicket[user.id] = channel.id;
  data.counter = ticketNumber + 1;
  saveData();

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR.startsWith("#") ? parseInt(EMBED_COLOR.replace(/^#/, ""), 16) : EMBED_COLOR)
    .setTitle("👋 Bienvenido")
    .setDescription(`${getEmojiObj(categoryValue) ? `<:${getEmojiObj(categoryValue).name}:${getEmojiObj(categoryValue).id}> ` : ""}<@${user.id}> Bienvenido\n\nEl Staff atenderá tu caso en breve.`)
    .setFooter({ text: `Ticket #${ticketNumber}` });

  const claimButton = new ButtonBuilder()
    .setCustomId(`claim_ticket_${channel.id}`)
    .setLabel("Atender ticket")
    .setStyle(ButtonStyle.Primary);

  const actionRow = new ActionRowBuilder().addComponents(claimButton);

  await channel.send({ content: `<@${user.id}>`, embeds: [embed], components: [actionRow] });

  try {
    if (interactionOrMessage?.reply) {
      await interactionOrMessage.reply({ content: `✅ Ticket creado: ${channel}`, ephemeral: true });
    } else if (interactionOrMessage?.channel) {
      await interactionOrMessage.channel.send(`✅ Ticket creado: ${channel}`);
    }
  } catch (err) {}

  if (LOGS_CHANNEL_ID) {
    try {
      const lc = await guild.channels.fetch(LOGS_CHANNEL_ID);
      if (lc) await lc.send({ content: `📘 Nuevo ticket #${ticketNumber} creado por <@${user.id}> (categoría: ${getFriendlyName(categoryValue)}): ${channel}` });
    } catch (err) {}
  }

  return channel;
}

async function closeTicketByStaff(message, client) {
  const ticket = data.channels[message.channel.id];
  if (!ticket) {
    await message.reply("Este comando solo funciona en canales de ticket.");
    return;
  }
  if (!isMod(message.member)) {
    await message.reply("Solo moderadores/administradores pueden usar este comando.");
    return;
  }

  try {
    const fetched = await message.channel.messages.fetch({ limit: 200 });
    const sorted = fetched.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    let transcript = `Transcripción ticket #${ticket.number} - ${message.channel.name}\nCreado por: <@${ticket.ownerId}>\nRazón: ${ticket.reason || "No especificado"}\nCerrado por: <@${message.author.id}>\nFecha: ${new Date().toISOString()}\n\n--- Mensajes ---\n\n`;
    sorted.forEach(m => {
      const ts = new Date(m.createdTimestamp).toISOString();
      const author = `${m.author.tag} (${m.author.id})`;
      let content = m.content || "";
      if (m.attachments && m.attachments.size > 0) {
        const urls = m.attachments.map(a => a.url).join(", ");
        content += ` [Adjuntos: ${urls}]`;
      }
      transcript += `[${ts}] ${author}: ${content}\n`;
    });
    const filename = `transcript-ticket-${ticket.number}.txt`;
    const filepath = path.join(__dirname, filename);
    fs.writeFileSync(filepath, transcript, "utf8");

    if (LOGS_CHANNEL_ID) {
      try {
        const logs = await message.guild.channels.fetch(LOGS_CHANNEL_ID);
        if (logs) await logs.send({ content: `📁 Ticket #${ticket.number} cerrado por <@${message.author.id}> (propietario: <@${ticket.ownerId}>)`, files: [filepath] });
      } catch (err) {}
    } else {
      await message.channel.send({ content: "Transcripción del ticket:", files: [filepath] }).catch(() => {});
    }

    delete data.userHasTicket[ticket.ownerId];
    delete data.channels[message.channel.id];
    saveData();

    if (CLOSE_MODE === "delete") {
      await message.channel.delete("Ticket cerrado por comando");
    } else {
      const archiveCat = await ensureCategory(message.guild, ARCHIVE_CATEGORY_NAME);
      await message.channel.setParent(archiveCat.id);
      await message.channel.permissionOverwrites.edit(ticket.ownerId, { SendMessages: false });
      await message.channel.setName(`closed-${message.channel.name}`);
      await message.channel.send({ content: `📌 Ticket cerrado por <@${message.author.id}>. Canal archivado.` });
    }

    try { fs.unlinkSync(filepath); } catch (err) {}

  } catch (err) {
    console.error("Error cerrando ticket:", err);
    await message.reply("Ocurrió un error al cerrar el ticket.");
  }
}

/* Export: init para inyectar handlers en el client */
function init(client) {
  if (!client) throw new Error("Debes pasar el cliente de Discord al init del ticket-system.");

  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        // si quieres añadir /ticket panel por slash, añade aquí el handler (opcional)
      } else if (interaction.isStringSelectMenu()) {
        if (interaction.customId === "ticket_category_select") {
          const chosen = interaction.values[0];
          const userId = interaction.user.id;
          if (data.userHasTicket[userId]) {
            const existingChannelId = data.userHasTicket[userId];
            const ch = interaction.guild.channels.cache.get(existingChannelId);
            await interaction.reply({ content: `❗️ Ya tienes un ticket abierto: ${ch ? ch.toString() : "ID:" + existingChannelId}`, ephemeral: true });
            return;
          }

          const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`confirm_ticket_${userId}_${Date.now()}_${chosen}`).setLabel("Aceptar ✅").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`cancel_ticket_${userId}_${Date.now()}_${chosen}`).setLabel("Cancelar ❌").setStyle(ButtonStyle.Danger)
          );

          const embed = new EmbedBuilder()
            .setTitle("Confirmar apertura de ticket")
            .setDescription(`${getEmojiObj(chosen) ? `<:${getEmojiObj(chosen).name}:${getEmojiObj(chosen).id}> ` : ""}Has elegido: **${getFriendlyName(chosen)}**\n\nSi continúas se abrirá un ticket en el que podrás explicar tu problema.`)
            .setColor(EMBED_COLOR.startsWith("#") ? parseInt(EMBED_COLOR.replace(/^#/, ""), 16) : EMBED_COLOR)
            .setThumbnail(PANEL_THUMBNAIL_URL);

          await interaction.reply({ embeds: [embed], components: [confirmRow] });
        }
      } else if (interaction.isButton()) {
        const id = interaction.customId;
        if (id.startsWith("confirm_ticket_")) {
          const parts = id.split("_");
          const userId = parts[2];
          const chosen = parts.slice(4).join("_") || "otro";
          if (userId !== interaction.user.id && !isMod(interaction.member)) {
            await interaction.reply({ content: "❗️ Solo quien inició la apertura o un moderador puede confirmar.", ephemeral: true });
            return;
          }
          await interaction.deferReply({ ephemeral: true });

          if (data.userHasTicket[userId]) {
            const existing = interaction.guild.channels.cache.get(data.userHasTicket[userId]);
            await interaction.editReply({ content: `❗️ Ya tienes un ticket abierto: ${existing ? existing.toString() : data.userHasTicket[userId]}` });
            return;
          }

          await interaction.followUp({ content: "✍️ Por favor escribe aquí el motivo/descripción del ticket en los próximos 60 segundos (opcional). Si no escribes nada, se abrirá con la descripción \"No especificado\".", ephemeral: true });

          const filter = m => m.author.id === userId;
          const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 60000 });

          collector.on("collect", async (m) => {
            const reason = m.content;
            await createTicketForUser(interaction, interaction.guild, interaction.user, reason, chosen, client);
            try { await m.delete().catch(() => {}); } catch {}
          });
          collector.on("end", async (collected) => {
            if (collected.size === 0) {
              await createTicketForUser(interaction, interaction.guild, interaction.user, "No especificado", chosen, client);
            }
          });

        } else if (id.startsWith("cancel_ticket_")) {
          const parts = id.split("_");
          const userId = parts[2];
          if (userId !== interaction.user.id && !isMod(interaction.member)) {
            await interaction.reply({ content: "❗️ Solo quien inició la apertura o un moderador puede cancelar.", ephemeral: true });
            return;
          }
          await interaction.reply({ content: "❌ Apertura de ticket cancelada.", ephemeral: true });

        } else if (id.startsWith("claim_ticket_")) {
          const channelId = id.replace("claim_ticket_", "");
          const channel = interaction.guild.channels.cache.get(channelId);
          const ticket = data.channels[channelId];
          if (!ticket) {
            await interaction.reply({ content: "Ticket no encontrado en registros.", ephemeral: true });
            return;
          }
          if (!isMod(interaction.member)) {
            await interaction.reply({ content: "Solo moderadores/administradores pueden atender tickets.", ephemeral: true });
            return;
          }
          try {
            await channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
          } catch (err) { console.warn("No se pudieron editar permisos al claim:", err); }
          ticket.claimedBy = interaction.user.id;
          saveData();
          await channel.send({ content: `<@${ticket.ownerId}> <@${interaction.user.id}> atenderá tu ticket.` });
          await interaction.reply({ content: `Has atendido el ticket ${channel}.`, ephemeral: true });
        }
      }
    } catch (err) {
      console.error("Error en ticket-system interactionCreate:", err);
      try { if (!interaction.replied) await interaction.reply({ content: "Ocurrió un error.", ephemeral: true }); } catch {}
    }
  });

  // Mensajes: cierre por comandos
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith("!")) return;
    const args = message.content.slice(1).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();
    const closeCmds = ["cerrar", "cerrarticket", "close", "eliminar", "borrar"];
    if (closeCmds.includes(cmd)) {
      await closeTicketByStaff(message, client);
    }
  });

  // Exportar helper para enviar panel desde fuera
  client.ticketSystem = {
    sendPanel: async (channel) => {
      const embed = buildPanelEmbed();
      const row = new ActionRowBuilder().addComponents(buildCategorySelect());
      return channel.send({ embeds: [embed], components: [row] });
    }
  };
}

module.exports = { init };
