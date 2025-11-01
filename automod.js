const {
  Client,
  EmbedBuilder,
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  Routes,
  REST,
} = require("discord.js");
const fs = require("fs");

// ===============================
// ⚙️ CONFIGURACIÓN
// ===============================
const GUILD_ID = "1212886282645147768";
const LOG_CHANNEL_ID = "1434002832016801842";
const MUTED_ROLE_ID = "1430271610358726717";
const STAFF_ROLE_IDS = ["1212891335929897030", "1229140504310972599"];
const IGNORED_CHANNELS = ["1258524941289263254", "1313723272290111559"];
const BOT_OWNER_ID = "1032482231677108224";
const TICKET_CHANNEL_ID = "1228438600497102960";

// ===============================
// 📁 Archivos JSON
// ===============================
const WARNINGS_FILE = "./warns.json";
const BANNED_WORDS_FILE = "./bannedWords.json";
const SENSITIVE_WORDS_FILE = "./sensitiveWords.json";

// Crear archivos si no existen
if (!fs.existsSync(WARNINGS_FILE)) fs.writeFileSync(WARNINGS_FILE, "{}");
if (!fs.existsSync(BANNED_WORDS_FILE)) fs.writeFileSync(BANNED_WORDS_FILE, "[]");
if (!fs.existsSync(SENSITIVE_WORDS_FILE)) fs.writeFileSync(SENSITIVE_WORDS_FILE, "[]");

let warnings = JSON.parse(fs.readFileSync(WARNINGS_FILE));
let bannedWords = JSON.parse(fs.readFileSync(BANNED_WORDS_FILE));
let sensitiveWords = JSON.parse(fs.readFileSync(SENSITIVE_WORDS_FILE));

function saveWarnings() {
  fs.writeFileSync(WARNINGS_FILE, JSON.stringify(warnings, null, 2));
}

// ===============================
// 🧠 Funciones de utilidad
// ===============================
function hasIgnoredRole(member) {
  return STAFF_ROLE_IDS.some((id) => member.roles.cache.has(id));
}

function isIgnoredChannel(channelId) {
  return IGNORED_CHANNELS.includes(channelId);
}

// ===============================
// ✉️ Advertencia privada
// ===============================
async function sendPrivateWarn(user, color, reason, muteTime, client) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(muteTime ? "⛔ Has sido sancionado" : "⚠️ Advertencia")
    .setDescription(
      muteTime
        ? `Has sido sancionado por: **${reason}**.\nDuración del mute: **${muteTime} minutos.**`
        : `Has recibido una advertencia por: **${reason}**.\nReincidir generará sanción.`
    )
    .setFooter({ text: "SirgioBOT - Moderación automática" })
    .setTimestamp();

  const button = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Ver palabras prohibidas")
      .setStyle(ButtonStyle.Danger)
      .setCustomId("show_banned_words")
  );

  try {
    await user.send({ embeds: [embed], components: [button] });
  } catch {
    console.log(`No se pudo enviar DM a ${user.tag}`);
  }
}

// ===============================
// ⚠️ Sistema de advertencias y mute
// ===============================
async function warnUser(client, user, reason, guild) {
  if (!warnings[user.id]) warnings[user.id] = [];
  warnings[user.id].push({ reason, date: new Date().toISOString() });
  saveWarnings();

  const warnCount = warnings[user.id].length;
  const muteDurations = [0, 10, 20, 40, 60]; // min
  const muteTime = muteDurations[Math.min(warnCount, muteDurations.length - 1)];
  const member = await guild.members.fetch(user.id).catch(() => null);

  if (muteTime > 0 && member) {
    await member.roles.add(MUTED_ROLE_ID).catch(() => {});
    setTimeout(async () => {
      await member.roles.remove(MUTED_ROLE_ID).catch(() => {});
    }, muteTime * 60 * 1000);
  }

  await sendPrivateWarn(user, muteTime ? 0xff0000 : 0xfad02e, reason, muteTime, client);

  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (logChannel) {
    const logEmbed = new EmbedBuilder()
      .setColor(muteTime ? "Red" : "Yellow")
      .setTitle(muteTime ? "⛔ Sanción aplicada" : "⚠️ Advertencia emitida")
      .setDescription(
        `**Usuario:** ${user.tag}\n**Razón:** ${reason}\n**Warns totales:** ${warnCount}\n**Duración del mute:** ${
          muteTime ? `${muteTime}m` : "Advertencia"
        }`
      )
      .setTimestamp();
    logChannel.send({ embeds: [logEmbed] });
  }
}

// ===============================
// 🧹 Limpieza automática de warns (cada 30 días)
// ===============================
setInterval(() => {
  const now = new Date();
  let changed = false;
  for (const [userId, userWarns] of Object.entries(warnings)) {
    warnings[userId] = userWarns.filter(
      (w) => now - new Date(w.date) < 30 * 24 * 60 * 60 * 1000
    );
    if (warnings[userId].length === 0) delete warnings[userId];
    changed = true;
  }
  if (changed) {
    saveWarnings();
    console.log("🧹 Warns antiguos eliminados automáticamente");
  }
}, 24 * 60 * 60 * 1000); // cada 24h

