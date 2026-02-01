require("dotenv").config();
const fs = require("fs");
const path = require("path");
const os = require("os");
const { connectDB, db, mongoose } = require('./database');
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder
} = require("discord.js");
const express = require("express");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User]
});

client.setMaxListeners(25);

// Conectar a la base de datos
connectDB().then(async connected => {
  // En Replit, incluso si no hay MONGO_URI, intentaremos seguir para que el bot conecte a Discord
  // En Render, el usuario DEBE configurar MONGODB_URI
  if (!connected) {
    console.warn("⚠️ No se pudo conectar a MongoDB. El bot intentará iniciar sesión de todos modos, pero algunas funciones fallarán.");
  }
  
  // Iniciar el bot
  try {
    // Obtener token limpiando cualquier residuo de Render/Env
    const token = (process.env.DISCORD_TOKEN || process.env.TOKEN || "").toString().replace(/[\r\n\t\s]/g, "");
    
    console.log("🔍 Diagnóstico de variables de entorno:");
    console.log(`- DISCORD_TOKEN: ${process.env.DISCORD_TOKEN ? "Detectada (longitud original: " + process.env.DISCORD_TOKEN.length + ")" : "NO detectada"}`);
    console.log(`- TOKEN: ${process.env.TOKEN ? "Detectada (longitud original: " + process.env.TOKEN.length + ")" : "NO detectada"}`);
    console.log(`- Token final procesado (longitud): ${token.length}`);

    if (token.length < 50) {
      console.error("❌ ERROR: El token detectado es demasiado corto o no existe.");
      return;
    }
    
    console.log(`🔑 Intentando conectar con Discord...`);
    
    // Timeout de seguridad para detectar si Discord no responde
    const loginTimeout = setTimeout(() => {
      console.error("⚠️ El inicio de sesión está tardando demasiado. Esto suele pasar si el TOKEN es incorrecto o si los INTENTS no están activados en el Discord Developer Portal.");
    }, 15000);

    // Usar client.login directamente y capturar la promesa
    client.login(token)
      .then(() => {
        clearTimeout(loginTimeout);
        console.log(`✅ Conexión exitosa con Discord como ${client.user.tag}`);
      })
      .catch(err => {
        clearTimeout(loginTimeout);
        console.error("❌ Fallo crítico al iniciar sesión en Discord:", err.message);
        if (err.message.includes("An invalid token was provided")) {
          console.error("💡 TIP: El token que pusiste en Render es INVÁLIDO. Copia el 'Token' de nuevo desde el Developer Portal (Bot -> Reset Token).");
        }
        if (err.message.includes("Privileged intent")) {
          console.error("💡 TIP: Asegúrate de que los 'Privileged Gateway Intents' (Presence, Server Members, Message Content) estén activados en el Discord Developer Portal.");
        }
        // Fallback para debug
        console.log("Reintentando login en 5 segundos...");
        setTimeout(() => client.login(token).catch(() => {}), 5000);
      });

  } catch (err) {
    console.error("❌ Error sincrónico en bloque login:", err.message);
  }
});

require('./automod')(client);
require('./welcome.js')(client);
require('./postulaciones')(client);
require('./embed')(client);
require('./anuncio')(client);
require('./autoroles.js')(client);
require('./sugerencias.js')(client);
require('./notificaciones')(client);
require('./avisos')(client);
require('./utils/commands')(client);
require('./utils/stats')(client);
require('./utils/reminders')(client);
require('./utils/ratelimit')(client);
require('./utils/backup')(client);
require('./utils/audit')(client);
require('./tickets/ticketSystem')(client);

client.once("ready", () => {
  console.log(`✅ SirgioBOT conectado como ${client.user.tag}`);
  client.user.setActivity("LagSupport", { type: 3 });
  
  setInterval(async () => {
    try {
      await db.cleanupRateLimits();
      const cleaned = await db.cleanupOldWarnings();
      if (cleaned.length > 0) {
        console.log(`🧹 Limpiados ${cleaned.length} warns antiguos`);
      }
    } catch (err) {
      console.error("Error en limpieza periódica:", err);
    }
  }, 60 * 60 * 1000);
});

const app = express();
app.get("/", (req, res) => res.send("SirgioBOT is alive!"));
app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));
app.listen(process.env.PORT || 3000, () => console.log("🌐 Servidor web activo para mantener el bot despierto."));

client.on("error", (error) => {
  console.error("❌ Error de Discord:", error);
});
