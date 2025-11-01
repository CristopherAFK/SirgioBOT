const {
  Client,
  EmbedBuilder,
  PermissionsBitField,
  SlashCommandBuilder,
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

// Archivos de persistencia
const WARNINGS_FILE = "./warnings.json";

// Cargar o crear warnings.json
let warnings = {};
if (fs.existsSync(WARNINGS_FILE)) {
  warnings = JSON.parse(fs.readFileSync(WARNINGS_FILE));
} else {
  fs.writeFileSync(WARNINGS_FILE, JSON.stringify({}));
}

// Guardar advertencias
function saveWarnings() {
  fs.writeFileSync(WARNINGS_FILE, JSON.stringify(warnings, null, 2));
}

// ===============================
// 🚫 Listas de palabras
// ===============================
const bannedWords = [
  "server muerto",
  "borren el server",
  "puta",
  "puto",
  "perra",
  "pene",
  "vagina",
  "hitler",
  "violacion",
  "violar",
  "suicidate",
  "mátate",
  "kill your self",
  "kys",
  "maldito",
  "mierda",
  "coño",
  "zorra",
  "admin de mierda",
  "administrador de mierda",
  "staff de mierda",
  "sirgio de mierda",
  "reino de sensibles",
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
  "lgbt",
  "trans",
  "bisexual",
  "pansexual",
  "homosexual",
  "hetero",
  "transexual",
];

// ===============================
// 🧩 UTILIDADES
// ===============================
function hasIgnoredRole(member) {
  return STAFF_ROLE_IDS.some((id) => member.roles.cache.has(id));
}

function isIgnoredChannel(channelId) {
  return IGNORED_CHANNELS.includes(channelId);
}

async function sendPrivateEmbed(user, color, title, description, extraField) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: "Si crees que fue un error, contacta con el staff.",
    })
    .setTimestamp();

  if (extraField) embed.addFields(extraField);

  try {
    await user.send({ embeds: [embed] });
  } catch (e) {
    console.log(`No se pudo enviar DM a ${user.tag}`);
  }
}

// ===============================
// ⚠️ SISTEMA DE ADVERTENCIAS
// ===============================
async function warnUser(client, user, reason, guildId) {
  if (!warnings[user.id]) warnings[user.id] = [];
  warnings[user.id].push({ reason, date: new Date().toISOString() });
  saveWarnings();

  const warnCount = warnings[user.id].length;
  const muteDurations = [10, 20, 30, 60]; // minutos
  const muteTime = muteDurations[Math.min(warnCount - 1, muteDurations.length - 1)];

  const guild = client.guilds.cache.get(guildId);
  const member = await guild.members.fetch(user.id).catch(() => null);

  if (member) {
    await member.roles.add(MUTED_ROLE_ID).catch(() => {});
    setTimeout(async () => {
      await member.roles.remove(MUTED_ROLE_ID).catch(() => {});
    }, muteTime * 60 * 1000);
  }

  await sendPrivateEmbed(
    user,
    0xff0000,
    "Advertencia del servidor",
    `Has recibido una advertencia por: **${reason}**.\nAcumular advertencias puede resultar en sanciones mayores.\n\nDuración del mute: **${muteTime} minutos**`,
    {
      name: "Nota",
      value: "Haz clic en la flecha ▶️ para ver la lista de palabras prohibidas.",
    }
  );

  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (logChannel) {
    const logEmbed = new EmbedBuilder()
      .setColor("Red")
      .setTitle("⚠️ Nuevo warn emitido")
      .setDescription(`**Usuario:** ${user.tag}\n**Razón:** ${reason}\n**Total warns:** ${warnCount}`)
      .setTimestamp();
    logChannel.send({ embeds: [logEmbed] });
  }
}

