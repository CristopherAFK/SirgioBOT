// =========================
// SirgioBOT - index.js (COMPLETO: Bienvenida roja + Autoroles + AutoMod)
// =========================

require("dotenv").config();
const fs = require("fs");
const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionsBitField } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User]
});

// =========================
// CONFIG
// =========================
const MOD_ROLE_ID = "1229140504310972599";            // Rol de moderador (solo ellos usan !Roles)
const ROLES_CHANNEL_ID = "1422713049957273621";       // Canal donde se publican los embeds de roles
const LOG_CHANNEL_ID = "1413243479412310037";         // Canal de logs
const REGLAS_CHANNEL_ID = "1212998742505037864";      // Canal de reglas
const GENERAL_CHANNEL_ID = "1422783198655545435";     // #general donde se manda bienvenida
const MUTED_ROLE_ID = "ID_DEL_ROL_MUTED_AQUI";        // <- Si ya creaste el rol Muted, pon la ID aquí. Si queda vacío, el bot intentará crear/usar "Muted".

// Banners (usados por el comando !Roles)
const banners = {
  staff:    "https://media.discordapp.net/attachments/1225629661627682846/1422065793499136151/58_sin_titulo_20250928214126.png",
  niveles:  "https://media.discordapp.net/attachments/1225629661627682846/1422073914686701639/58_sin_titulo_20250928221347.png",
  exclusivos:"https://media.discordapp.net/attachments/1225629661627682846/1422246097820057742/58_sin_titulo_20250929093723.png",
  paises:   "https://media.discordapp.net/attachments/1225629661627682846/1422268955170443274/58_sin_titulo_20250929110844.png",
  generos:  "https://media.discordapp.net/attachments/1225629661627682846/1422283408935092376/58_sin_titulo_20250929120620.png",
  juegos:   "https://media.discordapp.net/attachments/1225629661627682846/1422289906079629403/58_sin_titulo_20250929123134.png",
  anuncios: "https://media.discordapp.net/attachments/1225629661627682846/1422305674318053426/58_sin_titulo_20250929133434.png"
};

// Imagen bienvenida
const WELCOME_IMAGE = "https://images-ext-1.discordapp.net/external/gA9Y8BTjysXecAKEi8pwfnh7inNh6kawKGVhZQnlwDM/https/cdn.nekotina.com/guilds/1212886282645147768/23ff9a0e-6163-4852-abcb-54a938a41121.jpg?format=webp&width=789&height=823";

// =========================
// AUTOROLES MAPAS (idénticos a los previos)
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
  "🔒": "1268381141648277616", // Privado
  "⚧️": "1268377460286951488", // No binarie
  "♂️": "1268377312227889223", // Hombre
  "♀️": "1268377374781739070"  // Mujer
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

// Embeds informativos (staff/niveles/exclusivos) - texto tal como lo pediste antes
const staffRolesEmbed = new EmbedBuilder()
  .setColor(0x006400)
  .setImage(banners.staff)
  .setDescription(
    "<@&1230952139015327755>: El Superior que dirige a los Administradores.\n" +
    "<@&1212891335929897030>: Administradores en totalidad del Servidor\n" +
    "<@&1230952186549243948>: Encargados de liderar a los Moderadores.\n" +
    "<@&1229140504310972599>: Moderadores del servidor.\n" +
    "<@&1230949752733175888>: Encargados de supervisar el Servidor.\n" +
    "<@&1230949777215197195>: Programadores del Servidor.\n" +
    "<@&1230949963551215627>: Encargados de organizar Eventos dentro o fuera del Servidor.\n" +
    "<@&1228835483036029078>: Editores de Sirgio."
  );

