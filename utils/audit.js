const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');
const { db, mongoose } = require('../database');
const { runSlash } = require('./runSlash');

const { GUILD_ID, ADMIN_ROLE_ID } = require('../config');

const ACTION_EMOJIS = {
  'TICKET_CREATE': '🎟️',
  'TICKET_CLAIM': '📋',
  'TICKET_CLOSE': '🔒',
  'TICKET_RATE': '⭐',
  'TICKET_REMINDER': '⏰',
  'SUGGESTION_CREATE': '💡',
  'SUGGESTION_REVIEW': '📝',
  'SANCTION_APPLY': '⚠️',
  'WARN_ADD': '⚠️',
  'MUTE_APPLY': '🔇',
  'BAN_APPLY': '🔨',
  'BACKUP_CREATE': '💾',
  'DEFAULT': '📌'
};

module.exports = (client) => {
  console.log('✅ Sistema de auditoría cargado');

  client.once('ready', async () => {
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return;

      const commands = [
        new SlashCommandBuilder()
          .setName('audit')
          .setDescription('Consulta los logs de auditoría')
          .addSubcommand(sub => 
            sub.setName('recent')
              .setDescription('Muestra los logs más recientes')
              .addIntegerOption(opt => 
                opt.setName('cantidad')
                  .setDescription('Cantidad de logs a mostrar (máx 25)')
                  .setRequired(false)))
          .addSubcommand(sub => 
            sub.setName('user')
              .setDescription('Logs relacionados a un usuario')
              .addUserOption(opt => 
                opt.setName('usuario')
                  .setDescription('Usuario a consultar')
                  .setRequired(true)))
          .addSubcommand(sub => 
            sub.setName('type')
              .setDescription('Filtrar por tipo de acción')
              .addStringOption(opt => 
                opt.setName('tipo')
                  .setDescription('Tipo de acción')
                  .setRequired(true)
                  .addChoices(
                    { name: 'Tickets', value: 'TICKET' },
                    { name: 'Sugerencias', value: 'SUGGESTION' },
                    { name: 'Sanciones', value: 'SANCTION' },
                    { name: 'Warns', value: 'WARN' },
                    { name: 'Mutes', value: 'MUTE' },
                    { name: 'Bans', value: 'BAN' },
                    { name: 'Backups', value: 'BACKUP' }
                  )))
          .addSubcommand(sub => 
            sub.setName('search')
              .setDescription('Buscar en los logs')
              .addStringOption(opt => 
                opt.setName('query')
                  .setDescription('Término de búsqueda')
                  .setRequired(true)))
      ];

      for (const command of commands) {
        const existing = (await guild.commands.fetch()).find(c => c.name === command.name);
        if (!existing) {
          await guild.commands.create(command);
        }
      }
      
      console.log('🟢 Comandos de auditoría registrados');
    } catch (error) {
      console.error('Error registrando comandos de audit:', error);
    }
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'audit') return;

    const hasAdminRole = interaction.member.roles.cache.has(ADMIN_ROLE_ID);
    if (!hasAdminRole) {
      return interaction.reply({ content: '❌ Este comando es solo para administradores.', ephemeral: true });
    }

    await runSlash(interaction, { defer: true, ephemeral: true, execute: async (interaction) => {
      const subcommand = interaction.options.getSubcommand();
      const AuditLog = mongoose.model('AuditLog');
      let logs = [];
      let title = '';

      switch (subcommand) {
        case 'recent': {
          const cantidad = Math.min(interaction.options.getInteger('cantidad') || 10, 25);
          logs = await AuditLog.find().sort({ createdAt: -1 }).limit(cantidad);
          title = `📜 Últimos ${logs.length} Logs de Auditoría`;
          break;
        }

        case 'user': {
          const user = interaction.options.getUser('usuario');
          logs = await AuditLog.find({
            $or: [
              { odId: user.id },
              { targetId: user.id },
              { staffId: user.id }
            ]
          }).sort({ createdAt: -1 }).limit(25);
          title = `📜 Logs de ${user.tag}`;
          break;
        }

        case 'type': {
          const tipo = interaction.options.getString('tipo');
          logs = await AuditLog.find({
            actionType: new RegExp(tipo, 'i')
          }).sort({ createdAt: -1 }).limit(25);
          title = `📜 Logs de tipo: ${tipo}`;
          break;
        }

        case 'search': {
          const query = interaction.options.getString('query');
          logs = await AuditLog.find({
            $or: [
              { actionType: new RegExp(query, 'i') },
              { 'details.reason': new RegExp(query, 'i') },
              { 'details.ticketNumber': query }
            ]
          }).sort({ createdAt: -1 }).limit(25);
          title = `🔍 Búsqueda: "${query}"`;
          break;
        }
      }

      if (logs.length === 0) {
        return interaction.editReply({ content: '📭 No se encontraron logs con esos criterios.' });
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(0x5865F2)
        .setFooter({ text: `Mostrando ${logs.length} resultados` })
        .setTimestamp();

      let description = '';
      for (const log of logs.slice(0, 15)) {
        const emoji = ACTION_EMOJIS[log.actionType] || ACTION_EMOJIS.DEFAULT;
        const time = `<t:${Math.floor(new Date(log.createdAt).getTime() / 1000)}:R>`;
        const user = log.odId ? `<@${log.odId}>` : 'Sistema';
        const staff = log.staffId ? `por <@${log.staffId}>` : '';
        
        description += `${emoji} **${log.actionType}**\n`;
        description += `   ${user} ${staff} - ${time}\n`;
        
        if (log.details) {
          if (log.details.ticketNumber) description += `   Ticket #${log.details.ticketNumber}\n`;
          if (log.details.reason) description += `   Razón: ${log.details.reason.substring(0, 50)}...\n`;
        }
        description += '\n';
      }

      embed.setDescription(description || 'Sin datos');

      if (logs.length > 15) {
        embed.addFields({ 
          name: '📌 Nota', 
          value: `Se muestran 15 de ${logs.length} resultados. Usa filtros más específicos para ver más.` 
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }});
  });
};
