const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  PermissionsBitField, 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// =========================
// CONFIGURACIÓN PRINCIPAL
// =========================
const GUILD_ID = "1212886282645147768";
const LOG_CHANNEL_ID = "1434002832016801842";
const MUTED_ROLE_ID = "1430271610358726717";
const STAFF_ROLE_IDS = ["1212891335929897030", "1229140504310972599"];
const IGNORED_CHANNELS = ["1258524941289263254", "1313723272290111559"];
const BOT_OWNER_ID = "1032482231677108224";
const TICKET_CHANNEL_ID = "1228438600497102960";

const warnsFile = path.join(__dirname, 'warns.json');
const bannedWordsFile = path.join(__dirname, 'bannedWords.json');
const sensitiveWordsFile = path.join(__dirname, 'sensitiveWords.json');

if (!fs.existsSync(warnsFile)) fs.writeFileSync(warnsFile, JSON.stringify({}));
if (!fs.existsSync(bannedWordsFile)) fs.writeFileSync(bannedWordsFile, JSON.stringify({ words: ["palabramala1", "palabramala2"] }, null, 2));
if (!fs.existsSync(sensitiveWordsFile)) fs.writeFileSync(sensitiveWordsFile, JSON.stringify({ words: ["negro", "gordo", "flaco"] }, null, 2));

let warns = JSON.parse(fs.readFileSync(warnsFile, 'utf8'));
const bannedWords = require(bannedWordsFile).words;
const sensitiveWords = require(sensitiveWordsFile).words;

let automodEnabled = true;
const cooldown = new Map();

// =========================
// FUNCIONES AUXILIARES
// =========================
function saveWarns() {
  fs.writeFileSync(warnsFile, JSON.stringify(warns, null, 2));
}

function addWarn(userId) {
  if (!warns[userId]) warns[userId] = [];
  const now = Date.now();
  warns[userId].push({ date: now });
  saveWarns();
  return warns[userId].length;
}

function resetWarns(userId) {
  delete warns[userId];
  saveWarns();
}

function getWarns(userId) {
  return warns[userId] || [];
}

// Limpieza automática cada 30 días
setInterval(() => {
  warns = {};
  saveWarns();
  console.log("🧹 Warns limpiados automáticamente cada 30 días.");
}, 30 * 24 * 60 * 60 * 1000);

// =========================
// SISTEMA DE SANCIONES
// =========================
async function applyMute(member, minutes, reason, logChannel) {
  try {
    await member.roles.add(MUTED_ROLE_ID);
    setTimeout(async () => {
      await member.roles.remove(MUTED_ROLE_ID);
    }, minutes * 60 * 1000);

    const embed = new EmbedBuilder()
      .setColor('Red')
      .setTitle('🔇 Usuario muteado')
      .setDescription(`**Usuario:** ${member.user.tag}\n**Duración:** ${minutes} minutos\n**Razón:** ${reason}`)
      .setTimestamp();

    if (logChannel) logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error(err);
  }
}

