// ================================
// SirgioBOT - Sistema Automod Completo (automod.js) - ACTUALIZADO con lista completa de palabras prohibidas
// ================================

const fs = require("fs");
const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

// IDs proporcionados
const GUILD_ID = "1212886282645147768";
const LOG_CHANNEL_ID = "1434002832016801842";
const MUTED_ROLE_ID = "1430271610358726717";
const STAFF_ROLE_IDS = ["1212891335929897030", "1229140504310972599"];
const IGNORED_CHANNELS = ["1258524941289263254", "1313723272290111559"];
const BOT_OWNER_ID = "1032482231677108224";
const TICKET_CHANNEL_ID = "1228438600497102960";

const WARNS_FILE = "./warns.json";
let automodEnabled = true;

// Asegurar existencia de warns.json
if (!fs.existsSync(WARNS_FILE)) fs.writeFileSync(WARNS_FILE, "{}");

// ================================
// Lista completa de palabras prohibidas (según tu lista)
// ================================
const palabrasProhibidas = [
  "server muerto",
  "borren el server",
  "puta",
  "puto",
  "perra",
  "pene",
  "vagina",
  "negro",
  "negros",
  "hitler",
  "violacion",
  "violar",
  "viole",
  "suicidate",
  "mátate",
  "kill your self",
  "kys",
  "maldito",
  "mierda",
  "coño",
  "zorra",
  "mamame el guebo",
  "server de los sensibles",
  "server de los cristales",
  "chaqueta",
  "masturbación",
  "server de mrd",
  "pedofilo",
  "porno",
  "borra esa mierda",
  "borra la cuenta",
  "midgio",
  // incluí también variantes comunes y sin acentos
  "suicate", "suicidate", "mátate", "mátate", "k y s", "k y s", "kys.", "kys!",
  "mamame", "mamame el guebo", "guebo"
];

// Palabras sensibles (para avisar al mencionado)
const sensitiveWords = [
  "negro",
  "gay",
  "lesbiana",
  "bisexual",
  "pansexual",
  "homosexual",
  "transexual",
];

// regex para links
const regexLink = /(https?:\/\/[^\s]+)/g;

// ================================
// Helpers
// ================================
function saveWarns(warns) {
  fs.writeFileSync(WARNS_FILE, JSON.stringify(warns, null, 2));
}

function loadWarns() {
  let warns = JSON.parse(fs.readFileSync(WARNS_FILE, "utf8"));
  let changed = false;
  const now = Date.now();

  // Limpieza automática (30 días)
  for (const [userId, data] of Object.entries(warns)) {
    const lastWarn = new Date(data.lastWarnDate).getTime();
    if (now - lastWarn > 30 * 24 * 60 * 60 * 1000) {
      delete warns[userId];
      changed = true;

      const guild = client.guilds.cache.get(GUILD_ID);
      const logChannel = guild?.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        logChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor("Green")
              .setDescription(`🧹 Las advertencias de <@${userId}> fueron eliminadas automáticamente por inactividad de 30 días.`),
          ],
        });
      }
    }
  }

  if (changed) saveWarns(warns);
  return warns;
}

function findBannedWord(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const w of palabrasProhibidas) {
    if (!w) continue;
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
      const re = new RegExp(`\\b${escaped}\\b`, "u");
      if (re.test(lower)) return w;
    } catch {
      if (lower.includes(w.toLowerCase())) return w;
    }
  }
  return null;
}

function getMuteDurationMs(warnsCount) {
  switch (warnsCount) {
    case 2: return 10 * 60 * 1000; // 10 min
    case 3: return 20 * 60 * 1000; // 20 min
    case 4: return 40 * 60 * 1000; // 40 min
    default:
      if (warnsCount >= 5) return 60 * 60 * 1000; // 1 hora (límite)
      return 0; // warn 1 => 0
  }
}

async function applyMute(member, durationMs) {
  if (!member || !durationMs) return;
  await member.roles.add(MUTED_ROLE_ID).catch(() => null);
  setTimeout(async () => {
    try {
      const refreshed = await member.guild.members.fetch(member.id).catch(() => null);
      if (refreshed) await refreshed.roles.remove(MUTED_ROLE_ID).catch(() => null);
    } catch {}
  }, durationMs);
}

