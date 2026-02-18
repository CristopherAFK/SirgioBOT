// Script de diagnóstico para ejecutar en Render
// Uso: node test-render.js

console.log("=".repeat(60));
console.log("🔍 DIAGNÓSTICO COMPLETO PARA RENDER");
console.log("=".repeat(60));

// Paso 1: Verificar Node.js
console.log("\n📦 PASO 1: Verificando entorno Node.js");
console.log("   Node version:", process.version);
console.log("   Platform:", process.platform);
console.log("   Architecture:", process.arch);

// Paso 2: Verificar variables de entorno
console.log("\n🔐 PASO 2: Verificando variables de entorno");
const token = (process.env.DISCORD_TOKEN || process.env.TOKEN || "").trim();
const mongoUri = process.env.MONGODB_URI || "";
const port = process.env.PORT || "no configurado";

console.log("   DISCORD_TOKEN existe:", !!process.env.DISCORD_TOKEN);
console.log("   TOKEN existe:", !!process.env.TOKEN);
console.log("   Token seleccionado longitud:", token.length);

if (token.length > 0) {
  console.log("   Token primeros 10 chars:", token.substring(0, 10));
  console.log("   Token últimos 10 chars:", token.substring(token.length - 10));
  console.log("   Token tiene espacios al inicio:", token !== token.trimStart());
  console.log("   Token tiene espacios al final:", token !== token.trimEnd());
  console.log("   Token formato válido:", token.length >= 50 && token.includes("."));
} else {
  console.log("   ❌ TOKEN NO CONFIGURADO");
}

console.log("   MONGODB_URI existe:", !!mongoUri);
console.log("   PORT:", port);

// Paso 3: Verificar dependencias
console.log("\n📚 PASO 3: Verificando dependencias instaladas");
const dependencies = [
  "discord.js",
  "express",
  "mongoose",
  "dotenv",
  "axios"
];

for (const dep of dependencies) {
  try {
    const module = require(dep);
    if (dep === "discord.js") {
      console.log(`   ✅ ${dep} v${module.version}`);
    } else {
      console.log(`   ✅ ${dep} instalado`);
    }
  } catch (e) {
    console.log(`   ❌ ${dep} NO instalado`);
  }
}

// Paso 4: Test de conexión a Discord
console.log("\n🤖 PASO 4: Probando conexión a Discord");

if (!token || token.length < 50) {
  console.log("   ❌ No se puede probar conexión: Token inválido");
  console.log("\n" + "=".repeat(60));
  console.log("❌ DIAGNÓSTICO FALLIDO");
  console.log("=".repeat(60));
  console.log("\n💡 SOLUCIÓN:");
  console.log("1. Ve a https://discord.com/developers/applications");
  console.log("2. Selecciona tu aplicación");
  console.log("3. Ve a 'Bot' → 'Reset Token'");
  console.log("4. Copia el nuevo token");
  console.log("5. En Render → Environment → Actualiza DISCORD_TOKEN");
  console.log("6. Asegúrate de NO tener espacios al inicio o final");
  process.exit(1);
}

const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

let connectionSuccess = false;

client.once("ready", () => {
  connectionSuccess = true;
  console.log("   ✅ CONEXIÓN EXITOSA A DISCORD!");
  console.log("   Bot tag:", client.user.tag);
  console.log("   Bot ID:", client.user.id);
  console.log("   Servidores:", client.guilds.cache.size);
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ DIAGNÓSTICO EXITOSO - TODO FUNCIONA CORRECTAMENTE");
  console.log("=".repeat(60));
  console.log("\n🎉 El bot puede conectarse a Discord sin problemas.");
  console.log("Si no funciona en Render, verifica:");
  console.log("1. Que el Start Command sea: npm start");
  console.log("2. Que Health Check Path sea: /health");
  console.log("3. Que las variables de entorno estén bien configuradas");
  
  client.destroy();
  process.exit(0);
});

client.on("error", (error) => {
  console.log("   ❌ ERROR DE CLIENTE:", error.message);
});

console.log("   Intentando login con Discord...");
console.log("   (Esto puede tomar 5-10 segundos)");

client.login(token).catch((error) => {
  console.log("   ❌ FALLO EN LOGIN");
  console.log("   Error:", error.message);
  
  console.log("\n" + "=".repeat(60));
  console.log("❌ DIAGNÓSTICO FALLIDO");
  console.log("=".repeat(60));
  
  if (error.message.includes("token") || error.message.includes("401")) {
    console.log("\n💡 PROBLEMA: Token inválido o expirado");
    console.log("\nSOLUCIÓN:");
    console.log("1. Ve a https://discord.com/developers/applications");
    console.log("2. Selecciona tu aplicación");
    console.log("3. Ve a 'Bot' → 'Reset Token'");
    console.log("4. Copia el NUEVO token (se muestra solo una vez)");
    console.log("5. En Render:");
    console.log("   - Ve a tu servicio");
    console.log("   - Environment → Edit");
    console.log("   - Actualiza DISCORD_TOKEN con el nuevo token");
    console.log("   - IMPORTANTE: Sin espacios al inicio o final");
    console.log("   - Save Changes");
  }
  
  if (error.message.includes("Privileged") || error.message.includes("intent")) {
    console.log("\n💡 PROBLEMA: Privileged Gateway Intents no activados");
    console.log("\nSOLUCIÓN:");
    console.log("1. Ve a https://discord.com/developers/applications");
    console.log("2. Selecciona tu aplicación");
    console.log("3. Ve a 'Bot' → 'Privileged Gateway Intents'");
    console.log("4. ACTIVA estos 3 intents:");
    console.log("   ☑️ PRESENCE INTENT");
    console.log("   ☑️ SERVER MEMBERS INTENT");
    console.log("   ☑️ MESSAGE CONTENT INTENT");
    console.log("5. Click 'Save Changes'");
    console.log("6. En Render, reinicia el servicio manualmente");
  }
  
  if (error.message.includes("network") || error.message.includes("ENOTFOUND")) {
    console.log("\n💡 PROBLEMA: Error de red o DNS");
    console.log("\nSOLUCIÓN:");
    console.log("1. Verifica tu conexión a internet");
    console.log("2. Si estás en Render, puede ser un problema temporal");
    console.log("3. Intenta hacer un nuevo deploy");
  }
  
  process.exit(1);
});

// Timeout de 30 segundos
setTimeout(() => {
  if (!connectionSuccess) {
    console.log("   ❌ TIMEOUT: No se pudo conectar en 30 segundos");
    console.log("\n" + "=".repeat(60));
    console.log("❌ DIAGNÓSTICO FALLIDO - TIMEOUT");
    console.log("=".repeat(60));
    console.log("\n💡 POSIBLES CAUSAS:");
    console.log("1. Conexión de red lenta o bloqueada");
    console.log("2. Discord API está caído (poco probable)");
    console.log("3. Firewall bloqueando la conexión");
    console.log("\nIntenta ejecutar este script nuevamente.");
    process.exit(1);
  }
}, 30000);
