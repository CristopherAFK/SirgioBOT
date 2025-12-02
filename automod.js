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
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder
} = require("discord.js");

const GUILD_ID = "1212886282645147768";
const LOG_CHANNEL_ID = "1434002832016801842";
const MUTED_ROLE_ID = "1430271610358726717";
const STAFF_ROLE_IDS = ["1230949715127042098", "1229140504310972599"];
const IGNORED_CHANNELS = ["1258524941289263254", "1313723272290111559"];
const BOT_OWNER_ID = "1032482231677108224";
const TICKET_CHANNEL_ID = "1228438600497102960";
const VIGIL_CATEGORY_ID = "1255251210173153342";
const TICKET_CATEGORY_ID = "1228437209628020736";
const TICKETS_DATA_FILE = path.join(__dirname, "tickets.json");

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

// Funciones para tickets
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
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 90);
}

loadTicketData();

// Configuración de detección
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
const processedModals = new Set(); // Prevenir procesamiento duplicado de modales

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

  // Agregar botones según tipo de sanción
  const row = new ActionRowBuilder();
  
  // Botón de palabras prohibidas solo si fue detectado por palabra prohibida
  if (detectedWord) {
    row.addComponents(
      new ButtonBuilder().setCustomId("view_banned_words").setLabel("Ver palabras prohibidas").setStyle(ButtonStyle.Danger)
    );
  }
  
  // Botón de apelación solo en sanciones (cuando hay mute)
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
          .setDescription("Agrega una advertencia manual personalizada (abre modal)")
          .addUserOption((o) => o.setName("usuario").setDescription("Usuario objetivo").setRequired(true)),
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
          .setName("addword")
          .setDescription("Agrega una palabra a la lista prohibida (staff)")
          .addStringOption(o => o.setName("palabra").setDescription("Palabra a agregar").setRequired(true)),
        new SlashCommandBuilder()
          .setName("removeword")
          .setDescription("Quita una palabra de la lista prohibida (staff)")
          .addStringOption(o => o.setName("palabra").setDescription("Palabra a quitar").setRequired(true)),
        new SlashCommandBuilder()
          .setName("mute")
          .setDescription("Mutea manualmente a un usuario (staff)")
          .addUserOption(o => o.setName("usuario").setDescription("Usuario a mutear").setRequired(true))
          .addStringOption(o => o.setName("tiempo").setDescription("Duración (ej: 10m, 1h, 2d)").setRequired(true))
          .addStringOption(o => o.setName("motivo").setDescription("Motivo del mute").setRequired(false)),
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

      // Botón "Apelar sanción" - mostrar confirmación
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

      // Botón "Confirmar apelación"
      if (interaction.isButton() && interaction.customId.startsWith("confirm_appeal_")) {
        try {
          const guild = interaction.guild || client.guilds.cache.get(GUILD_ID);
          if (!guild) return interaction.reply({ content: "❌ No se pudo obtener el servidor.", ephemeral: true });

          // Verificar si el usuario ya tiene un ticket
          if (ticketData.userHasTicket[interaction.user.id]) {
            const existingId = ticketData.userHasTicket[interaction.user.id];
            const existingCh = guild.channels.cache.get(existingId) || await guild.channels.fetch(existingId).catch(() => null);
            return interaction.reply({ content: `❗️ Ya tienes un ticket abierto: ${existingCh ? existingCh.toString() : existingId}`, ephemeral: true });
          }

          // Crear nuevo ticket
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

          // Guardar referencias
          ticketData.userHasTicket[interaction.user.id] = channel.id;
          ticketData.channels[channel.id] = {
            ownerId: interaction.user.id,
            number,
            category: "apelacion",
            createdAt: new Date().toISOString(),
            claimedBy: null
          };
          saveTicketData();

          // Mensaje en el canal del ticket
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

      // Botón "Cancelar apelación"
      if (interaction.isButton() && interaction.customId.startsWith("cancel_appeal_")) {
        return interaction.reply({ content: "❌ Apelación cancelada.", ephemeral: true });
      }

      // Manejador de modal para addwarn personalizado
      if (interaction.isModalSubmit() && interaction.customId.startsWith("addwarn_modal_")) {
        // Prevenir procesamiento duplicado
        const modalKey = `${interaction.user.id}_${interaction.id}`;
        if (processedModals.has(modalKey)) return;
        processedModals.add(modalKey);
        setTimeout(() => processedModals.delete(modalKey), 5000); // Limpiar después de 5s

        const userId = interaction.customId.replace("addwarn_modal_", "");
        const razon = interaction.fields.getTextInputValue("razon_input");
        const tiempoStr = interaction.fields.getTextInputValue("mute_input") || "";
        const buttonStr = interaction.fields.getTextInputValue("button_input") || "si";
        const appealStr = interaction.fields.getTextInputValue("appeal_input") || "no";

        const guild = interaction.guild;
        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) return interaction.reply({ content: "❌ Usuario no encontrado.", ephemeral: true });

        const member = await guild.members.fetch(userId).catch(() => null);
        const ms = tiempoStr ? parseDuration(tiempoStr) : 0;

        // Aplicar warn con configuración personalizada
        if (!warnings[userId]) warnings[userId] = [];
        warnings[userId].push({ reason: `Advertencia manual: ${razon}`, date: new Date().toISOString(), detectedWord: null });
        saveWarnings();

        const warnCount = warnings[userId].length;
        const muteMinutes = ms > 0 ? Math.ceil(ms / 60000) : getMuteMinutesForWarnCount(warnCount);

        // Crear embed personalizado
        const embed = new EmbedBuilder()
          .setTitle(warnCount === 1 ? "⚠️ Advertencia detectada" : "⛔ Infracción detectada")
          .setDescription(
            warnCount === 1
              ? `Has recibido una advertencia por: **${razon}**.\n\nPor favor evita este comportamiento.`
              : `Has cometido una infracción por: **${razon}**.\n\nHas sido muteado por **${muteMinutes} minutos**.`
          )
          .setFooter({ text: "SirgioBOT - Moderación manual" })
          .setTimestamp()
          .setColor(warnCount === 1 ? 0x1e90ff : 0xff0000);

        // Incluir botones según configuración del staff
        const row1 = new ActionRowBuilder();
        if (buttonStr.toLowerCase() === "si") {
          row1.addComponents(
            new ButtonBuilder().setCustomId("view_banned_words").setLabel("Ver palabras prohibidas").setStyle(ButtonStyle.Danger)
          );
        }
        if (appealStr.toLowerCase() === "si") {
          row1.addComponents(
            new ButtonBuilder().setCustomId("appeal_sanction").setLabel("Apelar sanción").setStyle(ButtonStyle.Primary)
          );
        }
        
        const components = row1.components.length > 0 ? [row1] : [];

        try {
          await user.send({ embeds: [embed], components }).catch(() => {});
        } catch (e) {}

        // Aplicar mute si se especificó tiempo
        if (ms > 0 && member) {
          try {
            await member.roles.add(MUTED_ROLE_ID).catch(() => {});
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
          } catch (e) {
            console.error("Error aplicando mute:", e);
          }
        }

        // Log en canal
        try {
          const logCh = guild?.channels.cache.get(LOG_CHANNEL_ID);
          if (logCh) {
            const logEmbed = new EmbedBuilder()
              .setColor(ms > 0 ? 0xff0000 : 0xffff00)
              .setTitle(ms > 0 ? "⛔ Sanción personalizada" : "⚠️ Advertencia personalizada")
              .addFields(
                { name: "Usuario", value: `${user.tag} (${user.id})`, inline: true },
                { name: "Razón", value: razon, inline: true },
                { name: "Warns", value: `${warnCount}`, inline: true },
                { name: "Mute", value: ms > 0 ? `${muteMinutes}m` : "Advertencia", inline: true },
                { name: "Ver palabras prohibidas", value: buttonStr.toLowerCase() === "si" ? "Sí" : "No", inline: true },
                { name: "Botón apelación", value: appealStr.toLowerCase() === "si" ? "Sí" : "No", inline: true }
              )
              .setTimestamp();
            logCh.send({ embeds: [logEmbed] }).catch(() => {});
          }
        } catch (e) {
          console.error("Error en log:", e);
        }

        return interaction.reply({ content: `✅ Advertencia personalizada aplicada a ${user.tag}.`, ephemeral: true });
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
        const modal = new ModalBuilder()
          .setCustomId(`addwarn_modal_${user.id}`)
          .setTitle("Agregar Advertencia Personalizada");

        const razonInput = new TextInputBuilder()
          .setCustomId("razon_input")
          .setLabel("Razón de la advertencia")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("Ej: Spam, comportamiento tóxico");

        const muteInput = new TextInputBuilder()
          .setCustomId("mute_input")
          .setLabel("Tiempo de mute (opcional)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder("Ej: 10m, 1h, 2d o dejar vacío para solo advertencia");

        const buttonInput = new TextInputBuilder()
          .setCustomId("button_input")
          .setLabel("¿Mostrar botón 'ver palabras prohibidas'?")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder("si/no (por defecto: si)");

        const appealInput = new TextInputBuilder()
          .setCustomId("appeal_input")
          .setLabel("¿Mostrar botón 'Apelar sanción'?")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder("si/no (por defecto: no)");

        modal.addComponents(
          new ActionRowBuilder().addComponents(razonInput),
          new ActionRowBuilder().addComponents(muteInput),
          new ActionRowBuilder().addComponents(buttonInput),
          new ActionRowBuilder().addComponents(appealInput)
        );

        return interaction.showModal(modal);
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

      if (interaction.commandName === "addword") {
        const palabra = interaction.options.getString("palabra").toLowerCase().trim();
        if (!palabra) return interaction.reply({ content: "❌ La palabra no puede estar vacía.", ephemeral: true });

        try {
          const currentList = loadWords(BANNED_PATH);
          if (currentList.includes(palabra)) {
            return interaction.reply({ content: `⚠️ La palabra "${palabra}" ya está en la lista.`, ephemeral: true });
          }

          currentList.push(palabra);
          fs.writeFileSync(BANNED_PATH, JSON.stringify({ words: currentList }, null, 2));
          reloadWordLists();

          const logCh = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
          if (logCh) {
            const logEmbed = new EmbedBuilder()
              .setTitle("➕ Palabra añadida")
              .setDescription(`Se agregó la palabra: **${palabra}**`)
              .addFields({ name: "Moderador", value: `<@${interaction.user.id}>`, inline: true })
              .setColor(0x00ff00)
              .setTimestamp();
            logCh.send({ embeds: [logEmbed] }).catch(() => {});
          }

          return interaction.reply({ content: `✅ Palabra "${palabra}" agregada a la lista prohibida.`, ephemeral: true });
        } catch (e) {
          console.error("Error agregando palabra:", e);
          return interaction.reply({ content: "❌ Error al agregar la palabra.", ephemeral: true });
        }
      }

      if (interaction.commandName === "removeword") {
        const palabra = interaction.options.getString("palabra").toLowerCase().trim();
        if (!palabra) return interaction.reply({ content: "❌ La palabra no puede estar vacía.", ephemeral: true });

        try {
          const currentList = loadWords(BANNED_PATH);
          const index = currentList.indexOf(palabra);
          if (index === -1) {
            return interaction.reply({ content: `⚠️ La palabra "${palabra}" no está en la lista.`, ephemeral: true });
          }

          currentList.splice(index, 1);
          fs.writeFileSync(BANNED_PATH, JSON.stringify({ words: currentList }, null, 2));
          reloadWordLists();

          const logCh = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
          if (logCh) {
            const logEmbed = new EmbedBuilder()
              .setTitle("➖ Palabra removida")
              .setDescription(`Se eliminó la palabra: **${palabra}**`)
              .addFields({ name: "Moderador", value: `<@${interaction.user.id}>`, inline: true })
              .setColor(0xff6600)
              .setTimestamp();
            logCh.send({ embeds: [logEmbed] }).catch(() => {});
          }

          return interaction.reply({ content: `✅ Palabra "${palabra}" removida de la lista prohibida.`, ephemeral: true });
        } catch (e) {
          console.error("Error removiendo palabra:", e);
          return interaction.reply({ content: "❌ Error al remover la palabra.", ephemeral: true });
        }
      }

      if (interaction.commandName === "mute") {
        const user = interaction.options.getUser("usuario");
        const tiempo = interaction.options.getString("tiempo");
        const motivo = interaction.options.getString("motivo") || "No especificado";
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
          
          // Calcular tiempos
          const now = new Date();
          const endTime = new Date(now.getTime() + ms);
          const muteMinutes = Math.ceil(ms / 60000);
          
          const timeoutId = setTimeout(async () => {
            try {
              const refreshed = await guild.members.fetch(member.id).catch(() => null);
              if (refreshed) await refreshed.roles.remove(MUTED_ROLE_ID).catch(() => {});
            } catch {}
            activeMutes.delete(member.id);
          }, ms);
          activeMutes.set(member.id, timeoutId);

          // Enviar embed al usuario muteado con botón de apelación
          const userEmbed = new EmbedBuilder()
            .setTitle("🔇 Has sido muteado")
            .setColor(0xff0000)
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .addFields(
              { name: "📌 Servidor", value: guild.name, inline: false },
              { name: "⏱️ Duración", value: `${muteMinutes} minutos`, inline: true },
              { name: "🕐 Inicio", value: `<t:${Math.floor(now.getTime() / 1000)}:f>`, inline: true },
              { name: "🕑 Fin del mute", value: `<t:${Math.floor(endTime.getTime() / 1000)}:f>`, inline: true },
              { name: "👮 Moderador", value: `${interaction.user.tag}`, inline: true },
              { name: "📝 Motivo", value: motivo, inline: false }
            )
            .setFooter({ text: "Si crees que esto fue un error, contacta al staff del servidor." })
            .setTimestamp();

          const appealRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("appeal_sanction").setLabel("Apelar sanción").setStyle(ButtonStyle.Primary)
          );

          try {
            await user.send({ embeds: [userEmbed], components: [appealRow] }).catch(() => {});
          } catch (e) {
            console.log("No se pudo enviar DM al usuario muteado");
          }

          // Log en canal
          const logCh = guild.channels.cache.get(LOG_CHANNEL_ID);
          if (logCh) {
            const logEmbed = new EmbedBuilder()
              .setTitle("🔇 Mute manual")
              .setDescription(`${user.tag} muteado por ${tiempo}`)
              .addFields(
                { name: "Motivo", value: motivo, inline: true },
                { name: "Moderador", value: `<@${interaction.user.id}>`, inline: true },
                { name: "Fin del mute", value: `<t:${Math.floor(endTime.getTime() / 1000)}:f>`, inline: false }
              )
              .setColor(0xffa500)
              .setTimestamp();
            logCh.send({ embeds: [logEmbed] }).catch(() => {});
          }
          return interaction.reply({ content: `✅ ${user.tag} muteado por ${tiempo}.\n📝 Motivo: ${motivo}`, ephemeral: true });
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

      if (interaction.commandName === "vigilar") {
        const user = interaction.options.getUser("usuario");
        const tiempoStr = interaction.options.getString("tiempo");
        const guild = interaction.guild;
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ content: "❌ Miembro no encontrado.", ephemeral: true });

        try {
          const ms = tiempoStr === "0" ? 0 : parseDuration(tiempoStr);
          if (ms === null) return interaction.reply({ content: "❌ Tiempo inválido.", ephemeral: true });

          // Crear canal de vigilancia
          const chanName = sanitizeChannelName(`vigilancia-${user.username}`);
          
          // Solo staff puede ver el canal
          const overwrites = [
            { id: guild.id, deny: ["ViewChannel"] },
            { id: client.user.id, allow: ["ViewChannel", "SendMessages", "ManageChannels", "ReadMessageHistory"] },
            ...STAFF_ROLE_IDS.map(roleId => ({ id: roleId, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] }))
          ];

          const vigilanceChannel = await guild.channels.create({
            name: chanName,
            type: ChannelType.GuildText,
            parent: VIGIL_CATEGORY_ID,
            permissionOverwrites: overwrites,
            reason: `Vigilancia iniciada por ${interaction.user.tag}`
          }).catch(() => null);

          if (!vigilanceChannel) return interaction.reply({ content: "❌ Error creando canal de vigilancia.", ephemeral: true });

          const vigilanceEmbed = new EmbedBuilder()
            .setTitle("👁️ Vigilancia Iniciada")
            .setDescription(`Se ha iniciado vigilancia para ${user.tag}`)
            .addFields(
              { name: "Usuario", value: `${user.tag} (${user.id})`, inline: true },
              { name: "Iniciado por", value: `<@${interaction.user.id}>`, inline: true },
              { name: "Duración", value: ms === 0 ? "Indefinida" : `${Math.ceil(ms / 60000)} minutos`, inline: true }
            )
            .setColor(0xffa500)
            .setTimestamp();

          await vigilanceChannel.send({ embeds: [vigilanceEmbed] }).catch(() => {});

          activeVigilances.set(user.id, { channelId: vigilanceChannel.id, endTime: ms > 0 ? Date.now() + ms : null });

          if (ms > 0) {
            setTimeout(async () => {
              try {
                await vigilanceChannel.delete().catch(() => {});
              } catch {}
              activeVigilances.delete(user.id);
            }, ms);
          }

          const logCh = guild.channels.cache.get(LOG_CHANNEL_ID);
          if (logCh) {
            logCh.send({
              embeds: [new EmbedBuilder()
                .setTitle("👁️ Vigilancia iniciada")
                .setDescription(`Vigilancia iniciada para ${user.tag}`)
                .addFields(
                  { name: "Duración", value: ms === 0 ? "Indefinida" : `${Math.ceil(ms / 60000)} minutos`, inline: true },
                  { name: "Moderador", value: `<@${interaction.user.id}>`, inline: true }
                )
                .setColor(0xffa500)
                .setTimestamp()]
            }).catch(() => {});
          }

          return interaction.reply({ content: `✅ Vigilancia iniciada para ${user.tag} en ${vigilanceChannel}`, ephemeral: true });
        } catch (e) {
          console.error("Error en vigilancia:", e);
          return interaction.reply({ content: "❌ Error iniciando vigilancia.", ephemeral: true });
        }
      }

      if (interaction.commandName === "cerrar_vigilancia") {
        const user = interaction.options.getUser("usuario");
        const guild = interaction.guild;

        try {
          const vigilance = activeVigilances.get(user.id);
          if (!vigilance) return interaction.reply({ content: `❌ No hay vigilancia activa para ${user.tag}.`, ephemeral: true });

          const channel = await guild.channels.fetch(vigilance.channelId).catch(() => null);
          if (channel) await channel.delete().catch(() => {});

          activeVigilances.delete(user.id);

          const logCh = guild.channels.cache.get(LOG_CHANNEL_ID);
          if (logCh) {
            logCh.send({
              embeds: [new EmbedBuilder()
                .setTitle("👁️ Vigilancia cerrada")
                .setDescription(`Vigilancia cerrada para ${user.tag}`)
                .addFields({ name: "Moderador", value: `<@${interaction.user.id}>`, inline: true })
                .setColor(0xff0000)
                .setTimestamp()]
            }).catch(() => {});
          }

          return interaction.reply({ content: `✅ Vigilancia cerrada para ${user.tag}.`, ephemeral: true });
        } catch (e) {
          console.error("Error cerrando vigilancia:", e);
          return interaction.reply({ content: "❌ Error cerrando vigilancia.", ephemeral: true });
        }
      }
    } catch (err) {
      console.error("Error en interaction:", err);
    }
  });

  // Registrar mensajes de usuarios vigilados
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    try {
      const userId = message.author.id;
      const vigilance = activeVigilances.get(userId);
      
      if (vigilance) {
        const guild = message.guild;
        if (!guild) return;
        
        const vigilanceChannel = await guild.channels.fetch(vigilance.channelId).catch(() => null);
        if (!vigilanceChannel) {
          activeVigilances.delete(userId);
          return;
        }

        const now = new Date();
        const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const dateString = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        
        const recordEmbed = new EmbedBuilder()
          .setTitle("📝 Nuevo Mensaje")
          .setAuthor({
            name: message.author.tag,
            iconURL: message.author.displayAvatarURL({ dynamic: true })
          })
          .setDescription(message.content || "*[Sin contenido]*")
          .addFields(
            { name: "📅 Fecha", value: dateString, inline: true },
            { name: "🕐 Hora", value: timeString, inline: true },
            { name: "#️⃣ Canal", value: `<#${message.channelId}>`, inline: true }
          )
          .setColor(0x3498db)
          .setFooter({ text: `ID: ${message.id}` })
          .setTimestamp();

        // Agregar adjuntos si los hay
        if (message.attachments && message.attachments.size > 0) {
          const attachmentList = message.attachments.map(att => `[${att.name}](${att.url})`).join("\n");
          recordEmbed.addFields({ name: "📎 Adjuntos", value: attachmentList, inline: false });
        }

        await vigilanceChannel.send({ embeds: [recordEmbed] }).catch(() => {});
      }
    } catch (error) {
      console.error("Error registrando mensaje vigilado:", error);
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

      // 2.5. Detectar links (excluyendo GIFs embebidos de Discord)
      if (LINK_REGEX.test(content)) {
        const links = content.match(LINK_REGEX);
        if (links && links.length > 0) {
          // Filtrar GIFs (no penalizar por compartir GIFs)
          const nonGifLinks = links.filter(link => !link.toLowerCase().endsWith('.gif'));
          
          if (nonGifLinks.length > 0) {
            // El sistema de warns ya es progresivo: primera vez advertencia, repetir = mute gradual
            await applyWarn(client, guild, user, member, `Compartir links no permitido (${nonGifLinks[0]})`, null);
            try {
              await message.delete();
            } catch {}
            return;
          }
        }
      }

      // 3. Detectar emojis excesivos (excluyendo emojis personalizados, menciones, URLs y GIFs)
      // No penalizar si el mensaje contiene GIFs
      const hasGifAttachment = message.attachments && message.attachments.some(att => att.name && att.name.toLowerCase().endsWith('.gif'));
      const hasGifLink = content.toLowerCase().includes('.gif');
      
      if (!hasGifAttachment && !hasGifLink) {
        // Remover todas las etiquetas de Discord y URLs antes de contar emojis:
        // - Emojis personalizados: <:nombre:id> y <a:nombre:id>
        // - Menciones de usuarios: <@userid> y <@!userid>
        // - Menciones de roles: <@&roleid>
        // - Menciones de canales: <#channelid>
        // - URLs (http, https, www)
        const contentWithoutDiscordTags = content
          .replace(/<a?:\w+:\d+>/g, "")           // Emojis personalizados
          .replace(/<@!?\d+>/g, "")                // Menciones de usuarios
          .replace(/<@&\d+>/g, "")                 // Menciones de roles
          .replace(/<#\d+>/g, "")                  // Menciones de canales
          .replace(/https?:\/\/[^\s]+/g, "")      // URLs http/https
          .replace(/www\.[^\s]+/g, "");            // URLs www
        
        const emojiCount = (contentWithoutDiscordTags.match(/\p{Emoji}/gu) || []).length;
        if (emojiCount > EMOJI_THRESHOLD) {
          await applyWarn(client, guild, user, member, `Demasiados emojis (${emojiCount})`, null);
          try {
            await message.delete();
          } catch {}
          return;
        }
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

      // 5. Detectar abuso de mayúsculas (excluyendo emojis del servidor)
      if (content.length > CAPS_LENGTH_THRESHOLD) {
        // Remover emojis personalizados del servidor: <:nombre:id> y <a:nombre:id>
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