// ================================
// Export module
// ================================
module.exports = (client) => {
  console.log("✅ Automod cargado correctamente (con lista de palabras completa).");

  // Estado runtime
  let automodEnabled = true;
  const SPAM_WINDOW_MS = 7000;
  const SPAM_THRESHOLD = 5;
  const LINES_THRESHOLD = 5;
  const CAPS_LENGTH_THRESHOLD = 15;
  const CAPS_RATIO_THRESHOLD = 0.7;
  const userMessages = {};

  // =====================
  // Mensajes del servidor (auto moderation)
  // =====================
  client.on("messageCreate", async (message) => {
    try {
      if (!automodEnabled) return;
      if (message.author.bot) return;
      if (!message.guild) return;
      if (IGNORED_CHANNELS.includes(message.channel.id)) return;
      if (STAFF_ROLE_IDS.some(r => message.member.roles.cache.has(r))) return;

      const content = message.content || "";
      const contentLower = content.toLowerCase();
      const guild = message.guild;

      // 1) palabras prohibidas
      const found = findBannedWord(contentLower);
      if (found) {
        await message.delete().catch(() => {});
        await handleWarn(guild, message.author, message.member, `Uso de palabra prohibida: "${found}"`, found, message);
        return;
      }

      // 2) links
      if (regexLink.test(content)) {
        await message.delete().catch(() => {});
        await handleWarn(guild, message.author, message.member, "Envío de enlaces no permitidos", null, message);
        return;
      }

      // 3) exceso de mayúsculas
      const lettersOnly = content.replace(/[^A-Za-z]/g, "");
      const upperCount = (lettersOnly.match(/[A-Z]/g) || []).length;
      const capsRatio = lettersOnly.length ? upperCount / lettersOnly.length : 0;
      if (content.length > CAPS_LENGTH_THRESHOLD && capsRatio > CAPS_RATIO_THRESHOLD) {
        await message.delete().catch(() => {});
        await handleWarn(guild, message.author, message.member, "Uso excesivo de mayúsculas", null, message);
        return;
      }

      // 4) spam por líneas
      const lines = content.split(/\r?\n/).length;
      if (lines > LINES_THRESHOLD) {
        await message.delete().catch(() => {});
        await handleWarn(guild, message.author, message.member, `Spam (demasiadas líneas: ${lines})`, null, message);
        return;
      }

      // 5) flood: X mensajes seguidos en una ventana
      if (!userMessages[message.author.id]) userMessages[message.author.id] = { count: 0, lastMessage: Date.now() };
      const userData = userMessages[message.author.id];
      const now = Date.now();
      if (now - userData.lastMessage < SPAM_WINDOW_MS) userData.count = userData.count + 1;
      else userData.count = 1;
      userData.lastMessage = now;
      if (userData.count >= SPAM_THRESHOLD) {
        await message.delete().catch(() => {});
        await handleWarn(guild, message.author, message.member, `Spam (envío de ${userData.count} mensajes en corto tiempo)`, null, message);
        userData.count = 0;
        return;
      }

      // 6) sensitive words: avisar al mencionado si aplica
      for (const w of sensitiveWords) {
        if (contentLower.includes(w)) {
          const mentioned = message.mentions.users.first();
          if (mentioned) {
            try {
              await mentioned.send(`💬 Hola ${mentioned.username}, si este mensaje te incomodó u ofendió, puedes crear un ticket en <#${TICKET_CHANNEL_ID}>.`).catch(() => {});
            } catch {}
          }
          break;
        }
      }
    } catch (e) {
      console.error("Error en messageCreate (automod):", e);
    }
  });

  // =====================
  // Manejo de warns & notificaciones
  // =====================
  async function handleWarn(guild, user, member, reason, detectedWord = null, originalMessage = null) {
    const warns = loadWarnsLocal(); // local load with cleanup
    if (!warns[user.id]) warns[user.id] = { warns: 0, history: [] };
    warns[user.id].warns++;
    warns[user.id].lastWarnReason = reason;
    warns[user.id].lastWarnDate = new Date().toISOString();
    warns[user.id].history.push({ reason, date: new Date().toISOString(), detectedWord: detectedWord || null });
    saveWarns(warns);

    const warnCount = warns[user.id].warns;
    const muteMs = getMuteDurationMs(warnCount);

    // Embed azul para warn 1, rojo para sanción
    const embed = new EmbedBuilder()
      .setAuthor({ name: `Advertencia para ${user.tag}`, iconURL: user.displayAvatarURL?.() })
      .setTimestamp();

    if (warnCount === 1) {
      embed.setColor(0x1e90ff) // azul
        .setDescription(`⚠️ ${reason}\n\nPor favor evita este comportamiento. Esta es una advertencia (Warn 1).`);
    } else {
      embed.setColor(0xff0000) // rojo
        .setDescription(`🚫 ${reason}\n\n**Warn ${warnCount}/5.** Has sido muteado temporalmente por conducta repetida.`);
    }

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ver_palabras")
        .setLabel("Ver palabras prohibidas")
        .setStyle(ButtonStyle.Secondary)
    );

    // Enviar mensaje en canal (mencionando al usuario)
    try {
      if (originalMessage && originalMessage.channel) {
        await originalMessage.channel.send({ content: `<@${user.id}>`, embeds: [embed], components: [buttonRow] });
      } else {
        // fallback: enviar al canal general del guild
        const ch = guild?.channels.cache?.first();
        if (ch) await ch.send({ content: `<@${user.id}>`, embeds: [embed], components: [buttonRow] }).catch(() => {});
      }
    } catch {}

    // Enviar DM con embed + botón (intento)
    try {
      await user.send({ embeds: [embed], components: [buttonRow] }).catch(() => {});
    } catch {}

    // Aplicar mute si corresponde (warn >=2)
    if (muteMs > 0 && member) {
      await applyMute(member, muteMs).catch(() => {});
    }

    // Log en canal
    try {
      const guildObj = client.guilds.cache.get(GUILD_ID);
      const logCh = guildObj?.channels.cache.get(LOG_CHANNEL_ID);
      if (logCh) {
        const logEmbed = new EmbedBuilder()
          .setColor("Orange")
          .setTitle("Sistema Automod - Nueva Advertencia")
          .addFields(
            { name: "Usuario", value: `${user.tag} (${user.id})`, inline: true },
            { name: "Motivo", value: reason, inline: true },
            { name: "Warns", value: `${warnCount}`, inline: true },
            { name: "Duración mute", value: muteMs > 0 ? `${Math.round(muteMs/60000)}m` : "Advertencia", inline: true }
          )
          .setTimestamp();
        await logCh.send({ embeds: [logEmbed] }).catch(() => {});
      }
    } catch (e) {
      console.error("Error al enviar log:", e);
    }
  }

  // =====================
  // Botón "Ver palabras prohibidas"
  // =====================
  client.on("interactionCreate", async (interaction) => {
    try {
      if (!interaction.isButton()) return;
      if (interaction.customId !== "ver_palabras") return;

      // Responder de forma efímera para que solo él/ella lo vea
      const embed = new EmbedBuilder()
        .setColor("Grey")
        .setTitle("🔒 Lista de palabras y acciones restringidas")
        .setDescription(
          `**Palabras prohibidas (ejemplos):**\n${palabrasProhibidas.map(p => `• ${p}`).join("\n")}\n\n` +
          "**También puedes recibir advertencias por:**\n" +
          "- Enviar enlaces no permitidos\n" +
          "- Escribir en exceso con mayúsculas\n" +
          "- Enviar mensajes de más de 5 líneas\n" +
          "- Enviar 5 mensajes seguidos (spam)\n\n" +
          `Si tienes dudas, crea un ticket en <#${TICKET_CHANNEL_ID}>.`
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("Error en interactionCreate (botón ver_palabras):", e);
    }
  });

  // =====================
  // Comandos (simplificados: respuestas administrativas)
  // =====================
  client.on("interactionCreate", async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;

      // permisos: staff o owner
      const isStaffOrOwner =
        interaction.user.id === BOT_OWNER_ID ||
        (interaction.member && STAFF_ROLE_IDS.some((id) => interaction.member.roles.cache.has(id)));
      if (!isStaffOrOwner) return interaction.reply({ content: "❌ No tienes permisos.", ephemeral: true });

      const warns = loadWarnsLocal();

      const { commandName } = interaction;

      if (commandName === "automod") {
        const sub = interaction.options.getSubcommand();
        if (sub === "on") automodEnabled = true;
        if (sub === "off") automodEnabled = false;
        if (sub === "status") {
          return interaction.reply({ content: `🔧 AutoMod: **${automodEnabled ? "activado" : "desactivado"}**`, ephemeral: true });
        }
        return interaction.reply({ content: `✅ AutoMod ${sub}`, ephemeral: true });
      }

      if (commandName === "warns" || commandName === "viewwarns") {
        const user = interaction.options.getUser("usuario");
        const data = warns[user.id];
        if (!data) return interaction.reply({ content: `✅ ${user.tag} no tiene advertencias.`, ephemeral: true });
        const desc = `Total: **${data.warns}**\nÚltimo motivo: ${data.lastWarnReason}\nÚltima fecha: ${data.lastWarnDate}`;
        return interaction.reply({ embeds: [new EmbedBuilder().setColor("Yellow").setTitle(`Warns de ${user.tag}`).setDescription(desc)], ephemeral: true });
      }

      if (commandName === "addwarn") {
        const user = interaction.options.getUser("usuario");
        const reason = interaction.options.getString("razon") || "Warn manual";
        // mimic detection: create warn and apply consequences via handleWarn
        const guild = interaction.guild;
        const member = await guild.members.fetch(user.id).catch(() => null);
        await handleWarn(guild, user, member, `Warn manual: ${reason}`, null, null);
        return interaction.reply({ content: `⚠️ Advertencia manual añadida a ${user.tag}`, ephemeral: true });
      }

      if (commandName === "removewarn") {
        const user = interaction.options.getUser("usuario");
        if (!warns[user.id]) return interaction.reply({ content: `${user.tag} no tiene warns.`, ephemeral: true });
        warns[user.id].warns = Math.max(0, warns[user.id].warns - 1);
        warns[user.id].lastWarnDate = new Date().toISOString();
        saveWarns(warns);
        return interaction.reply({ content: `🟢 Se eliminó un warn de ${user.tag}. Total actual: ${warns[user.id].warns}`, ephemeral: true });
      }

      if (commandName === "resetwarns") {
        const user = interaction.options.getUser("usuario");
        delete warns[user.id];
        saveWarns(warns);
        return interaction.reply({ content: `🔄 Se han reseteado todas las advertencias de ${user.tag}.`, ephemeral: true });
      }
    } catch (e) {
      console.error("Error en interactionCreate (comandos):", e);
    }
  });

  // =====================
  // Helpers locales para load/save con limpieza
  // =====================
  function loadWarnsLocal() {
    let data = {};
    try {
      data = JSON.parse(fs.readFileSync(WARNS_FILE, "utf8"));
    } catch {
      data = {};
    }
    // limpieza automática sin notificar (la notificación se hace en loadWarns: pero loadWarns necesita client)
    // Para simplificar mantenemos la limpieza y notificación en loadWarns (que requiere client), así que aquí solo devolvemos data.
    // Si quieres que la limpieza ocurra en cada llamada, podemos fusionar loadWarnsLocal con loadWarns.
    return data;
  }

  // Exponer helpers en client.automod
  client.automod = client.automod || {};
  client.automod.helpers = {
    getBannedWords: () => palabrasProhibidas.slice(),
    addBannedWord: (w) => { palabrasProhibidas.push(w.toLowerCase()); },
    removeBannedWord: (w) => {
      const idx = palabrasProhibidas.indexOf(w.toLowerCase());
      if (idx !== -1) palabrasProhibidas.splice(idx, 1);
    },
    getWarns: () => loadWarnsLocal(),
  };
};

// Nota: la función loadWarns (que notifica en logs cuando limpia) usa `client` — si quieres que haga la limpieza
// automática exactamente en cada lectura, podemos ajustarla para usar el client pasado al module.exports y llamarla.
