// =========================
// SirgioBOT - index.js
// =========================

const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();
client.ticketData = {
  counter: 0,
  activeTickets: new Map(), // userId => channelId
};

// Importar sistema de tickets
require('./tickets-system')(client);

// Cuando el bot se conecte
client.once('ready', () => {
  console.log(`✅ SirgioBOT conectado como ${client.user.tag}`);
  client.user.setActivity('🎟️ Soporte | !panel');
});

// Login
client.login(process.env.TOKEN);
