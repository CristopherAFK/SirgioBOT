require("dotenv").config();
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { connectDB, db } = require('./database');
const express = require("express");

// Servidor Web para Render (Debe estar ANTES del login para pasar el Health Check)
const app = express();
app.get("/", (req, res) => res.send("SirgioBOT is alive!"));
app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor web activo en puerto ${PORT}`);
});

// Configuración de Intents y Partials
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

async function startBot() {
  console.log("🚀 Iniciando SirgioBOT...");

  // 1. Validar Token PRIMERO
  const token = (process.env.DISCORD_TOKEN || process.env.TOKEN || "").trim();
  
  if (!token || token.length < 50) {
    console.error("❌ ERROR: Token no válido o no configurado en las variables de entorno.");
    console.error("Token recibido (primeros 10 chars):", token.substring(0, 10));
    process.exit(1);
  }

  console.log("✅ Token validado (longitud:", token.length, ")");

  // 2. Conectar a Discord PRIMERO
  try {
    console.log("🔌 Intentando conectar a Discord...");
    await client.login(token);
    console.log("✅ Login exitoso, esperando evento ready...");
  } catch (err) {
    console.error("❌ Fallo crítico al iniciar sesión en Discord:");
    console.error("Error completo:", err);
    
    if (err.message.includes("Privileged intent")) {
      console.error("💡 TIP: Activa 'Privileged Gateway Intents' en el Discord Developer Portal.");
    }
    if (err.message.includes("token")) {
      console.error("💡 TIP: Verifica que el token sea correcto y no tenga espacios.");
    }
    
    process.exit(1);
  }
}

// 3. Evento Ready - Cargar módulos DESPUÉS de conectar
client.once("ready", async () => {
  console.log(`✅ ¡Bot listo! Conectado como ${client.user.tag}`);
  
  // Conectar a Base de Datos
  try {
    const dbConnected = await connectDB();
    if (!dbConnected) {
      console.warn("⚠️ Advertencia: No se pudo conectar a MongoDB. Algunas funciones fallarán.");
    }
  } catch (err) {
    console.error("❌ Error en base de datos:", err.message);
  }

  // Cargar Módulos DESPUÉS de que el bot esté conectado
  const modules = [
    './automod',
    './welcome.js',
    './postulaciones',
    './embed',
    './anuncio',
    './autoroles.js',
    './sugerencias.js',
    './notificaciones',
    './avisos',
    './utils/commands',
    './utils/stats',
    './utils/reminders',
    './utils/ratelimit',
    './utils/backup',
    './utils/audit',
    './tickets/ticketSystem'
  ];

  for (const modulePath of modules) {
    try {
      require(modulePath)(client);
      console.log(`✅ Módulo cargado: ${modulePath}`);
    } catch (err) {
      console.error(`⚠️ Error cargando módulo ${modulePath}:`, err.message);
    }
  }

  client.user.setActivity("LagSupport", { type: 3 });

  // Tareas periódicas
  setInterval(async () => {
    try {
      await db.cleanupRateLimits();
      await db.cleanupOldWarnings();
    } catch (err) {
      console.error("Error en limpieza periódica:", err.message);
    }
  }, 3600000); // 1 hora
});

client.on("error", (error) => {
  console.error("❌ Error de Discord:", error);
});

client.on("warn", (warning) => {
  console.warn("⚠️ Advertencia de Discord:", warning);
});

client.on("shardError", (error) => {
  console.error("❌ Error de Shard:", error);
});

// Iniciar el bot
startBot();
