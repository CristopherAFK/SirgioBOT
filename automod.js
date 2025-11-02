// automod.js
// SirgioBOT - AutoMod completo (archivo único)
// Requisitos: discord.js v14+, Node 16+
// Uso: require('./automod.js')(client);

const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

// ===============================
// ====== CONFIG (IDs provistas) ======
const GUILD_ID = "1212886282645147768";
const LOG_CHANNEL_ID = "1434002832016801842";
const MUTED_ROLE_ID = "1430271610358726717";
const STAFF_ROLE_IDS = ["1212891335929897030", "1229140504310972599"];
const IGNORED_CHANNELS = ["1258524941289263254", "1313723272290111559"];
const BOT_OWNER_ID = "1032482231677108224";
const TICKET_CHANNEL_ID = "1228438600497102960";
// =====================================

// ====== Archivos (deben existir o se crearán) ======
const WARNS_PATH = path.join(__dirname, "warns.json");
const BANNED_PATH = path.join(__dirname, "bannedWords.json");
const SENSITIVE_PATH = path.join(__dirname, "sensitiveWords.json");

// Asegurar existencia
if (!fs.existsSync(WARNS_PATH)) fs.writeFileSync(WARNS_PATH, JSON.stringify({}, null, 2));
if (!fs.existsSync(BANNED_PATH)) fs.writeFileSync(BANNED_PATH, JSON.stringify({ words: [] }, null, 2));
if (!fs.existsSync(SENSITIVE_PATH)) fs.writeFileSync(SENSITIVE_PATH, JSON.stringify({ words: [] }, null, 2));

// ====== Helpers para cargar listas (soporta array o { words: [] }) ======
function loadWords(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((w) => String(w).toLowerCase());
    if (parsed && Array.isArray(parsed.words)) return parsed.words.map((w) => String(w).toLowerCase());
    // fallback: empty
    return [];
  } catch (e) {
    console.error("Error cargando palabras desde", filePath, e);
    return [];
  }
}

// ====== Estado runtime y persistence ======
let warnings = {}; // { userId: [ { reason, date, detectedWord? } ] }
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

// ====== Ajustes de comportamiento ======
const SPAM_WINDOW_MS = 7000; // ventana para contar mensajes seguidos
const SPAM_THRESHOLD = 5; // cantidad de mensajes seguidos considerados spam
const LINES_THRESHOLD = 5; // líneas por mensaje consideradas spam
const CAPS_LENGTH_THRESHOLD = 15; // longitud mínima para evaluar caps
const CAPS_RATIO_THRESHOLD = 0.7; // ratio mayúsculas > 0.7 considerado abuso

// Mute progresivo por número de warns (index = warnCount)
// warn1 -> 0 (advertencia), warn2 -> 10m, warn3 -> 20m, warn4 -> 40m, warn5+ -> 60m
function getMuteMinutesForWarnCount(count) {
  if (count <= 1) return 0;
  if (count === 2) return 10;
  if (count === 3) return 20;
  if (count === 4) return 40;
  return 60;
}

// ====== Limpieza automática de warns (cada 24h se revisa y borra warns >30d) ======
function cleanupExpiredWarns(client) {
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  let changed = false;
  for (const [userId, arr] of Object.entries(warnings)) {
    const recent = (arr || []).filter((w) => now - new Date(w.date).getTime() < THIRTY_DAYS_MS);
    if (recent.length !== (arr || []).length) {
      // si limpiamos alguno
      warnings[userId] = recent;
      if (recent.length === 0) delete warnings[userId];
      changed = true;

      // notificar al log que se limpiaron warns de ese usuario
      try {
        const guild = client.guilds.cache.get(GUILD_ID);
        const logCh = guild?.channels.cache.get(LOG_CHANNEL_ID);
        if (logCh) {
          const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("🧹 Warns limpiados automáticamente")
            .setDescription(`Se eliminaron warns antiguos de <@${userId}> por inactividad (30 días).`)
            .setTimestamp();
          logCh.send({ embeds: [embed] }).catch(() => {});
        }
      } catch (e) {
        console.error("Error notificando limpieza de warns:", e);
      }
    }
  }
  if (changed) saveWarnings();
}

