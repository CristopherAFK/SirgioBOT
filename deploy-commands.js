// Script opcional para desplegar el comando slash /ticket panel en un guild (útil para pruebas).
require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error('Falta DISCORD_TOKEN, CLIENT_ID o GUILD_ID en .env');
  process.exit(1);
}

const commands = [
  {
    name: 'ticket',
    description: 'Panel y gestión de tickets',
    options: [{ name: 'panel', type: 1, description: 'Enviar el panel de apertura de tickets (staff)' }]
  }
];

(async () => {
  const rest = new REST({ version: '10' }).setToken(token);
  try {
    console.log('Desplegando comandos al guild...');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('Comandos desplegados correctamente.');
  } catch (err) {
    console.error('Error desplegando comandos:', err);
  }
})();
