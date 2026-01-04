// automod.js - Sistema mejorado de moderación automática con MongoDB
const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");

const GUILD_ID = "1212886282645147768";
const LOG_CHANNEL_ID = "1434002832016801842";
const MUTED_ROLE_ID = "1430271610358726717";
const HELPER_ROLE_ID = "1230949752733175888";
const MOD_ROLE_ID = "1229140504310972599";
const ADMIN_ROLE_ID = "1212891335929897030";
const HEAD_ADMIN_ROLE_ID = "1230952139015327755";

const db = require('./database');

const STAFF_ROLE_IDS = [HELPER_ROLE_ID, MOD_ROLE_ID, ADMIN_ROLE_ID, HEAD_ADMIN_ROLE_ID];
const CAN_BAN_ROLE_IDS = [MOD_ROLE_ID, ADMIN_ROLE_ID, HEAD_ADMIN_ROLE_ID];
const IGNORED_CHANNELS = ["1258524941289263254", "1313723272290111559"];
const BOT_OWNER_ID = "1032482231677108224";
const TICKET_CHANNEL_ID = "1228438600497102960";
const VIGIL_CATEGORY_ID = "1255251210173153342";
const TICKET_CATEGORY_ID = "1228437209628020736";
const TICKETS_DATA_FILE = path.join(__dirname, "tickets.json");

const WARNS_PATH = path.join(__dirname, "warns.json");
const BANNED_PATH = path.join(__dirname, "bannedWords.json");
const SENSITIVE_PATH = path.join(__dirname, "sensitiveWords.json");

const SANCTION_CATEGORIES = [
  { value: "flood", label: "Flood", emoji: "🌊" },
  { value: "spam", label: "Spam", emoji: "📢" },
  { value: "wall_of_text", label: "Wall of Text", emoji: "📄" },
  { value: "bypass_automod", label: "Bypass de AutoMod", emoji: "🔓" },
  { value: "vacio_legal", label: "Vacío legal", emoji: "⚖️" },
  { value: "romper_norma", label: "Romper Norma", emoji: "📜" },
  { value: "hacks_eventos", label: "Hacks en eventos", emoji: "🎮" },
  { value: "bypass_palabras", label: "Bypass de palabras prohibidas", emoji: "🚫" },
  { value: "canal_incorrecto", label: "Uso de canales incorrecto", emoji: "📍" },
  { value: "mencion_cp", label: "Mención de CP", emoji: "⛔" },
  { value: "publicidad", label: "Hacer publicidad", emoji: "📣" },
  { value: "perfil_inapropiado", label: "Perfil inapropiado/comprometido", emoji: "👤" },
  { value: "amenaza", label: "Amenaza", emoji: "⚠️" },
  { value: "intento_raid", label: "Intento de Raid", emoji: "💥" },
  { value: "ticket_innecesario", label: "Ticket innecesario", emoji: "🎫" },
  { value: "seguridad", label: "Seguridad", emoji: "🔒" },
  { value: "acoso", label: "Acoso", emoji: "😠" },
  { value: "contenido_nsfw", label: "Contenido NSFW", emoji: "🔞" },
  { value: "desinformacion", label: "Desinformación", emoji: "❌" },
  { value: "trolleo", label: "Trolleo", emoji: "🤡" },
  { value: "otro", label: "Otro", emoji: "📝" }
];

const HIDDEN_WORDS = ["fabio", "alle", "zuri", "error", "errorcode", "alleza", "itsalejo", "ist alejo", "imalejandro"];

if (!fs.existsSync(WARNS_PATH)) fs.writeFileSync(WARNS_PATH, JSON.stringify({}, null, 2));
if (!fs.existsSync(BANNED_PATH)) fs.writeFileSync(BANNED_PATH, JSON.stringify({ words: [] }, null, 2));
if (!fs.existsSync(SENSITIVE_PATH)) fs.writeFileSync(SENSITIVE_PATH, JSON.stringify({ words: [] }, null, 2));

function loadWords(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((w) => String(w).toLowerCase());
    if (parsed && Array.isArray(parsed.words)) return parsed.words.map((w) => String(w).toLowerCase());
    return [];
  } catch (e) {
    console.error("Error cargando palabras:", filePath, e);
    return [];
  }
}

function saveWords(filePath, words) {
  try {
    fs.writeFileSync(filePath, JSON.stringify({ words }, null, 2));
  } catch (e) {
    console.error("Error guardando palabras:", e);
  }
}

let warnings = {};
try {
  warnings = JSON.parse(fs.readFileSync(WARNS_PATH, "utf8"));
} catch (e) {
  warnings = {};
}

let bannedWords = loadWords(BANNED_PATH);
let sensitiveWords = loadWords(SENSITIVE_PATH);

function saveWarnings() {
  try {
    fs.writeFileSync(WARNS_PATH, JSON.stringify(warnings, null, 2));
  } catch (e) {
    console.error("Error guardando warns:", e);
  }
}

function reloadWordLists() {
  bannedWords = loadWords(BANNED_PATH);
  sensitiveWords = loadWords(SENSITIVE_PATH);
}

let ticketData = { lastTicket: 0, userHasTicket: {}, channels: {} };
function loadTicketData() {
  try {
    if (fs.existsSync(TICKETS_DATA_FILE)) {
      const raw = fs.readFileSync(TICKETS_DATA_FILE, "utf8");
      ticketData = JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error cargando tickets.json:", e);
  }
}
function saveTicketData() {
  try {
    fs.writeFileSync(TICKETS_DATA_FILE, JSON.stringify(ticketData, null, 2));
  } catch (e) {
    console.error("Error guardando tickets.json:", e);
  }
}
function sanitizeChannelName(name) {
  if (!name) return "";
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 _\-–—|]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 90)
    .toLowerCase();
}

loadTicketData();

