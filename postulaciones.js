const { Client, GatewayIntentBits, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
});

const POSTULACIONES_CHANNEL_ID = '1435093988196618383';
const SUBMISSIONS_CHANNEL_ID = '1435091853308461179';
const STAFF_ROLE_ID = '1212891335929897030';

let postulacionesAbiertas = false;

const categories = {
  'tiktok_mod': 'TikTok MOD',
  'twitch_mod': 'Twitch MOD',
  'editor': 'Editor de Sirgio',
  'programador': 'Discord Programador',
  'helper': 'Helper'
};

const questions = {
  'tiktok_mod': [
    { id: 'username', label: '¿Cuál es tu nombre de usuario en TikTok actualmente?', style: TextInputStyle.Short },
    { id: 'why', label: '¿Por qué quieres ser moderador del canal de TikTok?', style: TextInputStyle.Paragraph },
    { id: 'experience', label: '¿Tienes experiencia moderando en TikTok o redes sociales?', style: TextInputStyle.Paragraph },
    { id: 'action', label: '¿Qué harías si ves un comentario ofensivo o spam?', style: TextInputStyle.Paragraph },
    { id: 'age', label: '¿Cuántos años tienes?', style: TextInputStyle.Short }
  ],
  'twitch_mod': [
    { id: 'username', label: '¿Cuál es tu usuario en Twitch y nombre real?', style: TextInputStyle.Short },
    { id: 'why', label: '¿Por qué quieres moderar los directos de Sirgio en Twitch?', style: TextInputStyle.Paragraph },
    { id: 'experience', label: '¿Tienes experiencia moderando en Twitch o en directo?', style: TextInputStyle.Paragraph },
    { id: 'action', label: '¿Cómo actuarías si un espectador insulta a otro?', style: TextInputStyle.Paragraph },
    { id: 'age', label: '¿Cuántos años tienes?', style: TextInputStyle.Short }
  ],
  'editor': [
    { id: 'name', label: '¿Cuál es tu nombre y/o alias?', style: TextInputStyle.Short },
    { id: 'programs', label: '¿Qué programa(s) de edición utilizas?', style: TextInputStyle.Short },
    { id: 'why', label: '¿Por qué te interesa editar contenido para Sirgio?', style: TextInputStyle.Paragraph },
    { id: 'project', label: 'Cuéntanos un proyecto de edición que hayas completado', style: TextInputStyle.Paragraph },
    { id: 'experience', label: '¿Cuál es tu experiencia editando videos/streams?', style: TextInputStyle.Paragraph }
  ],
  'programador': [
    { id: 'alias', label: '¿Cuál es tu alias y qué lenguajes/programas conoces?', style: TextInputStyle.Short },
    { id: 'experience', label: '¿Tienes experiencia desarrollando bots para Discord?', style: TextInputStyle.Paragraph },
    { id: 'why', label: '¿Por qué quieres programar para este servidor?', style: TextInputStyle.Paragraph },
    { id: 'bugs', label: '¿Cómo manejarías reporte de bugs o solicitudes?', style: TextInputStyle.Paragraph },
    { id: 'time', label: '¿Dispones de tiempo para mantenimiento regular del bot?', style: TextInputStyle.Paragraph }
  ],
  'helper': [
    { id: 'name', label: '¿Cuál es tu nombre/alias y cuánto tiempo llevas aquí?', style: TextInputStyle.Short },
    { id: 'why', label: '¿Por qué quieres ser Helper y qué te motiva?', style: TextInputStyle.Paragraph },
    { id: 'experience', label: '¿Tienes experiencia ayudando en Discord u otras comunidades?', style: TextInputStyle.Paragraph },
    { id: 'problem', label: '¿Cómo reaccionarías si no sabes resolver un problema?', style: TextInputStyle.Paragraph },
    { id: 'schedule', label: '¿En qué rangos horarios sueles estar conectado?', style: TextInputStyle.Short }
  ]
};

