// =========================
// SirgioBOT - Sistema de Tickets con contador persistente y comando !cerrar
// =========================
require("dotenv").config();
const fs = require("fs");
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require("discord.js");
const express = require("express");

// =========================
// CONFIGURACIÓN PRINCIPAL
// =========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// IDs importantes
const STAFF_ROLE_IDS = [
  "1212891335929897030", // admin
  "1229140504310972599", // mod
  "1230952139015327755"  // headadmin
];
const TICKET_CATEGORY_ID = "1228437209628020736";

// =========================
// CONTADOR DE TICKETS
// =========================
const TICKET_FILE = "./tickets.json";
let ticketCounter = 0;

if (fs.existsSync(TICKET_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(TICKET_FILE, "utf8"));
    ticketCounter = data.lastTicket || 0;
    console.log(`📁 Contador cargado: ${ticketCounter}`);
  } catch (err) {
    console.error("⚠️ Error al leer tickets.json, reiniciando contador.");
    ticketCounter = 0;
  }
}

function saveTicketCounter() {
  fs.writeFileSync(TICKET_FILE, JSON.stringify({ lastTicket: ticketCounter }, null, 2));
}

// =========================
// PANEL DE TICKETS (!panel)
// =========================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content.toLowerCase() !== "!panel") return;

  if (!message.member.roles.cache.some(r => STAFF_ROLE_IDS.includes(r.id))) {
    return message.reply("❌ Solo el staff puede usar este comando.");
  }

  const embed = new EmbedBuilder()
    .setTitle("🎫 Sistema de Tickets")
    .setDescription("Selecciona una categoría para crear un ticket:")
    .setColor("#2b2d31");

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_category_select")
    .setPlaceholder("Selecciona una categoría")
    .addOptions([
      { label: "Soporte General", value: "soporte", emoji: "💬" },
      { label: "Reportar Usuario", value: "reporte", emoji: "⚠️" },
      { label: "Solicitud Staff", value: "staff", emoji: "🛠️" }
    ]);

  const row = new ActionRowBuilder().addComponents(menu);
  await message.channel.send({ embeds: [embed], components: [row] });
  message.reply("✅ Panel de tickets enviado correctamente.");
});

// =========================
// CREACIÓN DE TICKET
// =========================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== "ticket_category_select") return;

  const { guild, member, values } = interaction;
  const categoria = values[0];

  // Aumentar contador y guardar
  ticketCounter++;
  saveTicketCounter();

  const ticketNumber = String(ticketCounter).padStart(3, "0");

  // Crear canal del ticket
  const channel = await guild.channels.create({
    name: `ticket-${ticketNumber}`,
    type: 0, // GUILD_TEXT
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: member.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
      },
      ...STAFF_ROLE_IDS.map(id => ({
        id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
      }))
    ]
  });

  const embed = new EmbedBuilder()
    .setTitle("🎫 Ticket creado")
    .setDescription(`Hola ${member}, gracias por abrir un ticket.\nUn miembro del staff te atenderá pronto.\n\n**Categoría:** ${categoria}`)
    .setColor("#2b2d31")
    .setFooter({ text: "SirgioBOT | Sistema de Tickets" });

  await channel.send({ content: `${member}`, embeds: [embed] });
  await interaction.reply({ content: `✅ Ticket creado: ${channel}`, ephemeral: true });
});

// =========================
// CERRAR TICKET (!cerrar)
// =========================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content.toLowerCase() !== "!cerrar") return;

  // Solo staff puede cerrar
  if (!message.member.roles.cache.some(r => STAFF_ROLE_IDS.includes(r.id))) {
    return message.reply("❌ Solo el staff puede usar este comando.");
  }

  const channel = message.channel;

  // Verificar que sea un canal de ticket
  if (!channel.name.startsWith("ticket-")) {
    return message.reply("⚠️ Este canal no parece ser un ticket.");
  }

  await message.reply("🗑️ Cerrando ticket en 5 segundos...");
  setTimeout(async () => {
    try {
      await channel.delete();
      console.log(`✅ Ticket cerrado y canal eliminado: ${channel.name}`);
    } catch (err) {
      console.error("Error al eliminar el canal:", err);
    }
  }, 5000);
});

// =========================
// SERVIDOR WEB PARA RENDER
// =========================
const app = express();
app.get("/", (req, res) => res.send("SirgioBOT is alive!"));
app.listen(process.env.PORT || 3000, () => console.log("🌐 Servidor web activo para mantener el bot despierto."));

// =========================
// LOGIN
// =========================
client.login(process.env.DISCORD_TOKEN || process.env.TOKEN);