const nivelesRolesEmbed = new EmbedBuilder()
  .setColor(0x0000FF)
  .setImage(banners.niveles)
  .setDescription(
    "<@&1313716964383920269>: Nivel 100, puede cambiar apodo y añadir emoji.\n" +
    "<@&1313716864790302730>: Nivel 75.\n" +
    "<@&1313716715934453761>: Nivel 50.\n" +
    "<@&1313716612452581437>: Nivel 40.\n" +
    "<@&1313716401021911102>: Nivel 35, acceso al canal de spam.\n" +
    "<@&1239330751334584421>: Nivel 25, puede mandar imágenes y videos en <#1422783198655545435>.\n" +
    "<@&1313716306599481436>: Nivel 20.\n" +
    "<@&1313716235573264437>: Nivel 10, puede mandar GIFs en <#1422783198655545435>.\n" +
    "<@&1313716079998140536>: Nivel 5, puede mandar audios en <#1422783198655545435>.\n" +
    "<@&1313715879816597514>: Nivel 1."
  );

const exclusivosRolesEmbed = new EmbedBuilder()
  .setColor(0x800080)
  .setImage(banners.exclusivos)
  .setDescription(
    "<@&1229938887955189843>: Boosters.\n" +
    "<@&1230595787717611686>: Suscriptores.\n" +
    "<@&1422077772393746583>: Actualización 1/10/25.\n" +
    "<@&1255562775888003124>: Tabla de niveles temporada 1 (Top10).\n" +
    "<@&1267286215439421534>: Tabla de niveles temporada 2 (Top10).\n" +
    "<@&1316821713362878594>: Tabla de niveles temporada 3 (Top10).\n" +
    "<@&1400933425552162927>: Tabla de niveles temporada 4 (Top10).\n" +
    "<@&1413617450011856897>: Tabla de niveles temporada 5 (Top10).\n\n" +
    "Nota: Todos los que queden Top10 obtendrán rol exclusivo, Top1 su propio rol."
  );

// =========================
// AUTOROLES CONTROL
// =========================
let autorolesMessageIds = []; // mensajes en canal que contienen las reacciones de autoroles

// Función reutilizable para crear embeds de autoroles y reaccionar
async function crearAutoroles(channel, banner, rolesMap, color) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setImage(banner)
    .setDescription(Object.entries(rolesMap).map(([e, id]) => `${e} - <@&${id}>`).join("\n"));

  const msg = await channel.send({ embeds: [embed] });
  for (const emoji of Object.keys(rolesMap)) {
    try { await msg.react(emoji); } catch (err) { /* ignore */ }
  }
  autorolesMessageIds.push(msg.id);
}

// =========================
// PERSISTENCIA DE WARNINGS
// =========================
const WARNINGS_FILE = "./warnings.json";
let warningsData = {};

function loadWarnings() {
  try {
    if (fs.existsSync(WARNINGS_FILE)) {
      warningsData = JSON.parse(fs.readFileSync(WARNINGS_FILE, "utf8"));
    } else {
      warningsData = {};
    }
  } catch (err) {
    console.error("Error al leer warnings:", err);
    warningsData = {};
  }
}

function saveWarnings() {
  try {
    fs.writeFileSync(WARNINGS_FILE, JSON.stringify(warningsData, null, 2));
  } catch (err) {
    console.error("Error al guardar warnings:", err);
  }
}

loadWarnings();

// =========================
// HELPERS Y CHECKS
// =========================
function normalizeText(t) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const BAD_WORDS = [
  "admin de mierda","administración de mierda","borren el server","hijo de puta",
  "hitler","mátate","mierda","pene","perra","puta","puto","retrasado",
  "server muerto","sirgio de mierda","suicidate","tu puta madre","vagina",
  "violacion","violar","zorra","midgio","kys"
].map(w => normalizeText(w));

function containsBadWord(content) {
  const norm = normalizeText(content);
  for (const bad of BAD_WORDS) {
    if (norm.includes(bad)) return bad;
  }
  return null;
}

function containsLink(content) {
  const re = /(https?:\/\/\S+)|(www\.\S+)|(\bdiscord\.gg\/\S+\b)|(\binvite\.gg\/\S+)/i;
  return re.test(content);
}

function isExcessiveCaps(content) {
  // contamos letras, si menos de 10 letras, no consideramos
  const letters = content.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúñ]/g, "");
  if (letters.length < 10) return false;
  const upper = letters.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, "");
  return (upper.length / letters.length) >= 0.70;
}

function isTooManyLines(content) {
  const lines = content.split(/\r\n|\r|\n/);
  return lines.length > 5;
}

