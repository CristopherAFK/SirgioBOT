// automod.js - Sistema mejorado de moderación automática
const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits
} = require("discord.js");

const GUILD_ID = "1212886282645147768";
const LOG_CHANNEL_ID = "1434002832016801842";
const MUTED_ROLE_ID = "1430271610358726717";
const STAFF_ROLE_IDS = ["1230949715127042098", "1229140504310972599"];
const IGNORED_CHANNELS = ["1258524941289263254", "1313723272290111559"];
const BOT_OWNER_ID = "1032482231677108224";
const TICKET_CHANNEL_ID = "1228438600497102960";
const VIGIL_CATEGORY_ID = "1255251210173153342";

const WARNS_PATH = path.join(__dirname, "warns.json");
const BANNED_PATH = path.join(__dirname, "bannedWords.json");
const SENSITIVE_PATH = path.join(__dirname, "sensitiveWords.json");

// Crear archivos si no existen
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

// Configuración de detección
const SPAM_WINDOW_MS = 7000;
const SPAM_THRESHOLD = 5;
const LINES_THRESHOLD = 5;
const CAPS_LENGTH_THRESHOLD = 15;
const CAPS_RATIO_THRESHOLD = 0.7;
const INVITE_REGEX = /discord\.gg\/|discord\.com\/invite\//gi;
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

