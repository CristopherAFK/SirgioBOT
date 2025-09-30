const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

// Token desde el secret de Render o GitHub
const TOKEN = process.env.DISCORD_TOKEN;

// Crear cliente de Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Cuando el bot está listo
client.once("ready", () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
});

// -----------------------------
// Comandos
// -----------------------------

client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  // !ping
  if (message.content === "!ping") {
    message.channel.send("🏓 Pong!");
  }

  // !normas (aún falta el archivo normas.js)
  if (message.content === "!normas") {
    try {
      const { getNormasEmbed } = require("./normas.js");
      message.channel.send({ embeds: [getNormasEmbed()] });
    } catch (err) {
      console.error("⚠️ Error cargando normas.js:", err);
      message.channel.send("Las normas aún no están disponibles.");
    }
  }
});

// Iniciar sesión en Discord
client.login(TOKEN);
