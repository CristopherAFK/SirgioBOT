const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "roles",
  description: "Envía los mensajes de autoroles.",
  async execute(message) {
    const allowedRole = "1423037245279047711";
    const channelID = "1423037245279047711";

    if (!message.member.roles.cache.has(allowedRole))
      return message.reply("❌ No tienes permiso para usar este comando.");

    const channel = message.guild.channels.cache.get(channelID);
    if (!channel)
      return message.reply("❌ No se encontró el canal configurado.");

    // =========================
    // 🧑‍💼 ROLES DEL STAFF
    // =========================
    const staffEmbed = new EmbedBuilder()
      .setColor("#43B581")
      .setImage(
        "https://media.discordapp.net/attachments/1225629661627682846/1422065793499136151/58_sin_titulo_20250928214126.png"
      )
      .setDescription(
        "<@&1230952139015327755>: El Superior que dirige a los Administradores.\n\n" +
          "<@&1212891335929897030>: Administradores en totalidad del Servidor.\n\n" +
          "<@&1230952186549243948>: Encargados de liderar a los Moderadores.\n\n" +
          "<@&1229140504310972599>: Moderadores del servidor.\n\n" +
          "<@&1230949752733175888>: Encargados de supervisar el Servidor.\n\n" +
          "<@&1230949777215197195>: Programadores del Servidor.\n\n" +
          "<@&1230949963551215627>: Encargados de organizar Eventos dentro o fuera del Servidor.\n\n" +
          "<@&1228835483036029078>: Editores de Sirgio."
      );

    // =========================
    // 🧗 ROLES DE NIVELES
    // =========================
    const nivelesEmbed = new EmbedBuilder()
      .setColor("#5DADEC")
      .setImage(
        "https://media.discordapp.net/attachments/1225629661627682846/1422073914686701639/58_sin_titulo_20250928221347.png"
      )
      .setDescription(
        "<@&1313716964383920269>: Personas que han llegado a nivel 100. Pueden añadir un emoji de su gusto al servidor y cambiarse el apodo del servidor a merced.\n\n" +
          "<@&1313716864790302730>: Personas que han llegado a nivel 75.\n\n" +
          "<@&1313716715934453761>: Personas que han llegado a nivel 50.\n\n" +
          "<@&1313716612452581437>: Personas que han llegado a nivel 40.\n\n" +
          "<@&1313716401021911102>: Personas que han llegado a nivel 35 teniendo acceso al canal de spam.\n\n" +
          "<@&1239330751334584421>: Personas que han llegado a nivel 25 teniendo acceso a mandar imágenes y videos en ⁠#1422783198655545435\n\n" +
          "<@&1313716306599481436>: Personas que han llegado a nivel 20.\n\n" +
          "<@&1313716235573264437>: Personas que han llegado a nivel 10, teniendo acceso a mandar Gifs en ⁠#1422783198655545435\n\n" +
          "<@&1313716079998140536>: Personas que han llegado a nivel 5, teniendo acceso a mandar audios en #1422783198655545435\n\n" +
          "<@&1313715879816597514>: Personas que han llegado a nivel 1.\n\n" +
          "<@&1255562775888003124>: Rol exclusivo para los que estuvieron en la tabla de niveles en la temporada 1 (A partir del Top 10).\n\n" +
          "<@&1267286215439421534>: Rol exclusivo para los que estuvieron en la tabla de niveles en la temporada 2 (A partir del Top 10).\n\n" +
          "<@&1316821713362878594>: Rol exclusivo para los que estuvieron en la tabla de niveles en la temporada 3 (A partir del Top 10).\n\n" +
         "Nota: Todos los que queden a partir del Top 10 en la tabla de niveles obtendrán un rol exclusivo, y el Top 1 su propio rol exclusivo. 
      );

    // =========================
    // 🏅 ROLES EXCLUSIVOS
    // =========================
    const exclusivosEmbed = new EmbedBuilder()
      .setColor("#9B59B6")
      .setImage(
        "https://media.discordapp.net/attachments/1225629661627682846/1422246097820057742/58_sin_titulo_20250929093723.png"
      )
      .setDescription(
        "<@&1229938887955189843>: Rol exclusivo para Boosters del Servidor teniendo acceso a canales exclusivos.\n\n" +
          "<@&1433610447944417312>: Rol exclusivo para los usuarios que aporten sugerencias para el Servidor.\n\n" +
          "<@&1230595787717611686>: Rol exclusivo para los suscriptores de Sirgio (Canales exclusivos).\n\n" +
          "<@&1422077772393746583>: Rol exclusivo para los que estuvieron presentes en la actualización del 1/10/25.\n\n" +
          "<@&1431822024833241188>: Rol exclusivo para los Usuarios que participaron en la Sapo Invasión.\n\n" +
          "<@&1268066983333593088>: Rol exclusivo para los Usuarios activos en el canal de #1422813008815456347."
      );

    // =========================
    // 🌎 ROLES DE PAÍSES
    // =========================
    const paisesEmbed = new EmbedBuilder()
      .setColor("#E67E22")
      .setImage(
        "https://media.discordapp.net/attachments/1225629661627682846/1422283408935092376/58_sin_titulo_20250929120620.png"
      )
      .setDescription(
        "Reacciona con tu país para obtener el rol correspondiente 🇻🇪🇨🇴🇪🇨🇨🇱🇦🇷🇵🇪🇧🇴🇺🇾🇵🇾🇵🇦🇭🇳🇬🇹🇸🇻🇨🇷🇲🇽🇪🇸🇵🇷🇩🇴"
      );

    const paisesReacciones = {
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
      "🇬🇹": "1268385256507965450",
      "🇸🇻": "1268385050802651217",
      "🇨🇷": "1413710208546508901",
      "🇲🇽": "1268385311038246943",
      "🇪🇸": "1268385402704756847",
      "🇵🇷": "1268385447722356767",
      "🇩🇴": "1268406577522806845",
    };

    // =========================
    // ⚧️ ROLES DE GÉNERO
    // =========================
    const generoEmbed = new EmbedBuilder()
      .setColor("#E74C3C")
      .setImage(
        "https://media.discordapp.net/attachments/1225629661627682846/1422283408935092376/58_sin_titulo_20250929120620.png"
      )
      .setDescription(
        "🔒 Privado\n\n⚧️ No binarie\n\n♂️ Hombre\n\n♀️ Mujer"
      );

    const generoReacciones = {
      "🔒": "1268381141648277616",
      "⚧️": "1268377460286951488",
      "♂️": "1268377312227889223",
      "♀️": "1268377374781739070",
    };

    // =========================
    // 🎮 ROLES DE VIDEOJUEGOS
    // =========================
    const juegosEmbed = new EmbedBuilder()
      .setColor("#00BFFF")
      .setImage(
        "https://media.discordapp.net/attachments/1225629661627682846/1422289906079629403/58_sin_titulo_20250929123134.png"
      )
      .setDescription(
        "⬛  🚀  🟧  ⭐  🔫  ⛏️  🪠  🎤  🦟  👑  ⚽\nReacciona para obtener los roles de tus juegos favoritos."
      );

    const juegosReacciones = {
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
      "⚽": "1413241320566161518",
    };

    // =========================
    // 📢 ROLES DE ANUNCIOS
    // =========================
    const anunciosEmbed = new EmbedBuilder()
      .setColor("#C7EA46")
      .setImage(
        "https://media.discordapp.net/attachments/1225629661627682846/1422305674318053426/58_sin_titulo_20250929133434.png"
      )
      .setDescription(
        "🎉  📺  🎵  👾  📼  🎶  📣  📝\nReacciona para recibir notificaciones específicas."
      );

    const anunciosReacciones = {
      "🎉": "1268376127920148510",
      "📺": "1268374279913996328",
      "🎵": "1268375078949621770",
      "👾": "1268374348641865769",
      "📼": "1268375969823985744",
      "🎶": "1268376833720586332",
      "📣": "1268374164595675309",
      "📝": "1268375562997600338",
    };

    const mensajes = [
      { embed: staffEmbed },
      { embed: nivelesEmbed },
      { embed: exclusivosEmbed },
      { embed: paisesEmbed, reactions: paisesReacciones },
      { embed: generoEmbed, reactions: generoReacciones },
      { embed: juegosEmbed, reactions: juegosReacciones },
      { embed: anunciosEmbed, reactions: anunciosReacciones },
    ];

    for (const { embed, reactions } of mensajes) {
      const msg = await channel.send({ embeds: [embed] });
      if (reactions) {
        for (const emoji of Object.keys(reactions)) {
          await msg.react(emoji);
        }
      }
    }

    message.reply("✅ Autoroles enviados correctamente en el canal indicado.");
  },
};
