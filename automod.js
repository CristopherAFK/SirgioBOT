// =========================
// SirgioBOT - Sistema Automod (automod.js)
// =========================

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionsBitField,
  SlashCommandBuilder,
  Collection
} = require("discord.js");

const fs = require("fs");

const GUILD_ID = "1212886282645147768";
const LOG_CHANNEL_ID = "1434002832016801842";
const MUTED_ROLE_ID = "1430271610358726717";
const STAFF_ROLE_IDS = ["1212891335929897030", "1229140504310972599"];
const IGNORED_CHANNELS = ["1258524941289263254", "1313723272290111559"];
const BOT_OWNER_ID = "1032482231677108224";
const TICKET_CHANNEL_ID = "1228438600497102960";

const OFFENSIVE_WORDS = [
  "idiota", "imbécil", "estúpido", "tonto", "mierda", "pendejo", "gilipollas",
  "marica", "puta", "perra", "loco", "asqueroso", "cabrón", "bastardo"
];

const FORBIDDEN_LINKS = ["discord.gg", "porn", "nsfw", "xvideos", "onlyfans", "twitch.tv", "tiktok.com", "youtube.com"];

const userMessageCount = new Map();

module.exports = (client) => {

  // ========== COMANDOS ==========
  client.commands = new Collection();

  // /mute
  client.commands.set(
    "mute",
    new SlashCommandBuilder()
      .setName("mute")
      .setDescription("Mutea manualmente a un usuario.")
      .addUserOption(opt =>
        opt.setName("usuario").setDescription("Usuario a mutear").setRequired(true)
      )
      .addIntegerOption(opt =>
        opt.setName("minutos").setDescription("Duración del mute en minutos").setRequired(true)
      )
  );

  // /unmute
  client.commands.set(
    "unmute",
    new SlashCommandBuilder()
      .setName("unmute")
      .setDescription("Desmutea a un usuario manualmente.")
      .addUserOption(opt =>
        opt.setName("usuario").setDescription("Usuario a desmutear").setRequired(true)
      )
  );

  // ========== EVENTOS ==========

  client.on("messageCreate", async (message) => {
    if (
      !message.guild ||
      message.author.bot ||
      IGNORED_CHANNELS.includes(message.channel.id)
    )
      return;

    const content = message.content.toLowerCase();

    // ===== Palabras ofensivas =====
    const foundWord = OFFENSIVE_WORDS.find((w) => content.includes(w));
    if (foundWord) {
      await message.delete().catch(() => {});
      const targetUser = message.mentions.users.first();

      // Embed amarillo (mensaje privado)
      const dmEmbed = new EmbedBuilder()
        .setColor("Yellow")
        .setTitle("💬 Alerta: posible mensaje ofensivo")
        .setDescription(
          `Hola ${targetUser ? targetUser : "usuario"}, se ha detectado un mensaje potencialmente ofensivo dirigido a ti.\n\n` +
          `> **Canal:** ${message.channel}\n` +
          `> **Autor:** ${message.author}\n` +
          `> **Palabra detectada:** \`${foundWord}\`\n\n` +
          `Si este mensaje te incomodó u ofendió, puedes crear un ticket en <#${TICKET_CHANNEL_ID}>.`
        )
        .setFooter({ text: "SirgioBOT - Confidencial y privado" });

      if (targetUser) {
        try {
          await targetUser.send({ embeds: [dmEmbed] });
        } catch {
          console.log(`No se pudo enviar el DM a ${targetUser.tag}`);
        }
      }

      // Log interno
      const log = new EmbedBuilder()
        .setColor("Orange")
        .setTitle("🚨 Palabra ofensiva detectada")
        .setDescription(
          `**Usuario:** ${message.author}\n` +
          `**Canal:** ${message.channel}\n` +
          `**Palabra:** \`${foundWord}\`\n` +
          `**Mensaje original:** ${message.content}`
        )
        .setTimestamp();

      client.channels.cache.get(LOG_CHANNEL_ID)?.send({ embeds: [log] });
      return;
    }

    // ===== Links prohibidos =====
    if (FORBIDDEN_LINKS.some(link => content.includes(link))) {
      await sancionar(message, "Envío de links no permitidos", 40);
      return;
    }

    // ===== Spam (5 mensajes seguidos) =====
    const userId = message.author.id;
    if (!userMessageCount.has(userId)) {
      userMessageCount.set(userId, []);
    }

    const timestamps = userMessageCount.get(userId);
    const now = Date.now();
    timestamps.push(now);
    const filtered = timestamps.filter(t => now - t < 10000); // últimos 10s
    userMessageCount.set(userId, filtered);

    if (filtered.length >= 5) {
      await sancionar(message, "Spam (mensajes seguidos)", 60);
      userMessageCount.set(userId, []);
      return;
    }

    // ===== Mensajes muy largos =====
    if (message.content.split("\n").length > 5) {
      await sancionar(message, "Mensaje excesivamente largo (anti-spam)", 30);
      return;
    }
  });

  // ========== FUNCIONES ==========

  async function sancionar(message, razon, minutos) {
    await message.delete().catch(() => {});
    const miembro = message.member;
    if (!miembro || miembro.roles.cache.has(MUTED_ROLE_ID)) return;

    await miembro.roles.add(MUTED_ROLE_ID).catch(() => {});
    setTimeout(() => {
      miembro.roles.remove(MUTED_ROLE_ID).catch(() => {});
    }, minutos * 60 * 1000);

    const embed = new EmbedBuilder()
      .setColor("Red")
      .setTitle("🚫 Infracción detectada")
      .setDescription(
        `Has cometido una infracción por **${razon}**.\n\nHas sido muteado por **${minutos} minutos**.\n\nSirgioBOT - Moderación automática`
      )
      .setFooter({ text: "Ver palabras prohibidas en el servidor si tienes dudas." });

    try {
      await message.author.send({ embeds: [embed] });
    } catch {}

    const log = new EmbedBuilder()
      .setColor("Red")
      .setTitle("🧾 Registro de sanción")
      .setDescription(
        `**Usuario:** ${message.author}\n` +
        `**Razón:** ${razon}\n` +
        `**Duración:** ${minutos} minutos\n` +
        `**Canal:** ${message.channel}`
      )
      .setTimestamp();

    client.channels.cache.get(LOG_CHANNEL_ID)?.send({ embeds: [log] });
  }

  // ========== COMANDOS MANUALES ==========
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.commandName;
    const member = interaction.member;

    if (!STAFF_ROLE_IDS.some(id => member.roles.cache.has(id))) {
      return interaction.reply({
        content: "🚫 No tienes permiso para usar este comando.",
        ephemeral: true
      });
    }

    if (command === "mute") {
      const user = interaction.options.getUser("usuario");
      const minutes = interaction.options.getInteger("minutos");
      const guildMember = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!guildMember) return interaction.reply({ content: "❌ Usuario no encontrado.", ephemeral: true });

      await guildMember.roles.add(MUTED_ROLE_ID).catch(() => {});
      setTimeout(() => {
        guildMember.roles.remove(MUTED_ROLE_ID).catch(() => {});
      }, minutes * 60 * 1000);

      interaction.reply(`✅ ${user.tag} ha sido muteado por ${minutes} minutos.`);
    }

    if (command === "unmute") {
      const user = interaction.options.getUser("usuario");
      const guildMember = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!guildMember) return interaction.reply({ content: "❌ Usuario no encontrado.", ephemeral: true });

      await guildMember.roles.remove(MUTED_ROLE_ID).catch(() => {});
      interaction.reply(`✅ ${user.tag} ha sido desmuteado.`);
    }
  });
};
