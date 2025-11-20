const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

// IDs de canales y rol
const canalSugerencias = '1440873532580954112';
const canalStaff = '1435091853308461179';
const rolStaff = '1230949715127042098';

module.exports = (client) => {
  // =========================
  // REGISTRAR COMANDO /sugerir
  // =========================
  const command = {
    data: new SlashCommandBuilder()
      .setName('sugerir')
      .setDescription('Envía una sugerencia al servidor')
      .addStringOption(option =>
        option.setName('contenido')
          .setDescription('Escribe tu sugerencia')
          .setRequired(true)
      ),
    async execute(interaction) {
      const contenido = interaction.options.getString('contenido');

      // Embed de la sugerencia
      const embed = new EmbedBuilder()
        .setTitle('📬 Nueva Sugerencia')
        .setDescription(contenido)
        .setFooter({ text: `Enviada por ${interaction.user.tag}` })
        .setTimestamp()
        .setColor('Blue');

      // Enviar al canal de sugerencias
      const mensaje = await interaction.client.channels.cache.get(canalSugerencias).send({ embeds: [embed] });
      await mensaje.react('👍');
      await mensaje.react('👎');

      await interaction.reply({ content: '✅ ¡Tu sugerencia ha sido enviada!', ephemeral: true });

      // Botones para el staff
      const botones = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`aprobar_${mensaje.id}`)
          .setLabel('Aprobar')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`rechazar_${mensaje.id}`)
          .setLabel('Rechazar')
          .setStyle(ButtonStyle.Danger)
      );

      // Enviar al canal del staff
      await interaction.client.channels.cache.get(canalStaff).send({
        content: `📥 Nueva sugerencia enviada por <@${interaction.user.id}>`,
        embeds: [embed],
        components: [botones]
      });
    }
  };

  // Registrar el comando en la colección
  client.commands.set(command.data.name, command);

  // =========================
  // MANEJAR BOTONES Y MODALES
  // =========================
  client.on('interactionCreate', async interaction => {
    // BOTONES
    if (interaction.isButton()) {
      const [accion, mensajeId] = interaction.customId.split('_');
      if (!interaction.member.roles.cache.has(rolStaff)) {
        return interaction.reply({ content: '⛔ Solo el Staff puede usar estos botones.', ephemeral: true });
      }

      const modal = new ModalBuilder()
        .setCustomId(`modal_${accion}_${mensajeId}`)
        .setTitle(`${accion === 'aprobar' ? 'Aprobación' : 'Rechazo'} de sugerencia`);

      const razonInput = new TextInputBuilder()
        .setCustomId('razon')
        .setLabel('Razón de la decisión')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(razonInput);
      modal.addComponents(row);
      await interaction.showModal(modal);
    }

    // MODALES
    if (interaction.isModalSubmit()) {
      const [_, accion, mensajeId] = interaction.customId.split('_');
      const razon = interaction.fields.getTextInputValue('razon');

      const mensajeOriginal = await interaction.client.channels.cache.get(canalSugerencias).messages.fetch(mensajeId);
      const embedOriginal = mensajeOriginal.embeds[0];

      const embedRespuesta = EmbedBuilder.from(embedOriginal)
        .setColor(accion === 'aprobar' ? 'Green' : 'Red')
        .addFields({
          name: accion === 'aprobar' ? '✅ Aprobada por el Staff' : '🚫 Rechazada por el Staff',
          value: razon
        });

      await mensajeOriginal.edit({ embeds: [embedRespuesta] });
      await interaction.reply({ content: `✅ Sugerencia ${accion}da con razón: ${razon}`, ephemeral: true });
    }
  });
};
