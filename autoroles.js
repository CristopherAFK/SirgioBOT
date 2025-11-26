const { 
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

// =========================
// MAPAS DE ROLES
// =========================

const rolesPaises = {
  "🇻🇪": "1268383665168060517",
  "🇨🇴": "1268383284023525426",
  "🇪🇨": "1268384015925252240",
  "🇨🇱": "1268384143054471220",
  "🇦🇷": "1268384222796582993",
  "🇵🇪": "1268384464115994686",
  "🇧🇴": "1268384560325066864",
  "🇺🇾": "1268384709461934160",
  "🇵🇾": "1268384785403875350",
  "🇵🇦": "1268384817645359215",
  "🇭🇳": "1268384915011932312",
  "🇬🇹": "1268385050802651217",
  "🇸🇻": "1268385050802651217",
  "🇨🇷": "1413710208546508901",
  "🇲🇽": "1268385311038246943",
  "🇪🇸": "1268385402704756847",
  "🇵🇷": "1268385447722356767",
  "🇩🇴": "1268406577522806845"
};

const rolesGeneros = {
  "🔒": "1268381141648277616",
  "⚧️": "1268377460286951488",
  "♂️": "1268377312227889223",
  "♀️": "1268377374781739070"
};

const rolesJuegos = {
  "⬛": "1350919243339923609",
  "🚀": "1350917758988324885",
  "🟧": "1350917038939308272",
  "⭐": "1350918091873320980",
  "🔫": "1350917298051092651",
  "⛏️": "1350917442557313257",
  "🪠": "1413239980196626452",
  "🎤": "1413240385521713222",
  "🦟": "1413243773990862968",
  "👑": "1413243772703215679",
  "⚽": "1413241320566161518"
};

const rolesAnuncios = {
  "🎉": "1268376127920148510",
  "📺": "1268374279913996328",
  "🎵": "1268375078949621770",
  "👾": "1268374348641865769",
  "📼": "1268375969823985744",
  "🎶": "1268376833720586332",
  "📣": "1268374164595675309",
  "📝": "1268375562997600338"
};

// =========================
// BANNERS
// =========================
const banners = {
  paises: "https://media.discordapp.net/attachments/1225629661627682846/1422268955170443274/58_sin_titulo_20250929110844.png",
  generos: "https://media.discordapp.net/attachments/1225629661627682846/1422283408935092376/58_sin_titulo_20250929120620.png",
  juegos: "https://media.discordapp.net/attachments/1225629661627682846/1422289906079629403/58_sin_titulo_20250929123134.png",
  anuncios: "https://media.discordapp.net/attachments/1225629661627682846/1422305674318053426/58_sin_titulo_20250929133434.png"
};

// =========================
// FUNCIÓN PARA CREAR BOTONES
// =========================
function crearBotones(objRoles, prefix) {
  const rows = [];

  for (const emoji in objRoles) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${prefix}_${emoji}`)
          .setLabel(emoji)
          .setStyle(ButtonStyle.Primary)
      )
    );
  }

  return rows;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("autoroles")
    .setDescription("Envia los embeds de autoroles"),

  async execute(interaction) {
    
    // =============================
    // EMBED PAISES
    // =============================
    const embedPaises = new EmbedBuilder()
      .setColor("#ff0000")
      .setTitle("🌍 | Autoroles de Países")
      .setImage(banners.paises)
      .setDescription(
        Object.entries(rolesPaises)
          .map(([emoji, id]) => `${emoji} → <@&${id}>`)
          .join("\n\n")
      );

    await interaction.channel.send({
      embeds: [embedPaises],
      components: crearBotones(rolesPaises, "pais")
    });


    // =============================
    // EMBED GENEROS
    // =============================
    const embedGeneros = new EmbedBuilder()
      .setColor("#000000")
      .setTitle("👤 | Autoroles de Género")
      .setImage(banners.generos)
      .setDescription(
        Object.entries(rolesGeneros)
          .map(([emoji, id]) => `${emoji} → <@&${id}>`)
          .join("\n\n")
      );

    await interaction.channel.send({
      embeds: [embedGeneros],
      components: crearBotones(rolesGeneros, "genero")
    });


    // =============================
    // EMBED JUEGOS
    // =============================
    const embedJuegos = new EmbedBuilder()
      .setColor("#0033ff")
      .setTitle("🎮 | Autoroles de Juegos")
      .setImage(banners.juegos)
      .setDescription(
        Object.entries(rolesJuegos)
          .map(([emoji, id]) => `${emoji} → <@&${id}>`)
          .join("\n\n")
      );

    await interaction.channel.send({
      embeds: [embedJuegos],
      components: crearBotones(rolesJuegos, "juego")
    });


    // =============================
    // EMBED ANUNCIOS
    // =============================
    const embedAnuncios = new EmbedBuilder()
      .setColor("#ff8c00")
      .setTitle("📢 | Autoroles de Anuncios")
      .setImage(banners.anuncios)
      .setDescription(
        Object.entries(rolesAnuncios)
          .map(([emoji, id]) => `${emoji} → <@&${id}>`)
          .join("\n\n")
      );

    await interaction.channel.send({
      embeds: [embedAnuncios],
      components: crearBotones(rolesAnuncios, "anuncio")
    });

    await interaction.reply({ content: "Autoroles enviados correctamente.", ephemeral: true });
  }
};
