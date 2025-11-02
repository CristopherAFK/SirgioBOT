// =========================
// SirgioBOT - Sistema de Tickets completo (index.js)
// =========================

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  Partials,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

const TICKETS_FILE = path.join(__dirname, "tickets.json");

// STAFF ROLES (admin, mod, headadmin)
const STAFF_ROLE_IDS = [
  "1212891335929897030", // admin
  "1229140504310972599", // mod
  "1230952139015327755", // headadmin
];

// EMOJIS PERSONALIZADOS
const emojis = {
  discord_bots: { id: "1431413172513804348", name: "emoji_104" },
  report_user: { id: "1431408998887981147", name: "emoji_99" },
  streams: { id: "1268414311509004460", name: "Twitch" },
  lives: { id: "1268414284077994034", name: "TikTok" },
  dudas: { id: "1431412814345404618", name: "emoji_103" },
  otro: { id: "1431415219367842032", name: "emoji_106" },
};

// CATEGORÍA Y CANAL DONDE SE ENVIARÁ EL PANEL
const CATEGORY_ID = "1228438600497102960"; // categoría donde se crean los tickets
const PANEL_CHANNEL_ID = "1228438600497102960"; // canal donde se envía el panel

// Cargar o crear tickets.json
let tickets = {};
if (fs.existsSync(TICKETS_FILE)) {
  tickets = JSON.parse(fs.readFileSync(TICKETS_FILE, "utf8"));
}

// =========================
// COMANDO !panel
// =========================

client.on("messageCreate", async (message) => {
  if (message.content === "!panel") {
    if (!STAFF_ROLE_IDS.some((id) => message.member.roles.cache.has(id))) {
      return message.reply("❌ No tienes permiso para usar este comando.");
    }

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("🎫 Sistema de Tickets")
      .setDescription(
        "Selecciona la categoría que mejor describa tu solicitud para crear un ticket. Solo puedes tener **un ticket abierto** a la vez."
      );

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_menu")
      .setPlaceholder("📂 Selecciona una categoría")
      .addOptions([
        {
          label: "Discord Bots",
          description: "Reportar error o pedir ayuda con bots.",
          value: "discord_bots",
          emoji: emojis.discord_bots,
        },
        {
          label: "Reportar Usuario",
          description: "Reportar mal comportamiento o abuso.",
          value: "report_user",
          emoji: emojis.report_user,
        },
        {
          label: "Streams",
          description: "Soporte con streams.",
          value: "streams",
          emoji: emojis.streams,
        },
        {
          label: "Lives",
          description: "Ayuda con transmisiones en vivo.",
          value: "lives",
          emoji: emojis.lives,
        },
        {
          label: "Dudas o Soporte",
          description: "Cualquier otra duda o consulta.",
          value: "dudas",
          emoji: emojis.dudas,
        },
        {
          label: "Otro",
          description: "Asunto general o diferente.",
          value: "otro",
          emoji: emojis.otro,
        },
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    await message.channel.send({ embeds: [embed], components: [row] });
  }
});

// =========================
// SISTEMA DE CREACIÓN DE TICKETS
// =========================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId === "ticket_menu") {
    const existingTicket = Object.values(tickets).find(
      (t) => t.userId === interaction.user.id
    );

    if (existingTicket) {
      return interaction.reply({
        content: `❌ Ya tienes un ticket abierto: <#${existingTicket.channelId}>`,
        ephemeral: true,
      });
    }

    const category = client.channels.cache.get(CATEGORY_ID);
    if (!category) {
      return interaction.reply({
        content: "⚠️ No se encontró la categoría de tickets.",
        ephemeral: true,
      });
    }

    const ticketName = `ticket-${interaction.user.username}`.toLowerCase();
    const channel = await interaction.guild.channels.create({
      name: ticketName,
      type: 0,
      parent: CATEGORY_ID,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.AttachFiles,
          ],
        },
        ...STAFF_ROLE_IDS.map((id) => ({
          id,
          allow: [PermissionsBitField.Flags.ViewChannel],
        })),
      ],
    });

    tickets[channel.id] = {
      userId: interaction.user.id,
      channelId: channel.id,
      category: interaction.values[0],
    };

    fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));

    const confirmEmbed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("✅ Ticket Creado")
      .setDescription(
        `Tu ticket ha sido creado correctamente: ${channel}\nUn miembro del staff te atenderá pronto.`
      );

    await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });

    const staffEmbed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("🎫 Nuevo Ticket")
      .addFields(
        { name: "Usuario", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Categoría", value: interaction.values[0], inline: true }
      )
      .setTimestamp();

    await channel.send({ content: `<@&${STAFF_ROLE_IDS[0]}>`, embeds: [staffEmbed] });
  }
});

// =========================
// LOGIN
// =========================

client.once("ready", () => {
  console.log(`✅ SirgioBOT está en línea como ${client.user.tag}`);
});

client.login(TOKEN);