const SPAM_WINDOW_MS = 7000;
const SPAM_THRESHOLD = 5;
const LINES_THRESHOLD = 5;
const CAPS_LENGTH_THRESHOLD = 15;
const CAPS_RATIO_THRESHOLD = 0.7;
const INVITE_REGEX = /discord\.gg\/|discord\.com\/invite\//gi;
const LINK_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+|\b[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.(com|co|es|org|net|io|dev|tv|gg|uk|us|fr|de|it|ru|cn|jp)\b/gi;
const EMOJI_THRESHOLD = 10;

function getMuteMinutesForWarnCount(count) {
  if (count <= 1) return 0;
  if (count === 2) return 10;
  if (count === 3) return 20;
  if (count === 4) return 40;
  return 60;
}

const activeMutes = new Map();
const activeVigilances = new Map();
const userMessageHistory = new Map();
const processedModals = new Set();

function cleanupExpiredWarns(client) {
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  let changed = false;
  for (const [userId, arr] of Object.entries(warnings)) {
    const recent = (arr || []).filter((w) => now - new Date(w.date).getTime() < THIRTY_DAYS_MS);
    if (recent.length !== (arr || []).length) {
      warnings[userId] = recent;
      if (recent.length === 0) delete warnings[userId];
      changed = true;

      try {
        const guild = client.guilds.cache.get(GUILD_ID);
        const logCh = guild?.channels.cache.get(LOG_CHANNEL_ID);
        if (logCh) {
          const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle("🧹 Warns limpiados automáticamente")
            .setDescription(`Se eliminaron warns antiguos de <@${userId}> por inactividad (30 días).`)
            .setTimestamp();
          logCh.send({ embeds: [embed] }).catch(() => {});
        }
      } catch (e) {
        console.error("Error notificando limpieza:", e);
      }
    }
  }
  if (changed) saveWarnings();
}

function normalizeText(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[0-9]/g, (d) => {
      const map = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g" };
      return map[d] || d;
    })
    .replace(/[@]/g, "a")
    .replace(/[$]/g, "s")
    .replace(/[!|1]/g, "i")
    .replace(/[€]/g, "e")
    .replace(/[.,:;_\-*#~´`'^°+]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findBannedWordInText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  const normalized = normalizeText(text);
  
  const allBannedWords = [...bannedWords, ...HIDDEN_WORDS];
  
  for (const w of allBannedWords) {
    if (!w) continue;
    const phrase = w.trim().toLowerCase();
    const normalizedPhrase = normalizeText(phrase);
    
    if (phrase.includes(" ")) {
      if (lower.includes(phrase) || normalized.includes(normalizedPhrase)) return w;
    } else {
      const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "u");
      const reNorm = new RegExp(`\\b${normalizedPhrase.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "u");
      if (re.test(lower) || reNorm.test(normalized)) return w;
      
      const noSpaces = lower.replace(/\s+/g, "");
      const noSpacesNorm = normalized.replace(/\s+/g, "");
      if (noSpaces.includes(phrase) || noSpacesNorm.includes(normalizedPhrase)) return w;
    }
  }
  return null;
}

function parseDuration(input) {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  const m = s.match(/^(\d+)\s*(s|m|h|d)?$/);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  const unit = m[2] || "m";
  switch (unit) {
    case "s": return num * 1000;
    case "m": return num * 60 * 1000;
    case "h": return num * 60 * 60 * 1000;
    case "d": return num * 24 * 60 * 60 * 1000;
    default: return num * 60 * 1000;
  }
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return "Permanente";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function isStaff(member) {
  if (!member) return false;
  return member.roles.cache.some(r => STAFF_ROLE_IDS.includes(r.id));
}

function canBan(member) {
  if (!member) return false;
  return member.roles.cache.some(r => CAN_BAN_ROLE_IDS.includes(r.id));
}

async function applyWarn(client, guild, user, member, reason, detectedWord = null, staffUser = null) {
  if (!warnings[user.id]) warnings[user.id] = [];
  warnings[user.id].push({ reason, date: new Date().toISOString(), detectedWord, appliedBy: staffUser ? staffUser.id : "automod" });
  saveWarnings();

  const warnCount = warnings[user.id].length;
  const muteMinutes = getMuteMinutesForWarnCount(warnCount);

  const isHiddenWord = detectedWord && HIDDEN_WORDS.includes(detectedWord.toLowerCase());

  const embed = new EmbedBuilder()
    .setTitle(warnCount === 1 ? "⚠️ Advertencia personalizada" : "⛔ Infracción detectada")
    .setDescription(
      warnCount === 1
        ? `Has recibido una advertencia por: **${reason}**.\n\nPor favor evita este comportamiento.`
        : `Has cometido una infracción por: **${reason}**.\n\nHas sido muteado por **${muteMinutes} minutos**.`
    )
    .setFooter({ text: "SirgioBOT - Moderación" })
    .setTimestamp()
    .setColor(warnCount === 1 ? 0xffff00 : 0xff0000);

  const row = new ActionRowBuilder();
  
  if (detectedWord && !isHiddenWord) {
    row.addComponents(
      new ButtonBuilder().setCustomId("view_banned_words").setLabel("Ver palabras prohibidas").setStyle(ButtonStyle.Danger)
    );
  }
  
  if (muteMinutes > 0) {
    row.addComponents(
      new ButtonBuilder().setCustomId("appeal_sanction").setLabel("Apelar sanción").setStyle(ButtonStyle.Primary)
    );
  }
  
  const components = row.components.length > 0 ? [row] : [];

  try {
    await user.send({ embeds: [embed], components }).catch(() => {});
  } catch (e) {}

  if (muteMinutes > 0 && member) {
    try {
      await member.roles.add(MUTED_ROLE_ID).catch(() => {});
      const timeoutId = setTimeout(async () => {
        try {
          const refreshed = await guild.members.fetch(member.id).catch(() => null);
          if (refreshed) await refreshed.roles.remove(MUTED_ROLE_ID).catch(() => {});
        } catch {}
        activeMutes.delete(member.id);
      }, muteMinutes * 60 * 1000);
      activeMutes.set(member.id, timeoutId);
    } catch (e) {
      console.error("Error aplicando mute:", e);
    }
  }

  try {
    const logCh = guild?.channels.cache.get(LOG_CHANNEL_ID);
    if (logCh) {
      const logEmbed = new EmbedBuilder()
        .setColor(muteMinutes > 0 ? 0xff0000 : 0xffff00)
        .setTitle(muteMinutes > 0 ? "⛔ Sanción aplicada" : "⚠️ Advertencia emitida")
        .addFields(
          { name: "Usuario", value: `${user.tag} (${user.id})`, inline: true },
          { name: "Razón", value: reason, inline: true },
          { name: "Warns totales", value: `${warnCount}`, inline: true },
          { name: "Duración mute", value: muteMinutes > 0 ? `${muteMinutes}m` : "Advertencia", inline: true },
          { name: "Tipo", value: staffUser ? "Manual (Staff)" : "Automático (AutoMod)", inline: true }
        )
        .setTimestamp();
      logCh.send({ embeds: [logEmbed] }).catch(() => {});
    }
  } catch (e) {
    console.error("Error enviando log:", e);
  }

  return { warnCount, muteMinutes };
}

module.exports = (client) => {
  let automodEnabled = true;

  client.automod = client.automod || {};
  client.automod.reloadLists = () => {
    reloadWordLists();
    return { bannedWordsCount: bannedWords.length, sensitiveWordsCount: sensitiveWords.length };
  };

  client.once("ready", async () => {
    console.log("✅ AutoMod mejorado cargado");
    cleanupExpiredWarns(client);
    setInterval(() => cleanupExpiredWarns(client), 24 * 60 * 60 * 1000);

    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.error("❌ No se pudo encontrar el servidor con ID:", GUILD_ID);
      return;
    }

    try {
      const categoryChoices = SANCTION_CATEGORIES.slice(0, 25).map(c => ({ name: c.label, value: c.value }));
      
      const commands = [
        new SlashCommandBuilder()
          .setName("automod")
          .setDescription("Controla el sistema de AutoMod")
          .addSubcommand((s) => s.setName("on").setDescription("Activa el AutoMod"))
          .addSubcommand((s) => s.setName("off").setDescription("Desactiva el AutoMod"))
          .addSubcommand((s) => s.setName("status").setDescription("Muestra estado del AutoMod")),
        new SlashCommandBuilder()
          .setName("sancion")
          .setDescription("Aplica una sanción a un usuario (warn/mute/ban)")
          .addUserOption(o => o.setName("usuario").setDescription("Usuario a sancionar").setRequired(true))
          .addStringOption(o => o.setName("tipo").setDescription("Tipo de sanción").setRequired(true)
            .addChoices(
              { name: "⚠️ Warn (Advertencia)", value: "warn" },
              { name: "🔇 Mute (Silenciar)", value: "mute" },
              { name: "🔨 Ban (Baneo)", value: "ban" }
            ))
          .addStringOption(o => o.setName("categoria").setDescription("Categoría de la infracción").setRequired(true)
            .addChoices(...categoryChoices))
          .addStringOption(o => o.setName("razon").setDescription("Razón detallada").setRequired(true))
          .addStringOption(o => o.setName("tiempo").setDescription("Duración (ej: 10m, 1h, 2d) - Para mute/ban").setRequired(false))
          .addIntegerOption(o => o.setName("veces").setDescription("Veces que cometió la infracción").setRequired(false))
          .addStringOption(o => o.setName("infracciones_adicionales").setDescription("Otras infracciones cometidas (separadas por coma)").setRequired(false))
          .addAttachmentOption(o => o.setName("prueba").setDescription("Archivo de prueba (imagen/video)").setRequired(false)),
        new SlashCommandBuilder()
          .setName("stafftools")
          .setDescription("Panel de herramientas para el staff (visible para todos)"),
        new SlashCommandBuilder()
          .setName("viewwarns")
          .setDescription("Muestra las advertencias de un usuario")
          .addUserOption((o) => o.setName("usuario").setDescription("Usuario objetivo").setRequired(true)),
        new SlashCommandBuilder()
          .setName("resetwarns")
          .setDescription("Resetea todas las advertencias de un usuario")
          .addUserOption((o) => o.setName("usuario").setDescription("Usuario objetivo").setRequired(true)),
        new SlashCommandBuilder()
          .setName("removewarn")
          .setDescription("Elimina la última advertencia de un usuario")
          .addUserOption((o) => o.setName("usuario").setDescription("Usuario objetivo").setRequired(true)),
        new SlashCommandBuilder()
          .setName("reloadlists")
          .setDescription("Recarga las listas de palabras prohibidas (staff)"),
        new SlashCommandBuilder()
          .setName("addword")
          .setDescription("Agrega una palabra a la lista prohibida (staff)")
          .addStringOption(o => o.setName("palabra").setDescription("Palabra a agregar").setRequired(true)),
        new SlashCommandBuilder()
          .setName("removeword")
          .setDescription("Quita una palabra de la lista prohibida (staff)")
          .addStringOption(o => o.setName("palabra").setDescription("Palabra a quitar").setRequired(true)),
        new SlashCommandBuilder()
          .setName("remove_mute")
          .setDescription("Quita el mute a un usuario (staff)")
          .addUserOption(o => o.setName("usuario").setDescription("Usuario objetivo").setRequired(true)),
        new SlashCommandBuilder()
          .setName("vigilar")
          .setDescription("Inicia vigilancia de un usuario (staff)")
          .addUserOption(o => o.setName("usuario").setDescription("Usuario a vigilar").setRequired(true))
          .addStringOption(o => o.setName("tiempo").setDescription("Duración (ej: 10m, 1h, 2d o 0)").setRequired(true)),
        new SlashCommandBuilder()
          .setName("cerrar_vigilancia")
          .setDescription("Cierra el canal de vigilancia (staff)")
          .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true)),
        new SlashCommandBuilder()
          .setName("mantenimiento")
          .setDescription("Activa/desactiva el modo mantenimiento del servidor")
          .addStringOption(o => o.setName("accion").setDescription("Activar o desactivar").setRequired(true)
            .addChoices(
              { name: "Activar", value: "on" },
              { name: "Desactivar", value: "off" }
            )),
        new SlashCommandBuilder()
          .setName("ping_role")
          .setDescription("Hace ping a un rol específico")
          .addRoleOption(o => o.setName("rol").setDescription("Rol a mencionar").setRequired(true))
          .addStringOption(o => o.setName("mensaje").setDescription("Mensaje opcional").setRequired(false))
      ];

      // Registro global de comandos (para que sean visibles para todos)
      await guild.commands.set(commands);
      console.log("🟢 Comandos de AutoMod registrados");
    } catch (err) {
      console.error("Error registrando comandos:", err);
    }
  });

  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isButton() && interaction.customId === "view_banned_words") {
        const list = loadWords(BANNED_PATH);
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("🚫 Palabras prohibidas")
          .setDescription(list.length ? list.map((w) => `• ${w}`).join("\n") : "La lista está vacía.")
          .setFooter({ text: "Evita usar este tipo de lenguaje." });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (interaction.isButton() && interaction.customId === "appeal_sanction") {
        const confirmId = `confirm_appeal_${interaction.user.id}_${Date.now()}`;
        const cancelId = `cancel_appeal_${interaction.user.id}_${Date.now()}`;
        
        const confirmBtn = new ButtonBuilder().setCustomId(confirmId).setLabel("✅ Sí, apelar").setStyle(ButtonStyle.Success);
        const cancelBtn = new ButtonBuilder().setCustomId(cancelId).setLabel("❌ Cancelar").setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

        const embed = new EmbedBuilder()
          .setTitle("⚠️ Confirmación de Apelación")
          .setDescription("¿Realmente crees que el staff tuvo un error con tu sanción y deseas apelar?\n\nPor favor, sé honesto y cuidadoso con tus palabras. El staff revisará tu apelación y tomará la decisión correspondiente.")
          .setColor(0xff9900)
          .setFooter({ text: "Esta acción creará un ticket de apelación" })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      if (interaction.isButton() && interaction.customId.startsWith("confirm_appeal_")) {
        try {
          const guild = interaction.guild || client.guilds.cache.get(GUILD_ID);
          if (!guild) return interaction.reply({ content: "❌ No se pudo obtener el servidor.", ephemeral: true });

          loadTicketData();
          if (ticketData.userHasTicket[interaction.user.id]) {
            const existingId = ticketData.userHasTicket[interaction.user.id];
            const existingCh = guild.channels.cache.get(existingId) || await guild.channels.fetch(existingId).catch(() => null);
            return interaction.reply({ content: `❗️ Ya tienes un ticket abierto: ${existingCh ? existingCh.toString() : existingId}`, ephemeral: true });
          }

          ticketData.lastTicket = (ticketData.lastTicket || 0) + 1;
          const number = String(ticketData.lastTicket).padStart(3, "0");
          const username = interaction.user.username || "user";
          const chanName = sanitizeChannelName(`apelacion-${username}-${number}`);

          const overwrites = [
            { id: guild.id, deny: ["ViewChannel"] },
            { id: interaction.user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] },
            { id: client.user.id, allow: ["ViewChannel", "SendMessages", "ManageChannels", "ReadMessageHistory"] },
            ...STAFF_ROLE_IDS.map(roleId => ({
              id: roleId,
              allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"]
            }))
          ];

          let channel;
          try {
            channel = await guild.channels.create({
              name: chanName,
              type: ChannelType.GuildText,
              parent: TICKET_CATEGORY_ID,
              permissionOverwrites: overwrites,
              reason: `Ticket de apelación creado por ${interaction.user.tag}`
            });
          } catch (err) {
            channel = await guild.channels.create({
              name: chanName,
              type: ChannelType.GuildText,
              permissionOverwrites: overwrites,
              reason: `Ticket de apelación creado por ${interaction.user.tag}`
            });
          }

          ticketData.userHasTicket[interaction.user.id] = channel.id;
          ticketData.channels[channel.id] = {
            ownerId: interaction.user.id,
            number,
            category: "apelacion",
            createdAt: new Date().toISOString(),
            claimedBy: null
          };
          saveTicketData();

          const claimBtn = new ButtonBuilder().setCustomId(`claim_ticket_${channel.id}`).setLabel("🧑‍💼 Atender ticket").setStyle(ButtonStyle.Primary);
          const ticketRow = new ActionRowBuilder().addComponents(claimBtn);

          const embedTicket = new EmbedBuilder()
            .setTitle("📋 Apelación de Sanción")
            .setDescription(`<@${interaction.user.id}> ha apelado una sanción.\n\nEl staff revisará tu caso en breve.`)
            .setColor(0xff9900)
            .setFooter({ text: `Ticket #${number}` })
            .setTimestamp();

          await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embedTicket], components: [ticketRow] });

          return interaction.reply({ content: `✅ Ticket de apelación creado: ${channel}`, ephemeral: true });
        } catch (e) {
          console.error("Error creando ticket de apelación:", e);
          return interaction.reply({ content: "❌ Error creando el ticket.", ephemeral: true });
        }
      }

      if (interaction.isButton() && interaction.customId.startsWith("cancel_appeal_")) {
        return interaction.reply({ content: "❌ Apelación cancelada.", ephemeral: true });
      }

      if (interaction.isButton() && interaction.customId.startsWith("panel_")) {
        const action = interaction.customId.replace("panel_", "");
        const member = interaction.member;
        const isModPlus = member.roles.cache.has(MOD_ROLE_ID) || member.roles.cache.has(ADMIN_ROLE_ID) || member.roles.cache.has(HEAD_ADMIN_ROLE_ID);
        const isAdminPlus = member.roles.cache.has(ADMIN_ROLE_ID) || member.roles.cache.has(HEAD_ADMIN_ROLE_ID);

        if (!isStaff(member)) {
          return interaction.reply({ content: "❌ Solo el staff puede usar este panel.", ephemeral: true });
        }

        // --- Lógica de permisos por botón ---
        const isHelper = member.roles.cache.has(HELPER_ROLE_ID);

        // Helper actions: Mute and Remove Mute
        const helperActions = ["mute", "unmute"];
        // Moderator actions: Mute, Remove Mute, Ban + all communication tools
        const modActions = ["mute", "unmute", "ban", "timeout", "clear", "nuke", "send_embed_channel", "announce"];
        // Admin+ actions: Advanced tools
        const adminActions = ["automod_toggle", "role_manage", "lock_channel", "block_link", "watch_user", "quarantine", "reduce_perms"];

        if (helperActions.includes(action) && !isHelper && !isModPlus) {
          return interaction.reply({ content: "❌ Esta acción requiere rango **Helper** o superior.", ephemeral: true });
        }
        if (modActions.includes(action) && !isModPlus) {
          return interaction.reply({ content: "❌ Esta acción requiere rango **Moderador** o superior.", ephemeral: true });
        }
        if (adminActions.includes(action) && !isAdminPlus) {
          return interaction.reply({ content: "❌ Esta acción requiere rango **Administrador** o superior.", ephemeral: true });
        }

        if (action === "warn" || action === "mute" || action === "ban" || action === "timeout") {
          const modal = new ModalBuilder()
            .setCustomId(`panel_sancion_${action}_${Date.now()}`)
            .setTitle(`Aplicar ${action.toUpperCase()}`);

          const userInput = new TextInputBuilder()
            .setCustomId("user_id")
            .setLabel("ID del usuario")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("Ej: 123456789012345678");

          const reasonInput = new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Razón")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          const durationInput = new TextInputBuilder()
            .setCustomId("duration")
            .setLabel("Duración")
            .setStyle(TextInputStyle.Short)
            .setRequired(action !== "warn")
            .setPlaceholder("Ej: 10m, 1h, 2d");

          modal.addComponents(
            new ActionRowBuilder().addComponents(userInput),
            new ActionRowBuilder().addComponents(reasonInput),
            new ActionRowBuilder().addComponents(durationInput)
          );

          return interaction.showModal(modal);
        }

        if (action === "clear") {
          const modal = new ModalBuilder()
            .setCustomId(`panel_clear_${Date.now()}`)
            .setTitle("Limpiar Chat");

          const amountInput = new TextInputBuilder()
            .setCustomId("amount")
            .setLabel("Cantidad de mensajes")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("Máximo 100");

          modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
          return interaction.showModal(modal);
        }

        if (action === "add_note") {
          const modal = new ModalBuilder()
            .setCustomId(`panel_note_${Date.now()}`)
            .setTitle("Añadir Nota a Usuario");

          const userInput = new TextInputBuilder()
            .setCustomId("user_id")
            .setLabel("ID del usuario")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const noteInput = new TextInputBuilder()
            .setCustomId("note")
            .setLabel("Comentario interno")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(userInput),
            new ActionRowBuilder().addComponents(noteInput)
          );
          return interaction.showModal(modal);
        }

        if (action === "automod_toggle") {
          automodEnabled = !automodEnabled;
          return interaction.reply({ content: `⚙️ AutoMod ha sido ${automodEnabled ? "**activado** ✅" : "**desactivado** ❌"}.`, ephemeral: true });
        }


        if (action === "remove_mute") {
          const modal = new ModalBuilder()
            .setCustomId(`panel_remove_mute_modal_${targetUserId}`)
            .setTitle("🔊 Quitar Silencio");

          const userInput = new TextInputBuilder()
            .setCustomId("user_id")
            .setLabel("ID del Usuario")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("ID del usuario a des-silenciar")
            .setValue(targetUserId || "")
            .setRequired(true);

          const reasonInput = new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Razón")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Razón para quitar el silencio...")
            .setRequired(false);

          const firstActionRow = new ActionRowBuilder().addComponents(userInput);
          const secondActionRow = new ActionRowBuilder().addComponents(reasonInput);
          modal.addComponents(firstActionRow, secondActionRow);

          return interaction.showModal(modal);
        }

        if (action === "send_dm") {
          const modal = new ModalBuilder()
            .setCustomId(`panel_dm_${targetUserId}`)
            .setTitle("📩 Enviar Mensaje Directo");

          const userInput = new TextInputBuilder()
            .setCustomId("user_id")
            .setLabel("ID del Usuario")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("ID del usuario destinatario")
            .setValue(targetUserId || "")
            .setRequired(true);

          const messageInput = new TextInputBuilder()
            .setCustomId("message")
            .setLabel("Mensaje")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Escribe el mensaje a enviar...")
            .setRequired(true);

          const firstActionRow = new ActionRowBuilder().addComponents(userInput);
          const secondActionRow = new ActionRowBuilder().addComponents(messageInput);
          
          modal.addComponents(firstActionRow, secondActionRow);
          return interaction.showModal(modal);
        }

        // Implementación de warn_template
        if (action === "warn_template") {
          const modal = new ModalBuilder()
            .setCustomId("panel_warn_template_modal")
            .setTitle("⚠️ Gestionar Plantillas de Advertencia");

          const templateNameInput = new TextInputBuilder()
            .setCustomId("template_name")
            .setLabel("Nombre de la Plantilla")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ej: spam, toxicidad, flood...")
            .setRequired(true);

          const templateContentInput = new TextInputBuilder()
            .setCustomId("template_content")
            .setLabel("Contenido de la Plantilla")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Escribe el mensaje de advertencia...")
            .setRequired(true);

          const actionTypeInput = new TextInputBuilder()
            .setCustomId("action_type")
            .setLabel("Acción (crear/editar/eliminar/listar)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("crear")
            .setRequired(true);

          const firstActionRow = new ActionRowBuilder().addComponents(templateNameInput);
          const secondActionRow = new ActionRowBuilder().addComponents(templateContentInput);
          const thirdActionRow = new ActionRowBuilder().addComponents(actionTypeInput);

          modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);
          return interaction.showModal(modal);
        }

        if (action === "edit_msg") {
          const modal = new ModalBuilder()
            .setCustomId(`panel_edit_msg_${Date.now()}`)
            .setTitle("✏️ Editar Mensaje");

          const messageIdInput = new TextInputBuilder()
            .setCustomId("message_id")
            .setLabel("ID del Mensaje")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("ID del mensaje a editar")
            .setRequired(true);

          const newContentInput = new TextInputBuilder()
            .setCustomId("new_content")
            .setLabel("Nuevo Contenido")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Escribe el nuevo contenido del mensaje...")
            .setRequired(true);

          const channelIdInput = new TextInputBuilder()
            .setCustomId("channel_id")
            .setLabel("ID del Canal (opcional)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Deja vacío para canal actual")
            .setRequired(false);

          const firstActionRow = new ActionRowBuilder().addComponents(messageIdInput);
          const secondActionRow = new ActionRowBuilder().addComponents(newContentInput);
          const thirdActionRow = new ActionRowBuilder().addComponents(channelIdInput);

          modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);
          return interaction.showModal(modal);
        }


        if (action === "nuke") {
          const modal = new ModalBuilder()
            .setCustomId(`panel_nuke_${Date.now()}`)
            .setTitle("🧹 Nuke Canal");

          const confirmInput = new TextInputBuilder()
            .setCustomId("confirm_nuke")
            .setLabel("Confirmación")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Escribe 'CONFIRMAR' para proceder")
            .setRequired(true);

          const reasonInput = new TextInputBuilder()
            .setCustomId("nuke_reason")
            .setLabel("Razón del Nuke")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Explica por qué necesitas nukear este canal...")
            .setRequired(true);

          const firstActionRow = new ActionRowBuilder().addComponents(confirmInput);
          const secondActionRow = new ActionRowBuilder().addComponents(reasonInput);

          modal.addComponents(firstActionRow, secondActionRow);
          return interaction.showModal(modal);
        }

        if (action === "reduce_perms") {
          const modal = new ModalBuilder()
            .setCustomId(`panel_reduce_perms_${Date.now()}`)
            .setTitle("⬇️ Reducir Permisos");

          const userIdInput = new TextInputBuilder()
            .setCustomId("user_id")
            .setLabel("ID del Usuario")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("ID del usuario a reducir permisos")
            .setRequired(true);

          const reasonInput = new TextInputBuilder()
            .setCustomId("reduce_reason")
            .setLabel("Razón de la Reducción")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Explica por qué se reducen los permisos...")
            .setRequired(true);

          const durationInput = new TextInputBuilder()
            .setCustomId("reduce_duration")
            .setLabel("Duración (opcional)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ej: 1h, 30m, 1d (vacío = permanente)")
            .setRequired(false);

          const firstActionRow = new ActionRowBuilder().addComponents(userIdInput);
          const secondActionRow = new ActionRowBuilder().addComponents(reasonInput);
          const thirdActionRow = new ActionRowBuilder().addComponents(durationInput);

          modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);
          return interaction.showModal(modal);
        }

        if (action === "view_history") {
          const modal = new ModalBuilder()
            .setCustomId(`panel_view_history_${Date.now()}`)
            .setTitle("📋 Ver Historial");

          const userIdInput = new TextInputBuilder()
            .setCustomId("user_id")
            .setLabel("ID del Usuario")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("ID del usuario para ver historial")
            .setRequired(true);

          const historyTypeInput = new TextInputBuilder()
            .setCustomId("history_type")
            .setLabel("Tipo de Historial")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("warns, mutes, bans, all (por defecto: all)")
            .setRequired(false);

          const limitInput = new TextInputBuilder()
            .setCustomId("history_limit")
            .setLabel("Límite de Registros")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Número máximo de registros (por defecto: 10)")
            .setRequired(false);

          const firstActionRow = new ActionRowBuilder().addComponents(userIdInput);
          const secondActionRow = new ActionRowBuilder().addComponents(historyTypeInput);
          const thirdActionRow = new ActionRowBuilder().addComponents(limitInput);

          modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);
          return interaction.showModal(modal);
        }

        if (action === "role_manage") {
          const modal = new ModalBuilder()
            .setCustomId(`panel_role_manage_${Date.now()}`)
            .setTitle("👤 Gestionar Roles");

          const userIdInput = new TextInputBuilder()
            .setCustomId("user_id")
            .setLabel("ID del Usuario")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("ID del usuario para gestionar roles")
            .setRequired(true);

          const actionTypeInput = new TextInputBuilder()
            .setCustomId("action_type")
            .setLabel("Acción")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("add o remove")
            .setRequired(true);

          const roleIdInput = new TextInputBuilder()
            .setCustomId("role_id")
            .setLabel("ID del Rol")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("ID del rol a agregar/remover")
            .setRequired(true);

          const reasonInput = new TextInputBuilder()
            .setCustomId("role_reason")
            .setLabel("Razón")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Razón para la gestión de roles...")
            .setRequired(true);

          const firstActionRow = new ActionRowBuilder().addComponents(userIdInput);
          const secondActionRow = new ActionRowBuilder().addComponents(actionTypeInput);
          const thirdActionRow = new ActionRowBuilder().addComponents(roleIdInput);
          const fourthActionRow = new ActionRowBuilder().addComponents(reasonInput);

          modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);
          return interaction.showModal(modal);
        }

        if (action === "lock_channel") {
          const modal = new ModalBuilder()
            .setCustomId(`panel_lock_channel_${Date.now()}`)
            .setTitle("🔒 Bloquear Canal");

          const channelIdInput = new TextInputBuilder()
            .setCustomId("channel_id")
            .setLabel("ID del Canal (opcional)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Deja vacío para canal actual")
            .setRequired(false);

          const reasonInput = new TextInputBuilder()
            .setCustomId("lock_reason")
            .setLabel("Razón del Bloqueo")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Razón para bloquear el canal...")
            .setRequired(true);

          const durationInput = new TextInputBuilder()
            .setCustomId("lock_duration")
            .setLabel("Duración (opcional)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ej: 30m, 2h, 1d (vacío = permanente)")
            .setRequired(false);

          const firstActionRow = new ActionRowBuilder().addComponents(channelIdInput);
          const secondActionRow = new ActionRowBuilder().addComponents(reasonInput);
          const thirdActionRow = new ActionRowBuilder().addComponents(durationInput);

          modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);
          return interaction.showModal(modal);
        }

        if (action === "block_link") {
          const modal = new ModalBuilder()
            .setCustomId(`panel_block_link_${Date.now()}`)
            .setTitle("🚫 Bloquear Enlaces");

          const userIdInput = new TextInputBuilder()
            .setCustomId("user_id")
            .setLabel("ID del Usuario")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("ID del usuario a restringir enlaces")
            .setRequired(true);

          const reasonInput = new TextInputBuilder()
            .setCustomId("block_reason")
            .setLabel("Razón del Bloqueo")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Razón para bloquear enlaces...")
            .setRequired(true);

          const durationInput = new TextInputBuilder()
            .setCustomId("block_duration")
            .setLabel("Duración")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ej: 30m, 2h, 1d")
            .setRequired(true);

          const firstActionRow = new ActionRowBuilder().addComponents(userIdInput);
          const secondActionRow = new ActionRowBuilder().addComponents(reasonInput);
          const thirdActionRow = new ActionRowBuilder().addComponents(durationInput);

          modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);
          return interaction.showModal(modal);
        }

        if (action === "quarantine") {
          const modal = new ModalBuilder()
            .setCustomId(`panel_quarantine_${Date.now()}`)
            .setTitle("☣️ Cuarentena Usuario");

          const userIdInput = new TextInputBuilder()
            .setCustomId("user_id")
            .setLabel("ID del Usuario")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("ID del usuario a poner en cuarentena")
            .setRequired(true);

          const reasonInput = new TextInputBuilder()
            .setCustomId("quarantine_reason")
            .setLabel("Razón de la Cuarentena")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Razón para poner en cuarentena...")
            .setRequired(true);

          const durationInput = new TextInputBuilder()
            .setCustomId("quarantine_duration")
            .setLabel("Duración")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ej: 1h, 6h, 1d, 3d")
            .setRequired(true);

          const firstActionRow = new ActionRowBuilder().addComponents(userIdInput);
          const secondActionRow = new ActionRowBuilder().addComponents(reasonInput);
          const thirdActionRow = new ActionRowBuilder().addComponents(durationInput);

          modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);
          return interaction.showModal(modal);
        }

        if (action === "watch_user") {
          const modal = new ModalBuilder()
            .setCustomId(`panel_watch_user_${Date.now()}`)
            .setTitle("👁️ Vigilar Usuario");

          const userIdInput = new TextInputBuilder()
            .setCustomId("user_id")
            .setLabel("ID del Usuario")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("ID del usuario a vigilar")
            .setRequired(true);

          const reasonInput = new TextInputBuilder()
            .setCustomId("watch_reason")
            .setLabel("Razón de Vigilancia")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Razón para vigilar al usuario...")
            .setRequired(true);

          const durationInput = new TextInputBuilder()
            .setCustomId("watch_duration")
            .setLabel("Duración")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ej: 1d, 3d, 1w (vacío = indefinido)")
            .setRequired(false);

          const alertLevelInput = new TextInputBuilder()
            .setCustomId("alert_level")
            .setLabel("Nivel de Alerta")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("low, medium, high")
            .setRequired(true);

          const firstActionRow = new ActionRowBuilder().addComponents(userIdInput);
          const secondActionRow = new ActionRowBuilder().addComponents(reasonInput);
          const thirdActionRow = new ActionRowBuilder().addComponents(durationInput);
          const fourthActionRow = new ActionRowBuilder().addComponents(alertLevelInput);

          modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);
          return interaction.showModal(modal);
        }

        // Handler para send_embed_channel
        if (action === "send_embed_channel") {
          const modal = new ModalBuilder()
            .setCustomId(`panel_send_embed_${interaction.user.id}`)
            .setTitle('📢 Enviar Embed a Canal');

          const channelInput = new TextInputBuilder()
            .setCustomId('channel_id')
            .setLabel('ID del Canal')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ingresa el ID del canal donde enviar el embed')
            .setRequired(true);

          const titleInput = new TextInputBuilder()
            .setCustomId('embed_title')
            .setLabel('Título del Embed')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Título del mensaje embed')
            .setRequired(true);

          const descriptionInput = new TextInputBuilder()
            .setCustomId('embed_description')
            .setLabel('Descripción del Embed')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Contenido del mensaje embed')
            .setRequired(true);

          const colorInput = new TextInputBuilder()
            .setCustomId('embed_color')
            .setLabel('Color del Embed (hex)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('#FF0000 (opcional)')
            .setRequired(false);

          const footerInput = new TextInputBuilder()
            .setCustomId('embed_footer')
            .setLabel('Pie del Embed')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Texto del pie (opcional)')
            .setRequired(false);

          const firstActionRow = new ActionRowBuilder().addComponents(channelInput);
          const secondActionRow = new ActionRowBuilder().addComponents(titleInput);
          const thirdActionRow = new ActionRowBuilder().addComponents(descriptionInput);
          const fourthActionRow = new ActionRowBuilder().addComponents(colorInput);
          const fifthActionRow = new ActionRowBuilder().addComponents(footerInput);

          modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);
          return interaction.showModal(modal);
        }
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_sancion_")) {
        const parts = interaction.customId.split("_");
        const actionType = parts[2];
        const userId = interaction.fields.getTextInputValue("user_id").trim();
        const reason = interaction.fields.getTextInputValue("reason");
        const duration = interaction.fields.getTextInputValue("duration") || "";

        const guild = interaction.guild;
        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) return interaction.reply({ content: "❌ Usuario no encontrado.", ephemeral: true });

        const member = await guild.members.fetch(userId).catch(() => null);

        if (actionType === "warn") {
          if (!warnings[userId]) warnings[userId] = [];
          warnings[userId].push({ reason: `Advertencia manual: ${reason}`, date: new Date().toISOString(), detectedWord: null });
          saveWarnings();

          const warnCount = warnings[userId].length;
          const embed = new EmbedBuilder()
            .setTitle("⚠️ Advertencia recibida")
            .setDescription(`Has recibido una advertencia por: **${reason}**`)
            .setColor(0xffff00)
            .setFooter({ text: "SirgioBOT - Moderación" })
            .setTimestamp();

          await user.send({ embeds: [embed] }).catch(() => {});

          const logCh = guild.channels.cache.get(LOG_CHANNEL_ID);
          if (logCh) {
            const logEmbed = new EmbedBuilder()
              .setColor(0xffff00)
              .setTitle("⚠️ Advertencia aplicada")
              .addFields(
                { name: "Usuario", value: `${user.tag} (${userId})`, inline: true },
                { name: "Staff", value: `${interaction.user.tag}`, inline: true },
                { name: "Razón", value: reason, inline: false },
                { name: "Warns totales", value: `${warnCount}`, inline: true }
              )
              .setTimestamp();
            logCh.send({ embeds: [logEmbed] }).catch(() => {});
          }

          return interaction.reply({ content: `✅ Advertencia aplicada a ${user.tag}`, ephemeral: true });
        }

        if (actionType === "mute") {
          const ms = parseDuration(duration) || 10 * 60 * 1000;
          
          if (member) {
            await member.roles.add(MUTED_ROLE_ID).catch(() => {});
            if (activeMutes.has(member.id)) {
              clearTimeout(activeMutes.get(member.id));
            }
            const timeoutId = setTimeout(async () => {
              try {
                const refreshed = await guild.members.fetch(member.id).catch(() => null);
                if (refreshed) await refreshed.roles.remove(MUTED_ROLE_ID).catch(() => {});
              } catch {}
              activeMutes.delete(member.id);
            }, ms);
            activeMutes.set(member.id, timeoutId);
          }

          const embed = new EmbedBuilder()
            .setTitle("🔇 Has sido silenciado")
            .setDescription(`Has sido muteado por: **${reason}**\n\nDuración: **${formatDuration(ms)}**`)
            .setColor(0xff0000)
            .setFooter({ text: "SirgioBOT - Moderación" })
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("appeal_sanction").setLabel("Apelar sanción").setStyle(ButtonStyle.Primary)
          );

          await user.send({ embeds: [embed], components: [row] }).catch(() => {});

          const logCh = guild.channels.cache.get(LOG_CHANNEL_ID);
          if (logCh) {
            const logEmbed = new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle("🔇 Mute aplicado")
              .addFields(
                { name: "Usuario", value: `${user.tag} (${userId})`, inline: true },
                { name: "Staff", value: `${interaction.user.tag}`, inline: true },
                { name: "Razón", value: reason, inline: false },
                { name: "Duración", value: formatDuration(ms), inline: true }
              )
              .setTimestamp();
            logCh.send({ embeds: [logEmbed] }).catch(() => {});
          }

          return interaction.reply({ content: `✅ Mute aplicado a ${user.tag} por ${formatDuration(ms)}`, ephemeral: true });
        }

        if (actionType === "ban") {
          if (!canBan(interaction.member)) {
            return interaction.reply({ content: "❌ No tienes permisos para banear.", ephemeral: true });
          }

          const embed = new EmbedBuilder()
            .setTitle("🔨 Has sido baneado")
            .setDescription(`Has sido baneado del servidor por: **${reason}**`)
            .setColor(0x000000)
            .setFooter({ text: "SirgioBOT - Moderación" })
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("appeal_sanction").setLabel("Apelar sanción").setStyle(ButtonStyle.Primary)
          );

          await user.send({ embeds: [embed], components: [row] }).catch(() => {});

          if (member) {
            await member.ban({ reason: `${reason} - Por: ${interaction.user.tag}` }).catch(() => {});
          } else {
            await guild.members.ban(userId, { reason: `${reason} - Por: ${interaction.user.tag}` }).catch(() => {});
          }

          const logCh = guild.channels.cache.get(LOG_CHANNEL_ID);
          if (logCh) {
            const logEmbed = new EmbedBuilder()
              .setColor(0x000000)
              .setTitle("🔨 Ban aplicado")
              .addFields(
                { name: "Usuario", value: `${user.tag} (${userId})`, inline: true },
                { name: "Staff", value: `${interaction.user.tag}`, inline: true },
                { name: "Razón", value: reason, inline: false }
              )
              .setTimestamp();
            logCh.send({ embeds: [logEmbed] }).catch(() => {});
          }

          return interaction.reply({ content: `✅ Ban aplicado a ${user.tag}`, ephemeral: true });
        }
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_message_")) {
        const channelId = interaction.fields.getTextInputValue("channel_id").trim();
        const message = interaction.fields.getTextInputValue("message");
        const asEmbed = interaction.fields.getTextInputValue("as_embed")?.toLowerCase() === "si";

        const channel = interaction.guild.channels.cache.get(channelId) || await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) return interaction.reply({ content: "❌ Canal no encontrado.", ephemeral: true });

        if (asEmbed) {
          const embed = new EmbedBuilder()
            .setDescription(message)
            .setColor(0x00ff80)
            .setTimestamp();
          await channel.send({ embeds: [embed] });
        } else {
          await channel.send(message);
        }

        return interaction.reply({ content: `✅ Mensaje enviado a ${channel}`, ephemeral: true });
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_dm_")) {
        const userId = interaction.fields.getTextInputValue("user_id").trim();
        const messageText = interaction.fields.getTextInputValue("message");

        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) return interaction.reply({ content: "❌ Usuario no encontrado.", ephemeral: true });

        const embed = new EmbedBuilder()
          .setTitle("📬 Mensaje del Staff")
          .setDescription(messageText)
          .setColor(0x5865F2)
          .setFooter({ text: "Responde a este mensaje para hablar con el staff" })
          .setTimestamp();

        try {
          await user.send({ embeds: [embed] });
          
          // Registrar para relay de respuestas
          activeStaffDMs.set(user.id, interaction.user.id);
          
          return interaction.reply({ content: `✅ DM enviado a ${user.tag}. Sus respuestas te llegarán a ti.`, ephemeral: true });
        } catch (err) {
          return interaction.reply({ content: "❌ No se pudo enviar el DM (DMs cerrados del usuario).", ephemeral: true });
        }
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_embed_")) {
        const channelId = interaction.fields.getTextInputValue("channel_id").trim();
        const title = interaction.fields.getTextInputValue("title");
        const description = interaction.fields.getTextInputValue("description");

        const channel = interaction.guild.channels.cache.get(channelId) || await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) return interaction.reply({ content: "❌ Canal no encontrado.", ephemeral: true });

        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(0x5865F2)
          .setTimestamp();

        await channel.send({ embeds: [embed] });
        return interaction.reply({ content: `✅ Embed enviado a ${channel}`, ephemeral: true });
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_unmute_")) {
        const userId = interaction.fields.getTextInputValue("user_id").trim();
        const guild = interaction.guild;
        const member = await guild.members.fetch(userId).catch(() => null);

        if (!member) return interaction.reply({ content: "❌ Usuario no encontrado en el servidor.", ephemeral: true });

        await member.roles.remove(MUTED_ROLE_ID).catch(() => {});
        activeMutes.delete(userId);

        const user = await client.users.fetch(userId).catch(() => null);
        if (user) {
          const embed = new EmbedBuilder()
            .setTitle("🔊 Mute removido")
            .setDescription("Tu mute ha sido removido.")
            .setColor(0x00ff00)
            .setTimestamp();
          user.send({ embeds: [embed] }).catch(() => {});
        }

        return interaction.reply({ content: `✅ Mute removido a ${member.user.tag}`, ephemeral: true });
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_remove_mute_modal_")) {
        const userId = interaction.fields.getTextInputValue("user_id").trim();
        const reason = interaction.fields.getTextInputValue("reason") || "No especificada";
        const guild = interaction.guild;
        const member = await guild.members.fetch(userId).catch(() => null);

        if (!member) return interaction.reply({ content: "❌ Usuario no encontrado en el servidor.", ephemeral: true });

        // Verificar si el usuario está muteado
        const muteRole = guild.roles.cache.find(role => role.name === "Muted" || role.name === "Silenciado");
        if (!muteRole || !member.roles.cache.has(muteRole.id)) {
          return interaction.reply({ content: "❌ El usuario no está silenciado.", ephemeral: true });
        }

        try {
          await member.roles.remove(muteRole, `Mute removido por ${interaction.user.tag} - Razón: ${reason}`);
          
          // Log del unmute
          const logChannel = guild.channels.cache.find(ch => ch.name === "logs" || ch.name === "mod-logs");
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle("🔊 Silencio Removido")
              .addFields(
                { name: "Usuario", value: `${member.user.tag} (${member.id})`, inline: true },
                { name: "Moderador", value: `${interaction.user.tag}`, inline: true },
                { name: "Razón", value: reason, inline: false }
              )
              .setColor(0x00ff00)
              .setTimestamp();
            
            logChannel.send({ embeds: [logEmbed] });
          }

          return interaction.reply({ content: `✅ Silencio removido a ${member.user.tag}. Razón: ${reason}`, ephemeral: true });
        } catch (error) {
          console.error("Error al remover mute:", error);
          return interaction.reply({ content: "❌ Error al remover el silencio.", ephemeral: true });
        }
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_watch_")) {
        const userId = interaction.fields.getTextInputValue("user_id").trim();
        const durationStr = interaction.fields.getTextInputValue("duration");
        const guild = interaction.guild;
        const user = await client.users.fetch(userId).catch(() => null);

        if (!user) return interaction.reply({ content: "❌ Usuario no encontrado.", ephemeral: true });

        const ms = parseDuration(durationStr);
        const chanName = sanitizeChannelName(`vigilancia-${user.username}`);

        const overwrites = [
          { id: guild.id, deny: ["ViewChannel"] },
          { id: client.user.id, allow: ["ViewChannel", "SendMessages", "ManageChannels"] },
          ...STAFF_ROLE_IDS.map(roleId => ({
            id: roleId,
            allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"]
          }))
        ];

        let channel;
        try {
          channel = await guild.channels.create({
            name: chanName,
            type: ChannelType.GuildText,
            parent: VIGIL_CATEGORY_ID,
            permissionOverwrites: overwrites,
            reason: `Vigilancia de ${user.tag} por ${interaction.user.tag}`
          });
        } catch (err) {
          return interaction.reply({ content: "❌ Error creando canal de vigilancia.", ephemeral: true });
        }

        activeVigilances.set(user.id, channel.id);

        const embed = new EmbedBuilder()
          .setTitle("👁️ Vigilancia iniciada")
          .setDescription(`Se está vigilando a ${user.tag}.\n\nTodos sus mensajes se registrarán aquí.`)
          .setColor(0x5865F2)
          .addFields(
            { name: "Usuario", value: `${user.tag} (${user.id})`, inline: true },
            { name: "Duración", value: ms ? formatDuration(ms) : "Indefinida", inline: true }
          )
          .setTimestamp();

        await channel.send({ embeds: [embed] });

        if (ms && ms > 0) {
          setTimeout(async () => {
            try {
              const ch = guild.channels.cache.get(channel.id);
              if (ch) await ch.delete("Vigilancia expirada");
              activeVigilances.delete(user.id);
            } catch {}
          }, ms);
        }

        return interaction.reply({ content: `✅ Vigilancia de ${user.tag} iniciada en ${channel}`, ephemeral: true });
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_increase_mute_")) {
        const userId = interaction.fields.getTextInputValue("user_id").trim();
        const extraTimeStr = interaction.fields.getTextInputValue("extra_time");
        const guild = interaction.guild;

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return interaction.reply({ content: "❌ Usuario no encontrado en el servidor.", ephemeral: true });

        const extraMs = parseDuration(extraTimeStr);
        if (!extraMs) return interaction.reply({ content: "❌ Formato de duración inválido.", ephemeral: true });

        if (!activeMutes.has(userId)) {
          return interaction.reply({ content: "❌ Este usuario no tiene mute activo.", ephemeral: true });
        }

        const oldTimeout = activeMutes.get(userId);
        clearTimeout(oldTimeout);

        const newTimeout = setTimeout(async () => {
          try {
            const refreshed = await guild.members.fetch(userId).catch(() => null);
            if (refreshed) await refreshed.roles.remove(MUTED_ROLE_ID).catch(() => {});
          } catch {}
          activeMutes.delete(userId);
        }, extraMs);

        activeMutes.set(userId, newTimeout);

        const user = await client.users.fetch(userId).catch(() => null);
        if (user) {
          const embed = new EmbedBuilder()
            .setTitle("⏱️ Mute Aumentado")
            .setDescription(`Tu tiempo de mute ha sido aumentado por **${formatDuration(extraMs)}**.`)
            .setColor(0xff9900)
            .setTimestamp();
          user.send({ embeds: [embed] }).catch(() => {});
        }

        return interaction.reply({ content: `✅ Mute de ${member.user.tag} aumentado por ${formatDuration(extraMs)}`, ephemeral: true });
      }


      if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_send_embed_")) {
        const channelId = interaction.fields.getTextInputValue("channel_id").trim();
        const title = interaction.fields.getTextInputValue("embed_title");
        const description = interaction.fields.getTextInputValue("embed_description");
        const colorHex = interaction.fields.getTextInputValue("embed_color");
        const footer = interaction.fields.getTextInputValue("embed_footer");

        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel || !channel.isTextBased()) {
          return interaction.reply({ content: "❌ Canal no encontrado o no es un canal de texto.", ephemeral: true });
        }

        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setTimestamp();

        // Configurar color si se proporcionó
        if (colorHex && colorHex.match(/^#[0-9A-Fa-f]{6}$/)) {
          embed.setColor(colorHex);
        } else {
          embed.setColor(0x00ff00); // Verde por defecto
        }

        // Configurar footer si se proporcionó
        if (footer) {
          embed.setFooter({ text: footer });
        }

        try {
          await channel.send({ embeds: [embed] });
          return interaction.reply({ content: `✅ Embed enviado exitosamente a ${channel}`, ephemeral: true });
        } catch (error) {
          console.error("Error enviando embed:", error);
          return interaction.reply({ content: "❌ Error al enviar el embed. Verifica los permisos del bot.", ephemeral: true });
        }
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_role_manage_")) {
        const userId = interaction.fields.getTextInputValue("user_id").trim();
        const actionType = interaction.fields.getTextInputValue("action_type").trim().toLowerCase();
        const roleId = interaction.fields.getTextInputValue("role_id").trim();

        if (!["add", "remove"].includes(actionType)) {
          return interaction.reply({ content: "❌ La acción debe ser 'add' o 'remove'.", ephemeral: true });
        }

        const targetMember = interaction.guild.members.cache.get(userId);
        if (!targetMember) {
          return interaction.reply({ content: "❌ Usuario no encontrado en el servidor.", ephemeral: true });
        }

        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) {
          return interaction.reply({ content: "❌ Rol no encontrado.", ephemeral: true });
        }

        try {
          if (actionType === "add") {
            await targetMember.roles.add(role);
            return interaction.reply({ content: `✅ Rol ${role.name} añadido a ${targetMember.user.tag}`, ephemeral: true });
          } else {
            await targetMember.roles.remove(role);
            return interaction.reply({ content: `✅ Rol ${role.name} removido de ${targetMember.user.tag}`, ephemeral: true });
          }
        } catch (error) {
          console.error("Error gestionando rol:", error);
          return interaction.reply({ content: "❌ Error al gestionar el rol. Verifica los permisos del bot.", ephemeral: true });
        }
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_lock_channel_")) {
        const channelId = interaction.fields.getTextInputValue("channel_id").trim();
        const reason = interaction.fields.getTextInputValue("lock_reason");

        let targetChannel;
        if (channelId) {
          targetChannel = interaction.guild.channels.cache.get(channelId);
          if (!targetChannel) {
            return interaction.reply({ content: "❌ Canal no encontrado.", ephemeral: true });
          }
        } else {
          targetChannel = interaction.channel;
        }

        if (!targetChannel.isTextBased()) {
          return interaction.reply({ content: "❌ Solo se pueden bloquear canales de texto.", ephemeral: true });
        }

        try {
          await targetChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            SendMessages: false,
            AddReactions: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false
          });

          const embed = new EmbedBuilder()
            .setTitle("🔒 Canal Bloqueado")
            .setDescription(`**Razón:** ${reason}`)
            .setColor(0xff0000)
            .setTimestamp()
            .setFooter({ text: `Bloqueado por ${interaction.user.tag}` });

          await targetChannel.send({ embeds: [embed] });
          return interaction.reply({ content: `✅ Canal ${targetChannel} bloqueado exitosamente.`, ephemeral: true });
        } catch (error) {
          console.error("Error bloqueando canal:", error);
          return interaction.reply({ content: "❌ Error al bloquear el canal. Verifica los permisos del bot.", ephemeral: true });
        }
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_block_link_")) {
        const userId = interaction.fields.getTextInputValue("user_id").trim();
        const reason = interaction.fields.getTextInputValue("block_reason");

        const targetMember = interaction.guild.members.cache.get(userId);
        if (!targetMember) {
          return interaction.reply({ content: "❌ Usuario no encontrado en el servidor.", ephemeral: true });
        }

        // Crear o encontrar el rol de "Sin Enlaces"
        let noLinksRole = interaction.guild.roles.cache.find(role => role.name === "Sin Enlaces");
        if (!noLinksRole) {
          try {
            noLinksRole = await interaction.guild.roles.create({
              name: "Sin Enlaces",
              color: 0x8B0000,
              reason: "Rol automático para bloquear enlaces"
            });
          } catch (error) {
            console.error("Error creando rol Sin Enlaces:", error);
            return interaction.reply({ content: "❌ Error al crear el rol necesario.", ephemeral: true });
          }
        }

        try {
          await targetMember.roles.add(noLinksRole);
          
          const embed = new EmbedBuilder()
            .setTitle("🚫 Enlaces Bloqueados")
            .setDescription(`**Usuario:** ${targetMember.user.tag}\n**Razón:** ${reason}`)
            .setColor(0xff0000)
            .setTimestamp()
            .setFooter({ text: `Bloqueado por ${interaction.user.tag}` });

          await interaction.channel.send({ embeds: [embed] });
          return interaction.reply({ content: `✅ Enlaces bloqueados para ${targetMember.user.tag}`, ephemeral: true });
        } catch (error) {
          console.error("Error bloqueando enlaces:", error);
          return interaction.reply({ content: "❌ Error al bloquear enlaces. Verifica los permisos del bot.", ephemeral: true });
        }
      }

      // Handler para panel_quarantine_
      if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_quarantine_")) {
        const userId = interaction.fields.getTextInputValue("user_id").trim();
        const reason = interaction.fields.getTextInputValue("quarantine_reason");

        const targetMember = interaction.guild.members.cache.get(userId);
        if (!targetMember) {
          return interaction.reply({ content: "❌ Usuario no encontrado en el servidor.", ephemeral: true });
        }

        // Crear o encontrar el rol de "Cuarentena"
        let quarantineRole = interaction.guild.roles.cache.find(role => role.name === "Cuarentena");
        if (!quarantineRole) {
          try {
            quarantineRole = await interaction.guild.roles.create({
              name: "Cuarentena",
              color: 0x800080,
              permissions: [],
              reason: "Rol automático para cuarentena de usuarios"
            });
          } catch (error) {
            console.error("Error creando rol Cuarentena:", error);
            return interaction.reply({ content: "❌ Error al crear el rol necesario.", ephemeral: true });
          }
        }

        try {
          await targetMember.roles.add(quarantineRole);
          
          const embed = new EmbedBuilder()
            .setTitle("🔒 Usuario en Cuarentena")
            .setDescription(`**Usuario:** ${targetMember.user.tag}\n**Razón:** ${reason}`)
            .setColor(0x800080)
            .setTimestamp()
            .setFooter({ text: `Puesto en cuarentena por ${interaction.user.tag}` });

          await interaction.channel.send({ embeds: [embed] });
          return interaction.reply({ content: `✅ ${targetMember.user.tag} ha sido puesto en cuarentena`, ephemeral: true });
        } catch (error) {
          console.error("Error aplicando cuarentena:", error);
          return interaction.reply({ content: "❌ Error al aplicar cuarentena. Verifica los permisos del bot.", ephemeral: true });
        }
      }

      // Handler para panel_warn_template_modal
      if (interaction.isModalSubmit() && interaction.customId === "panel_warn_template_modal") {
        const templateName = interaction.fields.getTextInputValue("template_name").trim();
        const templateContent = interaction.fields.getTextInputValue("template_content").trim();
        const actionType = interaction.fields.getTextInputValue("action_type").trim().toLowerCase();

        const embed = new EmbedBuilder()
          .setTitle("⚠️ Gestión de Plantillas de Advertencia")
          .setColor(0xFFFF00)
          .setTimestamp()
          .setFooter({ text: `Acción realizada por ${interaction.user.tag}` });

        if (actionType === "crear") {
          embed.setDescription(`**Plantilla creada:**\n**Nombre:** ${templateName}\n**Contenido:** ${templateContent}\n\n*Nota: Esta funcionalidad se integrará con la base de datos en futuras actualizaciones.*`);
        } else if (actionType === "listar") {
          embed.setDescription("**Plantillas disponibles:**\n• spam\n• toxicidad\n• flood\n• lenguaje inapropiado\n\n*Nota: Lista de ejemplo. Se integrará con base de datos.*");
        } else {
          embed.setDescription(`**Acción:** ${actionType}\n**Plantilla:** ${templateName}\n\n*Funcionalidad en desarrollo.*`);
        }

        await interaction.channel.send({ embeds: [embed] });
        return interaction.reply({ content: `✅ Plantilla "${templateName}" procesada correctamente`, ephemeral: true });
      }

      // Handler para panel_edit_msg
      if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_edit_msg_")) {
        const messageId = interaction.fields.getTextInputValue("message_id").trim();
        const newContent = interaction.fields.getTextInputValue("new_content").trim();
        const channelId = interaction.fields.getTextInputValue("channel_id").trim();

        const targetChannel = channelId ? interaction.guild.channels.cache.get(channelId) : interaction.channel;
        if (!targetChannel) {
          return interaction.reply({ content: "❌ Canal no encontrado.", ephemeral: true });
        }

        try {
          const message = await targetChannel.messages.fetch(messageId);
          await message.edit(newContent);

          const embed = new EmbedBuilder()
            .setTitle("✏️ Mensaje Editado")
            .setDescription(`**Canal:** ${targetChannel}\n**Mensaje ID:** ${messageId}\n**Nuevo contenido:** ${newContent.substring(0, 100)}${newContent.length > 100 ? '...' : ''}`)
            .setColor(0x00FF00)
            .setTimestamp()
            .setFooter({ text: `Editado por ${interaction.user.tag}` });

          await interaction.channel.send({ embeds: [embed] });
          return interaction.reply({ content: "✅ Mensaje editado correctamente", ephemeral: true });
        } catch (error) {
          console.error("Error editando mensaje:", error);
          return interaction.reply({ content: "❌ Error al editar el mensaje. Verifica el ID y permisos.", ephemeral: true });
        }
      }

      // Handler para panel_nuke
      if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_nuke_")) {
        const channelId = interaction.fields.getTextInputValue("channel_id").trim();
        const confirmText = interaction.fields.getTextInputValue("confirm_text").trim();

        if (confirmText.toLowerCase() !== "confirmar") {
          return interaction.reply({ content: "❌ Debes escribir 'confirmar' para proceder con el nuke.", ephemeral: true });
        }

        const targetChannel = channelId ? interaction.guild.channels.cache.get(channelId) : interaction.channel;
        if (!targetChannel) {
          return interaction.reply({ content: "❌ Canal no encontrado.", ephemeral: true });
        }

        try {
          const channelName = targetChannel.name;
          const channelPosition = targetChannel.position;
          const channelParent = targetChannel.parent;
          const channelPermissions = targetChannel.permissionOverwrites.cache;

          await targetChannel.delete();
          const newChannel = await interaction.guild.channels.create({
            name: channelName,
            type: targetChannel.type,
            parent: channelParent,
            position: channelPosition,
            permissionOverwrites: channelPermissions
          });

          const embed = new EmbedBuilder()
            .setTitle("🧹 Canal Nukeado")
            .setDescription(`Canal recreado exitosamente por ${interaction.user.tag}`)
            .setColor(0xFF0000)
            .setTimestamp();

          await newChannel.send({ embeds: [embed] });
          return interaction.reply({ content: "✅ Canal nukeado correctamente", ephemeral: true });
        } catch (error) {
          console.error("Error nukeando canal:", error);
          return interaction.reply({ content: "❌ Error al nukear el canal. Verifica los permisos del bot.", ephemeral: true });
        }
      }

      // Handler para panel_reduce_perms
      if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_reduce_perms_")) {
        const userId = interaction.fields.getTextInputValue("user_id").trim();
        const reason = interaction.fields.getTextInputValue("reduce_reason").trim();
        const duration = interaction.fields.getTextInputValue("reduce_duration").trim();

        const targetMember = interaction.guild.members.cache.get(userId);
        if (!targetMember) {
          return interaction.reply({ content: "❌ Usuario no encontrado en el servidor.", ephemeral: true });
        }

        try {
          // Crear o encontrar rol de permisos reducidos
          let restrictedRole = interaction.guild.roles.cache.find(role => role.name === "Permisos Reducidos");
          if (!restrictedRole) {
            restrictedRole = await interaction.guild.roles.create({
              name: "Permisos Reducidos",
              color: 0x808080,
              permissions: ["ViewChannel", "ReadMessageHistory"],
              reason: "Rol automático para usuarios con permisos reducidos"
            });
          }

          await targetMember.roles.add(restrictedRole);

          const embed = new EmbedBuilder()
            .setTitle("🔒 Permisos Reducidos")
            .setDescription(`**Usuario:** ${targetMember.user.tag}\n**Razón:** ${reason}\n**Duración:** ${duration || 'Permanente'}`)
            .setColor(0x808080)
            .setTimestamp()
            .setFooter({ text: `Aplicado por ${interaction.user.tag}` });

          await interaction.channel.send({ embeds: [embed] });
          return interaction.reply({ content: `✅ Permisos reducidos aplicados a ${targetMember.user.tag}`, ephemeral: true });
        } catch (error) {
          console.error("Error reduciendo permisos:", error);
          return interaction.reply({ content: "❌ Error al reducir permisos. Verifica los permisos del bot.", ephemeral: true });
        }
      }

      // Handler para panel_view_history
      if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_view_history_")) {
        const userId = interaction.fields.getTextInputValue("user_id").trim();
        const historyType = interaction.fields.getTextInputValue("history_type").trim().toLowerCase() || "all";
        const limit = parseInt(interaction.fields.getTextInputValue("history_limit").trim()) || 10;

        const targetUser = await interaction.client.users.fetch(userId).catch(() => null);
        if (!targetUser) {
          return interaction.reply({ content: "❌ Usuario no encontrado.", ephemeral: true });
        }

        const embed = new EmbedBuilder()
          .setTitle("📊 Historial de Usuario")
          .setDescription(`**Usuario:** ${targetUser.tag}\n**Tipo:** ${historyType}\n**Límite:** ${limit}`)
          .addFields(
            { name: "⚠️ Advertencias", value: "Sin registros disponibles", inline: true },
            { name: "🔇 Muteos", value: "Sin registros disponibles", inline: true },
            { name: "🔨 Baneos", value: "Sin registros disponibles", inline: true }
          )
          .setColor(0x0099FF)
          .setTimestamp()
          .setFooter({ text: `Consultado por ${interaction.user.tag} • Nota: Integración con base de datos pendiente` });

        await interaction.channel.send({ embeds: [embed] });
        return interaction.reply({ content: `✅ Historial de ${targetUser.tag} mostrado`, ephemeral: true });
      }

      if (!interaction.isChatInputCommand()) return;

      const { commandName, options, member, guild } = interaction;

      if (!isStaff(member) && !["viewwarns", "stafftools"].includes(commandName)) {
        return interaction.reply({ content: "❌ Solo el staff puede usar estos comandos.", ephemeral: true });
      }
      

      if (commandName === "stafftools") {
        if (!member.roles.cache.has(HEAD_ADMIN_ROLE_ID)) {
          return interaction.reply({ content: "❌ Solo los **Head Admin** pueden desplegar el panel de herramientas.", ephemeral: true });
        }

        // Enviar imagen como mensaje separado primero
        // Confirmación ephemeral para el usuario que ejecutó el comando
        await interaction.reply({
          content: "✅ **Panel de Staff Tools desplegado correctamente**\nEl panel es visible para todos los miembros del servidor.",
          flags: MessageFlags.Ephemeral
        });

        // Enviar imagen como mensaje separado después
        // Enviar imagen como mensaje separado después
        await interaction.channel.send({
          content: "https://cdn.discordapp.com/attachments/1231000158234476658/1457133379731456063/58_sin_titulo_20260103160731.png?ex=695ae4b5&is=69599335&hm=e5b5be166dd283ab8312b4922e48540bf53e461cefd2c60e0bcd248688429b75"
        });

        // CATEGORÍA 1: MODERACIÓN BÁSICA
        const moderationEmbed = new EmbedBuilder()
          .setTitle("🛡️ Moderación Básica")
          .setDescription("**Acciones disciplinarias y gestión de usuarios**\n\n" +
            "• **Helpers+:** Warn, Mute, Unmute\n" +
            "• **Moderadores+:** Ban, Timeout")
          .setColor(0xFF6B6B)
          .setThumbnail("https://cdn.discordapp.com/attachments/1231000158234476658/1457133379731456063/58_sin_titulo_20260103160731.png?ex=695ae4b5&is=69599335&hm=e5b5be166dd283ab8312b4922e48540bf53e461cefd2c60e0bcd248688429b75")
          .setFooter({ text: "SirgioBOT - Panel Staff" })
          .setTimestamp();

        const moderationRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("panel_warn").setLabel("⚠️ Warn").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("panel_mute").setLabel("🔇 Mute").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("panel_remove_mute").setLabel("🔊 Unmute").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("panel_ban").setLabel("🔨 Ban").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("panel_timeout").setLabel("⌛ Timeout").setStyle(ButtonStyle.Secondary)
        );

        // CATEGORÍA 2: GESTIÓN DE CANALES
        const channelEmbed = new EmbedBuilder()
          .setTitle("📢 Gestión de Canales")
          .setDescription("**Herramientas para administrar canales y mensajes**\n\n" +
            "• **Helpers+:** Limpiar Chat (50 msgs), Editar Mensajes\n" +
            "• **Moderadores+:** Nuke, Silenciar Canal, Bloquear Links")
          .setColor(0x4ECDC4)
          .setThumbnail("https://cdn.discordapp.com/attachments/1231000158234476658/1457133379731456063/58_sin_titulo_20260103160731.png?ex=695ae4b5&is=69599335&hm=e5b5be166dd283ab8312b4922e48540bf53e461cefd2c60e0bcd248688429b75")
          .setFooter({ text: "SirgioBOT - Panel Staff" })
          .setTimestamp();

        const channelRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("panel_clear").setLabel("🧼 Limpiar Chat").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("panel_edit_msg").setLabel("✏️ Editar Msg").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("panel_nuke").setLabel("🧹 Nuke").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("panel_lock_channel").setLabel("🔇 Silenciar Canal").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("panel_block_link").setLabel("🔗 Bloquear Link").setStyle(ButtonStyle.Danger)
        );

        // CATEGORÍA 3: COMUNICACIÓN
        const communicationEmbed = new EmbedBuilder()
          .setTitle("💬 Comunicación")
          .setDescription("**Herramientas de comunicación y plantillas**\n\n" +
            "• **Helpers+:** DM, Plantillas de Warn\n" +
            "• **Moderadores+:** Enviar Embeds personalizados")
          .setColor(0x45B7D1)
          .setThumbnail("https://cdn.discordapp.com/attachments/1231000158234476658/1457133379731456063/58_sin_titulo_20260103160731.png?ex=695ae4b5&is=69599335&hm=e5b5be166dd283ab8312b4922e48540bf53e461cefd2c60e0bcd248688429b75")
          .setFooter({ text: "SirgioBOT - Panel Staff" })
          .setTimestamp();

        const communicationRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("panel_send_dm").setLabel("💬 DM").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("panel_warn_template").setLabel("⚠️ Plantillas").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("panel_send_embed_channel").setLabel("📊 Embed").setStyle(ButtonStyle.Secondary)
        );

        // CATEGORÍA 4: ADMINISTRACIÓN AVANZADA
        const adminEmbed = new EmbedBuilder()
          .setTitle("⚙️ Administración Avanzada")
          .setDescription("**Herramientas administrativas y de monitoreo**\n\n" +
            "• **Moderadores+:** Gestión de Roles, Vigilar Usuarios, Restringir Permisos\n" +
            "• **Head Admin:** AutoMod Toggle, Quarantine")
          .setColor(0x9B59B6)
          .setThumbnail("https://cdn.discordapp.com/attachments/1231000158234476658/1457133379731456063/58_sin_titulo_20260103160731.png?ex=695ae4b5&is=69599335&hm=e5b5be166dd283ab8312b4922e48540bf53e461cefd2c60e0bcd248688429b75")
          .setFooter({ text: "SirgioBOT - Panel Staff" })
          .setTimestamp();

        const adminRow1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("panel_role_manage").setLabel("🎭 Roles").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("panel_watch_user").setLabel("👁️ Vigilar").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("panel_reduce_perms").setLabel("🔒 Restringir").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("panel_automod_toggle").setLabel("⚙️ AutoMod").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("panel_quarantine").setLabel("☣️ Quarantine").setStyle(ButtonStyle.Danger)
        );

        // CATEGORÍA 5: INFORMACIÓN Y NOTAS
        const infoEmbed = new EmbedBuilder()
          .setTitle("📊 Información y Registros")
          .setDescription("**Herramientas de seguimiento y documentación**\n\n" +
            "• **Helpers+:** Añadir Notas, Ver Historial de usuarios")
          .setColor(0xF39C12)
          .setThumbnail("https://cdn.discordapp.com/attachments/1231000158234476658/1457133379731456063/58_sin_titulo_20260103160731.png?ex=695ae4b5&is=69599335&hm=e5b5be166dd283ab8312b4922e48540bf53e461cefd2c60e0bcd248688429b75")
          .setFooter({ text: "SirgioBOT - Panel Staff" })
          .setTimestamp();

        const infoRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("panel_add_note").setLabel("📝 Nota").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("panel_view_history").setLabel("📊 Historial").setStyle(ButtonStyle.Primary)
        );

        // Enviar todos los embeds categorizados
        await interaction.channel.send({ 
          embeds: [moderationEmbed], 
          components: [moderationRow]
        });
        
        await interaction.channel.send({ 
          embeds: [channelEmbed], 
          components: [channelRow]
        });
        
        await interaction.channel.send({ 
          embeds: [communicationEmbed], 
          components: [communicationRow]
        });
        
        await interaction.channel.send({ 
          embeds: [adminEmbed], 
          components: [adminRow1]
        });
        
        await interaction.channel.send({ 
          embeds: [infoEmbed], 
          components: [infoRow]
        });

        // Embed de guía con botón
        const guideEmbed = new EmbedBuilder()
          .setTitle("❓ ¿Necesitas ayuda?")
          .setDescription("Si no sabes para qué sirve algún botón o herramienta, haz click aquí")
          .setColor(0x9B59B6)
          .setThumbnail("https://cdn.discordapp.com/attachments/1231000158234476658/1457133379731456063/58_sin_titulo_20260103160731.png?ex=695ae4b5&is=69599335&hm=e5b5be166dd283ab8312b4922e48540bf53e461cefd2c60e0bcd248688429b75");

        const guideButton = new ButtonBuilder()
          .setCustomId('show_guide')
          .setLabel('📖 Ver Guía Completa')
          .setStyle(ButtonStyle.Primary);

        const guideRow = new ActionRowBuilder()
          .addComponents(guideButton);

        await interaction.channel.send({ 
          embeds: [guideEmbed], 
          components: [guideRow]
        });
      }

      if (commandName === "sancion") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "❌ Solo el staff puede usar este comando.", ephemeral: true });
        }
        
        const targetUser = options.getUser("usuario");
        const tipo = options.getString("tipo");
        const categoria = options.getString("categoria");
        const razon = options.getString("razon");
        const tiempo = options.getString("tiempo");
        const veces = options.getInteger("veces") || 1;
        const infracciones = options.getString("infracciones_adicionales");
        const prueba = options.getAttachment("prueba");
        
        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
        
        if (tipo === "warn") {
          await applyWarn(client, guild, targetUser, targetMember, `${categoria}: ${razon}`, null, interaction.user);
        } else if (tipo === "mute") {
          const ms = parseDuration(tiempo) || 10 * 60 * 1000;
          const muteMinutes = Math.floor(ms / 60 / 1000);
          
          if (targetMember) {
            await targetMember.roles.add(MUTED_ROLE_ID).catch(() => {});
            const timeoutId = setTimeout(async () => {
              try {
                const refreshed = await guild.members.fetch(targetMember.id).catch(() => null);
                if (refreshed) await refreshed.roles.remove(MUTED_ROLE_ID).catch(() => {});
              } catch {}
              activeMutes.delete(targetMember.id);
            }, ms);
            activeMutes.set(targetMember.id, timeoutId);
          }
          
          try {
            const logCh = guild?.channels.cache.get(LOG_CHANNEL_ID);
            if (logCh) {
              const logEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("⛔ Sanción aplicada")
                .addFields(
                  { name: "Usuario", value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                  { name: "Razón", value: `${categoria}: ${razon}`, inline: true },
                  { name: "Duración mute", value: `${muteMinutes}m`, inline: true },
                  { name: "Aplicado por", value: `${interaction.user.tag}`, inline: true },
                  { name: "Veces", value: `${veces}`, inline: true }
                );
              if (infracciones) logEmbed.addFields({ name: "Infracciones adicionales", value: infracciones, inline: false });
              if (prueba) logEmbed.addFields({ name: "Prueba", value: `[${prueba.name}](${prueba.url})`, inline: false });
              logEmbed.setTimestamp();
              logCh.send({ embeds: [logEmbed] }).catch(() => {});
            }
          } catch (e) {}
        } else if (tipo === "ban") {
          const ms = parseDuration(tiempo);
          
          try {
            if (targetMember) {
              await guild.bans.create(targetUser.id, { reason: `${categoria}: ${razon}` }).catch(() => {});
            }
          } catch (e) {}
          
          try {
            const logCh = guild?.channels.cache.get(LOG_CHANNEL_ID);
            if (logCh) {
              const logEmbed = new EmbedBuilder()
                .setColor(0x000000)
                .setTitle("🔨 Ban aplicado")
                .addFields(
                  { name: "Usuario", value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                  { name: "Razón", value: `${categoria}: ${razon}`, inline: true },
                  { name: "Aplicado por", value: `${interaction.user.tag}`, inline: true },
                  { name: "Veces", value: `${veces}`, inline: true }
                );
              if (infracciones) logEmbed.addFields({ name: "Infracciones adicionales", value: infracciones, inline: false });
              if (prueba) logEmbed.addFields({ name: "Prueba", value: `[${prueba.name}](${prueba.url})`, inline: false });
              logEmbed.setTimestamp();
              logCh.send({ embeds: [logEmbed] }).catch(() => {});
            }
          } catch (e) {}
        }
        
        return interaction.reply({ content: `✅ Sanción aplicada a ${targetUser.tag}.`, ephemeral: true });
      }

      if (commandName === "automod") {
        const sub = options.getSubcommand();
        if (sub === "on") {
          automodEnabled = true;
          return interaction.reply({ content: "✅ AutoMod activado.", ephemeral: true });
        }
        if (sub === "off") {
          automodEnabled = false;
          return interaction.reply({ content: "⚠️ AutoMod desactivado.", ephemeral: true });
        }
        if (sub === "status") {
          const embed = new EmbedBuilder()
            .setTitle("📊 Estado del AutoMod")
            .setDescription(`Estado: **${automodEnabled ? "Activado ✅" : "Desactivado ❌"}**`)
            .addFields(
              { name: "Palabras prohibidas", value: `${bannedWords.length}`, inline: true },
              { name: "Palabras sensibles", value: `${sensitiveWords.length}`, inline: true },
              { name: "Palabras ocultas", value: `${HIDDEN_WORDS.length}`, inline: true }
            )
            .setColor(automodEnabled ? 0x00ff00 : 0xff0000)
            .setTimestamp();
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }

      if (commandName === "viewwarns") {
        const user = options.getUser("usuario");
        const userWarns = warnings[user.id] || [];
        if (userWarns.length === 0) {
          return interaction.reply({ content: `✅ ${user.tag} no tiene advertencias.`, ephemeral: true });
        }
        const embed = new EmbedBuilder()
          .setTitle(`📋 Advertencias de ${user.tag}`)
          .setDescription(userWarns.map((w, i) => `**${i + 1}.** ${w.reason}\n   📅 ${new Date(w.date).toLocaleString()}`).join("\n\n"))
          .setColor(0xffff00)
          .setFooter({ text: `Total: ${userWarns.length} warns` })
          .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (commandName === "resetwarns") {
        const user = options.getUser("usuario");
        delete warnings[user.id];
        saveWarnings();
        return interaction.reply({ content: `✅ Warns de ${user.tag} reseteados.`, ephemeral: true });
      }

      if (commandName === "removewarn") {
        const user = options.getUser("usuario");
        if (!warnings[user.id] || warnings[user.id].length === 0) {
          return interaction.reply({ content: `❌ ${user.tag} no tiene warns.`, ephemeral: true });
        }
        warnings[user.id].pop();
        if (warnings[user.id].length === 0) delete warnings[user.id];
        saveWarnings();
        return interaction.reply({ content: `✅ Última advertencia de ${user.tag} eliminada.`, ephemeral: true });
      }

      if (commandName === "reloadlists") {
        reloadWordLists();
        return interaction.reply({ content: `✅ Listas recargadas. Prohibidas: ${bannedWords.length}, Sensibles: ${sensitiveWords.length}`, ephemeral: true });
      }

      if (commandName === "addword") {
        const word = options.getString("palabra").toLowerCase().trim();
        if (bannedWords.includes(word)) {
          return interaction.reply({ content: "❌ Esa palabra ya está en la lista.", ephemeral: true });
        }
        bannedWords.push(word);
        saveWords(BANNED_PATH, bannedWords);
        
        try {
          const logCh = guild?.channels.cache.get(LOG_CHANNEL_ID);
          if (logCh) {
            const logEmbed = new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle("📝 Palabra prohibida agregada")
              .addFields(
                { name: "Palabra", value: `**${word}**`, inline: true },
                { name: "Agregado por", value: `${interaction.user.tag}`, inline: true }
              )
              .setTimestamp();
            logCh.send({ embeds: [logEmbed] }).catch(() => {});
          }
        } catch (e) {}
        
        return interaction.reply({ content: `✅ Palabra "${word}" agregada a la lista prohibida.`, ephemeral: true });
      }

      if (commandName === "removeword") {
        const word = options.getString("palabra").toLowerCase().trim();
        const index = bannedWords.indexOf(word);
        if (index === -1) {
          return interaction.reply({ content: "❌ Esa palabra no está en la lista.", ephemeral: true });
        }
        bannedWords.splice(index, 1);
        saveWords(BANNED_PATH, bannedWords);
        
        try {
          const logCh = guild?.channels.cache.get(LOG_CHANNEL_ID);
          if (logCh) {
            const logEmbed = new EmbedBuilder()
              .setColor(0x00ff00)
              .setTitle("📝 Palabra prohibida removida")
              .addFields(
                { name: "Palabra", value: `**${word}**`, inline: true },
                { name: "Removido por", value: `${interaction.user.tag}`, inline: true }
              )
              .setTimestamp();
            logCh.send({ embeds: [logEmbed] }).catch(() => {});
          }
        } catch (e) {}
        
        return interaction.reply({ content: `✅ Palabra "${word}" eliminada de la lista.`, ephemeral: true });
      }

      if (commandName === "remove_mute") {
        const user = options.getUser("usuario");
        const targetMember = await guild.members.fetch(user.id).catch(() => null);
        if (!targetMember) {
          return interaction.reply({ content: "❌ Usuario no encontrado en el servidor.", ephemeral: true });
        }
        await targetMember.roles.remove(MUTED_ROLE_ID).catch(() => {});
        if (activeMutes.has(user.id)) {
          clearTimeout(activeMutes.get(user.id));
          activeMutes.delete(user.id);
        }
        
        try {
          const logCh = guild?.channels.cache.get(LOG_CHANNEL_ID);
          if (logCh) {
            const logEmbed = new EmbedBuilder()
              .setColor(0x00ff00)
              .setTitle("🔊 Unmute")
              .addFields(
                { name: "Usuario", value: `${user.tag} (${user.id})`, inline: true },
                { name: "Demuteado por", value: `${interaction.user.tag}`, inline: true }
              )
              .setTimestamp();
            logCh.send({ embeds: [logEmbed] }).catch(() => {});
          }
        } catch (e) {}
        
        return interaction.reply({ content: `✅ Mute removido de ${user.tag}.`, ephemeral: true });
      }

      if (commandName === "vigilar") {
        const user = options.getUser("usuario");
        const tiempoStr = options.getString("tiempo");
        const ms = parseDuration(tiempoStr);

        const chanName = sanitizeChannelName(`vigilancia-${user.username}`);
        
        const overwrites = [
          { id: guild.id, deny: ["ViewChannel"] },
          { id: client.user.id, allow: ["ViewChannel", "SendMessages", "ManageChannels"] },
          ...STAFF_ROLE_IDS.map(roleId => ({
            id: roleId,
            allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"]
          }))
        ];

        let channel;
        try {
          channel = await guild.channels.create({
            name: chanName,
            type: ChannelType.GuildText,
            parent: VIGIL_CATEGORY_ID,
            permissionOverwrites: overwrites,
            reason: `Vigilancia de ${user.tag} por ${interaction.user.tag}`
          });
        } catch (err) {
          return interaction.reply({ content: "❌ Error creando canal de vigilancia.", ephemeral: true });
        }

        activeVigilances.set(user.id, channel.id);

        const embed = new EmbedBuilder()
          .setTitle("👁️ Vigilancia iniciada")
          .setDescription(`Se está vigilando a ${user.tag}.\n\nTodos sus mensajes se registrarán aquí.`)
          .setColor(0x5865F2)
          .addFields(
            { name: "Usuario", value: `${user.tag} (${user.id})`, inline: true },
            { name: "Duración", value: ms ? formatDuration(ms) : "Indefinida", inline: true }
          )
          .setTimestamp();

        await channel.send({ embeds: [embed] });

        if (ms && ms > 0) {
          setTimeout(async () => {
            try {
              const ch = guild.channels.cache.get(channel.id);
              if (ch) await ch.delete("Vigilancia expirada");
              activeVigilances.delete(user.id);
            } catch {}
          }, ms);
        }

        return interaction.reply({ content: `✅ Vigilancia de ${user.tag} iniciada en ${channel}`, ephemeral: true });
      }

      if (commandName === "cerrar_vigilancia") {
        const user = options.getUser("usuario");
        const channelId = activeVigilances.get(user.id);
        if (!channelId) {
          return interaction.reply({ content: "❌ No hay vigilancia activa para ese usuario.", ephemeral: true });
        }
        const channel = guild.channels.cache.get(channelId);
        if (channel) {
          await channel.delete("Vigilancia cerrada manualmente").catch(() => {});
        }
        activeVigilances.delete(user.id);
        return interaction.reply({ content: `✅ Vigilancia de ${user.tag} cerrada.`, ephemeral: true });
      }

      if (commandName === "mantenimiento") {
        const accion = options.getString("accion");
        
        const confirmEmbed = new EmbedBuilder()
          .setTitle(`⚠️ Confirmar ${accion === "on" ? "activación" : "desactivación"} de mantenimiento`)
          .setDescription(accion === "on" 
            ? "Esto pondrá todos los canales en privado y creará un canal visible para avisar del mantenimiento.\n\n¿Estás seguro?"
            : "Esto restaurará el acceso a todos los canales.\n\n¿Estás seguro?")
          .setColor(0xff9900)
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`maint_confirm_${accion}`).setLabel("✅ Confirmar").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`maint_cancel`).setLabel("❌ Cancelar").setStyle(ButtonStyle.Danger)
        );

        return interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true });
      }

      if (commandName === "ping_role") {
        const role = options.getRole("rol");
        const mensaje = options.getString("mensaje") || "";

        const content = `${role.toString()}${mensaje ? `\n\n${mensaje}` : ""}`;
        
        await interaction.channel.send({ content, allowedMentions: { roles: [role.id], parse: ["everyone"] } });
        return interaction.reply({ content: "✅ Ping enviado.", ephemeral: true });
      }

    } catch (err) {
      console.error("Error en interactionCreate:", err);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "❌ Ocurrió un error.", ephemeral: true });
        }
      } catch {}
    }
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith("maint_confirm_")) {
      const accion = interaction.customId.replace("maint_confirm_", "");
      const guild = interaction.guild;

      await interaction.update({ content: "⏳ Procesando...", embeds: [], components: [] });

      if (accion === "on") {
        try {
          const maintenanceChannel = await guild.channels.create({
            name: "servidor-en-mantenimiento",
            type: ChannelType.GuildText,
            permissionOverwrites: [
              { id: guild.id, allow: ["ViewChannel"], deny: ["SendMessages"] }
            ],
            reason: "Modo mantenimiento activado"
          });

          const embed = new EmbedBuilder()
            .setTitle("🔧 Servidor en Mantenimiento")
            .setDescription("El servidor se encuentra temporalmente en mantenimiento.\n\nVolveremos pronto. ¡Gracias por tu paciencia!")
            .setColor(0xff9900)
            .setTimestamp();

          await maintenanceChannel.send({ embeds: [embed] });

          const textChannels = guild.channels.cache.filter(c => 
            c.type === ChannelType.GuildText && 
            c.id !== maintenanceChannel.id &&
            !c.name.includes("mantenimiento")
          );

          for (const [, channel] of textChannels) {
            try {
              await channel.permissionOverwrites.edit(guild.id, { ViewChannel: false });
            } catch {}
          }

          await interaction.editReply({ content: `✅ Modo mantenimiento activado. Canal creado: ${maintenanceChannel}` });
        } catch (err) {
          console.error("Error activando mantenimiento:", err);
          await interaction.editReply({ content: "❌ Error activando el modo mantenimiento." });
        }
      } else {
        try {
          const maintenanceChannel = guild.channels.cache.find(c => c.name === "servidor-en-mantenimiento");
          if (maintenanceChannel) {
            await maintenanceChannel.delete("Modo mantenimiento desactivado");
          }

          const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
          for (const [, channel] of textChannels) {
            try {
              await channel.permissionOverwrites.edit(guild.id, { ViewChannel: null });
            } catch {}
          }

          await interaction.editReply({ content: "✅ Modo mantenimiento desactivado. Canales restaurados." });
        } catch (err) {
          console.error("Error desactivando mantenimiento:", err);
          await interaction.editReply({ content: "❌ Error desactivando el modo mantenimiento." });
        }
      }
    }

    if (interaction.customId === "maint_cancel") {
      return interaction.update({ content: "❌ Operación cancelada.", embeds: [], components: [] });
    }

    if (interaction.customId === "show_guide") {
      const guideEmbed = new EmbedBuilder()
        .setTitle("📖 Guía Completa de Herramientas de Staff")
        .setDescription("**🔨 MODERACIÓN**\n" +
          "• **Mute:** Silencia a un usuario temporalmente\n" +
          "• **Remove Mute:** Quita el silencio a un usuario\n" +
          "• **Ban:** Banea permanentemente a un usuario del servidor\n" +
          "• **Kick:** Expulsa a un usuario del servidor\n" +
          "• **Timeout:** Aplica timeout temporal a un usuario\n\n" +
          "**📢 COMUNICACIÓN**\n" +
          "• **Enviar Embed:** Crea y envía mensajes embed personalizados\n" +
          "• **Enviar DM:** Envía mensaje privado a un usuario\n" +
          "• **Anuncio:** Publica anuncios oficiales en canales\n" +
          "• **Encuesta:** Crea encuestas con reacciones\n\n" +
          "**🔧 ADMINISTRACIÓN**\n" +
          "• **Mantenimiento:** Activa/desactiva modo mantenimiento del servidor\n" +
          "• **Backup:** Crea respaldos de configuración del servidor\n" +
          "• **Logs:** Accede a registros de actividad del servidor\n\n" +
          "**📊 INFORMACIÓN**\n" +
          "• **Añadir Notas:** Agrega notas al perfil de un usuario\n" +
          "• **Ver Historial:** Consulta el historial de sanciones de un usuario")
        .setColor(0x9B59B6)
        .setFooter({ text: "Usa estas herramientas responsablemente" })
        .setTimestamp();

      return interaction.reply({ embeds: [guideEmbed], ephemeral: true });
    }
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const vigilanceChannelId = activeVigilances.get(message.author.id);
    if (vigilanceChannelId) {
      try {
        const vigilanceChannel = message.guild?.channels.cache.get(vigilanceChannelId);
        if (vigilanceChannel) {
          const recordEmbed = new EmbedBuilder()
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setDescription(message.content || "*Sin contenido de texto*")
            .addFields(
              { name: "#️⃣ Canal", value: `<#${message.channelId}>`, inline: true }
            )
            .setColor(0x3498db)
            .setFooter({ text: `ID: ${message.id}` })
            .setTimestamp();

          if (message.attachments && message.attachments.size > 0) {
            const attachmentList = message.attachments.map(att => `[${att.name}](${att.url})`).join("\n");
            recordEmbed.addFields({ name: "📎 Adjuntos", value: attachmentList, inline: false });
          }

          await vigilanceChannel.send({ embeds: [recordEmbed] }).catch(() => {});
        }
      } catch (error) {
        console.error("Error registrando mensaje vigilado:", error);
      }
    }
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot || !automodEnabled || IGNORED_CHANNELS.includes(message.channelId)) return;

    try {
      const user = message.author;
      const member = message.member;
      const guild = message.guild;

      if (!member) return;

      if (STAFF_ROLE_IDS.some((r) => member.roles.cache.has(r))) return;

      const content = message.content;

      const bannedWord = findBannedWordInText(content);
      if (bannedWord) {
        await applyWarn(client, guild, user, member, `Palabra prohibida: ${bannedWord}`, bannedWord);
        try {
          await message.delete();
        } catch {}
        return;
      }

      if (INVITE_REGEX.test(content)) {
        await applyWarn(client, guild, user, member, "Invitación a otro servidor", null);
        try {
          await message.delete();
        } catch {}
        return;
      }

      if (LINK_REGEX.test(content)) {
        const links = content.match(LINK_REGEX);
        if (links && links.length > 0) {
          const nonAllowedLinks = links.filter(link => {
            const lowerLink = link.toLowerCase();
            if (lowerLink.endsWith('.gif')) return false;
            if (lowerLink.includes('tenor.com')) return false;
            if (lowerLink.includes('giphy.com')) return false;
            if (lowerLink.includes('gfycat.com')) return false;
            if (lowerLink.includes('youtube.com')) return false;
            if (lowerLink.includes('youtu.be')) return false;
            if (lowerLink.includes('spotify.com')) return false;
            if (lowerLink.includes('soundcloud.com')) return false;
            if (lowerLink.includes('music.apple.com')) return false;
            if (lowerLink.includes('deezer.com')) return false;
            if (lowerLink.includes('tidal.com')) return false;
            if (lowerLink.includes('music.youtube.com')) return false;
            return true;
          });
          
          if (nonAllowedLinks.length > 0) {
            await applyWarn(client, guild, user, member, `Compartir links no permitido`, null);
            try {
              await message.delete();
            } catch {}
            return;
          }
        }
      }

      const hasGifAttachment = message.attachments && message.attachments.some(att => att.name && att.name.toLowerCase().endsWith('.gif'));
      const hasGifLink = content.toLowerCase().includes('.gif');
      
      if (!hasGifAttachment && !hasGifLink) {
        const contentWithoutDiscordTags = content
          .replace(/<a?:\w+:\d+>/g, "")
          .replace(/<@!?\d+>/g, "")
          .replace(/<@&\d+>/g, "")
          .replace(/<#\d+>/g, "")
          .replace(/https?:\/\/[^\s]+/g, "")
          .replace(/www\.[^\s]+/g, "");
        
        const emojiCount = (contentWithoutDiscordTags.match(/\p{Emoji}/gu) || []).length;
        if (emojiCount > EMOJI_THRESHOLD) {
          await applyWarn(client, guild, user, member, `Demasiados emojis (${emojiCount})`, null);
          try {
            await message.delete();
          } catch {}
          return;
        }
      }

      const lineCount = content.split("\n").length;
      if (lineCount > LINES_THRESHOLD) {
        await applyWarn(client, guild, user, member, "Flood de líneas", null);
        try {
          await message.delete();
        } catch {}
        return;
      }

      if (content.length > CAPS_LENGTH_THRESHOLD) {
        const contentWithoutEmojis = content.replace(/<a?:\w+:\d+>/g, "");
        
        if (contentWithoutEmojis.length > CAPS_LENGTH_THRESHOLD) {
          const capsCount = (contentWithoutEmojis.match(/[A-Z]/g) || []).length;
          const capsRatio = capsCount / contentWithoutEmojis.length;
          if (capsRatio > CAPS_RATIO_THRESHOLD) {
            await applyWarn(client, guild, user, member, "Abuso de mayúsculas", null);
            try {
              await message.delete();
            } catch {}
            return;
          }
        }
      }

      if (!userMessageHistory.has(user.id)) {
        userMessageHistory.set(user.id, []);
      }
      const history = userMessageHistory.get(user.id);
      const now = Date.now();
      history.push(now);
      const recentMessages = history.filter((t) => now - t < SPAM_WINDOW_MS);
      userMessageHistory.set(user.id, recentMessages);

      if (recentMessages.length > SPAM_THRESHOLD) {
        await applyWarn(client, guild, user, member, "Spam", null);
        try {
          await message.delete();
        } catch {}
        return;
      }

    } catch (err) {
      console.error("Error en messageCreate:", err);
    }
  });
};