function addWarningFor(userId, type) {
  if (!warningsData[userId]) warningsData[userId] = { types: {}, createdAt: Date.now() };
  if (!warningsData[userId].types[type]) warningsData[userId].types[type] = 0;
  warningsData[userId].types[type] += 1;
  saveWarnings();
  return warningsData[userId].types[type];
}

function getWarningCount(userId, type) {
  return warningsData[userId]?.types?.[type] ?? 0;
}

// =========================
// MUTING (usa MUTED_ROLE_ID si está, sino crea/usa rol "Muted")
// =========================
async function ensureMutedRole(guild) {
  // si proporcionaron un ID específico, intentar usarlo
  if (MUTED_ROLE_ID && MUTED_ROLE_ID !== "" && MUTED_ROLE_ID !== "ID_DEL_ROL_MUTED_AQUI") {
    const role = guild.roles.cache.get(MUTED_ROLE_ID);
    if (role) return role;
    // si no lo encuentra, intenta crearlo (fallback)
  }

  // buscar por nombre
  let role = guild.roles.cache.find(r => r.name === "Muted");
  if (role) return role;

  // crear роль
  try {
    role = await guild.roles.create({
      name: "Muted",
      permissions: []
    });
    // aplicar overwrites en todos los canales textuales
    guild.channels.cache.forEach(async (channel) => {
      try {
        if (channel.isTextBased && channel.permissionsFor) {
          await channel.permissionOverwrites.create(role, {
            SendMessages: false,
            AddReactions: false,
            Speak: false
          }).catch(() => {});
        }
      } catch (err) { /* ignore */ }
    });
    return role;
  } catch (err) {
    console.error("No se pudo crear rol Muted:", err);
    return null;
  }
}

async function applyMute(member, minutes, reason = "Mute automático") {
  if (!member || !member.manageable) return { ok: false, reason: "No se puede gestionar al miembro" };

  // limit máximo 60 minutos
  if (minutes > 60) minutes = 60;

  const guild = member.guild;

  // si el bot tiene ModerateMembers, usar timeout nativo (Discord timeout) - preferible
  try {
    if (guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      const ms = minutes * 60 * 1000;
      await member.timeout(ms, reason).catch(() => {});
      return { ok: true, type: "timeout", minutes };
    }
  } catch (err) {
    // ignorar y seguir con rol
  }

  const role = await ensureMutedRole(guild);
  if (!role) return { ok: false, reason: "No hay rol muted" };

  try {
    await member.roles.add(role, reason);
  } catch (err) {
    console.error("Error aplicando rol muted:", err);
    return { ok: false, reason: "Error al añadir rol" };
  }

  // programar quitarlo pasado el tiempo
  setTimeout(async () => {
    try {
      const freshMember = await guild.members.fetch(member.id).catch(() => null);
      if (freshMember && freshMember.roles.cache.has(role.id)) {
        await freshMember.roles.remove(role, "Tiempo de mute expirado").catch(() => {});
      }
    } catch (err) { /* ignore */ }
  }, minutes * 60 * 1000);

  return { ok: true, type: "role", minutes, roleId: role.id };
}

// =========================
// EMBED BUILDERS
// =========================
function buildUserWarningEmbed(title, description, user) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0x87CEFA) // celeste
    .setTimestamp()
    .setFooter({ text: `Advertencia para ${user.tag}` });
}

function buildLogEmbed(user, type, content, extra = "") {
  const e = new EmbedBuilder()
    .setTitle("Registro de moderación")
    .addFields(
      { name: "Usuario", value: `${user.tag} (${user.id})`, inline: false },
      { name: "Tipo", value: type, inline: true },
      { name: "Contenido", value: content?.slice(0, 1024) || "—", inline: false }
    )
    .setColor(0xFFB6C1)
    .setTimestamp();
  if (extra) e.addFields({ name: "Notas", value: extra });
  return e;
}

// =========================
// EVENT: READY
// =========================
client.once("ready", () => {
  console.log(`✅ SirgioBOT conectado como ${client.user.tag}`);
  client.user.setActivity("Moderando el servidor", { type: 3 });
});