// ===============================
// 💬 AutoMod principal
// ===============================
module.exports = (client) => {
  let automodEnabled = true;
  const userMessages = {};

  client.once("ready", async () => {
    console.log("✅ AutoMod cargado correctamente");

    // ===============================
    // Slash Commands
    // ===============================
    const commands = [
      new SlashCommandBuilder()
        .setName("automod")
        .setDescription("Controla el sistema de AutoMod")
        .addSubcommand((sub) => sub.setName("on").setDescription("Activa el AutoMod"))
        .addSubcommand((sub) => sub.setName("off").setDescription("Desactiva el AutoMod"))
        .addSubcommand((sub) => sub.setName("status").setDescription("Ver estado del AutoMod")),

      new SlashCommandBuilder()
        .setName("addwarn")
        .setDescription("Agrega una advertencia manual")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true))
        .addStringOption((o) => o.setName("razon").setDescription("Motivo").setRequired(true)),

      new SlashCommandBuilder()
        .setName("removewarn")
        .setDescription("Elimina la última advertencia de un usuario")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true)),

      new SlashCommandBuilder()
        .setName("resetwarns")
        .setDescription("Resetea todas las advertencias de un usuario")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true)),

      new SlashCommandBuilder()
        .setName("viewwarns")
        .setDescription("Muestra las advertencias de un usuario")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true)),
    ];

    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
      body: commands,
    });
    console.log("🟢 Comandos registrados en el servidor.");
  });

  // ===============================
  // 🎛️ Comandos
  // ===============================
  client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton() && interaction.customId === "show_banned_words") {
      const embed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("🚫 Lista de palabras prohibidas")
        .setDescription(bannedWords.join(", "));
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    if (
      !STAFF_ROLE_IDS.some((id) => interaction.member.roles.cache.has(id)) &&
      interaction.user.id !== BOT_OWNER_ID
    )
      return interaction.reply({
        content: "❌ No tienes permisos para usar este comando.",
        ephemeral: true,
      });

    const guild = interaction.guild;

    if (commandName === "automod") {
      const sub = interaction.options.getSubcommand();
      if (sub === "on") automodEnabled = true;
      else if (sub === "off") automodEnabled = false;

      const color = sub === "status" ? "Blue" : automodEnabled ? "Green" : "Red";
      const statusMsg =
        sub === "status"
          ? `🔧 AutoMod está **${automodEnabled ? "activado" : "desactivado"}**`
          : `✅ AutoMod **${sub === "on" ? "activado" : "desactivado"}**`;

      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(color).setDescription(statusMsg)],
        ephemeral: true,
      });
    }

    if (commandName === "addwarn") {
      const user = interaction.options.getUser("usuario");
      const reason = interaction.options.getString("razon");
      await warnUser(client, user, reason, guild);
      return interaction.reply({ content: `⚠️ Advertencia añadida a **${user.tag}**`, ephemeral: true });
    }

    if (commandName === "removewarn") {
      const user = interaction.options.getUser("usuario");
      if (!warnings[user.id]?.length)
        return interaction.reply({ content: "❌ Este usuario no tiene advertencias.", ephemeral: true });
      warnings[user.id].pop();
      saveWarnings();
      return interaction.reply({ content: `🟢 Se eliminó una advertencia de **${user.tag}**.`, ephemeral: true });
    }

    if (commandName === "resetwarns") {
      const user = interaction.options.getUser("usuario");
      delete warnings[user.id];
      saveWarnings();
      return interaction.reply({ content: `🔄 Warns de **${user.tag}** reseteados.`, ephemeral: true });
    }

    if (commandName === "viewwarns") {
      const user = interaction.options.getUser("usuario");
      const userWarns = warnings[user.id] || [];
      const desc = userWarns.length
        ? userWarns.map((w, i) => `**${i + 1}.** ${w.reason}`).join("\n")
        : "✅ Sin advertencias.";
      const embed = new EmbedBuilder().setColor("Yellow").setTitle(`Advertencias de ${user.tag}`).setDescription(desc);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  });

  // ===============================
  // 💬 Filtrado de mensajes
  // ===============================
  client.on("messageCreate", async (message) => {
    if (message.author.bot || !automodEnabled) return;
    if (isIgnoredChannel(message.channel.id)) return;

    const member = message.member;
    if (!member || hasIgnoredRole(member)) return;

    const content = message.content.toLowerCase();
    const guild = message.guild;

    // 🚫 Palabras prohibidas
    if (bannedWords.some((w) => content.includes(w))) {
      await warnUser(client, message.author, "Uso de palabra prohibida", guild);
      return message.delete().catch(() => {});
    }

    // ⚠️ Palabras potencialmente ofensivas
    if (sensitiveWords.some((w) => content.includes(w))) {
      const mentioned = message.mentions.users.first();
      if (mentioned) {
        mentioned
          .send({
            content: `💬 Hola ${mentioned}, si este mensaje te incomodó u ofendió, puedes crear un ticket en <#${TICKET_CHANNEL_ID}>.`,
          })
          .catch(() => {});
      }
    }

    // 📛 Spam por líneas
    if (content.split("\n").length > 5) {
      await warnUser(client, message.author, "Spam (demasiadas líneas)", guild);
      return message.delete().catch(() => {});
    }

    // 📨 Flood (5 mensajes seguidos)
    if (!userMessages[message.author.id])
      userMessages[message.author.id] = { count: 0, lastMessage: Date.now() };

    const userData = userMessages[message.author.id];
    userData.count =
      Date.now() - userData.lastMessage < 7000 ? userData.count + 1 : 1;
    userData.lastMessage = Date.now();

    if (userData.count >= 5) {
      await warnUser(client, message.author, "Spam (mensajes seguidos)", guild);
      userData.count = 0;
    }

    // 🔠 Mayúsculas excesivas
    const capsRatio = content.replace(/[^A-Z]/g, "").length / content.length;
    if (content.length > 15 && capsRatio > 0.7) {
      await warnUser(client, message.author, "Uso excesivo de mayúsculas", guild);
    }

    // 🔗 Enlaces
    if (/(https?:\/\/[^\s]+)/g.test(content)) {
      await warnUser(client, message.author, "Envío de links no permitidos", guild);
      message.delete().catch(() => {});
    }
  });
};
