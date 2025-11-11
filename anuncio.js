const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anuncio')
    .setDescription('Envía un anuncio como mensaje normal para generar vista previa')
    .addChannelOption(option =>
      option
        .setName('canal')
        .setDescription('Canal donde se enviará el anuncio')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .addStringOption(option =>
      option
        .setName('mensaje')
        .setDescription('Contenido del anuncio (puede incluir links)')
        .setRequired(true)),
  async execute(interaction) {
    const staffRoleId = '1230949715127042098';

    // Permiso solo para staff
    if (!interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', ephemeral: true });
    }

    const canal = interaction.options.getChannel('canal');
    const mensaje = interaction.options.getString('mensaje');

    try {
      // Envía como mensaje simple
      await canal.send(mensaje);

      await interaction.reply({
        content: `✅ Anuncio enviado correctamente a ${canal}`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Error enviando anuncio:', error);
      await interaction.reply({
        content: '❌ Ocurrió un error al enviar el anuncio.',
        ephemeral: true
      });
    }
  },
};