client.once('ready', async () => {
  console.log(`Bot conectado como ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('postular')
      .setDescription('Enviar una postulación para un rol del servidor')
      .addStringOption(option =>
        option.setName('categoria')
          .setDescription('Selecciona la categoría a la que deseas postularte')
          .setRequired(true)
          .addChoices(
            { name: 'TikTok MOD', value: 'tiktok_mod' },
            { name: 'Twitch MOD', value: 'twitch_mod' },
            { name: 'Editor de Sirgio', value: 'editor' },
            { name: 'Discord Programador', value: 'programador' },
            { name: 'Helper', value: 'helper' }
          )
      ),
    new SlashCommandBuilder()
      .setName('abrir_postulaciones')
      .setDescription('Abrir el sistema de postulaciones')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
      .setName('cerrar_postulaciones')
      .setDescription('Cerrar el sistema de postulaciones')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  ];

  try {
    console.log('Registrando comandos slash...');
    await client.application.commands.set(commands);
    console.log('Comandos registrados exitosamente!');
  } catch (error) {
    console.error('Error registrando comandos:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'abrir_postulaciones') {
      postulacionesAbiertas = true;
      console.log('✅ Postulaciones abiertas. Estado:', postulacionesAbiertas);
      await interaction.reply({ content: '✅ Las postulaciones han sido abiertas para todos los usuarios.', ephemeral: false });
    }

    if (commandName === 'cerrar_postulaciones') {
      postulacionesAbiertas = false;
      console.log('🔒 Postulaciones cerradas. Estado:', postulacionesAbiertas);
      await interaction.reply({ content: '🔒 Las postulaciones han sido cerradas.', ephemeral: false });
    }

    if (commandName === 'postular') {
      const hasStaffRole = interaction.member.roles.cache.has(STAFF_ROLE_ID);
      
      console.log(`Usuario ${interaction.user.tag} intentó postular. Postulaciones abiertas: ${postulacionesAbiertas}, Es staff: ${hasStaffRole}`);

      if (interaction.channelId !== POSTULACIONES_CHANNEL_ID) {
        return interaction.reply({ 
          content: `❌ Este comando solo puede ser usado en <#${POSTULACIONES_CHANNEL_ID}>`, 
          ephemeral: true 
        });
      }

      if (!postulacionesAbiertas && !hasStaffRole) {
        return interaction.reply({ 
          content: '❌ Las postulaciones están actualmente cerradas. Un administrador debe usar `/abrir_postulaciones` primero.', 
          ephemeral: true 
        });
      }

      const categoria = interaction.options.getString('categoria');
      const categoryName = categories[categoria];
      const categoryQuestions = questions[categoria];

      const modal = new ModalBuilder()
        .setCustomId(`postulacion|${categoria}|${interaction.user.id}`)
        .setTitle(`Postulación: ${categoryName}`);

      categoryQuestions.forEach((q, index) => {
        const input = new TextInputBuilder()
          .setCustomId(q.id)
          .setLabel(q.label)
          .setStyle(q.style)
          .setRequired(false);

        const actionRow = new ActionRowBuilder().addComponents(input);
        modal.addComponents(actionRow);
      });

      await interaction.showModal(modal);
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('postulacion|')) {
      const parts = interaction.customId.split('|');
      const categoria = parts[1];
      const userId = parts[2];
      const categoryName = categories[categoria];
      const categoryQuestions = questions[categoria];

      const responses = {};
      categoryQuestions.forEach(q => {
        responses[q.id] = interaction.fields.getTextInputValue(q.id) || 'No respondido';
      });

      const embed = new EmbedBuilder()
        .setTitle(`📋 Nueva Postulación: ${categoryName}`)
        .setColor(0x3498db)
        .setAuthor({ 
          name: interaction.user.tag, 
          iconURL: interaction.user.displayAvatarURL() 
        })
        .setDescription(`**Usuario:** <@${interaction.user.id}>\n**ID:** ${interaction.user.id}`)
        .setTimestamp();

      categoryQuestions.forEach(q => {
        embed.addFields({ name: q.label, value: responses[q.id], inline: false });
      });

      const acceptButton = new ButtonBuilder()
        .setCustomId(`accept|${categoria}|${interaction.user.id}`)
        .setLabel('✅ Aceptar')
        .setStyle(ButtonStyle.Success);

      const rejectButton = new ButtonBuilder()
        .setCustomId(`reject|${categoria}|${interaction.user.id}`)
        .setLabel('❌ Rechazar')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(acceptButton, rejectButton);

      const submissionsChannel = await client.channels.fetch(SUBMISSIONS_CHANNEL_ID);
      await submissionsChannel.send({ embeds: [embed], components: [row] });

      await interaction.reply({ 
        content: '✅ Tu postulación ha sido enviada correctamente. Recibirás una respuesta por mensaje directo.', 
        ephemeral: true 
      });
    }

    if (interaction.customId.startsWith('message|')) {
      const parts = interaction.customId.split('|');
      const action = parts[1];
      const categoria = parts[2];
      const userId = parts[3];
      const staffMessage = interaction.fields.getTextInputValue('staff_message');
      const categoryName = categories[categoria];

      try {
        const user = await client.users.fetch(userId);
        
        if (action === 'accept') {
          const acceptEmbed = new EmbedBuilder()
            .setTitle('🎉 ¡Postulación Aprobada!')
            .setColor(0x2ecc71)
            .setDescription(`Hola ${user.username} 🎉\n\n¡Tu solicitud para el rol de **${categoryName}** ha sido aprobada!`)
            .addFields({ name: '📝 Carta del Staff:', value: staffMessage || 'Sin mensaje adicional' })
            .setTimestamp();

          await user.send({ embeds: [acceptEmbed] });
        } else {
          const rejectEmbed = new EmbedBuilder()
            .setTitle('Postulación No Aprobada')
            .setColor(0xe74c3c)
            .setDescription(
              `Hola ${user.username}\n\n` +
              `Gracias por tu interés en el rol de **${categoryName}**. Lamentablemente, después de revisar tu solicitud, hemos decidido no aprobarla en esta ocasión.\n\n` +
              `Queremos que sepas que la decisión no refleja una falta de valor, sino que hemos tenido muchas candidaturas y hemos optado por perfiles que se ajustan mejor al momento.\n\n` +
              `Te animamos a que vuelvas a intentarlo en el futuro.\n` +
              `Si deseas, podemos darte feedback adicional; solo háznoslo saber.\n` +
              `¡Gracias por tu tiempo y esperamos verte activo/a en la comunidad!`
            )
            .addFields({ name: '📝 Mensaje del Staff:', value: staffMessage || 'Sin mensaje adicional' })
            .setTimestamp();

          await user.send({ embeds: [rejectEmbed] });
        }

        await interaction.update({ 
          content: `✅ ${action === 'accept' ? 'Postulación aceptada' : 'Postulación rechazada'} y mensaje enviado a <@${userId}>`,
          embeds: interaction.message.embeds,
          components: [] 
        });

      } catch (error) {
        console.error('Error enviando DM:', error);
        await interaction.reply({ 
          content: '❌ No se pudo enviar el mensaje al usuario. Es posible que tenga los DMs cerrados.', 
          ephemeral: true 
        });
      }
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('accept|') || interaction.customId.startsWith('reject|')) {
      const parts = interaction.customId.split('|');
      const action = parts[0];
      const categoria = parts[1];
      const userId = parts[2];
      const categoryName = categories[categoria];

      const modal = new ModalBuilder()
        .setCustomId(`message|${action}|${categoria}|${userId}`)
        .setTitle(`Mensaje para ${action === 'accept' ? 'Aceptar' : 'Rechazar'}`);

      const messageInput = new TextInputBuilder()
        .setCustomId('staff_message')
        .setLabel('Mensaje del Staff para el postulante')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Escribe un mensaje personalizado para el postulante...')
        .setRequired(true);

      const actionRow = new ActionRowBuilder().addComponents(messageInput);
      modal.addComponents(actionRow);

      await interaction.showModal(modal);
    }
  }
});