// =========================
// EVENT: GUILD MEMBER ADD (BIENVENIDA SIN ROL AUTOMÁTICO)
// =========================
client.on("guildMemberAdd", async (member) => {
  try {
    const canal = member.guild.channels.cache.get(GENERAL_CHANNEL_ID) || member.guild.systemChannel;
    if (!canal) return;

    const embed = new EmbedBuilder()
      .setTitle("👋 ¡Bienvenido!")
      .setDescription(
        `Hola ${member}, bienvenido a **${member.guild.name}** 🎉\n\n` +
        `📌 Por favor, lee las reglas en <#${REGLAS_CHANNEL_ID}>.\n` +
        `🎨 Luego pasa por los autorroles en <#${ROLES_CHANNEL_ID}> para obtener tus roles.`
      )
      .setColor(0xFF0000) // rojo como pediste
      .setImage(WELCOME_IMAGE)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

    await canal.send({ embeds: [embed] });
  } catch (err) {
    console.error("Error en guildMemberAdd:", err);
  }
});

// =========================
// EVENT: MESSAGE CREATE (AUTOMOD)
// =========================
client.on("messageCreate", async (message) => {
  try {
    if (message.author?.bot) return;
    if (!message.guild) return;

    const content = message.content || "";
    const member = message.member;

    // IGNORAR MODS
    if (member.roles.cache.has(MOD_ROLE_ID)) return;

    // 1) malas palabras
    const bad = containsBadWord(content);
    if (bad) {
      await message.delete().catch(() => {});
      const type = "badword";
      const count = addWarningFor(member.id, type);

      const title = "Evita usar este tipo de palabras ⚠️";
      const description = `Se ha detectado el uso de lenguaje inapropiado.\n\n**Palabra detectada:** \`${bad}\`\n\nEn este servidor no se permite este tipo de lenguaje. Si continúas, se aplicarán sanciones (mute temporal).`;

      try { await message.author.send({ embeds: [buildUserWarningEmbed(title, description, message.author)] }).catch(() => {}); } catch(e){}
      const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) logChannel.send({ embeds: [buildLogEmbed(message.author, "Lenguaje inapropiado", content, `Palabra: ${bad} — Advertencias de este tipo: ${count}`)] }).catch(() => {});

      if (count >= 2) {
        const muteMinutes = Math.min(60, 20 * (count - 1));
        const res = await applyMute(member, muteMinutes, `Mute por repetir lenguaje inapropiado (${bad})`);
        try { await message.author.send({ embeds: [buildUserWarningEmbed("Has sido silenciado temporalmente ⚠️", `Por repetir el uso de lenguaje inapropiado se te aplicó un mute de ${muteMinutes} minutos.`, message.author)] }).catch(() => {}); } catch(e){}
        if (logChannel) logChannel.send({ embeds: [buildLogEmbed(message.author, "Mute aplicado - lenguaje", content, `Mute: ${muteMinutes} min - resultado: ${JSON.stringify(res)}`)] }).catch(() => {});
      }
      return;
    }

    // 2) enlaces
    if (containsLink(content)) {
      await message.delete().catch(() => {});
      const type = "link";
      const count = addWarningFor(member.id, type);

      const title = "Evita compartir enlaces aquí ⚠️";
      const description = "No está permitido publicar enlaces o invitaciones en este servidor. Tu mensaje ha sido eliminado. Si vuelves a hacerlo, se aplicarán sanciones.";

      try { await message.author.send({ embeds: [buildUserWarningEmbed(title, description, message.author)] }).catch(() => {}); } catch(e){}
      const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) logChannel.send({ embeds: [buildLogEmbed(message.author, "Enlace no permitido", content, `Advertencias de este tipo: ${count}`)] }).catch(() => {});

      if (count >= 2) {
        const muteMinutes = Math.min(60, 20 * (count - 1));
        const res = await applyMute(member, muteMinutes, "Mute por enviar enlaces");
        try { await message.author.send({ embeds: [buildUserWarningEmbed("Has sido silenciado temporalmente ⚠️", `Mute de ${muteMinutes} minutos por enviar enlaces.`, message.author)] }).catch(() => {}); } catch(e){}
        if (logChannel) logChannel.send({ embeds: [buildLogEmbed(message.author, "Mute aplicado - enlaces", content, `Mute: ${muteMinutes} min - resultado: ${JSON.stringify(res)}`)] }).catch(() => {});
      }
      return;
    }

    // 3) mayúsculas excesivas
    if (isExcessiveCaps(content)) {
      await message.delete().catch(() => {});
      const type = "caps";
      const count = addWarningFor(member.id, type);

      const title = "No uses excesivamente las mayúsculas ⚠️";
      const description = "Por favor no escribas todo en mayúsculas. Esto dificulta la lectura y se considera gritar. Tu mensaje ha sido eliminado y te hemos enviado esta advertencia.";

      try { await message.author.send({ embeds: [buildUserWarningEmbed(title, description, message.author)] }).catch(() => {}); } catch(e){}
      const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) logChannel.send({ embeds: [buildLogEmbed(message.author, "Mayúsculas excesivas", content, `Advertencias de este tipo: ${count}`)] }).catch(() => {});

      if (count >= 2) {
        const muteMinutes = Math.min(60, 20 * (count - 1));
        const res = await applyMute(member, muteMinutes, "Mute por mayúsculas excesivas");
        try { await message.author.send({ embeds: [buildUserWarningEmbed("Has sido silenciado temporalmente ⚠️", `Mute de ${muteMinutes} minutos por escribir en mayúsculas repetidamente.`, message.author)] }).catch(() => {}); } catch(e){}
        if (logChannel) logChannel.send({ embeds: [buildLogEmbed(message.author, "Mute aplicado - mayúsculas", content, `Mute: ${muteMinutes} min - resultado: ${JSON.stringify(res)}`)] }).catch(() => {});
      }
      return;
    }

    // 4) mensajes > 5 líneas
    if (isTooManyLines(content)) {
      await message.delete().catch(() => {});
      const type = "long";
      const count = addWarningFor(member.id, type);

      const title = "Evita mensajes muy largos ⚠️";
      const description = "Tu mensaje contenía más de 5 líneas. Por favor divide el contenido o usa spoilers. Tu mensaje ha sido eliminado y has recibido una advertencia.";

      try { await message.author.send({ embeds: [buildUserWarningEmbed(title, description, message.author)] }).catch(() => {}); } catch(e){}
      const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) logChannel.send({ embeds: [buildLogEmbed(message.author, "Mensaje muy largo", content, `Advertencias de este tipo: ${count}`)] }).catch(() => {});

      if (count >= 2) {
        const muteMinutes = Math.min(60, 20 * (count - 1));
        const res = await applyMute(member, muteMinutes, "Mute por mensajes largos");
        try { await message.author.send({ embeds: [buildUserWarningEmbed("Has sido silenciado temporalmente ⚠️", `Mute de ${muteMinutes} minutos por mensajes largos repetidos.`, message.author)] }).catch(() => {}); } catch(e){}
        if (logChannel) logChannel.send({ embeds: [buildLogEmbed(message.author, "Mute aplicado - largo", content, `Mute: ${muteMinutes} min - resultado: ${JSON.stringify(res)}`)] }).catch(() => {});
      }
      return;
    }

  } catch (err) {
    console.error("Error en automod:", err);
  }
});