// ====== Util: buscar palabra prohibida (soporta frases) ======
function findBannedWordInText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const w of bannedWords) {
    if (!w) continue;
    const phrase = w.trim();
    // match whole phrase or substring — para frases permitimos contains
    if (phrase.includes(" ")) {
      if (lower.includes(phrase)) return w;
    } else {
      // palabra individual -> word boundary
      const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "u");
      if (re.test(lower)) return w;
    }
  }
  return null;
}

// ====== Aplicar warn (persistente) ======
async function applyWarn(client, guild, user, member, reason, detectedWord = null) {
  // crear estructura
  if (!warnings[user.id]) warnings[user.id] = [];
  warnings[user.id].push({ reason, date: new Date().toISOString(), detectedWord });
  saveWarnings();

  const warnCount = warnings[user.id].length;
  const muteMinutes = getMuteMinutesForWarnCount(warnCount);

  // Enviar DM al usuario con botón "Ver palabras prohibidas"
  const embed = new EmbedBuilder()
    .setTitle(warnCount === 1 ? "⚠️ Advertencia detectada" : "⛔ Infracción detectada")
    .setDescription(
      warnCount === 1
        ? `Has recibido una advertencia por: **${reason}**.\n\nPor favor evita este comportamiento. Reincidir generará sanciones.`
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
  } catch (e) {
    // DMs cerrados, no pasa nada
  }

  // Aplicar rol mute si corresponde y si tenemos member
  if (muteMinutes > 0 && member) {
    try {
      await member.roles.add(MUTED_ROLE_ID).catch(() => {});
      // quitar rol después de tiempo (no persiste reinicios)
      setTimeout(async () => {
        try {
          const refreshed = await guild.members.fetch(member.id).catch(() => null);
          if (refreshed) await refreshed.roles.remove(MUTED_ROLE_ID).catch(() => {});
        } catch {}
      }, muteMinutes * 60 * 1000);
    } catch (e) {
      console.error("Error aplicando mute por rol:", e);
    }
  }

  // Log en canal de logs
  try {
    const logCh = guild?.channels.cache.get(LOG_CHANNEL_ID);
    if (logCh) {
      const logEmbed = new EmbedBuilder()
        .setColor(muteMinutes > 0 ? "Red" : "Yellow")
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

// ====== Entrypoint: export module ======
module.exports = (client) => {
  // reload lists on command if needed
  client.automod = client.automod || {};
  client.automod.reloadLists = () => {
    reloadWordLists();
    return { bannedWordsCount: bannedWords.length, sensitiveWordsCount: sensitiveWords.length };
  };

  // Limpiar warns al iniciar
  client.once("ready", async () => {
    console.log("✅ AutoMod cargado - SirgioBOT");
    cleanupExpiredWarns(client);

    // ejecutar limpieza cada 24h
    setInterval(() => cleanupExpiredWarns(client), 24 * 60 * 60 * 1000);

    // Registrar slash commands en el servidor (solo para el guild)
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
          .setDescription("Recarga las listas de palabras prohibidas y sensibles (staff)")
      ].map((c) => c.toJSON());

      await client.application.commands.set(commands, GUILD_ID);
      console.log("🟢 Comandos registrados en el servidor.");
    } catch (err) {
      console.error("Error registrando comandos:", err);
    }
  });

  // ====== Interaction handler (slash + botones) ======
  client.on("interactionCreate", async (interaction) => {
    try {
      // Botón "Ver palabras prohibidas"
      if (interaction.isButton() && interaction.customId === "view_banned_words") {
        // se asegura de leer la lista actualizada
        const list = loadWords(BANNED_PATH);
        const embed = new EmbedBuilder()
          .setColor("Red")
          .setTitle("🚫 Lista de palabras prohibidas")
          .setDescription(list.length ? list.map((w) => `• ${w}`).join("\n") : "La lista está vacía.")
          .setFooter({ text: "Evita usar este tipo de lenguaje en el servidor." });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (!interaction.isChatInputCommand()) return;

      // permisos: staff o owner
      const isStaffOrOwner =
        interaction.user.id === BOT_OWNER_ID ||
        (interaction.member && STAFF_ROLE_IDS.some((r) => interaction.member.roles.cache.has(r)));
      if (!isStaffOrOwner) {
        return interaction.reply({ content: "❌ No tienes permisos para usar este comando.", ephemeral: true });
      }

      const name = interaction.commandName;

      // /automod subcommands
      if (name === "automod") {
        const sub = interaction.options.getSubcommand();
        if (sub === "on") automodEnabled = true;
        if (sub === "off") automodEnabled = false;
        if (sub === "status")
          return interaction.reply({ content: `🔧 AutoMod está **${automodEnabled ? "activado" : "desactivado"}**.`, ephemeral: true });
        return interaction.reply({ content: `✅ AutoMod ${sub} ejecutado.`, ephemeral: true });
      }

      if (name === "addwarn") {
        const user = interaction.options.getUser("usuario");
        const reason = interaction.options.getString("razon");
        const guild = interaction.guild;
        const member = await guild.members.fetch(user.id).catch(() => null);
        await applyWarn(client, guild, user, member, `Advertencia manual: ${reason}`, null);
        return interaction.reply({ content: `⚠️ Advertencia añadida a ${user.tag}.`, ephemeral: true });
      }

      if (name === "removewarn") {
        const user = interaction.options.getUser("usuario");
        if (!warnings[user.id]?.length) return interaction.reply({ content: "✅ Ese usuario no tiene warns.", ephemeral: true });
        warnings[user.id].pop();
        if (warnings[user.id].length === 0) delete warnings[user.id];
        saveWarnings();
        return interaction.reply({ content: `🟢 Se eliminó la última advertencia de ${user.tag}.`, ephemeral: true });
      }

      if (name === "resetwarns") {
        const user = interaction.options.getUser("usuario");
        delete warnings[user.id];
        saveWarnings();
        return interaction.reply({ content: `🔄 Se han reseteado las advertencias de ${user.tag}.`, ephemeral: true });
      }

      if (name === "viewwarns") {
        const user = interaction.options.getUser("usuario");
        const arr = warnings[user.id] || [];
        if (!arr.length) return interaction.reply({ content: `✅ ${user.tag} no tiene advertencias.`, ephemeral: true });
        const desc = arr.map((w, i) => `**${i + 1}.** ${w.reason} — ${new Date(w.date).toLocaleString()}`).join("\n");
        const embed = new EmbedBuilder().setColor("Yellow").setTitle(`Warns de ${user.tag}`).setDescription(desc);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (name === "reloadlists") {
        reloadWordLists();
        return interaction.reply({ content: `🔁 Listas recargadas. bannedWords=${bannedWords.length}, sensitiveWords=${sensitiveWords.length}`, ephemeral: true });
      }
    } catch (err) {
      console.error("Error en interactionCreate (automod):", err);
      if (interaction.replied || interaction.deferred) {
        try { await interaction.editReply({ content: "❌ Ocurrió un error al ejecutar el comando.", ephemeral: true }); } catch {}
      } else {
        try { await interaction.reply({ content: "❌ Ocurrió un error al ejecutar el comando.", ephemeral: true }); } catch {}
      }
    }
  });

  // ====== messageCreate: principal detección ======
  // Map para flood detection: userId -> { count, lastMessage }
  const userMessages = {};
// Estado del AutoMod (por defecto activado)
let automodEnabled = true;

  client.on("messageCreate", async (message) => {
    try {
      if (message.author.bot) return;
      if (!automodEnabled) return;
      if (!message.guild) return;
      if (IGNORED_CHANNELS.includes(message.channel.id)) return;

      const member = message.member;
      if (!member) return;
      if (STAFF_ROLE_IDS.some((r) => member.roles.cache.has(r))) return; // staff exento

      const content = message.content || "";
      const contentLower = content.toLowerCase();

      // 1) Sensitive words (si hay mencion, enviar DM privado al mencionado, log)
      const sensitiveFound = sensitiveWords.find((w) => {
        if (!w) return false;
        // match phrase or word
        if (w.includes(" ")) return contentLower.includes(w);
        const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "u");
        return re.test(contentLower);
      });
      if (sensitiveFound && message.mentions.users.size > 0) {
        const mentioned = message.mentions.users.first();
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor("Yellow")
            .setTitle("💬 Alerta: posible mensaje ofensivo")
            .setDescription(`Hola ${mentioned.username}, si este mensaje te incomodó u ofendió, puedes crear un ticket en <#${TICKET_CHANNEL_ID}>.`)
            .setFooter({ text: "SirgioBOT - Confidencial y privado" })
            .setTimestamp();
          await mentioned.send({ embeds: [dmEmbed] }).catch(() => {
            // usuario con DMs cerrados; ignorar
          });

          // Log
          const logCh = message.guild.channels.cache.get(LOG_CHANNEL_ID);
          if (logCh) {
            const logEmbed = new EmbedBuilder()
              .setColor("Yellow")
              .setTitle("⚠️ Palabra sensible detectada")
              .addFields(
                { name: "Autor", value: `${message.author.tag} (${message.author.id})`, inline: true },
                { name: "Mencionado", value: `${mentioned.tag} (${mentioned.id})`, inline: true },
                { name: "Canal", value: `${message.channel}`, inline: true }
              )
              .setDescription(`Mensaje: ${message.content}`)
              .setTimestamp();
            logCh.send({ embeds: [logEmbed] }).catch(() => {});
          }
        } catch (e) {
          console.error("Error enviando DM por palabra sensible:", e);
        }
      }

      // 2) Palabra prohibida -> borrar mensaje + warn + posible mute
      const bannedFound = findBannedWordInText(content);
      if (bannedFound) {
        // eliminar mensaje
        await message.delete().catch(() => {});

        // aplicar warn
        await applyWarn(client, message.guild, message.author, member, `Uso de palabra prohibida: "${bannedFound}"`, bannedFound);
        return;
      }

      // 3) Links
      if (/(https?:\/\/[^\s]+)/gi.test(content)) {
        await message.delete().catch(() => {});
        await applyWarn(client, message.guild, message.author, member, "Envío de links no permitidos", null);
        return;
      }

      // 4) Exceso de mayúsculas
      const lettersOnly = content.replace(/[^A-Za-z]/g, "");
      const upperCount = (lettersOnly.match(/[A-Z]/g) || []).length;
      const capsRatio = lettersOnly.length ? upperCount / lettersOnly.length : 0;
      if (content.length > CAPS_LENGTH_THRESHOLD && capsRatio > CAPS_RATIO_THRESHOLD) {
        await message.delete().catch(() => {});
        await applyWarn(client, message.guild, message.author, member, "Uso excesivo de mayúsculas", null);
        return;
      }

      // 5) Spam por líneas
      const lines = content.split(/\r?\n/).length;
      if (lines > LINES_THRESHOLD) {
        await message.delete().catch(() => {});
        await applyWarn(client, message.guild, message.author, member, `Spam (demasiadas líneas: ${lines})`, null);
        return;
      }

      // 6) Flood / mensajes seguidos
      if (!userMessages[message.author.id]) userMessages[message.author.id] = { count: 0, lastMessage: Date.now() };
      const userData = userMessages[message.author.id];
      userData.count = Date.now() - userData.lastMessage < SPAM_WINDOW_MS ? userData.count + 1 : 1;
      userData.lastMessage = Date.now();
      if (userData.count >= SPAM_THRESHOLD) {
        await message.delete().catch(() => {});
        await applyWarn(client, message.guild, message.author, member, "Spam (mensajes seguidos)", null);
        userData.count = 0;
        return;
      }

      // no match -> seguir normal
    } catch (e) {
      console.error("Error en messageCreate automod:", e);
    }
  });

  // ====== Exponer helpers para debugging desde index.js si se quiere ======
  client.automod = client.automod || {};
  client.automod.getBanned = () => bannedWords.slice();
  client.automod.getSensitive = () => sensitiveWords.slice();
  client.automod.getWarnings = () => JSON.parse(JSON.stringify(warnings));
  client.automod.reloadLists = () => {
    reloadWordLists();
    return { banned: bannedWords.length, sensitive: sensitiveWords.length };
  };
};

// EOF
