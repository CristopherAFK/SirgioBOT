const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Envía el panel del sistema de tickets'),

  async execute(interaction) {
    // 🔒 ID del rol STAFF que puede usar el comando
    const STAFF_ROLE_ID = '1229140504310972599'; 

    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: '❌ Solo el staff puede usar este comando.', ephemeral: true });
    }

    const iconUrl = "https://media.discordapp.net/attachments/1420914042251509990/1430698897927307347/79794618.png";
    const greenColor = 0x00A86B;

    const embed = new EmbedBuilder()
      .setColor(greenColor)
      .setTitle('🎟️ Sistema de Tickets')
      .setThumbnail(iconUrl)
      .setDescription(
        "> ¿Tienes dudas, problemas o necesitas contactar al staff?\n" +
        "> Abre un ticket según el tipo de ayuda que necesites.\n\n" +
        "⚠️ **No abras tickets innecesarios ni los uses para bromear.** El mal uso puede resultar en sanciones."
      );

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_menu')
      .setPlaceholder('🎫 Selecciona una categoría...')
      .addOptions([
        { label: 'Discord Bots', emoji: '🤖', value: 'discord_bots' },
        { label: 'Reportar usuario', emoji: '⚠️', value: 'report_user' },
        { label: 'Streams', emoji: '🎥', value: 'streams' },
        { label: 'Lives', emoji: '📱', value: 'lives' },
        { label: 'Dudas', emoji: '❓', value: 'dudas' },
        { label: 'Otros', emoji: '🟢', value: 'otros' },
      ]);

    const row = new ActionRowBuilder().addComponents(menu);
    await interaction.reply({ embeds: [embed], components: [row] });
  },
};
