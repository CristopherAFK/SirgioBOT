#!/usr/bin/env node
require("dotenv").config();

console.log("🧪 Test de Conexión de SirgioBOT\n");
console.log("=".repeat(50));

// 1. Verificar Token
console.log("\n1️⃣ Verificando Token...");
const token = (process.env.DISCORD_TOKEN || process.env.TOKEN || "").trim();

if (!token) {
  console.error("❌ ERROR: No se encontró DISCORD_TOKEN o TOKEN en .env");
  console.log("💡 Crea un archivo .env con: DISCORD_TOKEN=tu_token_aqui");
  process.exit(1);
}

if (token.length < 50) {
  console.error("❌ ERROR: Token demasiado corto (longitud:", token.length, ")");
  console.log("💡 Un token válido tiene ~70 caracteres");
  process.exit(1);
}

console.log("✅ Token encontrado (longitud:", token.length, ")");
console.log("   Primeros 20 chars:", token.substring(0, 20) + "...");

// 2. Verificar MongoDB URI
console.log("\n2️⃣ Verificando MongoDB URI...");
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.warn("⚠️  ADVERTENCIA: No se encontró MONGODB_URI");
  console.log("   El bot funcionará sin persistencia de datos");
} else {
  console.log("✅ MongoDB URI configurada");
  console.log("   Host:", mongoUri.includes("mongodb.net") ? "MongoDB Atlas" : "Local/Otro");
}

// 3. Verificar dependencias
console.log("\n3️⃣ Verificando dependencias...");
try {
  require("discord.js");
  console.log("✅ discord.js instalado");
} catch (err) {
  console.error("❌ discord.js NO instalado. Ejecuta: npm install");
  process.exit(1);
}

try {
  require("express");
  console.log("✅ express instalado");
} catch (err) {
  console.error("❌ express NO instalado. Ejecuta: npm install");
  process.exit(1);
}

// 4. Test de conexión real
console.log("\n4️⃣ Intentando conectar a Discord...");
console.log("   (Esto puede tardar unos segundos)\n");

const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log("✅ ¡CONEXIÓN EXITOSA!");
  console.log("   Bot conectado como:", client.user.tag);
  console.log("   ID:", client.user.id);
  console.log("   Servidores:", client.guilds.cache.size);
  console.log("\n" + "=".repeat(50));
  console.log("🎉 TODO ESTÁ CORRECTO. El bot debería funcionar en Render.");
  console.log("=".repeat(50));
  process.exit(0);
});

client.on("error", (error) => {
  console.error("\n❌ ERROR DE CONEXIÓN:", error.message);
  
  if (error.message.includes("TOKEN_INVALID")) {
    console.log("\n💡 SOLUCIÓN:");
    console.log("   1. Ve a https://discord.com/developers/applications");
    console.log("   2. Selecciona tu aplicación");
    console.log("   3. Ve a 'Bot' y copia el token");
    console.log("   4. Actualiza tu archivo .env con el token correcto");
  }
  
  if (error.message.includes("Privileged intent")) {
    console.log("\n💡 SOLUCIÓN:");
    console.log("   1. Ve a https://discord.com/developers/applications");
    console.log("   2. Selecciona tu aplicación");
    console.log("   3. Ve a 'Bot' → 'Privileged Gateway Intents'");
    console.log("   4. Activa: MESSAGE CONTENT INTENT");
  }
  
  process.exit(1);
});

setTimeout(() => {
  console.error("\n❌ TIMEOUT: La conexión tardó demasiado");
  console.log("💡 Verifica tu conexión a internet");
  process.exit(1);
}, 30000);

client.login(token).catch((err) => {
  console.error("\n❌ FALLO AL HACER LOGIN:", err.message);
  process.exit(1);
});
