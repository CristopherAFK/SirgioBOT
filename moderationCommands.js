// commands/moderationCommands.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Configura tus IDs
const GUILD_ID = "1212886282645147768";
const LOG_CHANNEL_ID = "1434002832016801842";
const MUTED_ROLE_ID = "1430271610358726717";
const STAFF_ROLE_IDS = ["1212891335929897030", "1229140504310972599"];
const MONITOR_CHANNEL_CATEGORY = "1434002832016801842"; // Puedes cambiarlo si quieres que los canales de vigilancia se agrupen

const bannedWordsFile = path.join(__dirname, '../bannedWords.txt');
const sensitiveWordsFile = path.join(__dirname, '../sensitiveWords.txt');

module.exports = [
  // /mute
  {
    data: new SlashCommandBuilder()
      .setName('mute')
      .setDescription('Mutea a un usuario manualmente.')
      .addUserOption(option => option.setName('usuario').setDescription('Usuario a mutear').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
      const user = interaction.options.getUser('usuario');
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply({ content: '❌ No se encontró al usuario.', ephemeral: true });

      await member.roles.add(MUTED_ROLE_ID);
      const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('🔇 Usuario muteado')
        .setDescription(`${user.tag} fue muteado manualmente por ${interaction.user.tag}`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) logChannel.send({ embeds: [embed] });
    }
  },

  // /remove-mute
  {
    data: new SlashCommandBuilder()
      .setName('remove-mute')
      .setDescription('Remueve el mute de un usuario.')
      .addUserOption(option => option.setName('usuario').setDescription('Usuario a desmutear').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
      const user = interaction.options.getUser('usuario');
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply({ content: '❌ No se encontró al usuario.', ephemeral: true });

      await member.roles.remove(MUTED_ROLE_ID);
      const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle('🔊 Usuario desmuteado')
        .setDescription(`${user.tag} fue desmuteado por ${interaction.user.tag}`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) logChannel.send({ embeds: [embed] });
    }
  },

  // /add-word
  {
    data: new SlashCommandBuilder()
      .setName('add-word')
      .setDescription('Agrega una palabra al filtro del automod.')
      .addStringOption(option => option.setName('tipo').setDescription('Tipo de palabra (banned o sensitive)').setRequired(true).addChoices(
        { name: 'banned', value: 'banned' },
        { name: 'sensitive', value: 'sensitive' },
      ))
      .addStringOption(option => option.setName('palabra').setDescription('Palabra a agregar').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const tipo = interaction.options.getString('tipo');
      const palabra = interaction.options.getString('palabra').toLowerCase();

      const file = tipo === 'banned' ? bannedWordsFile : sensitiveWordsFile;
      fs.appendFileSync(file, `\n${palabra}`);

      await interaction.reply({ content: `✅ Palabra **${palabra}** añadida a la lista ${tipo}.`, ephemeral: true });
    }
  },

  // /remove-word
  {
    data: new SlashCommandBuilder()
      .setName('remove-word')
      .setDescription('Elimina una palabra del filtro del automod.')
      .addStringOption(option => option.setName('tipo').setDescription('Tipo de palabra (banned o sensitive)').setRequired(true).addChoices(
        { name: 'banned', value: 'banned' },
        { name: 'sensitive', value: 'sensitive' },
      ))
      .addStringOption(option => option.setName('palabra').setDescription('Palabra a eliminar').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const tipo = interaction.options.getString('tipo');
      const palabra = interaction.options.getString('palabra').toLowerCase();

      const file = tipo === 'banned' ? bannedWordsFile : sensitiveWordsFile;
      let words = fs.readFileSync(file, 'utf8').split('\n').map(w => w.trim()).filter(Boolean);
      words = words.filter(w => w !== palabra);
      fs.writeFileSync(file, words.join('\n'));

      await interaction.reply({ content: `✅ Palabra **${palabra}** eliminada de la lista ${tipo}.`, ephemeral: true });
    }
  },

  // /vigilar
  {
    data: new SlashCommandBuilder()
      .setName('vigilar')
      .setDescription('Crea un canal para monitorear a un usuario.')
      .addUserOption(option => option.setName('usuario').setDescription('Usuario a vigilar').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
      const user = interaction.options.getUser('usuario');
      const guild = interaction.guild;
      const staffRoles = STAFF_ROLE_IDS.map(id => ({ id, allow: [PermissionFlagsBits.ViewChannel] }));

      const channel = await guild.channels.create({
        name: `vigilando-${user.username}`,
        type: 0,
        parent: MONITOR_CHANNEL_CATEGORY,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...staffRoles,
        ],
      });

      const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('👁️ Usuario en vigilancia')
        .setDescription(`El usuario ${user.tag} está siendo vigilado.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      await channel.send({ embeds: [embed] });
    }
  },

  // /status
  {
    data: new SlashCommandBuilder()
      .setName('status')
      .setDescription('Verifica el estado de un usuario (muteado, vigilado, normal).')
      .addUserOption(option => option.setName('usuario').setDescription('Usuario a verificar').setRequired(true)),
    async execute(interaction) {
      const user = interaction.options.getUser('usuario');
      const member = await interaction.guild.members.fetch(user.id);
      let estado = '🟢 Sin sanción';

      if (member.roles.cache.has(MUTED_ROLE_ID)) estado = '🔇 Muteado';
      else if (interaction.guild.channels.cache.some(c => c.name === `vigilando-${user.username}`))
        estado = '👁️ En vigilancia';

      const embed = new EmbedBuilder()
        .setColor('Yellow')
        .setTitle('📋 Estado del usuario')
        .setDescription(`**Usuario:** ${user.tag}\n**Estado:** ${estado}`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
];