function findBannedWordInText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const w of bannedWords) {
    if (!w) continue;
    const phrase = w.trim();
    if (phrase.includes(" ")) {
      if (lower.includes(phrase)) return w;
    } else {
      const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "u");
      if (re.test(lower)) return w;
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

async function applyWarn(client, guild, user, member, reason, detectedWord = null) {
  if (!warnings[user.id]) warnings[user.id] = [];
  warnings[user.id].push({ reason, date: new Date().toISOString(), detectedWord });
  saveWarnings();

  const warnCount = warnings[user.id].length;
  const muteMinutes = getMuteMinutesForWarnCount(warnCount);

  const embed = new EmbedBuilder()
    .setTitle(warnCount === 1 ? "⚠️ Advertencia detectada" : "⛔ Infracción detectada")
    .setDescription(
      warnCount === 1
        ? `Has recibido una advertencia por: **${reason}**.\n\nPor favor evita este comportamiento.`
        : `Has cometido una infracción por: **${reason}**.\n\nHas sido muteado por **${muteMinutes} minutos**.`
    )
    .setFooter({ text: "SirgioBOT - Moderación automática" })
    .setTimestamp()
    .setColor(warnCount === 1 ? 0x1e90ff : 0xff0000);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("view_banned_words").setLabel("Ver palabras prohibidas").setStyle(ButtonStyle.Danger)
  );

  try {
    await user.send({ embeds: [embed], components: [row] }).catch(() => {});
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
          { name: "Duración mute", value: muteMinutes > 0 ? `${muteMinutes}m` : "Advertencia", inline: true }
        )
        .setTimestamp();
      logCh.send({ embeds: [logEmbed] }).catch(() => {});
    }
  } catch (e) {
    console.error("Error enviando log:", e);
  }

  return { warnCount, muteMinutes };
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

    try {
      const commands = [
        new SlashCommandBuilder()
          .setName("automod")
          .setDescription("Controla el sistema de AutoMod")
          .addSubcommand((s) => s.setName("on").setDescription("Activa el AutoMod"))
          .addSubcommand((s) => s.setName("off").setDescription("Desactiva el AutoMod"))
          .addSubcommand((s) => s.setName("status").setDescription("Muestra estado del AutoMod")),
        new SlashCommandBuilder()
          .setName("addwarn")
          .setDescription("Agrega una advertencia manual a un usuario")
          .addUserOption((o) => o.setName("usuario").setDescription("Usuario objetivo").setRequired(true))
          .addStringOption((o) => o.setName("razon").setDescription("Motivo").setRequired(true)),
        new SlashCommandBuilder()
          .setName("removewarn")
          .setDescription("Elimina la última advertencia de un usuario")
          .addUserOption((o) => o.setName("usuario").setDescription("Usuario objetivo").setRequired(true)),
        new SlashCommandBuilder()
          .setName("resetwarns")
          .setDescription("Resetea todas las advertencias de un usuario")
          .addUserOption((o) => o.setName("usuario").setDescription("Usuario objetivo").setRequired(true)),
        new SlashCommandBuilder()
          .setName("viewwarns")
          .setDescription("Muestra las advertencias de un usuario")
          .addUserOption((o) => o.setName("usuario").setDescription("Usuario objetivo").setRequired(true)),
        new SlashCommandBuilder()
          .setName("reloadlists")
          .setDescription("Recarga las listas de palabras prohibidas (staff)"),
        new SlashCommandBuilder()
          .setName("mute")
          .setDescription("Mutea manualmente a un usuario (staff)")
          .addUserOption(o => o.setName("usuario").setDescription("Usuario a mutear").setRequired(true))
          .addStringOption(o => o.setName("tiempo").setDescription("Duración (ej: 10m, 1h, 2d)").setRequired(true)),
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
          .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true))
      ].map((c) => c.toJSON());

      await client.application.commands.set(commands, GUILD_ID);
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

      if (!interaction.isChatInputCommand()) return;

      const isStaffOrOwner =
        interaction.user.id === BOT_OWNER_ID ||
        (interaction.member && STAFF_ROLE_IDS.some((r) => interaction.member.roles.cache.has(r)));

      if (interaction.commandName !== "automod" && !isStaffOrOwner) {
        return interaction.reply({ content: "❌ No tienes permisos.", ephemeral: true });
      }

      if (interaction.commandName === "automod") {
        const sub = interaction.options.getSubcommand();
        if (sub === "on") automodEnabled = true;
        if (sub === "off") automodEnabled = false;
        if (sub === "status")
          return interaction.reply({ content: `🔧 AutoMod está **${automodEnabled ? "activado" : "desactivado"}**.`, ephemeral: true });
        return interaction.reply({ content: `✅ AutoMod ${sub} ejecutado.`, ephemeral: true });
      }

      if (interaction.commandName === "addwarn") {
        const user = interaction.options.getUser("usuario");
        const reason = interaction.options.getString("razon");
        const guild = interaction.guild;
        const member = await guild.members.fetch(user.id).catch(() => null);
        await applyWarn(client, guild, user, member, `Advertencia manual: ${reason}`, null);
        return interaction.reply({ content: `⚠️ Advertencia añadida a ${user.tag}.`, ephemeral: true });
      }

      if (interaction.commandName === "removewarn") {
        const user = interaction.options.getUser("usuario");
        if (!warnings[user.id]?.length) return interaction.reply({ content: "✅ Sin warns.", ephemeral: true });
        warnings[user.id].pop();
        if (warnings[user.id].length === 0) delete warnings[user.id];
        saveWarnings();
        return interaction.reply({ content: `🟢 Última advertencia eliminada.`, ephemeral: true });
      }

      if (interaction.commandName === "resetwarns") {
        const user = interaction.options.getUser("usuario");
        delete warnings[user.id];
        saveWarnings();
        return interaction.reply({ content: `🔄 Warns reseteados de ${user.tag}.`, ephemeral: true });
      }

      if (interaction.commandName === "viewwarns") {
        const user = interaction.options.getUser("usuario");
        const arr = warnings[user.id] || [];
        if (!arr.length) return interaction.reply({ content: `✅ ${user.tag} sin advertencias.`, ephemeral: true });
        const desc = arr.map((w, i) => `**${i + 1}.** ${w.reason}`).join("\n");
        const embed = new EmbedBuilder().setColor(0xffff00).setTitle(`Warns: ${user.tag}`).setDescription(desc);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (interaction.commandName === "reloadlists") {
        reloadWordLists();
        return interaction.reply({ content: `🔁 Listas recargadas: ${bannedWords.length} prohibidas, ${sensitiveWords.length} sensibles.`, ephemeral: true });
      }

      if (interaction.commandName === "mute") {
        const user = interaction.options.getUser("usuario");
        const tiempo = interaction.options.getString("tiempo");
        const ms = parseDuration(tiempo);
        if (!ms) return interaction.reply({ content: "❌ Tiempo inválido.", ephemeral: true });

        const guild = interaction.guild;
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ content: "❌ Miembro no encontrado.", ephemeral: true });

        try {
          await member.roles.add(MUTED_ROLE_ID);
          if (activeMutes.has(member.id)) {
            clearTimeout(activeMutes.get(member.id));
            activeMutes.delete(member.id);
          }
          const timeoutId = setTimeout(async () => {
            try {
              const refreshed = await guild.members.fetch(member.id).catch(() => null);
              if (refreshed) await refreshed.roles.remove(MUTED_ROLE_ID).catch(() => {});
            } catch {}
            activeMutes.delete(member.id);
          }, ms);
          activeMutes.set(member.id, timeoutId);

          const logCh = guild.channels.cache.get(LOG_CHANNEL_ID);
          if (logCh) logCh.send({ embeds: [new EmbedBuilder().setTitle("🔇 Mute manual").setDescription(`${user.tag} muteado por ${tiempo}`).setColor(0xffa500).setTimestamp()] }).catch(() => {});
          return interaction.reply({ content: `✅ ${user.tag} muteado por ${tiempo}.`, ephemeral: true });
        } catch (e) {
          console.error("Error:", e);
          return interaction.reply({ content: "❌ Error aplicando mute.", ephemeral: true });
        }
      }

      if (interaction.commandName === "remove_mute") {
        const user = interaction.options.getUser("usuario");
        const guild = interaction.guild;
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ content: "❌ Miembro no encontrado.", ephemeral: true });
        try {
          await member.roles.remove(MUTED_ROLE_ID).catch(() => {});
          if (activeMutes.has(member.id)) {
            clearTimeout(activeMutes.get(member.id));
            activeMutes.delete(member.id);
          }
          const logCh = guild.channels.cache.get(LOG_CHANNEL_ID);
          if (logCh) logCh.send({ embeds: [new EmbedBuilder().setTitle("🔊 Unmute").setDescription(`${user.tag} desmuteado`).setColor(0x00ff00).setTimestamp()] }).catch(() => {});
          return interaction.reply({ content: `✅ Mute removido de ${user.tag}.`, ephemeral: true });
        } catch (e) {
          return interaction.reply({ content: "❌ Error.", ephemeral: true });
        }
      }
    } catch (err) {
      console.error("Error en interaction:", err);
    }
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot || !automodEnabled || IGNORED_CHANNELS.includes(message.channelId)) return;

    try {
      const user = message.author;
      const member = message.member;
      const guild = message.guild;

      if (!member) return;

      // Ignorar staff
      if (STAFF_ROLE_IDS.some((r) => member.roles.cache.has(r))) return;

      const content = message.content;

      // 1. Detectar palabras prohibidas
      const bannedWord = findBannedWordInText(content);
      if (bannedWord) {
        await applyWarn(client, guild, user, member, `Palabra prohibida: "${bannedWord}"`, bannedWord);
        try {
          await message.delete();
        } catch {}
        return;
      }

      // 2. Detectar invites
      if (INVITE_REGEX.test(content)) {
        await applyWarn(client, guild, user, member, "Invitación a otro servidor", null);
        try {
          await message.delete();
        } catch {}
        return;
      }

      // 3. Detectar emojis excesivos
      const emojiCount = (content.match(/\p{Emoji}/gu) || []).length;
      if (emojiCount > EMOJI_THRESHOLD) {
        await applyWarn(client, guild, user, member, `Demasiados emojis (${emojiCount})`, null);
        try {
          await message.delete();
        } catch {}
        return;
      }

      // 4. Detectar spam de líneas
      const lineCount = content.split("\n").length;
      if (lineCount > LINES_THRESHOLD) {
        await applyWarn(client, guild, user, member, "Flood de líneas", null);
        try {
          await message.delete();
        } catch {}
        return;
      }

      // 5. Detectar abuso de mayúsculas
      if (content.length > CAPS_LENGTH_THRESHOLD) {
        const capsCount = (content.match(/[A-Z]/g) || []).length;
        const capsRatio = capsCount / content.length;
        if (capsRatio > CAPS_RATIO_THRESHOLD) {
          await applyWarn(client, guild, user, member, "Abuso de mayúsculas", null);
          try {
            await message.delete();
          } catch {}
          return;
        }
      }

      // 6. Detectar spam rápido
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
      }

    } catch (err) {
      console.error("Error en messageCreate:", err);
    }
  });
};