// =========================
// COMANDO !Roles (SOLO MODS) - envía embeds + autoroles
// =========================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content !== "!Roles") return;
  if (!message.member.roles.cache.has(MOD_ROLE_ID)) return message.reply("❌ Solo los moderadores pueden usar este comando.");

  try {
    const channel = message.guild.channels.cache.get(ROLES_CHANNEL_ID);
    if (!channel) return message.reply("❌ Canal de roles no encontrado.");

    // Embeds informativos
    await channel.send({ embeds: [staffRolesEmbed] });
    await channel.send({ embeds: [nivelesRolesEmbed] });
    await channel.send({ embeds: [exclusivosRolesEmbed] });

    // Autoroles dinámicos (con reacción)
    await crearAutoroles(channel, banners.paises, rolesPaises, 0xFFA500);
    await crearAutoroles(channel, banners.generos, rolesGeneros, 0xFF0000);
    await crearAutoroles(channel, banners.juegos, rolesJuegos, 0x00FFFF);
    await crearAutoroles(channel, banners.anuncios, rolesAnuncios, 0x90EE90);

    message.reply("✅ Mensajes de roles y autoroles publicados.");
  } catch (err) {
    console.error("Error en comando !Roles:", err);
    message.reply("Ocurrió un error al ejecutar el comando.");
  }
});

