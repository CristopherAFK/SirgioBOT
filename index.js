// =================== IMPORTACIONES ===================
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import fetch from "node-fetch";
import cron from "cron";

// =================== CONFIGURACIÓN ===================
const TOKEN = process.env.DISCORD_TOKEN; // Poner tu token en Render > Environment
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY; // Poner tu API Key en Render > Environment
const MOD_ROLE_ID = "1229140504310972599";
const WELCOME_CHANNEL_ID = "1212999950275837972";
const XP_CHANNEL_ID = "1213983541717770330";

// =================== CLIENTE ===================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// =================== EVENTOS ===================

// Bienvenida
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setDescription(
      `¡${member.user} ingreso al servidor!\n\n` +
      `¡Bienvenid@ a El Reino del Lag!\n` +
      `No olvides leer las normas y pasarte por los canales de presentación.`
    )
    .setImage("https://cdn.discordapp.com/attachments/1297672202283651152/1422452540980596827/58_sin_titulo_20250925213550.png");

  channel.send({ content: `${member}`, embeds: [embed] });
});

// Comando !Normas
client.on("messageCreate", async (message) => {
  if (!message.member.roles.cache.has(MOD_ROLE_ID)) return;
  if (message.content === "!Normas") {
    const embed1 = new EmbedBuilder()
      .setTitle("📜 Normas del Servidor (1/3)")
      .setColor(0x3498db)
      .setDescription(
        "1. Sé respetuoso\nDebes respetar a todos los usuarios. Trata a los demás como quieres que te traten a ti.\n" +
        "2. No usar lenguaje inapropiado\nEl uso de palabrotas debe mantenerse al mínimo. No se puede ofender de forma excesiva a los usuarios.\n" +
        "3. No hacer spam\nNo envíes mensajes repetitivos o múltiples mensajes pequeños consecutivos.\n" +
        "4. Prohibido material NSFW\nNo compartir contenido pornográfico, adulto o sexual de ningún tipo.\n" +
        "5. Se prohíbe contenido relacionado al CP\nBromas o contenido de este tipo están completamente prohibidas.\n" +
        "6. No publicidad\nNo se permite publicidad externa. Solo se puede compartir contenido relevante en canales designados.\n" +
        "7. Nombres y fotos apropiadas\nNo se permiten nombres ni fotos de perfil ofensivos. Se pedirá cambiar si son inapropiados.\n" +
        "8. Server Raiding\nNo se permiten raids ni menciones a los mismos, salvo contexto de juego."
      );

    const embed2 = new EmbedBuilder()
      .setTitle("📜 Normas del Servidor (2/3)")
      .setColor(0x3498db)
      .setDescription(
        "9. Amenazas directas e indirectas\nAmenazas DDoS, DoX, abuso u otras están prohibidas. Contacta a un admin si te sientes amenazado.\n" +
        "10. No multicuentas\nEl uso de múltiples cuentas está prohibido. Reincidir puede derivar en ban.\n" +
        "11. Filtración de información personal\nNo se permite compartir datos personales de otros miembros.\n" +
        "12. No hacer ping a sirgio\nPuedes responderle pero no hacerle ping innecesariamente.\n" +
        "13. Uso correcto de canales\nComparte contenido donde corresponde: memes en <#1400931230266032149>, comandos en <#1225884545513947229>.\n" +
        "14. No ping a everyone, here ni staff\nNo mencionas sin razón justificada. Usa <#1213983541717770330> si necesitas ayuda.\n" +
        "15. No hacer farm de niveles (Maximo 5 lineas de mensaje)\nNo escribir mensajes consecutivos sin interacción real. (Máximo 5 líneas)\n" +
        "16. No causar peleas\nEvita conflictos. Informa a un moderador si surge un problema."
      );

    const embed3 = new EmbedBuilder()
      .setTitle("📜 Normas del Servidor (3/3)")
      .setColor(0x3498db)
      .setDescription(
        "17. Respeta al staff\nNo faltas de respeto a moderadores o administradores. Problemas se exponen con respeto.\n" +
        "18. No usar hacks o exploits\nNo usar programas o modificaciones que den ventaja en juegos u otros fines.\n" +
        "19. No mandar links o archivos fuera de canales\nEvita spam y contenido irrelevante.\n" +
        "20. Respeta privacidad en chats de voz\nNo grabes ni compartas conversaciones sin consentimiento. Usa <#1213983541717770330> si fuiste afectado.\n" +
        "21. No impersonar usuarios o staff\nNo hacerse pasar por otra persona mediante nombre, foto o actitudes.\n" +
        "22. No flood de sonidos en llamadas\nEvita música, ruidos o sonidos constantes en chats de voz sin consentimiento.\n" +
        "23. Denuncia en vez de responder con toxicidad\nUsa el sistema de tickets o contacta al staff si alguien rompe reglas.\n\n" +
        "⚠️ Aviso final\nParticipar en este servidor implica aceptar todas estas reglas. El staff puede actualizar reglas sin previo aviso. Si fuiste afectado por algún usuario, abre un ticket en <#1213983541717770330> para reportarlo."
      );

    message.channel.send({ embeds: [embed1, embed2, embed3] });
  }
});

// =================== LOGIN ===================
client.login(TOKEN);
