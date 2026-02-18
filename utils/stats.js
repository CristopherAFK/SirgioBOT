const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { db, mongoose } = require('../database');
const { runSlash } = require('./runSlash');

const { GUILD_ID, STAFF_ROLE_ID } = require('../config');

module.exports = (client) => {
  client.once('ready', async () => {
    console.log('✅ Sistema de estadísticas cargado');

    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return;

      const commands = [
        new SlashCommandBuilder()
          .setName('stats')
          .setDescription('Muestra estadísticas del servidor y staff')
          .addSubcommand(sub => 
            sub.setName('tickets')
              .setDescription('Estadísticas de tickets'))
          .addSubcommand(sub => 
            sub.setName('staff')
              .setDescription('Ranking de staff por tickets atendidos'))
          .addSubcommand(sub => 
            sub.setName('personal')
              .setDescription('Tus estadísticas personales de staff'))
      ];

      for (const command of commands) {
        const existing = (await guild.commands.fetch()).find(c => c.name === command.name);
        if (!existing) {
          await guild.commands.create(command);
        }
      }
      
      console.log('🟢 Comandos de estadísticas registrados');
    } catch (error) {
      console.error('Error registrando comandos de stats:', error);
    }
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'stats') return;

    await runSlash(interaction, { defer: true, ephemeral: false, execute: async (interaction) => {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'tickets': {
          const stats = await db.getTicketStats();

          const embed = new EmbedBuilder()
            .setTitle('📊 Estadísticas de Tickets')
            .setColor(0x5865F2)
            .addFields(
              { name: '🟢 Tickets Abiertos', value: (stats.open_tickets || 0).toString(), inline: true },
              { name: '🔴 Tickets Cerrados', value: (stats.closed_tickets || 0).toString(), inline: true },
              { name: '📅 Cerrados Hoy', value: (stats.closed_today || 0).toString(), inline: true },
              { name: '⭐ Calificación Promedio', value: stats.avg_rating ? `${parseFloat(stats.avg_rating).toFixed(2)}/5` : 'N/A', inline: true },
              { name: '📝 Tickets Calificados', value: (stats.rated_tickets || 0).toString(), inline: true }
            )
            .setFooter({ text: 'Estadísticas en tiempo real' })
            .setTimestamp();

          return interaction.editReply({ embeds: [embed] });
        }

        case 'staff': {
          const staffStats = await db.getStaffStats();

          if (!staffStats || staffStats.length === 0) {
            return interaction.editReply({ content: '📊 No hay estadísticas de staff disponibles aún.' });
          }

          let description = '';
          const medals = ['🥇', '🥈', '🥉'];

          for (let i = 0; i < Math.min(staffStats.length, 10); i++) {
            const staff = staffStats[i];
            const medal = medals[i] || `**${i + 1}.**`;
            const avgRating = staff.ratingCount > 0 
              ? (parseFloat(staff.totalRating) / staff.ratingCount).toFixed(2)
              : 'N/A';
            
            description += `${medal} <@${staff.staffId}>\n`;
            description += `   📋 Atendidos: ${staff.ticketsClaimed} | 🔒 Cerrados: ${staff.ticketsClosed} | ⭐ Promedio: ${avgRating}\n\n`;
          }

          const embed = new EmbedBuilder()
            .setTitle('🏆 Ranking de Staff')
            .setDescription(description || 'Sin datos')
            .setColor(0xFFD700)
            .setFooter({ text: 'Ordenado por tickets cerrados' })
            .setTimestamp();

          return interaction.editReply({ embeds: [embed] });
        }

        case 'personal': {
          const hasStaffRole = interaction.member.roles.cache.has(STAFF_ROLE_ID);
          if (!hasStaffRole) {
            return interaction.editReply({ content: '❌ Este comando es solo para staff.' });
          }

          const myStats = await db.getStaffStats(interaction.user.id);

          if (!myStats) {
            return interaction.editReply({ content: '📊 Aún no tienes estadísticas. ¡Empieza a atender tickets!' });
          }

          const avgRating = myStats.ratingCount > 0 
            ? (parseFloat(myStats.totalRating) / myStats.ratingCount).toFixed(2)
            : 'N/A';

          const embed = new EmbedBuilder()
            .setTitle('📊 Tus Estadísticas')
            .setColor(0x00FF80)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .addFields(
              { name: '📋 Tickets Atendidos', value: myStats.ticketsClaimed.toString(), inline: true },
              { name: '🔒 Tickets Cerrados', value: myStats.ticketsClosed.toString(), inline: true },
              { name: '⭐ Calificación Promedio', value: avgRating, inline: true },
              { name: '📝 Total de Calificaciones', value: myStats.ratingCount.toString(), inline: true }
            )
            .setFooter({ text: `Última actualización: ${new Date(myStats.updatedAt).toLocaleString()}` })
            .setTimestamp();

          return interaction.editReply({ embeds: [embed] });
        }
      }
    }});
  });
};
