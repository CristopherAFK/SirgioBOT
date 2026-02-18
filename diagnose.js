require("dotenv").config();

console.log("=== DIAGNÓSTICO DE SIRGIO BOT ===\n");

// 1. Verificar variables de entorno
console.log("1️⃣ VERIFICANDO VARIABLES DE ENTORNO:");
const token = process.env.DISCORD_TOKEN || process.env.TOKEN || "";
console.log("   - DISCORD_TOKEN existe:", !!process.env.DISCORD_TOKEN);
console.log("   - TOKEN existe:", !!process.env.TOKEN);
console.log("   - Token seleccionado longitud:", token.length);
console.log("   - Token primeros 10 chars:", token.substring(0, 10));
console.log("   - Token últimos 10 chars:", token.substring(token.length - 10));
console.log("   - Tiene espacios al inicio:", token !== token.trimStart());
console.log("   - Tiene espacios al final:", token !== token.trimEnd());
console.log("   - MONGODB_URI existe:", !!process.env.MONGODB_URI);
console.log("   - PORT:", process.env.PORT || "no configurado");

// 2. Verificar dependencias
console.log("\n2️⃣ VERIFICANDO DEPENDENCIAS:");
try {
  const discord = require("discord.js");
  console.log("   ✅ discord.js instalado, versión:", discord.version);
} catch (e) {
  console.log("   ❌ discord.js NO instalado");
}

try {
  const express = require("express");
  console.log("   ✅ express instalado");
} catch (e) {
  console.log("   ❌ express NO instalado");
}

try {
  const mongoose = require("mongoose");
  console.log("   ✅ mongoose instalado, versión:", mongoose.version);
} catch (e) {
  console.log("   ❌ mongoose NO instalado");
}

// 3. Test de conexión a Discord
console.log("\n3️⃣ PROBANDO CONEXIÓN A DISCORD:");
if (!token || token.length < 50) {
  console.log("   ❌ Token inválido, no se puede probar conexión");
  process.exit(1);
}

const { Client, GatewayIntentBits } = require("discord.js");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log("   ✅ CONEXIÓN EXITOSA!");
  console.log("   - Bot conectado como:", client.user.tag);
  console.log("   - Bot ID:", client.user.id);
  console.log("   - Servidores:", client.guilds.cache.size);
  console.log("\n🎉 TODO FUNCIONA CORRECTAMENTE");
  process.exit(0);
});

client.on("error", (error) => {
  console.log("   ❌ ERROR DE DISCORD:", error.message);
  process.exit(1);
});

console.log("   Intentando login...");
client.login(token).catch((error) => {
  console.log("   ❌ FALLO EN LOGIN:", error.message);
  
  if (error.message.includes("token")) {
    console.log("\n💡 SOLUCIÓN: El token es inválido o ha expirado");
    console.log("   1. Ve a https://discord.com/developers/applications");
    console.log("   2. Selecciona tu aplicación");
    console.log("   3. Ve a 'Bot' → 'Reset Token'");
    console.log("   4. Copia el nuevo token y actualízalo en Render");
  }
  
  if (error.message.includes("Privileged")) {
    console.log("\n💡 SOLUCIÓN: Activa los Privileged Gateway Intents");
    console.log("   1. Ve a https://discord.com/developers/applications");
    console.log("   2. Selecciona tu aplicación");
    console.log("   3. Ve a 'Bot' → 'Privileged Gateway Intents'");
    console.log("   4. Activa: PRESENCE, SERVER MEMBERS, MESSAGE CONTENT");
  }
  
  process.exit(1);
});

// Timeout de 30 segundos
setTimeout(() => {
  console.log("   ❌ TIMEOUT: No se pudo conectar en 30 segundos");
  process.exit(1);
}, 30000);
