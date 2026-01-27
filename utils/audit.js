const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { db } = require('../database');

const GUILD_ID = '1212886282645147768';
const ADMIN_ROLE_ID = '1212891335929897030';

const ACTION_COLORS = {
  'TICKET_CREATE': 0x00FF00,
  'TICKET_CLAIM': 0x3498DB,
  'TICKET_CLOSE': 0xFF6B6B,
  'TICKET_RATE': 0xFFD700,
  'TICKET_REMINDER': 0xFFA500,
  'SUGGESTION_CREATE': 0x9B59B6,
  'SUGGESTION_REVIEW': 0xE74C3C,
  'SANCTION_APPLY': 0xFF0000,
  'WARN_ADD': 0xFFFF00,
  'MUTE_APPLY': 0xFF9900,
  'BAN_APPLY': 0x8B0000,
  'BACKUP_CREATE': 0x00CED1,
  'DEFAULT': 0x5865F2
};

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

    try {
      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ ephemeral: true });

      let logs = [];
      let title = '';

      switch (subcommand) {
        case 'recent': {
          const cantidad = Math.min(interaction.options.getInteger('cantidad') || 10, 25);
          logs = await db.getAuditLogs({});
          logs = logs.slice(0, cantidad);
          title = `📜 Últimos ${logs.length} Logs de Auditoría`;
          break;
        }

        case 'user': {
          const user = interaction.options.getUser('usuario');
          logs = await db.getAuditLogs({ userId: user.id });
          title = `📜 Logs de ${user.tag}`;
          break;
        }

        case 'type': {
          const tipo = interaction.options.getString('tipo');
          const result = await db.query(
            `SELECT * FROM audit_logs WHERE action_type LIKE $1 ORDER BY created_at DESC LIMIT 25`,
            [`${tipo}%`]
          );
          logs = result.rows;
          title = `📜 Logs de tipo: ${tipo}`;
          break;
        }

        case 'search': {
          const query = interaction.options.getString('query');
          const result = await db.query(
            `SELECT * FROM audit_logs WHERE 
             details::text ILIKE $1 OR action_type ILIKE $1 
             ORDER BY created_at DESC LIMIT 25`,
            [`%${query}%`]
          );
          logs = result.rows;
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
        const emoji = ACTION_EMOJIS[log.action_type] || ACTION_EMOJIS.DEFAULT;
        const time = `<t:${Math.floor(new Date(log.created_at).getTime() / 1000)}:R>`;
        const user = log.user_id ? `<@${log.user_id}>` : 'Sistema';
        const staff = log.staff_id ? `por <@${log.staff_id}>` : '';
        
        description += `${emoji} **${log.action_type}**\n`;
        description += `   ${user} ${staff} - ${time}\n`;
        
        if (log.details) {
          const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
          if (details.ticketNumber) description += `   Ticket #${details.ticketNumber}\n`;
          if (details.reason) description += `   Razón: ${details.reason.substring(0, 50)}...\n`;
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

    } catch (error) {
      console.error('Error en comando audit:', error);
      await interaction.editReply({ content: '❌ Ocurrió un error al consultar los logs.' }).catch(() => {});
    }
  });
};