// ===============================
// 🧠 SISTEMA AUTOMOD
// ===============================
module.exports = (client) => {
  let automodEnabled = true;
  const userMessages = {};

  // Registro de comandos slash
  client.once("ready", async () => {
    console.log("✅ AutoMod activo");
    const commands = [
      new SlashCommandBuilder()
        .setName("help")
        .setDescription("Muestra los comandos disponibles."),
      new SlashCommandBuilder()
        .setName("automod")
        .setDescription("Activa o desactiva el sistema de AutoMod.")
        .addStringOption((option) =>
          option
            .setName("estado")
            .setDescription("Elige si activar o desactivar el AutoMod")
            .setRequired(true)
            .addChoices(
              { name: "on", value: "on" },
              { name: "off", value: "off" }
            )
        ),
      new SlashCommandBuilder()
        .setName("addwarn")
        .setDescription("Agrega una advertencia manual a un usuario.")
        .addUserOption((opt) =>
          opt.setName("usuario").setDescription("Usuario a advertir").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("razon").setDescription("Motivo de la advertencia").setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName("removewarn")
        .setDescription("Elimina una advertencia a un usuario.")
        .addUserOption((opt) =>
          opt.setName("usuario").setDescription("Usuario objetivo").setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("Muestra las advertencias de un usuario.")
        .addUserOption((opt) =>
          opt.setName("usuario").setDescription("Usuario objetivo").setRequired(true)
        ),
    ];

    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    try {
      await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
        body: commands,
      });
      console.log("🟢 Comandos del AutoMod registrados.");
    } catch (err) {
      console.error("Error registrando comandos:", err);
    }
  });

  // ===============================
  // Slash commands
  // ===============================
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "help") {
      const embed = new EmbedBuilder()
        .setColor("Blue")
        .setTitle("📘 Lista de comandos de SirgioBOT")
        .addFields(
          {
            name: "🎫 Tickets",
            value: "`!panel` - Abre el panel de soporte.",
          },
          {
            name: "🛡️ Moderación",
            value:
              "`/addwarn`, `/removewarn`, `/warnings`, `/automod` - Sistema de AutoMod",
          }
        )
        .setFooter({ text: "SirgioBOT - Sistema de ayuda" });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.commandName === "automod") {
      const estado = interaction.options.getString("estado");
      automodEnabled = estado === "on";
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(automodEnabled ? "Green" : "Red")
            .setDescription(
              `El sistema de AutoMod ha sido **${
                automodEnabled ? "activado" : "desactivado"
              }** correctamente.`
            ),
        ],
        ephemeral: true,
      });
    }

    if (interaction.commandName === "addwarn") {
      const user = interaction.options.getUser("usuario");
      const razon = interaction.options.getString("razon");
      await warnUser(client, user, razon, GUILD_ID);
      await interaction.reply({
        content: `✅ Se ha agregado una advertencia a ${user.tag}`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === "removewarn") {
      const user = interaction.options.getUser("usuario");
      if (!warnings[user.id] || warnings[user.id].length === 0) {
        return interaction.reply({
          content: "❌ Este usuario no tiene advertencias.",
          ephemeral: true,
        });
      }
      warnings[user.id].pop();
      saveWarnings();
      await interaction.reply({
        content: `🟢 Se eliminó una advertencia de ${user.tag}.`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === "warnings") {
      const user = interaction.options.getUser("usuario");
      const userWarns = warnings[user.id] || [];
      const embed = new EmbedBuilder()
        .setColor("Yellow")
        .setTitle(`⚠️ Advertencias de ${user.tag}`)
        .setDescription(
          userWarns.length
            ? userWarns.map((w, i) => `**${i + 1}.** ${w.reason}`).join("\n")
            : "✅ Sin advertencias."
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  });

  // ===============================
  // Detección de mensajes
  // ===============================
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!automodEnabled) return;
    if (isIgnoredChannel(message.channel.id)) return;

    const member = message.member;
    if (!member || hasIgnoredRole(member)) return;

    const content = message.content.toLowerCase();

    // Palabras prohibidas
    if (bannedWords.some((w) => content.includes(w))) {
      await warnUser(client, message.author, "Uso de palabra prohibida", message.guild.id);
      return message.delete().catch(() => {});
    }

    // Palabras sensibles
    if (sensitiveWords.some((w) => content.includes(w))) {
      const embed = new EmbedBuilder()
        .setColor("Aqua")
        .setDescription(
          `@${message.author.username}, si te sientes incómodo por este mensaje, puedes crear un ticket para reportarlo.`
        );
      await message.reply({ embeds: [embed] });
    }

    // Spam (más de 5 líneas)
    if (content.split("\n").length > 5) {
      await warnUser(client, message.author, "Spam (demasiadas líneas)", message.guild.id);
      return message.delete().catch(() => {});
    }

    // Flood (5 mensajes seguidos)
    if (!userMessages[message.author.id])
      userMessages[message.author.id] = { count: 0, lastMessage: Date.now() };

    const userData = userMessages[message.author.id];
    if (Date.now() - userData.lastMessage < 7000) userData.count++;
    else userData.count = 1;
    userData.lastMessage = Date.now();

    if (userData.count >= 5) {
      await warnUser(client, message.author, "Spam (mensajes seguidos)", message.guild.id);
      userData.count = 0;
    }

    // MAYÚSCULAS
    const capsRatio = content.replace(/[^A-Z]/g, "").length / content.length;
    if (content.length > 15 && capsRatio > 0.7) {
      await warnUser(client, message.author, "Uso excesivo de mayúsculas", message.guild.id);
    }
  });
};
