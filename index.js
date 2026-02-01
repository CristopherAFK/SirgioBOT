require("dotenv").config();
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { connectDB, db } = require('./database');
const express = require("express");

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

// Servidor Web para Render (Debe estar ANTES del login para pasar el Health Check)
const app = express();
app.get("/", (req, res) => res.send("SirgioBOT is alive!"));
app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor web activo en puerto ${PORT}`);
});

async function startBot() {
  console.log("🚀 Iniciando SirgioBOT...");

  // 1. Conectar a Base de Datos
  try {
    const dbConnected = await connectDB();
    if (!dbConnected) {
      console.warn("⚠️ Advertencia: No se pudo conectar a MongoDB. Algunas funciones fallarán.");
    }
  } catch (err) {
    console.error("❌ Error crítico en base de datos:", err.message);
  }

  // 2. Cargar Módulos
  try {
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
    console.log("✅ Todos los módulos cargados.");
  } catch (err) {
    console.error("❌ Error cargando módulos:", err.message);
  }

  // 3. Evento Ready
  client.once("ready", () => {
    console.log(`✅ ¡Bot listo! Conectado como ${client.user.tag}`);
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

  client.on("error", (error) => console.error("❌ Error de Discord:", error));

  // 4. Inicio de Sesión
  const token = (process.env.DISCORD_TOKEN || process.env.TOKEN || "").trim();
  
  if (!token || token.length < 50) {
    console.error("❌ ERROR: Token no válido o no configurado en las variables de entorno.");
    return;
  }

  try {
    await client.login(token);
  } catch (err) {
    console.error("❌ Fallo crítico al iniciar sesión en Discord:");
    console.error(err.message);
    
    if (err.message.includes("Privileged intent")) {
      console.error("💡 TIP: Activa 'Privileged Gateway Intents' en el Discord Developer Portal.");
    }
    
    // Reintento automático en caso de fallo de red
    setTimeout(() => {
      console.log("Reintentando conexión...");
      client.login(token).catch(() => {});
    }, 10000);
  }
}

startBot();
