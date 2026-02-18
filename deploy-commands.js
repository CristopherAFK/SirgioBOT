/**
 * Script para registrar los comandos slash en el servidor sin arrancar el bot completo.
 * Uso: node deploy-commands.js
 * Requiere: .env con DISCORD_TOKEN (o TOKEN) y opcionalmente GUILD_ID.
 */
require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { connectDB } = require('./database');
const { GUILD_ID } = require('./config');

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

const token = (process.env.DISCORD_TOKEN || process.env.TOKEN || '').trim();
if (!token || token.length < 50) {
  console.error('❌ Configura DISCORD_TOKEN o TOKEN en .env');
  process.exit(1);
}

const modules = [
  './automod',
  './postulaciones',
  './embed',
  './anuncio',
  './sugerencias.js',
  './utils/commands',
  './utils/stats',
  './utils/audit',
  './tickets/ticketSystem'
];

for (const modulePath of modules) {
  try {
    require(modulePath)(client);
    console.log(`✅ Módulo cargado: ${modulePath}`);
  } catch (err) {
    console.error(`⚠️ Error cargando ${modulePath}:`, err.message);
  }
}

client.once('ready', async () => {
  console.log(`✅ Conectado como ${client.user.tag}`);
  try {
    await connectDB();
  } catch (e) {
    console.warn('⚠️ MongoDB no conectado.');
  }
  console.log('⏳ Los módulos registran comandos en ready. Esperando 10s...');
  setTimeout(() => {
    console.log('✅ deploy-commands finalizado.');
    process.exit(0);
  }, 10000);
});

client.login(token).catch((err) => {
  console.error('❌ Error al conectar:', err.message);
  process.exit(1);
});
