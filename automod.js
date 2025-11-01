// automod.js
// Requiere: discord.js v14, Node >=16.9
// Uso: const automod = require('./automod'); automod(client);

const {
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  PermissionsBitField,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// ===============================
// ⚙️ CONFIGURACIÓN (IDs que proporcionaste)
// ===============================
const GUILD_ID = "1212886282645147768";
const LOG_CHANNEL_ID = "1434002832016801842";
const MUTED_ROLE_ID = "1430271610358726717";
const STAFF_ROLE_IDS = ["1212891335929897030", "1229140504310972599"];
const IGNORED_CHANNELS = ["1258524941289263254", "1313723272290111559"];
const BOT_OWNER_ID = "1032482231677108224";
const TICKET_CHANNEL_ID = "1228438600497102960";

// ===============================
// Persistencia de warns
// ===============================
const WARNS_FILE = path.join(__dirname, "warns.json");
let warns = {};
if (fs.existsSync(WARNS_FILE)) {
  try {
    warns = JSON.parse(fs.readFileSync(WARNS_FILE, "utf8"));
  } catch (e) {
    console.error("Error parseando warns.json, iniciando vacío.", e);
    warns = {};
  }
}
function saveWarns() {
  fs.writeFileSync(WARNS_FILE, JSON.stringify(warns, null, 2));
}

// ===============================
// Listas de palabras
// ===============================
let bannedWords = [
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
];

const sensitiveWords = [
  "negro",
  "gay",
  "lesbiana",
  "bisexual",
  "pansexual",
  "homosexual",
  "transexual",
];

// ===============================
// Ajustes de comportamiento
// ===============================
const SPAM_WINDOW_MS = 7000;
const SPAM_THRESHOLD = 5;
const LINES_THRESHOLD = 5;
const CAPS_LENGTH_THRESHOLD = 15;
const CAPS_RATIO_THRESHOLD = 0.7;
// Mutes progresivos: index = warn count (1-indexed). warn1 -> 0 (solo advertencia)
const MUTE_DURATIONS_MINUTES = [0, 10, 20, 40, 60]; // warn1=0, warn2=10, warn3=20, warn4=40, warn5+=60

// ===============================
// Estado runtime
// ===============================
let automodEnabled = true;
const userMessages = {}; // flood detection: userId -> { count, lastMessage }

// ===============================
// Utilidades
// ===============================
function isStaff(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionsBitField.Flags.Administrator)) return true;
  return STAFF_ROLE_IDS.some((id) => member.roles.cache.has(id));
}

function isIgnoredChannel(channelId) {
  return IGNORED_CHANNELS.includes(channelId);
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findBannedWord(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const w of bannedWords) {
    if (!w) continue;
    try {
      const re = new RegExp(`\\b${escapeRegExp(w.toLowerCase())}\\b`, "u");
      if (re.test(lower)) return w;
    } catch {
      if (lower.includes(w.toLowerCase())) return w;
    }
  }
  return null;
}

// ===============================
// Embeds estilo (similar a la imagen)
// ===============================
function createWarnEmbed({ title, detectedWord, description, userTag }) {
  const embed = new EmbedBuilder()
    .setColor(0x1e90ff) // azul claro
    .setTitle(title || "Evita usar este tipo de palabras ⚠️")
    .setDescription(
      description ||
        "Se ha detectado el uso de lenguaje inapropiado.\n\n" +
          (detectedWord ? `**Palabra detectada:** \`${detectedWord}\`\n\n` : "") +
          "En este servidor no se permite este tipo de lenguaje. Si continúas, se aplicarán sanciones (mute temporal)."
    )
    .setFooter({ text: userTag ? `Advertencia para ${userTag}` : "SirgioBOT - Moderación automática" })
    .setTimestamp();
  return embed;
}

function createLogEmbed({ userTag, reason, warnCount, muteTime }) {
  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("⚠️ Advertencia emitida")
    .addFields(
      { name: "Usuario", value: userTag || "Desconocido", inline: true },
      { name: "Razón", value: reason || "No especificada", inline: true },
      { name: "Total de warns", value: `${warnCount}`, inline: true },
      { name: "Duración del mute", value: muteTime ? `${muteTime}m` : "Advertencia", inline: true }
    )
    .setTimestamp();
  return embed;
}