// =========================
// REACCIONES: ASIGNAR / REMOVER ROLES
// =========================
client.on("messageReactionAdd", async (reaction, user) => {
  try {
    if (user.bot) return;
    if (!reaction.message || !reaction.message.guild) return;
    if (!autorolesMessageIds.includes(reaction.message.id)) return;

    const embedImage = reaction.message.embeds[0]?.data?.image?.url;
    let map = null;
    if (embedImage === banners.paises) map = rolesPaises;
    else if (embedImage === banners.generos) map = rolesGeneros;
    else if (embedImage === banners.juegos) map = rolesJuegos;
    else if (embedImage === banners.anuncios) map = rolesAnuncios;

    const roleId = map?.[reaction.emoji.name];
    if (!roleId) return;

    const member = await reaction.message.guild.members.fetch(user.id);
    if (member) await member.roles.add(roleId).catch(() => {});
  } catch (err) {
    console.error("Error messageReactionAdd:", err);
  }
});

client.on("messageReactionRemove", async (reaction, user) => {
  try {
    if (user.bot) return;
    if (!reaction.message || !reaction.message.guild) return;
    if (!autorolesMessageIds.includes(reaction.message.id)) return;

    const embedImage = reaction.message.embeds[0]?.data?.image?.url;
    let map = null;
    if (embedImage === banners.paises) map = rolesPaises;
    else if (embedImage === banners.generos) map = rolesGeneros;
    else if (embedImage === banners.juegos) map = rolesJuegos;
    else if (embedImage === banners.anuncios) map = rolesAnuncios;

    const roleId = map?.[reaction.emoji.name];
    if (!roleId) return;

    const member = await reaction.message.guild.members.fetch(user.id);
    if (member) await member.roles.remove(roleId).catch(() => {});
  } catch (err) {
    console.error("Error messageReactionRemove:", err);
  }
});

// =========================
// COMANDOS PARA MODS: warnings, clearwarnings, ping
// =========================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith("!")) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (!message.member.roles.cache.has(MOD_ROLE_ID)) return; // solo mods

  if (command === "ping") {
    return message.reply(`🏓 ¡Pong! Latencia: **${client.ws.ping}ms**`);
  }

  if (command === "warnings") {
    const user = message.mentions.users.first();
    if (!user) return message.reply("Menciona a un usuario.");
    const w = warningsData[user.id] || { types: {} };
    return message.reply({ content: `Advertencias de ${user.tag}: \n\`\`\`${JSON.stringify(w.types, null, 2)}\`\`\`` });
  }

  if (command === "clearwarnings") {
    const user = message.mentions.users.first();
    if (!user) return message.reply("Menciona a un usuario.");
    delete warningsData[user.id];
    saveWarnings();
    return message.reply(`Advertencias de ${user.tag} borradas.`);
  }
});

// =========================
// COMANDOS DE ADMINISTRACIÓN (AUTOMOD Y HELP)
// =========================

// Variable para controlar si el AutoMod está activo
let automodActivo = true;

// Canal de logs del staff
const staffLogChannelId = "1413243479412310037";

// IDs de roles del staff (para registrar su actividad)
const staffRoles = [
  "1229140504310972599", // Moderadores
  "1212891335929897030", // Administradores
  "1230952139015327755", // Superior
  "1230952186549243948", // Líder de Mods
  "1230949752733175888"  // Supervisor
];

// IDs de usuarios exentos del registro
const exemptUserIds = ["956700088103747625", "1032482231677108224"];