// =========================
// SISTEMA AUTOMOD
// =========================
module.exports = (client) => {

  // ---- Registro de comandos automáticamente ----
  client.once('ready', async () => {
    try {
      const data = [
        new SlashCommandBuilder().setName('automod').setDescription('Controla el sistema Automod')
          .addSubcommand(s => s.setName('on').setDescription('Activa el automod'))
          .addSubcommand(s => s.setName('off').setDescription('Desactiva el automod'))
          .addSubcommand(s => s.setName('status').setDescription('Muestra el estado del automod')),
        new SlashCommandBuilder().setName('warns').setDescription('Muestra las advertencias de un usuario')
          .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a revisar').setRequired(true)),
        new SlashCommandBuilder().setName('addwarn').setDescription('Agrega una advertencia a un usuario')
          .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a advertir').setRequired(true)),
        new SlashCommandBuilder().setName('removewarn').setDescription('Elimina una advertencia de un usuario')
          .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a modificar').setRequired(true)),
        new SlashCommandBuilder().setName('resetwarns').setDescription('Elimina todas las advertencias de un usuario')
          .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a limpiar').setRequired(true)),
        new SlashCommandBuilder().setName('viewwarns').setDescription('Muestra el historial detallado de advertencias')
          .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a revisar').setRequired(true))
      ].map(cmd => cmd.toJSON());

      await client.application.commands.set(data, GUILD_ID);
      console.log("✅ Comandos del automod registrados correctamente.");
    } catch (err) {
      console.error("❌ Error al registrar comandos:", err);
    }
  });

  // ---- Manejo de comandos ----
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'automod') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'on') {
        automodEnabled = true;
        await interaction.reply({ content: '✅ Automod activado.', ephemeral: true });
      } else if (sub === 'off') {
        automodEnabled = false;
        await interaction.reply({ content: '❌ Automod desactivado.', ephemeral: true });
      } else if (sub === 'status') {
        await interaction.reply({ content: `⚙️ Automod está **${automodEnabled ? 'activado' : 'desactivado'}**.`, ephemeral: true });
      }
    }

    if (['warns', 'addwarn', 'removewarn', 'resetwarns', 'viewwarns'].includes(commandName)) {
      const user = options.getUser('usuario');
      const member = await interaction.guild.members.fetch(user.id);
      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);

      if (commandName === 'warns' || commandName === 'viewwarns') {
        const userWarns = getWarns(user.id);
        if (userWarns.length === 0) {
          return interaction.reply({ content: `${user.tag} no tiene advertencias.`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
          .setColor('Yellow')
          .setTitle(`⚠️ Advertencias de ${user.tag}`)
          .setDescription(userWarns.map((w, i) => `**${i + 1}.** <t:${Math.floor(w.date / 1000)}:R>`).join('\n'))
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (commandName === 'addwarn') {
        const totalWarns = addWarn(user.id);
        const muteTimes = [10, 20, 40, 60];
        const duration = muteTimes[Math.min(totalWarns - 1, muteTimes.length - 1)];

        const embed = new EmbedBuilder()
          .setColor('Red')
          .setTitle('🚨 Nueva advertencia')
          .setDescription(`**Usuario:** ${user.tag}\n**Advertencias totales:** ${totalWarns}\n**Duración mute:** ${duration} min`)
          .setTimestamp();

        logChannel.send({ embeds: [embed] });
        await applyMute(member, duration, "Automod", logChannel);
        interaction.reply({ content: `⚠️ ${user.tag} recibió una advertencia (${totalWarns}).`, ephemeral: true });
      }

      if (commandName === 'removewarn') {
        if (warns[user.id]?.length > 0) warns[user.id].pop();
        saveWarns();
        return interaction.reply({ content: `Se eliminó una advertencia a ${user.tag}.`, ephemeral: true });
      }

      if (commandName === 'resetwarns') {
        resetWarns(user.id);
        return interaction.reply({ content: `Todas las advertencias de ${user.tag} fueron eliminadas.`, ephemeral: true });
      }
    }

    // Botón "Ver palabras prohibidas"
    if (interaction.isButton() && interaction.customId === 'ver_palabras') {
      const banned = JSON.parse(fs.readFileSync(bannedWordsFile, 'utf8')).words;
      const embed = new EmbedBuilder()
        .setColor('Purple')
        .setTitle('🚫 Palabras prohibidas')
        .setDescription(banned.map(w => `• ${w}`).join('\n'))
        .setFooter({ text: 'Evita usar estas palabras para no recibir sanciones.' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  });

  // ---- Sistema principal de monitoreo ----
  client.on('messageCreate', async (message) => {
    if (!automodEnabled || message.author.bot) return;
    if (IGNORED_CHANNELS.includes(message.channel.id)) return;
    const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
    const member = message.member;

    // Anti-spam
    if (!cooldown.has(message.author.id)) cooldown.set(message.author.id, []);
    const timestamps = cooldown.get(message.author.id);
    timestamps.push(Date.now());
    const filtered = timestamps.filter(t => Date.now() - t < 10000);
    cooldown.set(message.author.id, filtered);
    if (filtered.length >= 5 || message.content.split('\n').length >= 5) {
      const warnsCount = addWarn(message.author.id);
      const muteTimes = [10, 20, 40, 60];
      const duration = muteTimes[Math.min(warnsCount - 1, muteTimes.length - 1)];
      await applyMute(member, duration, "Anti-spam", logChannel);
      message.delete();
      return;
    }

    // Palabras prohibidas
    if (bannedWords.some(w => message.content.toLowerCase().includes(w))) {
      const warnsCount = addWarn(message.author.id);
      const muteTimes = [10, 20, 40, 60];
      const duration = muteTimes[Math.min(warnsCount - 1, muteTimes.length - 1)];
      await applyMute(member, duration, "Palabra prohibida", logChannel);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ver_palabras')
          .setLabel('Ver palabras prohibidas')
          .setStyle(ButtonStyle.Danger)
      );

      const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('🚫 Palabra prohibida detectada')
        .setDescription(`Tu mensaje contenía una palabra prohibida.`)
        .setFooter({ text: 'Evita reincidir para no recibir sanciones más graves.' });

      await message.channel.send({ content: `<@${message.author.id}>`, embeds: [embed], components: [row] });
      await message.delete();
      return;
    }

    // Palabras ofensivas
    if (sensitiveWords.some(w => message.content.toLowerCase().includes(w))) {
      const mentionedUser = message.mentions.users.first();
      if (mentionedUser) {
        const dmEmbed = new EmbedBuilder()
          .setColor('Yellow')
          .setTitle('⚠️ Posible mensaje ofensivo detectado')
          .setDescription(`Hola <@${mentionedUser.id}>, alguien te dijo algo que podría ser ofensivo. Si te incomodó, puedes crear un ticket en <#${TICKET_CHANNEL_ID}>.`)
          .setFooter({ text: 'SirgioBOT cuida tu seguridad emocional 💛' });
        await mentionedUser.send({ embeds: [dmEmbed] }).catch(() => {});
      }
    }
  });
};
