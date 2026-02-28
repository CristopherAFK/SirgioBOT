require("dotenv").config();
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { connectDB, db } = require('./database');
const express = require("express");
const { setupStaffPanel } = require('./staff-panel/routes');

const app = express();
app.get("/", (req, res) => res.redirect("/panel/"));
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
client.setMaxListeners(20);

// Exportar cliente para que otros módulos lo usen si es necesario
// o guardar la instancia de notificaciones
let notificationSystem;

setupStaffPanel(app, client);

// Cargar módulos ANTES de login para que sus client.once('ready') se registren y ejecuten al conectar
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
    const moduleInstance = require(modulePath)(client);
    if (modulePath === './notificaciones') {
      client.notificationSystem = moduleInstance;
    }
    console.log(`✅ Módulo cargado: ${modulePath}`);
  } catch (err) {
    console.error(`⚠️ Error cargando módulo ${modulePath}:`, err.message);
  }
}

const MAX_RETRIES = 5;
const RETRY_DELAYS = [5000, 10000, 30000, 60000, 120000];

async function startBot(retryCount = 0) {
  console.log("🚀 Iniciando SirgioBOT...");

  const token = (process.env.DISCORD_TOKEN || process.env.TOKEN || "").replace(/[^\x20-\x7E]/g, '').trim();
  
  if (!token || token.length < 50) {
    console.error("❌ ERROR: Token no válido o no configurado en las variables de entorno.");
    console.error("Token recibido (primeros 10 chars):", token.substring(0, 10));
    console.log("🌐 Staff Panel sigue disponible en /panel/ sin conexión al bot.");
    return;
  }

  console.log("✅ Token validado (longitud:", token.length, ")");

  try {
    // Pre-flight: verify Discord API connectivity and token
    console.log("🔍 Verificando conectividad con Discord API...");
    const https = require('https');
    await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'discord.com',
        path: '/api/v10/gateway/bot',
        method: 'GET',
        headers: { 'Authorization': `Bot ${token}` },
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log(`✅ Discord API respondió (status: ${res.statusCode})`);
          if (res.statusCode === 200) {
            try {
              const info = JSON.parse(data);
              console.log(`📡 Gateway URL: ${info.url}, Shards: ${info.shards}`);
            } catch (e) {}
          } else if (res.statusCode === 401) {
            reject(new Error('Token inválido (401 Unauthorized)'));
            return;
          } else {
            console.warn(`⚠️ Discord API status: ${res.statusCode} - ${data.substring(0, 200)}`);
          }
          resolve();
        });
      });
      req.on('error', (err) => reject(new Error(`No se pudo conectar a Discord API: ${err.message}`)));
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout conectando a Discord API (10s)')); });
      req.end();
    });

    console.log("🔌 Intentando conectar a Discord...");
    // Login with 30-second timeout
    const loginPromise = client.login(token);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Login timeout: Discord no respondió en 30 segundos')), 30000)
    );
    await Promise.race([loginPromise, timeoutPromise]);
    console.log("✅ Login exitoso, esperando evento ready...");
  } catch (err) {
    console.error("❌ Fallo al iniciar sesión en Discord:", err.message);
    
    if (err.message.includes("Privileged intent")) {
      console.error("💡 TIP: Activa 'Privileged Gateway Intents' en el Discord Developer Portal.");
      process.exit(1);
    }
    if (err.code === 'TokenInvalid' || (err.message && err.message.includes('TOKEN_INVALID'))) {
      console.error("💡 TIP: El token es inválido. Verifica que sea correcto.");
      process.exit(1);
    }

    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount] || 120000;
      console.log(`🔄 Reintentando conexión en ${delay / 1000}s... (intento ${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return startBot(retryCount + 1);
    } else {
      console.error("❌ Se agotaron los reintentos de conexión. Reiniciando proceso...");
      process.exit(1);
    }
  }
}

// Evento Ready - solo DB, actividad y tareas periódicas (los módulos ya están cargados y registran sus comandos en su propio ready)
client.once("ready", async () => {
  console.log(`✅ ¡Bot listo! Conectado como ${client.user.tag}`);

  try {
    const dbConnected = await connectDB();
    if (!dbConnected) {
      console.warn("⚠️ Advertencia: No se pudo conectar a MongoDB. Algunas funciones fallarán.");
    }
  } catch (err) {
    console.error("❌ Error en base de datos:", err.message);
  }

  client.user.setActivity("LagSupport", { type: 3 });

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

client.on("shardDisconnect", (event, id) => {
  console.warn(`⚠️ Shard ${id} desconectado. Código: ${event?.code}. El cliente intentará reconectar automáticamente.`);
});

client.on("shardReconnecting", (id) => {
  console.log(`🔄 Shard ${id} reconectando...`);
});

client.on("shardResume", (id, replayedEvents) => {
  console.log(`✅ Shard ${id} reconectado. Eventos repetidos: ${replayedEvents}`);
});

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled Rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
});

startBot();
