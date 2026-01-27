const { EmbedBuilder } = require('discord.js');
const { db } = require('../database');

const GUILD_ID = '1212886282645147768';
const REMINDER_INTERVAL = 30 * 60 * 1000;
const TICKET_INACTIVE_TIME = 60 * 60 * 1000;

module.exports = (client) => {
  console.log('✅ Sistema de recordatorios cargado');

  client.once('ready', async () => {
    setInterval(async () => {
      await checkInactiveTickets(client);
    }, REMINDER_INTERVAL);

    setTimeout(() => checkInactiveTickets(client), 60000);
  });
};

async function checkInactiveTickets(client) {
  try {
    const result = await db.query(`
      SELECT * FROM tickets 
      WHERE status = 'open' 
      AND claimed_by IS NULL 
      AND created_at < NOW() - INTERVAL '1 hour'
    `);

    const unclaimedTickets = result.rows;

    if (unclaimedTickets.length === 0) return;

    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;

    for (const ticket of unclaimedTickets) {
      try {
        const channel = await guild.channels.fetch(ticket.channel_id).catch(() => null);
        if (!channel) continue;

        const messages = await channel.messages.fetch({ limit: 10 });
        const botReminders = messages.filter(m => 
          m.author.id === client.user.id && 
          m.embeds[0]?.title?.includes('Recordatorio')
        );

        const lastReminder = botReminders.first();
        if (lastReminder) {
          const timeSinceReminder = Date.now() - lastReminder.createdTimestamp;
          if (timeSinceReminder < REMINDER_INTERVAL) continue;
        }

        const embed = new EmbedBuilder()
          .setTitle('⏰ Recordatorio')
          .setDescription(`Este ticket lleva más de 1 hora sin ser atendido.\n\n<@${ticket.owner_id}>, el staff atenderá tu caso lo antes posible. Si tu consulta ya no es necesaria, puedes pedir que cierren el ticket.`)
          .setColor(0xFFA500)
          .setFooter({ text: `Ticket #${ticket.ticket_number}` })
          .setTimestamp();

        await channel.send({ embeds: [embed] });

        await db.addAuditLog('TICKET_REMINDER', ticket.owner_id, null, null, {
          channelId: ticket.channel_id,
          ticketNumber: ticket.ticket_number,
          reason: 'Ticket sin atender por más de 1 hora'
        });

      } catch (err) {
        console.error('Error enviando recordatorio:', err);
      }
    }

    const claimedResult = await db.query(`
      SELECT * FROM tickets 
      WHERE status = 'open' 
      AND claimed_by IS NOT NULL 
      AND claimed_at < NOW() - INTERVAL '2 hours'
    `);

    for (const ticket of claimedResult.rows) {
      try {
        const channel = await guild.channels.fetch(ticket.channel_id).catch(() => null);
        if (!channel) continue;

        const messages = await channel.messages.fetch({ limit: 5 });
        const lastMessage = messages.filter(m => !m.author.bot).first();

        if (lastMessage) {
          const timeSinceLastMessage = Date.now() - lastMessage.createdTimestamp;
          if (timeSinceLastMessage < 2 * 60 * 60 * 1000) continue;
        }

        const userReminders = messages.filter(m => 
          m.author.id === client.user.id && 
          m.content?.includes('esperando tu respuesta')
        );

        if (userReminders.size > 0) {
          const lastUserReminder = userReminders.first();
          const timeSinceUserReminder = Date.now() - lastUserReminder.createdTimestamp;
          if (timeSinceUserReminder < 2 * 60 * 60 * 1000) continue;
        }

        await channel.send({
          content: `<@${ticket.owner_id}> ¿Sigues ahí? El staff está esperando tu respuesta. Si ya no necesitas ayuda, por favor avísanos para cerrar el ticket.`
        });

      } catch (err) {
        console.error('Error enviando recordatorio de respuesta:', err);
      }
    }

  } catch (error) {
    console.error('Error en checkInactiveTickets:', error);
  }
}
