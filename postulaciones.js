const fs = require('fs');
const path = require('path');
const { 
  SlashCommandBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionFlagsBits 
} = require('discord.js');

const POSTULACIONES_CHANNEL_ID = '1435093988196618383';
const SUBMISSIONS_CHANNEL_ID = '1435091853308461179';
const STAFF_ROLE_ID = '1212891335929897030';
const STATUS_FILE = path.join(__dirname, 'postulaciones_status.json');

let postulacionesAbiertas = false;

function loadStatus() {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
      postulacionesAbiertas = data.open || false;
    }
  } catch (e) {
    console.error('Error cargando estado de postulaciones:', e);
  }
}

function saveStatus() {
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify({ open: postulacionesAbiertas }, null, 2));
  } catch (e) {
    console.error('Error guardando estado de postulaciones:', e);
  }
}

loadStatus();

const categories = {
  'tiktok_mod': 'TikTok MOD',
  'twitch_mod': 'Twitch MOD',
  'editor': 'Editor de Sirgio',
  'programador': 'Discord Programador',
  'helper': 'Helper'
};

const questions = {
  'tiktok_mod': [
    { id: 'username', label: 'Tu usuario actual en TikTok', style: TextInputStyle.Short },
    { id: 'why', label: '¿Por qué quieres ser mod en TikTok?', style: TextInputStyle.Paragraph },
    { id: 'experience', label: '¿Tienes experiencia moderando redes?', style: TextInputStyle.Paragraph },
    { id: 'action', label: '¿Qué harías ante comentarios ofensivos?', style: TextInputStyle.Paragraph },
    { id: 'age', label: '¿Cuántos años tienes?', style: TextInputStyle.Short }
  ],
  'twitch_mod': [
    { id: 'username', label: 'Tu usuario en Twitch y nombre real', style: TextInputStyle.Short },
    { id: 'why', label: '¿Por qué quieres moderar en Twitch?', style: TextInputStyle.Paragraph },
    { id: 'experience', label: '¿Tienes experiencia moderando en directo?', style: TextInputStyle.Paragraph },
    { id: 'action', label: '¿Qué harías si un espectador insulta a otro?', style: TextInputStyle.Paragraph },
    { id: 'age', label: '¿Cuántos años tienes?', style: TextInputStyle.Short }
  ],
  'editor': [
    { id: 'name', label: 'Tu nombre o alias', style: TextInputStyle.Short },
    { id: 'programs', label: 'Programa(s) de edición que usas', style: TextInputStyle.Short },
    { id: 'why', label: '¿Por qué quieres editar para Sirgio?', style: TextInputStyle.Paragraph },
    { id: 'project', label: 'Describe un proyecto de edición tuyo', style: TextInputStyle.Paragraph },
    { id: 'experience', label: 'Tu experiencia editando videos', style: TextInputStyle.Paragraph }
  ],
  'programador': [
    { id: 'alias', label: 'Tu alias y lenguajes que conoces', style: TextInputStyle.Short },
    { id: 'experience', label: '¿Has hecho bots o proyectos de Discord?', style: TextInputStyle.Paragraph },
    { id: 'why', label: '¿Por qué quieres programar aquí?', style: TextInputStyle.Paragraph },
    { id: 'bugs', label: '¿Cómo manejas bugs o solicitudes?', style: TextInputStyle.Paragraph },
    { id: 'time', label: '¿Tienes tiempo para mantenimiento del bot?', style: TextInputStyle.Paragraph }
  ],
  'helper': [
    { id: 'name', label: 'Tu nombre o alias y tiempo aquí', style: TextInputStyle.Short },
    { id: 'why', label: '¿Por qué quieres ser Helper?', style: TextInputStyle.Paragraph },
    { id: 'experience', label: '¿Has ayudado en otras comunidades?', style: TextInputStyle.Paragraph },
    { id: 'problem', label: '¿Qué haces si no sabes resolver algo?', style: TextInputStyle.Paragraph },
    { id: 'schedule', label: '¿En qué horario estás activo?', style: TextInputStyle.Short }
  ]
};