// =========================
// COMANDOS !automod y !help
// =========================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith("!")) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Solo Admins pueden usar estos comandos
  if (!message.member.roles.cache.some(r => r.name.toLowerCase() === "admin")) return;

  // ======== !automod on/off/status ========
  if (command === "automod") {
    const option = args[0]?.toLowerCase();

    if (option === "on") {
      automodActivo = true;
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("✅ AutoMod Activado")
        .setDescription("El sistema de moderación automática ha sido **activado** correctamente.");
      return message.channel.send({ embeds: [embed] });
    }

    if (option === "off") {
      automodActivo = false;
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("⛔ AutoMod Desactivado")
        .setDescription("El sistema de moderación automática ha sido **desactivado**.");
      return message.channel.send({ embeds: [embed] });
    }

    if (option === "status") {
      const embed = new EmbedBuilder()
        .setColor(automodActivo ? 0x00ff00 : 0xff0000)
        .setTitle("📊 Estado del AutoMod")
        .setDescription(`El sistema de AutoMod está actualmente **${automodActivo ? "ACTIVADO" : "DESACTIVADO"}**.`);
      return message.channel.send({ embeds: [embed] });
    }

    return message.channel.send("Uso correcto: `!automod on`, `!automod off`, `!automod status`");
  }

  // ======== !help ========
  if (command === "help") {
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("📘 Lista de comandos disponibles")
      .setDescription("Estos son los comandos administrativos disponibles para el bot:")
      .addFields(
        { name: "🛠️ **!automod on / off / status**", value: "Activa, desactiva o consulta el estado del sistema AutoMod." },
        { name: "📋 **!clearwarnings @usuario**", value: "Elimina todas las advertencias acumuladas de un usuario." },
        { name: "🔍 **!help**", value: "Muestra este menú de ayuda con todos los comandos disponibles." }
      )
      .setFooter({ text: "SirgioBOT | Panel de administración" })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  }
});


// =========================
// SISTEMA DE REGISTRO DE STAFF
// =========================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (exemptUserIds.includes(message.author.id)) return;

  const isStaff = message.member?.roles.cache.some(role => staffRoles.includes(role.id));
  if (!isStaff) return;

  const logChannel = message.guild.channels.cache.get(staffLogChannelId);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle("📋 Registro de actividad del Staff")
    .setDescription(`**Mensaje enviado por:** <@${message.author.id}>`)
    .addFields(
      { name: "📄 Contenido", value: message.content || "*Mensaje vacío*" },
      { name: "📍 Canal", value: `<#${message.channel.id}>`, inline: true },
      { name: "🕒 Hora", value: `<t:${Math.floor(message.createdTimestamp / 1000)}:f>`, inline: true }
    )
    .setFooter({ text: "SirgioBOT - Registro de Staff" })
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
  if (!oldMessage || !newMessage) return;
  if (newMessage.author.bot) return;
  if (exemptUserIds.includes(newMessage.author.id)) return;

  const isStaff = newMessage.member?.roles.cache.some(role => staffRoles.includes(role.id));
  if (!isStaff) return;

  const logChannel = newMessage.guild.channels.cache.get(staffLogChannelId);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor(0x1e90ff)
    .setTitle("✏️ Mensaje editado por Staff")
    .setDescription(`**Usuario:** <@${newMessage.author.id}>`)
    .addFields(
      { name: "📍 Canal", value: `<#${newMessage.channel.id}>`, inline: true },
      { name: "📄 Antes", value: oldMessage.content || "*Vacío*" },
      { name: "📄 Después", value: newMessage.content || "*Vacío*" }
    )
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

client.on("messageDelete", async (message) => {
  if (!message || !message.author) return;
  if (message.author.bot) return;
  if (exemptUserIds.includes(message.author.id)) return;

  const isStaff = message.member?.roles.cache.some(role => staffRoles.includes(role.id));
  if (!isStaff) return;

  const logChannel = message.guild.channels.cache.get(staffLogChannelId);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor(0xdc143c)
    .setTitle("🗑️ Mensaje eliminado por Staff")
    .setDescription(`**Usuario:** <@${message.author.id}>`)
    .addFields(
      { name: "📍 Canal", value: `<#${message.channel.id}>`, inline: true },
      { name: "📄 Contenido", value: message.content || "*Vacío*" }
    )
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

// =========================
// LOGIN
// =========================
client.login(process.env.TOKEN);