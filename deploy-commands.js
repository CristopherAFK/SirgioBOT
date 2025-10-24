require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');

const commands = [];
const foldersPath = './comandos';
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = `${foldersPath}/${folder}`;
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(`./${commandsPath}/${file}`);
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
    }
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('🔄 Actualizando comandos (Slash)...');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('✅ Comandos registrados correctamente.');
  } catch (error) {
    console.error(error);
  }
})();
