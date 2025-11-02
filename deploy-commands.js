// deploy-commands.js
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if (Array.isArray(command)) {
    command.forEach(c => commands.push(c.data.toJSON()));
  } else {
    commands.push(command.data.toJSON());
  }
}

const CLIENT_ID = 'TU_CLIENT_ID_AQUI'; // ⚠️ Pon tu Client ID
const GUILD_ID = '1212886282645147768';
const TOKEN = process.env.TOKEN; // o directamente el token

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🌀 Cargando comandos...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ ¡Comandos registrados correctamente!');
  } catch (error) {
    console.error(error);
  }
})();
