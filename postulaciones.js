// =========================
// SirgioBOT - Sistema de Postulaciones
// =========================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const fs = require('fs');

// =========================
// CONFIG
// =========================
const CANAL_POSTULACIONES = '1435091853308461179';
const CANAL_COMANDOS = '1435093988196618383';
const STAFF_ROLES = ['1212891335929897030', '1229140504310972599'];

// Archivo donde se guarda el estado de las postulaciones
const STATE_FILE = './postulaciones_estado.json';

// =========================
// Estado global de postulaciones
// =========================
function obtenerEstado() {
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    const json = JSON.parse(data);
    return json.abiertas;
  } catch {
    return false;
  }
}

function guardarEstado(abiertas) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ abiertas }, null, 2));
}

// =========================
// EXPORTAR COMANDOS
// =========================
module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isButton() && !interaction.isModalSubmit()) return;

    // =========================
    // /postular
    // =========================
    if (interaction.commandName === 'postular') {
      if (interaction.channel.id !== CANAL_COMANDOS) {
        return interaction.reply({
          content: `❌ Este comando solo puede usarse en <#${CANAL_COMANDOS}>.`,
          ephemeral: true,
        });
      }

      const postulacionesAbiertas = obtenerEstado();
      const tieneRolStaff = STAFF_ROLES.some((id) => interaction.member.roles.cache.has(id));

      // Si las postulaciones están cerradas y no es staff
      if (!postulacionesAbiertas && !tieneRolStaff) {
        return interaction.reply({
          content: '🚫 Las postulaciones están cerradas actualmente. Espera a que se abran nuevamente.',
          ephemeral: true,
        });
      }

      const categoria = interaction.options.getString('categoria');
      let modal;

      // Modal dinámico según categoría
      const preguntasComunes = [
        {
          id: 'experiencia',
          label: '¿Tienes experiencia en esta área?',
          placeholder: 'Describe brevemente tu experiencia (opcional)',
        },
        {
          id: 'disponibilidad',
          label: '¿Cuánto tiempo puedes dedicar al rol?',
          placeholder: 'Por ejemplo: 2 horas al día, fines de semana, etc.',
        },
        {
          id: 'motivacion',
          label: 'Motivo por el cual quieres unirte al equipo',
          placeholder: 'Explica por qué te gustaría formar parte del equipo (opcional)',
        },
      ];

      if (categoria === 'twitch') {
        modal = new ModalBuilder()
          .setCustomId('post_twitch')
          .setTitle('Postulación - Twitch MOD');
      } else if (categoria === 'tiktok') {
        modal = new ModalBuilder()
          .setCustomId('post_tiktok')
          .setTitle('Postulación - Tiktok MOD');
      } else if (categoria === 'programador') {
        modal = new ModalBuilder()
          .setCustomId('post_programador')
          .setTitle('Postulación - Programador Discord');
      } else if (categoria === 'editor') {
        modal = new ModalBuilder()
          .setCustomId('post_editor')
          .setTitle('Postulación - Editor');
      } else if (categoria === 'helper') {
        modal = new ModalBuilder()
          .setCustomId('post_helper')
          .setTitle('Postulación - Discord Helper');
      }

      if (!modal) return interaction.reply({ content: '❌ Categoría no válida.', ephemeral: true });

      // Crear inputs
      const inputs = preguntasComunes.map((q) =>
        new TextInputBuilder()
          .setCustomId(q.id)
          .setLabel(q.label)
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder(q.placeholder)
          .setRequired(false)
      );

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputs[0]),
        new ActionRowBuilder().addComponents(inputs[1]),
        new ActionRowBuilder().addComponents(inputs[2])
      );

      await interaction.showModal(modal);
    }

    // =========================
    // /abrirpostulaciones
    // =========================
    if (interaction.commandName === 'abrirpostulaciones') {
      if (!STAFF_ROLES.some((id) => interaction.member.roles.cache.has(id))) {
        return interaction.reply({ content: '🚫 No tienes permisos para usar este comando.', ephemeral: true });
      }

      guardarEstado(true);
      return interaction.reply({ content: '✅ Las postulaciones han sido **abiertas**.', ephemeral: false });
    }

    // =========================
    // /cerrarpostulaciones
    // =========================
    if (interaction.commandName === 'cerrarpostulaciones') {
      if (!STAFF_ROLES.some((id) => interaction.member.roles.cache.has(id))) {
        return interaction.reply({ content: '🚫 No tienes permisos para usar este comando.', ephemeral: true });
      }

      guardarEstado(false);
      return interaction.reply({ content: '🔒 Las postulaciones han sido **cerradas**.', ephemeral: false });
    }

    // =========================
    // Modal Enviado
    // =========================
    if (interaction.isModalSubmit()) {
      if (!interaction.customId.startsWith('post_')) return;

      const categoria = interaction.customId.split('_')[1];
      const experiencia = interaction.fields.getTextInputValue('experiencia') || 'No respondió';
      const disponibilidad = interaction.fields.getTextInputValue('disponibilidad') || 'No respondió';
      const motivacion = interaction.fields.getTextInputValue('motivacion') || 'No respondió';

      const embed = new EmbedBuilder()
        .setTitle(`📋 Nueva Postulación (${categoria.toUpperCase()})`)
        .setDescription(`**Usuario:** ${interaction.user.tag}\n**ID:** ${interaction.user.id}`)
        .addFields(
          { name: 'Experiencia', value: experiencia },
          { name: 'Disponibilidad', value: disponibilidad },
          { name: 'Motivo', value: motivacion }
        )
        .setColor('Blurple')
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`aceptar_${interaction.user.id}`).setLabel('✅ Aceptar').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`rechazar_${interaction.user.id}`).setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger)
      );

      const canal = interaction.guild.channels.cache.get(CANAL_POSTULACIONES);
      if (canal) await canal.send({ embeds: [embed], components: [row] });

      await interaction.reply({ content: '✅ Tu postulación ha sido enviada correctamente.', ephemeral: true });
    }

    // =========================
    // Aceptar/Rechazar botones
    // =========================
    if (interaction.isButton()) {
      const [accion, userId] = interaction.customId.split('_');
      const mensaje = interaction.message;

      // Verificar permisos
      if (!STAFF_ROLES.some((id) => interaction.member.roles.cache.has(id))) {
        return interaction.reply({ content: '🚫 No tienes permisos para gestionar postulaciones.', ephemeral: true });
      }

      // Evitar múltiples respuestas
      if (mensaje.embeds[0].footer?.text?.includes('gestionada')) {
        return interaction.reply({
          content: '⚠️ Esta postulación ya fue gestionada por otro miembro del staff.',
          ephemeral: true,
        });
      }

      const embed = EmbedBuilder.from(mensaje.embeds[0]);
      const usuario = await interaction.guild.members.fetch(userId).catch(() => null);
      const aceptada = accion === 'aceptar';

      embed.setColor(aceptada ? 'Green' : 'Red');
      embed.setFooter({ text: `Postulación ${aceptada ? 'aceptada' : 'rechazada'} por ${interaction.user.tag} | gestionada` });

      await mensaje.edit({ embeds: [embed], components: [] });

      if (usuario) {
        const dm = new EmbedBuilder()
          .setTitle(aceptada ? '✅ Postulación Aceptada' : '❌ Postulación Rechazada')
          .setDescription(
            aceptada
              ? '¡Felicidades! 🎉 Tu postulación ha sido aceptada. Pronto un miembro del staff te contactará.'
              : 'Lamentamos informarte que tu postulación fue rechazada. Gracias por tu interés, puedes intentarlo más adelante.'
          )
          .setColor(aceptada ? 'Green' : 'Red');
        await usuario.send({ embeds: [dm] }).catch(() => {});
      }

      await interaction.reply({
        content: aceptada ? '✅ Postulación aceptada correctamente.' : '❌ Postulación rechazada correctamente.',
        ephemeral: true,
      });
    }
  });
};
