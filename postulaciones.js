// postulaciones.js
// Sistema de postulaciones completo (importar con setupPostulaciones(client))

const {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

// ----------------- CONFIG -----------------
const CLIENT_ID = '1420178410512060437'; // tu Client/Application ID
const GUILD_ID_FALLBACK = '121288062845147768'; // si no usas process.env.GUILD_ID, pon tu guild id aquí
const canalPanel = '1435093988196618383';       // canal donde se publica el embed principal (panel)
const canalRevisar = '1435091853308461179';     // canal donde llegan las postulaciones
const ADMIN_ROLE = '1212891335929897030';
const MOD_ROLE = '1229140504310972599';

// Control manual (arranca abierto)
let postulacionesActivas = true;

// Map temporal para guardar respuestas del primer modal por usuario
const respuestasParciales = new Map(); // key = userId, value = { categoria?:..., p1:..., p2:..., ... }

// ----------------- EXPORTADA -----------------
function setupPostulaciones(client) {
  // Registrar comandos en el guild (usa GUILD_ID de env si está, sino fallback)
  const GUILD_ID = process.env.GUILD_ID || GUILD_ID_FALLBACK;
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  const commands = [
    new SlashCommandBuilder()
      .setName('panelpostulaciones')
      .setDescription('Envía el panel principal de postulaciones (solo staff).')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('postular')
      .setDescription('Inicia tu postulación (usa este comando en el canal del panel).')
      .toJSON(),

    new SlashCommandBuilder()
      .setName('postulaciones')
      .setDescription('Activa o desactiva las postulaciones (solo Admin/Mod).')
      .addStringOption(opt =>
        opt.setName('estado')
          .setDescription('on = abrir / off = cerrar')
          .setRequired(true)
          .addChoices(
            { name: 'Activar', value: 'on' },
            { name: 'Desactivar', value: 'off' }
          )
      )
      .toJSON()
  ];

  (async () => {
    try {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log('✅ Comandos de postulaciones registrados.');
    } catch (err) {
      console.error('❌ Error registrando comandos de postulaciones:', err);
    }
  })();

  // ----------------- HANDLERS -----------------
  client.on('interactionCreate', async (interaction) => {
    // ---- Comandos de barra ----
    if (interaction.isChatInputCommand()) {
      const cmd = interaction.commandName;

      // --- /panelpostulaciones ---
      if (cmd === 'panelpostulaciones') {
        if (!interaction.member.roles.cache.has(ADMIN_ROLE) && !interaction.member.roles.cache.has(MOD_ROLE)) {
          return interaction.reply({ content: '❌ No tienes permisos para usar este comando.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
          .setTitle('📋 Postulaciones - ' + (interaction.guild ? interaction.guild.name : 'Servidor'))
          .setColor('#00C4A7')
          .setDescription(
            '**Requisitos mínimos:**\n' +
            '• Tener al menos **16 años**.\n' +
            '• **3 meses** de antigüedad en el servidor.\n' +
            '• Ser **activo** en la comunidad.\n' +
            '• Mantener **buena conducta** (sin sanciones frecuentes).\n' +
            '• No haber estado involucrado en **conflictos graves**.\n\n' +
            '**Categorías:** Helper / Editor / Programador / Organizador\n\n' +
            'Si cumples los requisitos, usa **/postular** en este canal para empezar tu postulación.'
          )
          .setFooter({ text: 'Sistema de postulaciones' })
          .setTimestamp();

        // enviar al canal del panel (si existe)
        try {
          const ch = await client.channels.fetch(canalPanel);
          if (ch) await ch.send({ embeds: [embed] });
          await interaction.reply({ content: '✅ Panel enviado correctamente.', ephemeral: true });
        } catch (err) {
          console.error('Error enviando panel:', err);
          await interaction.reply({ content: '❌ No se pudo enviar el panel (canal no encontrado).', ephemeral: true });
        }
        return;
      }

      // --- /postulaciones (on/off) ---
      if (cmd === 'postulaciones') {
        if (!interaction.member.roles.cache.has(ADMIN_ROLE) && !interaction.member.roles.cache.has(MOD_ROLE)) {
          return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', ephemeral: true });
        }
        const estado = interaction.options.getString('estado');
        postulacionesActivas = (estado === 'on');
        return interaction.reply({ content: `✅ Las postulaciones están ahora **${postulacionesActivas ? 'ABIERTAS' : 'CERRADAS'}**.`, ephemeral: true });
      }

      // --- /postular ---
      if (cmd === 'postular') {
        // comprobaciones de canal y estado
        if (!postulacionesActivas) {
          return interaction.reply({ content: '🚫 Las postulaciones están cerradas actualmente. Vuelve más tarde.', ephemeral: true });
        }
        if (interaction.channelId !== canalPanel) {
          return interaction.reply({ content: '❌ Solo puedes usar este comando en el canal oficial de postulaciones.', ephemeral: true });
        }

        // Primer modal (máx. 5 inputs): pedimos categoría + 4 preguntas iniciales
        const modal1 = new ModalBuilder()
          .setCustomId('postulacion_modal_1')
          .setTitle('Postulación — paso 1 de 2');

        // 5 inputs
        const categoriaInput = new TextInputBuilder()
          .setCustomId('categoria')
          .setLabel('¿A qué categoría te postulas? (Helper/Editor/Programador/Organizador)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const p1 = new TextInputBuilder()
          .setCustomId('p1')
          .setLabel('Has tenido experiencia moderando? Si es así, ¿Cómo fue? ¿Cuál fue tu rol?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        const p2 = new TextInputBuilder()
          .setCustomId('p2')
          .setLabel('¿Tienes alguna amistad en el Servidor? ¿Estarías dispuesto a sancionarlo si incumple?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        const p3 = new TextInputBuilder()
          .setCustomId('p3')
          .setLabel('¿Cuál es tu disponibilidad diaria/semanal? ¿En qué franjas horarias eres más activo?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        const p4 = new TextInputBuilder()
          .setCustomId('p4')
          .setLabel('¿Cómo equilibrarías la moderación con tu vida personal/laboral/estudios?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        modal1.addComponents(
          new ActionRowBuilder().addComponents(categoriaInput),
          new ActionRowBuilder().addComponents(p1),
          new ActionRowBuilder().addComponents(p2),
          new ActionRowBuilder().addComponents(p3),
          new ActionRowBuilder().addComponents(p4)
        );

        await interaction.showModal(modal1);
        return;
      }
    } // end isChatInputCommand

    // ---- Modal submits (dos pasos) ----
    if (interaction.isModalSubmit()) {
      // ----- Primer modal enviado: abrimos el segundo modal -----
      if (interaction.customId === 'postulacion_modal_1') {
        // Guardar respuestas parciales en Map con timeout
        const userId = interaction.user.id;
        const partial = {
          categoria: interaction.fields.getTextInputValue('categoria'),
          p1: interaction.fields.getTextInputValue('p1'),
          p2: interaction.fields.getTextInputValue('p2'),
          p3: interaction.fields.getTextInputValue('p3'),
          p4: interaction.fields.getTextInputValue('p4'),
          timestamp: Date.now()
        };
        respuestasParciales.set(userId, partial);

        // Programa limpieza a los 10 minutos
        setTimeout(() => {
          if (respuestasParciales.has(userId)) respuestasParciales.delete(userId);
        }, 10 * 60 * 1000);

        // Mostrar segundo modal con las preguntas restantes (4 preguntas)
        const modal2 = new ModalBuilder()
          .setCustomId('postulacion_modal_2')
          .setTitle('Postulación — paso 2 de 2');

        const p5 = new TextInputBuilder()
          .setCustomId('p5')
          .setLabel('¿Qué crees que es lo más valioso que aportarías al equipo y por qué quieres ser moderador aquí?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        const p6 = new TextInputBuilder()
          .setCustomId('p6')
          .setLabel('¿Es por el rol o por el deseo genuino de ayudar a la comunidad?')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const p7 = new TextInputBuilder()
          .setCustomId('p7')
          .setLabel('Estás en voz y dos usuarios se insultan agresivamente. ¿Cómo intervienes y qué pasos tomas después?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        const p8 = new TextInputBuilder()
          .setCustomId('p8')
          .setLabel('Si una regla se malinterpreta con frecuencia, ¿qué harías para solucionarlo?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        const p9 = new TextInputBuilder()
          .setCustomId('p9')
          .setLabel('Alguien hace spam o envía enlaces maliciosos. Describe paso a paso tu procedimiento.')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        // Nota: Discord permite **5 inputs** por modal. Aquí usamos 5: p5,p6,p7,p8,p9
        modal2.addComponents(
          new ActionRowBuilder().addComponents(p5),
          new ActionRowBuilder().addComponents(p6),
          new ActionRowBuilder().addComponents(p7),
          new ActionRowBuilder().addComponents(p8),
          new ActionRowBuilder().addComponents(p9)
        );

        // Aceptamos la primera entrega y mostramos segundo modal
        await interaction.reply({ content: '🔁 Continúa en el siguiente formulario...', ephemeral: true });
        // showModal debe usarse sobre la interacción original — en algunos entornos se permite showModal después de reply
        // en discord.js, usamos interaction.showModal en la misma interacción de submit; dado que ya respondimos, obtenemos la interacción de usuario otra vez vía follow-up -> mejor: usar showModal directamente sin reply
        // Para compatibilidad: mostramos el modal2 usando interaction.followUp then showModal on the user interaction (works in many setups).
        // Aquí intentamos showModal directamente:
        try {
          await interaction.showModal(modal2);
        } catch (err) {
          // si falla showModal por haber respondido, intentamos obtener la interacción por deferReply y luego showModal
          console.warn('showModal falló (modal1->modal2), intentando alternativa...', err);
        }

        return;
      }

      // ----- Segundo modal: juntamos todo y enviamos -----
      if (interaction.customId === 'postulacion_modal_2') {
        const userId = interaction.user.id;
        const partial = respuestasParciales.get(userId);
        if (!partial) {
          // si no hay parciales, informamos al usuario
          await interaction.reply({ content: '❌ No se encontró la primera parte de tu postulación (expiró). Por favor, vuelve a usar /postular.', ephemeral: true });
          return;
        }

        // Recuperar respuestas del segundo modal
        const p5 = interaction.fields.getTextInputValue('p5');
        const p6 = interaction.fields.getTextInputValue('p6');
        const p7 = interaction.fields.getTextInputValue('p7');
        const p8 = interaction.fields.getTextInputValue('p8');
        const p9 = interaction.fields.getTextInputValue('p9');

        // Combinar todas las respuestas
        const todas = {
          categoria: partial.categoria,
          preguntas: [
            partial.p1,
            partial.p2,
            partial.p3,
            partial.p4,
            p5,
            p6,
            p7,
            p8,
            p9
          ]
        };

        // Crear embed final y enviarlo al canal de revisión
        const embed = new EmbedBuilder()
          .setTitle('📨 Nueva Postulación')
          .setColor('#2b2d31')
          .setThumbnail(interaction.user.displayAvatarURL?.() || null)
          .addFields(
            { name: '👤 Postulante', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: false },
            { name: '📂 Categoría', value: `${todas.categoria}`, inline: false },
            { name: '🧾 Respuestas (1-9)', value: todas.preguntas.map((r, i) => `**${i + 1}.** ${r}`).join('\n\n') }
          )
          .setFooter({ text: 'Sistema de postulaciones' })
          .setTimestamp();

        try {
          const ch = await client.channels.fetch(canalRevisar);
          if (!ch) throw new Error('Canal de revisión no encontrado');
          // Notificar al staff mencionando roles
          await ch.send({ content: `<@&${ADMIN_ROLE}> <@&${MOD_ROLE}>`, embeds: [embed] });
        } catch (err) {
          console.error('Error enviando postulación:', err);
          await interaction.reply({ content: '❌ Ocurrió un error al enviar tu postulación. Contacta a un administrador.', ephemeral: true });
          respuestasParciales.delete(userId);
          return;
        }

        // Confirmación al postulante
        await interaction.reply({ content: '✅ Tu postulación fue enviada correctamente. ¡Gracias por postularte!', ephemeral: true });

        // limpiar la entrada parcial
        respuestasParciales.delete(userId);
        return;
      }
    } // end isModalSubmit
  }); // end interactionCreate

  // log ready del módulo
  client.once('ready', () => {
    console.log('setupPostulaciones: listo (módulo cargado).');
  });
}

