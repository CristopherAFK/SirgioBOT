Skip to content


AI




Node.js



Upgrade



Publish

Files



Commands
Search
Packager files
Config files
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

Add Discord integration for bot functionality

Agent 3

3 days ago

3 messages & 19 actions
I'll help you create a Discord bot application system with the features you described. Let me first check the current project structure.
Checkpoint made
3 days ago
Add a new way to create and manage customer accounts

Rollback here

Changes
2 minutes of work
No necesito que se conecte ahora mismo, solo quiero el codigo pero por ahora no estara conectado con el bot

3 days ago

2 messages & 3 actions
Entendido perfectamente. No configuraré el bot para que se ejecute ahora. Solo te he proporcionado el código completo. Déjame revisar el código que he creado para asegurarme de que todo esté correcto:
crea el codigo en un archivo que se llame postulaciones.js porque ya tengo el archivo index creado

3 days ago

2 messages & 6 actions
Perfecto, voy a crear el archivo `postulaciones.js` con el código corregido (he arreglado un bug importante que encontré):
Checkpoint made
3 days ago
Add a system for users to apply for staff positions on Discord

Rollback here

Changes
2 minutes of work
Ready to share? Publish this App in a few clicks.
Autoscale Deployment
Primary URL
nodejs-arekbloom
.replit.app

Open Publishing
El comando /abrirpostulaciones no abre las postulaciones para todo el mundo, soluciona ese errror

46 minutes ago
Checkpoint made
46 minutes ago
Add a system for users to apply for different server roles

Rollback here

Changes

5 messages & 17 actions
Veo el código que me compartiste. La lógica parece correcta, pero déjame revisar si hay algún problema:
Checkpoint made
43 minutes ago
Fix issue where opening applications was not universally applied

Rollback here

Changes
2 minutes of work
en que archivo se guardan los cambios?

41 minutes ago

Decided on postulaciones.js file
Todos los cambios están guardados en el archivo postulaciones.js 📄

Ese es el archivo principal que contiene todo el sistema de postulaciones:

Los 3 comandos (/postular, /abrir_postulaciones, /cerrar_postulaciones)
Las 5 categorías con sus preguntas
Los botones de aceptar/rechazar
El sistema de DMs con embeds verdes y rojos
Los logs de depuración que añadí
También actualicé:

README.md - Documentación del proyecto
package.json - Configuración para que el bot se ejecute con postulaciones.js
El archivo principal con todo el código es postulaciones.js - ese es el que se ejecuta cuando inicias el bot.

9 seconds of work

Scroll to latest

Make, test, iterate…

Build

Build



Node.js - Replit

Pasted-const-SlashCommandBuilder-ModalBuilder-TextInputBuilder-TextInputStyle-ActionRo-1762616142650_1762616142652.txt
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

// ===============================
// CONFIGURACIÓN
// ===============================
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

// ============================================
// EXPORTACIÓN
// ============================================
module.exports = (client) => {

  client.once('ready', async () => {
    console.log(`✅ Sistema de Postulaciones listo en ${client.user.tag}`);

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
      await client.application.commands.set(commands);
      console.log('🟢 Comandos de postulaciones registrados con éxito');
    } catch (error) {
      console.error('Error registrando comandos:', error);
    }
  });

  client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName ==...