module.exports = (client) => {

  client.once('ready', async () => {
    console.log(`✅ Sistema de Postulaciones listo (Estado: ${postulacionesAbiertas ? 'ABIERTAS' : 'CERRADAS'})`);

    const GUILD_ID = "1212886282645147768";

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
        .setDescription('Abrir el sistema de postulaciones (Staff)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
      new SlashCommandBuilder()
        .setName('cerrar_postulaciones')
        .setDescription('Cerrar el sistema de postulaciones (Staff)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
      new SlashCommandBuilder()
        .setName('estado_postulaciones')
        .setDescription('Ver el estado actual de las postulaciones')
    ];

    try {
      for (const command of commands) {
        await client.application.commands.create(command.toJSON(), GUILD_ID);
      }
      console.log('🟢 Comandos de postulaciones registrados');
    } catch (error) {
      console.error('Error registrando comandos de postulaciones:', error);
    }
  });

  client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === 'abrir_postulaciones') {
        const member = interaction.member;
        const hasStaffRole = member.roles.cache.has(STAFF_ROLE_ID) || member.permissions.has(PermissionFlagsBits.Administrator);
        
        if (!hasStaffRole) {
          return interaction.reply({ content: '❌ No tienes permisos para usar este comando.', ephemeral: true });
        }

        postulacionesAbiertas = true;
        saveStatus();

        const embed = new EmbedBuilder()
          .setTitle('📋 Postulaciones Abiertas')
          .setDescription('Las postulaciones han sido **abiertas**.\n\nLos usuarios ahora pueden postularse usando el comando `/postular`.')
          .setColor(0x00ff00)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'cerrar_postulaciones') {
        const member = interaction.member;
        const hasStaffRole = member.roles.cache.has(STAFF_ROLE_ID) || member.permissions.has(PermissionFlagsBits.Administrator);
        
        if (!hasStaffRole) {
          return interaction.reply({ content: '❌ No tienes permisos para usar este comando.', ephemeral: true });
        }

        postulacionesAbiertas = false;
        saveStatus();

        const embed = new EmbedBuilder()
          .setTitle('🔒 Postulaciones Cerradas')
          .setDescription('Las postulaciones han sido **cerradas**.\n\nLos usuarios ya no pueden postularse hasta que se vuelvan a abrir.')
          .setColor(0xff0000)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'estado_postulaciones') {
        const embed = new EmbedBuilder()
          .setTitle('📊 Estado de Postulaciones')
          .setDescription(`Las postulaciones están actualmente: **${postulacionesAbiertas ? '✅ ABIERTAS' : '🔒 CERRADAS'}**`)
          .setColor(postulacionesAbiertas ? 0x00ff00 : 0xff0000)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (commandName === 'postular') {
        const hasStaffRole = interaction.member.roles.cache.has(STAFF_ROLE_ID);

        if (interaction.channelId !== POSTULACIONES_CHANNEL_ID) {
          return interaction.reply({ 
            content: `❌ Este comando solo puede usarse en <#${POSTULACIONES_CHANNEL_ID}>`, 
            ephemeral: true 
          });
        }

        if (!postulacionesAbiertas && !hasStaffRole) {
          return interaction.reply({ 
            content: '❌ Las postulaciones están actualmente cerradas. Espera a que se anuncie la apertura.', 
            ephemeral: true 
          });
        }

        const categoria = interaction.options.getString('categoria');
        const categoryName = categories[categoria];
        const categoryQuestions = questions[categoria];

        const modal = new ModalBuilder()
          .setCustomId(`postulacion|${categoria}|${interaction.user.id}`)
          .setTitle(`Postulación: ${categoryName}`);

        categoryQuestions.forEach(q => {
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

        try {
          const submissionsChannel = await client.channels.fetch(SUBMISSIONS_CHANNEL_ID);
          await submissionsChannel.send({ embeds: [embed], components: [row] });

          await interaction.reply({ 
            content: '✅ Tu postulación ha sido enviada correctamente. Recibirás una respuesta por mensaje directo.', 
            ephemeral: true 
          });
        } catch (error) {
          console.error('Error enviando postulación:', error);
          await interaction.reply({ 
            content: '❌ Error al enviar la postulación. Intenta de nuevo más tarde.', 
            ephemeral: true 
          });
        }
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
          .setLabel('Mensaje del Staff')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Escribe un mensaje personalizado...')
          .setRequired(true);

        const actionRow = new ActionRowBuilder().addComponents(messageInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
      }
    }
  });
};
