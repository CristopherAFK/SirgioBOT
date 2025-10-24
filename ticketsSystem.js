const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

const ticketFile = './ticketCount.json';
if (!fs.existsSync(ticketFile)) fs.writeFileSync(ticketFile, JSON.stringify({ count: 0 }));

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    // 🎫 Selección de tipo de ticket
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
      const choice = interaction.values[0];
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_ticket').setLabel('✅ Continuar').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cancel_ticket').setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        content: `¿Estás seguro de abrir un ticket para **${choice.replace('_', ' ')}**?`,
        components: [confirmRow],
        ephemeral: true,
      });
    }

    // ✅ Confirmación o cancelación
    if (interaction.isButton()) {
      const user = interaction.user;
      const guild = interaction.guild;

      if (interaction.customId === 'cancel_ticket') {
        return interaction.update({ content: '❌ Cancelado.', components: [] });
      }

      if (interaction.customId === 'confirm_ticket') {
        const data = JSON.parse(fs.readFileSync(ticketFile));
        data.count++;
        fs.writeFileSync(ticketFile, JSON.stringify(data));

        // 🔧 Cambia estas IDs según tu servidor
        const categoryId = '1228437209628020736'; // Categoría de tickets
        const staffRole = '1229140504310972599';  // Rol del staff

        const channel = await guild.channels.create({
          name: `ticket-${user.username}-${data.count}`,
          type: 0, // Texto
          parent: categoryId,
          permissionOverwrites: [
            { id: guild.id, deny: ['ViewChannel'] },
            { id: user.id, allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'AddReactions'] },
            { id: staffRole, allow: ['ViewChannel', 'SendMessages', 'ManageMessages'] },
          ],
        });

        const embed = new EmbedBuilder()
          .setColor(0x00A86B)
          .setTitle(`🎟️ Ticket #${data.count}`)
          .setDescription(
            `👋 Hola ${user}, gracias por contactar al staff.\n\n` +
            "Por favor, describe tu problema o solicitud aquí.\n\n" +
            "Un miembro del staff te atenderá pronto.\n\n" +
            "Para cerrar este ticket, escribe **!cerrar**."
          )
          .setTimestamp()
          .setFooter({ text: 'Sistema de Tickets — SirgioBOT' });

        await channel.send({ embeds: [embed] });
        await interaction.update({ content: `✅ Ticket creado: ${channel}`, components: [] });
      }
    }
  });

  // 🛑 Cierre con comando !cerrar
  client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    if (msg.content.toLowerCase() === '!cerrar' && msg.channel.name.startsWith('ticket-')) {
      await msg.reply('🛑 Cerrando ticket en 5 segundos...');
      setTimeout(() => msg.channel.delete().catch(() => {}), 5000);
    }
  });
};