// ===============================
// Advertir usuario (persistente en warns.json)
// ===============================
async function applyWarn(client, guild, user, reason, detectedWord = null) {
  // asegurar estructura
  if (!warns[user.id]) warns[user.id] = [];
  warns[user.id].push({ reason, date: new Date().toISOString(), detectedWord });
  saveWarns();

  const warnCount = warns[user.id].length;
  // calcula mute time
  const idx = Math.min(warnCount - 1, MUTE_DURATIONS_MINUTES.length - 1);
  const muteMinutes = MUTE_DURATIONS_MINUTES[idx];

  // enviar DM con botón para ver palabras (botón en el mismo embed)
  const embed = createWarnEmbed({
    detectedWord,
    userTag: user.tag,
  });

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("view_banned_words")
      .setLabel("Ver palabras prohibidas")
      .setStyle(ButtonStyle.Danger)
  );

  // Intentar borrar el mensaje original en el canal antes de notificar (si existe).
  // (Debe haberse borrado por quien llama a applyWarn; aquí solo DM/Log)
  try {
    await user.send({ embeds: [embed], components: [buttonRow] });
  } catch {
    // usuario tiene DMs cerrados
    // no hacemos fallar el flujo
  }

  // Aplicar mute solo si muteMinutes > 0
  if (muteMinutes > 0) {
    // intenta aplicar rol de mute
    if (guild) {
      try {
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (member) {
          await member.roles.add(MUTED_ROLE_ID).catch(() => {});
          // programar eliminación del rol (no persistente sobre reinicio)
          setTimeout(async () => {
            try {
              const m = await guild.members.fetch(user.id).catch(() => null);
              if (m) await m.roles.remove(MUTED_ROLE_ID).catch(() => {});
            } catch {}
          }, muteMinutes * 60 * 1000);
        }
      } catch (e) {
        console.error("Error aplicando rol de mute:", e);
      }
    }
  }

  // Log en canal
  if (guild) {
    try {
      const logCh = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      if (logCh && logCh.send) {
        const logEmbed = createLogEmbed({
          userTag: user.tag,
          reason,
          warnCount,
          muteTime: muteMinutes > 0 ? muteMinutes : null,
        });
        await logCh.send({ embeds: [logEmbed] }).catch(() => {});
      }
    } catch (e) {
      console.error("Error enviando log:", e);
    }
  }

  return { warnCount, muteMinutes };
}

