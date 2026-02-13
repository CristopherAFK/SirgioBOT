const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

const GUILD_ID = process.env.GUILD_ID || '1212886282645147768';

module.exports = (client) => {
    client.once('ready', async () => {
    console.log('✅ Comandos de utilidad cargados');

    try {
      // Intentar obtener el servidor desde la caché o fetch
      let guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) {
        console.log(`🔍 Servidor ${GUILD_ID} no encontrado en caché, intentando fetch...`);
        guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
      }

      if (!guild) {
        console.error(`❌ No se encontró el servidor con ID: ${GUILD_ID}. Asegúrate de que el bot esté en el servidor y el ID sea correcto.`);
        // Si no hay servidor específico, registrar como globales para asegurar que aparezcan
        console.log('⚠️ Registrando comandos como GLOBALES ante la falta de servidor específico...');
        await client.application.commands.set(commands_list);
        console.log('🟢 Comandos registrados como GLOBALES');
        return;
      }

      console.log(`🔄 Sincronizando comandos con el servidor: ${guild.name} (${GUILD_ID})...`);
      
      // Limpiar comandos globales para evitar duplicados
      await client.application.commands.set([]);
      console.log('🗑️ Comandos globales limpiados');

      const commands = [
        new SlashCommandBuilder()
          .setName('userinfo')
          .setDescription('Muestra información de un usuario')
          .addUserOption(option => 
            option.setName('usuario')
              .setDescription('Usuario a consultar (opcional)')
              .setRequired(false)),
        
        new SlashCommandBuilder()
          .setName('serverinfo')
          .setDescription('Muestra información del servidor'),
        
        new SlashCommandBuilder()
          .setName('avatar')
          .setDescription('Muestra el avatar de un usuario')
          .addUserOption(option => 
            option.setName('usuario')
              .setDescription('Usuario a consultar (opcional)')
              .setRequired(false)),
        
        new SlashCommandBuilder()
          .setName('banner')
          .setDescription('Muestra el banner de un usuario')
          .addUserOption(option => 
            option.setName('usuario')
              .setDescription('Usuario a consultar (opcional)')
              .setRequired(false)),
        
        new SlashCommandBuilder()
          .setName('ping')
          .setDescription('Muestra la latencia del bot'),
        
        new SlashCommandBuilder()
          .setName('membercount')
          .setDescription('Muestra el conteo de miembros del servidor'),
        
        new SlashCommandBuilder()
          .setName('notif-manual')
          .setDescription('Notifica manualmente un video reciente (Solo Staff)')
          .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
          .addStringOption(option =>
            option.setName('canal')
              .setDescription('Selecciona el canal')
              .setRequired(true)
              .addChoices(
                { name: 'Sirgio_o', value: 'Sirgio_o' },
                { name: 'Sirgiotv', value: 'Sirgiotv' }
              ))
      ];

      // Sincronización completa: elimina duplicados y comandos antiguos, y registra los nuevos
      await guild.commands.set(commands);
      
      // OPCIONAL: Registrar también como globales para mayor redundancia si el usuario lo prefiere
      // await client.application.commands.set(commands);
      
      console.log('🟢 Comandos de utilidad sincronizados y registrados correctamente');
    } catch (error) {
      console.error('Error registrando comandos de utilidad:', error);
    }
  });

  // Definir la lista de comandos fuera para poder usarla en fallback global
  const commands_list = [
        new SlashCommandBuilder()
          .setName('userinfo')
          .setDescription('Muestra información de un usuario')
          .addUserOption(option => 
            option.setName('usuario')
              .setDescription('Usuario a consultar (opcional)')
              .setRequired(false)),
        
        new SlashCommandBuilder()
          .setName('serverinfo')
          .setDescription('Muestra información del servidor'),
        
        new SlashCommandBuilder()
          .setName('avatar')
          .setDescription('Muestra el avatar de un usuario')
          .addUserOption(option => 
            option.setName('usuario')
              .setDescription('Usuario a consultar (opcional)')
              .setRequired(false)),
        
        new SlashCommandBuilder()
          .setName('banner')
          .setDescription('Muestra el banner de un usuario')
          .addUserOption(option => 
            option.setName('usuario')
              .setDescription('Usuario a consultar (opcional)')
              .setRequired(false)),
        
        new SlashCommandBuilder()
          .setName('ping')
          .setDescription('Muestra la latencia del bot'),
        
        new SlashCommandBuilder()
          .setName('membercount')
          .setDescription('Muestra el conteo de miembros del servidor'),
        
        new SlashCommandBuilder()
          .setName('notif-manual')
          .setDescription('Notifica manualmente un video reciente (Solo Staff)')
          .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
          .addStringOption(option =>
            option.setName('canal')
              .setDescription('Selecciona el canal')
              .setRequired(true)
              .addChoices(
                { name: 'Sirgio_o', value: 'Sirgio_o' },
                { name: 'Sirgiotv', value: 'Sirgiotv' }
              ))
      ];

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      switch (interaction.commandName) {
        case 'userinfo': {
          const user = interaction.options.getUser('usuario') || interaction.user;
          const member = await interaction.guild.members.fetch(user.id).catch(() => null);
          
          const fetchedUser = await user.fetch();
          
          const embed = new EmbedBuilder()
            .setTitle(`👤 Información de ${user.tag}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setColor(member?.displayHexColor || 0x5865F2)
            .addFields(
              { name: '🆔 ID', value: user.id, inline: true },
              { name: '📅 Cuenta creada', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
              { name: '🤖 Bot', value: user.bot ? 'Sí' : 'No', inline: true }
            );

          if (member) {
            embed.addFields(
              { name: '📥 Se unió al servidor', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
              { name: '🎭 Apodo', value: member.nickname || 'Ninguno', inline: true },
              { name: '🔝 Rol más alto', value: member.roles.highest.toString(), inline: true },
              { name: `📋 Roles (${member.roles.cache.size - 1})`, value: member.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => r.toString()).slice(0, 10).join(', ') || 'Ninguno', inline: false }
            );

            if (member.premiumSince) {
              embed.addFields({ name: '💎 Booster desde', value: `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>`, inline: true });
            }
          }

          if (fetchedUser.banner) {
            embed.setImage(fetchedUser.bannerURL({ dynamic: true, size: 512 }));
          }

          embed.setFooter({ text: `Solicitado por ${interaction.user.tag}` })
            .setTimestamp();

          return interaction.reply({ embeds: [embed] });
        }

        case 'serverinfo': {
          const guild = interaction.guild;
          await guild.fetch();

          const owner = await guild.fetchOwner();
          const channels = guild.channels.cache;
          const textChannels = channels.filter(c => c.type === 0).size;
          const voiceChannels = channels.filter(c => c.type === 2).size;
          const categories = channels.filter(c => c.type === 4).size;

          const embed = new EmbedBuilder()
            .setTitle(`🏰 ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
            .setColor(0x5865F2)
            .addFields(
              { name: '🆔 ID', value: guild.id, inline: true },
              { name: '👑 Dueño', value: owner.user.tag, inline: true },
              { name: '📅 Creado', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
              { name: '👥 Miembros', value: guild.memberCount.toLocaleString(), inline: true },
              { name: '💎 Nivel de Boost', value: `Nivel ${guild.premiumTier}`, inline: true },
              { name: '🚀 Boosts', value: guild.premiumSubscriptionCount?.toString() || '0', inline: true },
              { name: '📝 Canales de texto', value: textChannels.toString(), inline: true },
              { name: '🔊 Canales de voz', value: voiceChannels.toString(), inline: true },
              { name: '📁 Categorías', value: categories.toString(), inline: true },
              { name: '😀 Emojis', value: guild.emojis.cache.size.toString(), inline: true },
              { name: '🎭 Roles', value: guild.roles.cache.size.toString(), inline: true },
              { name: '🔒 Verificación', value: verificationLevelText(guild.verificationLevel), inline: true }
            )
            .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
            .setTimestamp();

          if (guild.banner) {
            embed.setImage(guild.bannerURL({ size: 512 }));
          }

          return interaction.reply({ embeds: [embed] });
        }

        case 'avatar': {
          const user = interaction.options.getUser('usuario') || interaction.user;
          
          const embed = new EmbedBuilder()
            .setTitle(`🖼️ Avatar de ${user.tag}`)
            .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
            .setColor(0x5865F2)
            .addFields(
              { name: '🔗 Enlaces', value: `[PNG](${user.displayAvatarURL({ extension: 'png', size: 1024 })}) | [JPG](${user.displayAvatarURL({ extension: 'jpg', size: 1024 })}) | [WEBP](${user.displayAvatarURL({ extension: 'webp', size: 1024 })})`, inline: false }
            )
            .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
            .setTimestamp();

          return interaction.reply({ embeds: [embed] });
        }

        case 'banner': {
          const user = interaction.options.getUser('usuario') || interaction.user;
          const fetchedUser = await user.fetch();
          
          if (!fetchedUser.banner) {
            return interaction.reply({ content: '❌ Este usuario no tiene un banner.', ephemeral: true });
          }

          const embed = new EmbedBuilder()
            .setTitle(`🎨 Banner de ${user.tag}`)
            .setImage(fetchedUser.bannerURL({ dynamic: true, size: 1024 }))
            .setColor(fetchedUser.accentColor || 0x5865F2)
            .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
            .setTimestamp();

          return interaction.reply({ embeds: [embed] });
        }

        case 'ping': {
          const sent = await interaction.reply({ content: '🏓 Calculando...', fetchReply: true });
          const latency = sent.createdTimestamp - interaction.createdTimestamp;
          const apiLatency = Math.round(client.ws.ping);

          const embed = new EmbedBuilder()
            .setTitle('🏓 Pong!')
            .setColor(latency < 100 ? 0x00ff00 : latency < 200 ? 0xffff00 : 0xff0000)
            .addFields(
              { name: '📨 Latencia del mensaje', value: `${latency}ms`, inline: true },
              { name: '💓 Latencia de la API', value: `${apiLatency}ms`, inline: true }
            )
            .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
            .setTimestamp();

          return interaction.editReply({ content: null, embeds: [embed] });
        }

        case 'membercount': {
          const guild = interaction.guild;
          const members = guild.memberCount;
          const bots = guild.members.cache.filter(m => m.user.bot).size;
          const humans = members - bots;

          const embed = new EmbedBuilder()
            .setTitle('👥 Conteo de Miembros')
            .setColor(0x5865F2)
            .addFields(
              { name: '📊 Total', value: members.toLocaleString(), inline: true },
              { name: '👤 Humanos', value: humans.toLocaleString(), inline: true },
              { name: '🤖 Bots', value: bots.toLocaleString(), inline: true }
            )
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

          return interaction.reply({ embeds: [embed] });
        }

        case 'notif-manual': {
          if (!client.notificationSystem) {
            return interaction.reply({ content: '❌ El sistema de notificaciones no está inicializado.', ephemeral: true });
          }

          const canalNombre = interaction.options.getString('canal');
          const canal = client.notificationSystem.canalesConfigurados.find(c => c.nombre === canalNombre);

          if (!canal) {
            return interaction.reply({ content: '❌ Canal no configurado.', ephemeral: true });
          }

          await interaction.deferReply({ ephemeral: true });

          const videos = await client.notificationSystem.getRecentVideos(canal);
          if (videos.length === 0) {
            return interaction.editReply({ content: '❌ No se encontraron videos recientes.' });
          }

          // Crear botones o un menú sería mejor, pero por simplicidad usaremos el más reciente de los 3
          // o podrías elegir uno. Vamos a enviar el primero (más reciente).
          await client.notificationSystem.sendNotification(videos[0]);

          return interaction.editReply({ content: `✅ Notificación enviada manualmente para el video: **${videos[0].titulo}**` });
        }
      }
    } catch (error) {
      console.error('Error en comando de utilidad:', error);
      if (!interaction.replied) {
        await interaction.reply({ content: '❌ Ocurrió un error.', ephemeral: true }).catch(() => {});
      }
    }
  });
};

function verificationLevelText(level) {
  const levels = {
    0: 'Ninguna',
    1: 'Baja',
    2: 'Media',
    3: 'Alta',
    4: 'Muy Alta'
  };
  return levels[level] || 'Desconocida';
}