// ===============================
// Export principal: función que recibe client
// ===============================
module.exports = function (client) {
  // Registrar comandos slash en ready
  client.once("ready", async () => {
    console.log("✅ AutoMod cargado correctamente (module).");

    // comandos según tu lista:
    const commands = [
      new SlashCommandBuilder()
        .setName("automod")
        .setDescription("Controla el sistema de AutoMod")
        .addSubcommand((s) => s.setName("on").setDescription("Activa el AutoMod"))
        .addSubcommand((s) => s.setName("off").setDescription("Desactiva el AutoMod"))
        .addSubcommand((s) => s.setName("status").setDescription("Muestra el estado del AutoMod")),
      new SlashCommandBuilder()
        .setName("warns")
        .setDescription("Muestra las advertencias de un usuario")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuario objetivo").setRequired(true)),
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
        .setDescription("Muestra todas las advertencias de un usuario")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuario objetivo").setRequired(true)),
      new SlashCommandBuilder()
        .setName("addpalabra")
        .setDescription("Agrega palabra prohibida")
        .addStringOption((o) => o.setName("palabra").setDescription("Palabra a agregar").setRequired(true)),
      new SlashCommandBuilder()
        .setName("delpalabra")
        .setDescription("Elimina palabra prohibida")
        .addStringOption((o) => o.setName("palabra").setDescription("Palabra a eliminar").setRequired(true)),
    ].map((c) => c.toJSON());

    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    try {
      await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
        body: commands,
      });
      console.log("🟢 Comandos registrados en el servidor.");
    } catch (err) {
      console.error("Error registrando comandos:", err);
    }
  });

  // ===============================
  // Interacciones (slash + botones)
  // ===============================
  client.on("interactionCreate", async (interaction) => {
    try {
      // BOTÓN en DM: "Ver palabras prohibidas" -> actualiza el mensaje con la lista
      if (interaction.isButton() && interaction.customId === "view_banned_words") {
        // actualizar el mensaje original (mismo DM)
        const embed = new EmbedBuilder()
          .setColor("Red")
          .setTitle("🚫 Lista de Palabras Prohibidas")
          .setDescription(bannedWords.map((w) => `• ${w}`).join("\n"))
          .setFooter({ text: "Evita usar este tipo de lenguaje en el servidor." });
        // intenta update (funciona para mensajes del bot con componentes)
        try {
          await interaction.update({ embeds: [embed], components: [] });
        } catch {
          // fallback: reply ephemeral
          await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
        }
        return;
      }

      // Slash commands
      if (!interaction.isChatInputCommand()) return;

      // permisos: staff o owner
      const isStaffOrOwner =
        interaction.user.id === BOT_OWNER_ID ||
        (interaction.member && STAFF_ROLE_IDS.some((id) => interaction.member.roles.cache.has(id)));
      if (!isStaffOrOwner) {
        return interaction.reply({ content: "❌ No tienes permisos para usar este comando.", ephemeral: true });
      }

      const { commandName } = interaction;

      // automod on/off/status
      if (commandName === "automod") {
        const sub = interaction.options.getSubcommand();
        if (sub === "on") automodEnabled = true;
        else if (sub === "off") automodEnabled = false;

        const color = automodEnabled ? "Green" : "Red";
        const desc = sub === "status" ? `🔧 AutoMod está **${automodEnabled ? "activado" : "desactivado"}**` : `✅ AutoMod **${sub === "on" ? "activado" : "desactivado"}**`;
        const embed = new EmbedBuilder().setColor(color).setDescription(desc);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // warns (ver cantidad)
      if (commandName === "warns") {
        const user = interaction.options.getUser("usuario");
        const list = warns[user.id] || [];
        const embed = new EmbedBuilder()
          .setColor("Yellow")
          .setTitle(`Warns de ${user.tag}`)
          .setDescription(list.length ? `Total: **${list.length}**` : "✅ Sin advertencias.");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (commandName === "addwarn") {
        const user = interaction.options.getUser("usuario");
        const reason = interaction.options.getString("razon");
        await applyWarn(client, interaction.guild, user, reason);
        return interaction.reply({ content: `⚠️ Advertencia añadida a **${user.tag}**.`, ephemeral: true });
      }

      if (commandName === "removewarn") {
        const user = interaction.options.getUser("usuario");
        if (!warns[user.id]?.length) {
          return interaction.reply({ content: "❌ Este usuario no tiene advertencias.", ephemeral: true });
        }
        const removed = warns[user.id].pop();
        saveWarns();
        return interaction.reply({ content: `🟢 Se eliminó la última advertencia de **${user.tag}** (razón: ${removed.reason}).`, ephemeral: true });
      }

      if (commandName === "resetwarns") {
        const user = interaction.options.getUser("usuario");
        delete warns[user.id];
        saveWarns();
        return interaction.reply({ content: `🔄 Se han reseteado todas las advertencias de **${user.tag}**.`, ephemeral: true });
      }

      if (commandName === "viewwarns") {
        const user = interaction.options.getUser("usuario");
        const userWarns = warns[user.id] || [];
        const desc = userWarns.length ? userWarns.map((w, i) => `**${i + 1}.** ${w.reason} — ${new Date(w.date).toLocaleString()}`).join("\n") : "✅ Sin advertencias.";
        const embed = new EmbedBuilder().setColor("Yellow").setTitle(`Advertencias de ${user.tag}`).setDescription(desc);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (commandName === "addpalabra") {
        const palabra = interaction.options.getString("palabra").toLowerCase();
        if (bannedWords.includes(palabra)) {
          return interaction.reply({ content: "❌ Esa palabra ya está en la lista.", ephemeral: true });
        }
        bannedWords.push(palabra);
        return interaction.reply({ content: `✅ Palabra "${palabra}" añadida.`, ephemeral: true });
      }

      if (commandName === "delpalabra") {
        const palabra = interaction.options.getString("palabra").toLowerCase();
        const idx = bannedWords.indexOf(palabra);
        if (idx === -1) return interaction.reply({ content: "❌ Esa palabra no existe en la lista.", ephemeral: true });
        bannedWords.splice(idx, 1);
        return interaction.reply({ content: `✅ Palabra "${palabra}" eliminada.`, ephemeral: true });
      }
    } catch (err) {
      console.error("Error en interactionCreate (automod):", err);
    }
  });

  // ===============================
  // Mensajes del servidor - auto moderation
  // ===============================
  client.on("messageCreate", async (message) => {
    try {
      if (!automodEnabled) return;
      if (message.author.bot) return;
      if (!message.guild) return;
      if (isIgnoredChannel(message.channel.id)) return;

      const member = message.member;
      if (!member) return;
      if (isStaff(member)) return; // staff exento

      const originalContent = message.content || "";
      const contentLower = originalContent.toLowerCase();
      const guild = message.guild;

      // 1) palabras prohibidas
      const found = findBannedWord(originalContent);
      if (found) {
        // eliminar mensaje y advertir
        await message.delete().catch(() => {});
        await applyWarn(client, guild, message.author, `Uso de palabra prohibida: "${found}"`, found);
        return;
      }

      // 2) links (puedes ajustar qué dominios permites)
      const linkRegex = /(https?:\/\/[^\s]+)/gi;
      if (linkRegex.test(originalContent)) {
        await message.delete().catch(() => {});
        await applyWarn(client, guild, message.author, "Envío de links no permitidos", null);
        return;
      }

      // 3) exceso de mayúsculas
      const lettersOnly = originalContent.replace(/[^A-Za-z]/g, "");
      const upperCount = (lettersOnly.match(/[A-Z]/g) || []).length;
      const capsRatio = lettersOnly.length ? upperCount / lettersOnly.length : 0;
      if (originalContent.length > CAPS_LENGTH_THRESHOLD && capsRatio > CAPS_RATIO_THRESHOLD) {
        await message.delete().catch(() => {});
        await applyWarn(client, guild, message.author, "Uso excesivo de mayúsculas", null);
        return;
      }

      // 4) spam por líneas
      const lines = originalContent.split(/\r?\n/).length;
      if (lines > LINES_THRESHOLD) {
        await message.delete().catch(() => {});
        await applyWarn(client, guild, message.author, `Spam (demasiadas líneas: ${lines})`, null);
        return;
      }

      // 5) flood: X mensajes seguidos en una ventana
      if (!userMessages[message.author.id])
        userMessages[message.author.id] = { count: 0, lastMessage: Date.now() };

      const userData = userMessages[message.author.id];
      const now = Date.now();
      if (now - userData.lastMessage < SPAM_WINDOW_MS) {
        userData.count = userData.count + 1;
      } else {
        userData.count = 1;
      }
      userData.lastMessage = now;

      if (userData.count >= SPAM_THRESHOLD) {
        await message.delete().catch(() => {});
        await applyWarn(client, guild, message.author, `Spam (envío de ${userData.count} mensajes en corto tiempo)`, null);
        userData.count = 0;
        return;
      }

      // 6) sensitive words (si hay mención, avisar al mencionado)
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

  // devolver helpers si quieres usarlos desde index.js
  client.automod = client.automod || {};
  client.automod.helpers = {
    bannedWords,
    warns,
    saveWarns,
    applyWarn,
    setAutomodEnabled: (v) => { automodEnabled = !!v; },
    getAutomodEnabled: () => automodEnabled,
  };
};
