// =========================
// SirgioBOT - Sistema de Tickets completo (único archivo)
// - !panel -> envía embed verde + select (no botón intermedio)
// - Confirmación (Aceptar / Cancelar)
// - Un ticket por usuario
// - ticket-username-001
// - Persistencia en tickets.json
// - Mensaje en el canal del ticket con botón "Atender ticket" (staff)
// - Claim: staff al pulsar "Atender ticket" anuncia que atenderá
// - !cerrar / !close / !eliminar / !borrar -> solo staff: genera transcripción .txt -> envía a canal logs -> elimina canal
// =========================

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  AttachmentBuilder
} = require("discord.js");
const express = require("express");

// -------------------------
// CONFIG
// -------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

// STAFF ROLES (admin, mod, headadmin)
const STAFF_ROLE_IDS = [
  "1212891335929897030", // admin
  "1229140504310972599", // mod
  "1230952139015327755"  // headadmin (incluido por si acaso)
];

// ID de la categoría donde se crearán los tickets
const TICKET_CATEGORY_ID = "1228437209628020736";

// Canal donde se enviarán las transcripciones (logs)
const LOGS_CHANNEL_ID = "1431416957160259764";

// Archivo de persistencia
const DATA_FILE = path.join(__dirname, "tickets.json");

// Emojis personalizados (objeto usado por select/embeds)
const EMOJI_IDS = {
  discord_bots: { id: "1431413172513804348", name: "emoji_104" },
  report_user:  { id: "1431408998887981147", name: "emoji_99" },
  streams:      { id: "1268414311509004460", name: "Twitch" },
  lives:        { id: "1268414284077994034", name: "TikTok" },
  dudas:        { id: "1431412814345404618", name: "emoji_103" },
  otro:         { id: "1431415219367842032", name: "emoji_106" }
};

// Thumbnail para el embed del panel (aparecerá arriba a la derecha)
const PANEL_THUMBNAIL = "https://media.discordapp.net/attachments/1420914042251509990/1430698897927307347/79794618.png";

// -------------------------
// PERSISTENCIA - cargar / guardar
// -------------------------
let data = { lastTicket: 0, userHasTicket: {}, channels: {} };
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    data = JSON.parse(raw);
    if (!data.lastTicket) data.lastTicket = 0;
    if (!data.userHasTicket) data.userHasTicket = {};
    if (!data.channels) data.channels = {};
    console.log(`📁 tickets.json cargado (lastTicket=${data.lastTicket})`);
  } catch (err) {
    console.error("⚠️ Error leyendo tickets.json, se recreará uno nuevo:", err);
    data = { lastTicket: 0, userHasTicket: {}, channels: {} };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  }
} else {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("⚠️ Error guardando tickets.json:", err);
  }
}

function sanitizeChannelName(name) {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 90);
}

function isStaff(member) {
  if (!member) return false;
  return member.roles.cache.some(r => STAFF_ROLE_IDS.includes(r.id));
}

// -------------------------
// !panel -> enviar embed + select (visible donde lo invoquen staff)
// -------------------------
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (message.content.toLowerCase() !== "!panel") return;

    if (!message.member) await message.guild.members.fetch(message.author.id).catch(() => {});
    if (!isStaff(message.member)) {
      return message.reply("❌ Solo el staff puede usar este comando.");
    }

    const embed = new EmbedBuilder()
      .setTitle("🎟️ LagSupport")
      .setDescription(
        "¿Tienes alguna duda respecto al servidor? ¿Alguien te está molestando y deseas reportarlo? ¿Deseas apelar una sanción injusta?\n\n" +
        "En este canal podrás abrir un ticket para hablar directamente con el staff de Sirgio, quienes te ayudarán con los problemas o dudas que tengas. " +
        "Simplemente tienes que elegir una opción con el menú de abajo el tipo de ayuda que necesitas y después explicar el problema que tienes."
      )
      .setColor(0x00FF80)
      .setThumbnail(PANEL_THUMBNAIL)
      .setTimestamp();

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_category_select")
      .setPlaceholder("Selecciona una categoría")
      .addOptions([
        { label: "Discord Bots", value: "discord_bots", emoji: EMOJI_IDS.discord_bots },
        { label: "Reportar usuario", value: "report_user", emoji: EMOJI_IDS.report_user },
        { label: "Streams", value: "streams", emoji: EMOJI_IDS.streams },
        { label: "Lives", value: "lives", emoji: EMOJI_IDS.lives },
        { label: "Dudas", value: "dudas", emoji: EMOJI_IDS.dudas },
        { label: "Otro", value: "otro", emoji: EMOJI_IDS.otro }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);
    await message.channel.send({ embeds: [embed], components: [row] });
    await message.reply({ content: "✅ Panel de tickets enviado correctamente.", ephemeral: true }).catch(()=>{});
  } catch (err) {
    console.error("Error en !panel:", err);
  }
});

// -------------------------
// Interactions: select -> confirm buttons, buttons -> confirm/cancel/claim
// -------------------------
client.on("interactionCreate", async (interaction) => {
  try {
    // ---- Select menu: user eligió categoría ----
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_category_select") {
      const chosen = interaction.values[0];
      const userId = interaction.user.id;

      // Verificar ticket existente
      if (data.userHasTicket[userId]) {
        const chId = data.userHasTicket[userId];
        const ch = interaction.guild.channels.cache.get(chId) || await interaction.guild.channels.fetch(chId).catch(()=>null);
        return interaction.reply({ content: `❗️ Ya tienes un ticket abierto: ${ch ? ch.toString() : chId}`, ephemeral: true });
      }

      // Crear botones confirm/cancel
      const confirmId = `confirm_ticket_${userId}_${Date.now()}_${chosen}`;
      const cancelId = `cancel_ticket_${userId}_${Date.now()}_${chosen}`;
      const confirmBtn = new ButtonBuilder().setCustomId(confirmId).setLabel("Aceptar ✅").setStyle(ButtonStyle.Success);
      const cancelBtn = new ButtonBuilder().setCustomId(cancelId).setLabel("Cancelar ❌").setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

      const embed = new EmbedBuilder()
        .setTitle("🟢 Confirmar apertura de ticket")
        .setDescription(`${EMOJI_IDS[chosen] ? `<:${EMOJI_IDS[chosen].name}:${EMOJI_IDS[chosen].id}> ` : ""}Has elegido: **${chosen.replace(/_/g, " ")}**\n\nSi continúas se abrirá un ticket en el que podrás explicar tu problema.`)
        .setColor(0x00FF80)
        .setTimestamp();

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    // ---- Botones ----
    if (interaction.isButton()) {
      const id = interaction.customId;

      // Cancel button
      if (id.startsWith("cancel_ticket_")) {
        const parts = id.split("_");
        const userId = parts[2];
        // Solo el que inició o staff puede cancelar
        if (userId !== interaction.user.id && !isStaff(interaction.member)) {
          return interaction.reply({ content: "❗ Solo quien inició la apertura o el staff puede cancelar.", ephemeral: true });
        }
        return interaction.update({ content: "❌ Apertura de ticket cancelada.", embeds: [], components: [] });
      }

      // Confirm button -> crear ticket
      if (id.startsWith("confirm_ticket_")) {
        const parts = id.split("_");
        const userId = parts[2];
        const chosen = parts.slice(4).join("_") || "otro";

        // Solo el que inició o staff puede confirmar
        if (userId !== interaction.user.id && !isStaff(interaction.member)) {
          return interaction.reply({ content: "❗ Solo quien inició la apertura o el staff puede confirmar.", ephemeral: true });
        }

        // doble-check ticket abierto
        if (data.userHasTicket[userId]) {
          const existingId = data.userHasTicket[userId];
          const ch = interaction.guild.channels.cache.get(existingId) || await interaction.guild.channels.fetch(existingId).catch(()=>null);
          return interaction.update({ content: `❗️ Ya tienes un ticket abierto: ${ch ? ch.toString() : existingId}`, embeds: [], components: [] });
        }

        // Generar nuevo ticket
        data.lastTicket = (data.lastTicket || 0) + 1;
        const number = String(data.lastTicket).padStart(3, "0");
        const username = interaction.user.username || "user";
        const rawName = `${username}-${number}`;
        const chanName = sanitizeChannelName(rawName);

        // Preparar overwrites
        const overwrites = [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
          ...STAFF_ROLE_IDS.map(roleId => ({
            id: roleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          }))
        ];

        // Intentar crear canal en la categoría; si falla, crear sin parent
        let channel;
        try {
          // si la categoría existe, la usamos; si no, Discord ignorará parent si es inválido -> atrapamos error
          channel = await interaction.guild.channels.create({
            name: chanName,
            type: ChannelType.GuildText,
            parent: TICKET_CATEGORY_ID,
            permissionOverwrites: overwrites,
            reason: `Ticket creado por ${interaction.user.tag}`
          });
        } catch (err) {
          console.warn("No se pudo crear canal con parent (categoria):", err);
          channel = await interaction.guild.channels.create({
            name: chanName,
            type: ChannelType.GuildText,
            permissionOverwrites: overwrites,
            reason: `Ticket creado por ${interaction.user.tag} (categoria fallback)`
          });
        }

        // Guardar referencias
        data.userHasTicket[interaction.user.id] = channel.id;
        data.channels[channel.id] = {
          ownerId: interaction.user.id,
          number,
          category: chosen,
          createdAt: new Date().toISOString(),
          claimedBy: null
        };
        saveData();

        // Mensaje en el canal del ticket con botón "Atender ticket"
        const claimBtn = new ButtonBuilder().setCustomId(`claim_ticket_${channel.id}`).setLabel("🧑‍💼 Atender ticket").setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(claimBtn);

        const embedTicket = new EmbedBuilder()
          .setTitle("👋 ¡Bienvenido!")
          .setDescription(`<@${interaction.user.id}> Bienvenido\n\nEl Staff atenderá tu caso en breve.`)
          .setColor(0x00FF80)
          .setFooter({ text: `Ticket #${number}` })
          .setTimestamp();

        await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embedTicket], components: [row] });

        // Responder al usuario (ephemeral)
        try {
          await interaction.update({ content: `✅ Ticket creado: ${channel}`, embeds: [], components: [] });
        } catch {
          await interaction.reply({ content: `✅ Ticket creado: ${channel}`, ephemeral: true });
        }

        return;
      }

      // Claim button -> staff atendiendo
      if (id.startsWith("claim_ticket_")) {
        const channelId = id.replace("claim_ticket_", "");
        const ticket = data.channels[channelId];
        if (!ticket) return interaction.reply({ content: "❗ Ticket no encontrado en registros.", ephemeral: true });

        // Solo staff puede claim
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "❌ Solo moderadores/administradores pueden atender tickets.", ephemeral: true });
        }

        // Intentar dar permiso específico al claimer (no estrictamente necesario si roles ya tienen acceso)
        try {
          await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
          });
        } catch (err) {
          console.warn("No se pudieron editar permisos al claim:", err);
        }

        ticket.claimedBy = interaction.user.id;
        saveData();

        // Mensaje anunciando quien atenderá
        const ownerId = ticket.ownerId;
        await interaction.channel.send({ content: `💬 Hola <@${ownerId}>, gracias por comunicarte con el staff. <@${interaction.user.id}> atenderá tu ticket.` });
        return interaction.reply({ content: `Has atendido el ticket ${interaction.channel}.`, ephemeral: true });
      }
    }
  } catch (err) {
    console.error("Error en interactionCreate:", err);
    try { if (!interaction.replied) await interaction.reply({ content: "Ocurrió un error.", ephemeral: true }); } catch {}
  }
});

// -------------------------
// Cerrar ticket: !cerrar / !close / !eliminar / !borrar (solo staff)
// - genera transcripción .txt, la envía al canal LOGS_CHANNEL_ID con embed y adjunto
// - elimina referencias y borra canal
// -------------------------
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    const parts = message.content.trim().toLowerCase().split(/\s+/);
    const cmd = parts[0];
    const closeCmds = ["!cerrar", "!close", "!eliminar", "!borrar"];
    if (!closeCmds.includes(cmd)) return;

    if (!message.member) await message.guild.members.fetch(message.author.id).catch(()=>{});
    if (!isStaff(message.member)) return message.reply("❌ Solo el staff puede usar este comando.");

    const channel = message.channel;
    const ticket = data.channels[channel.id];
    if (!ticket) {
      return message.reply("⚠️ Este canal no parece ser un ticket gestionado por el sistema.");
    }

    // Crear transcripción: leer todos los mensajes (últimos hasta cubrir todo)
    let allMessages = [];
    try {
      let lastId;
      while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;
        const fetched = await channel.messages.fetch(options);
        if (!fetched || fetched.size === 0) break;
        const arr = Array.from(fetched.values());
        allMessages.push(...arr);
        lastId = arr[arr.length - 1].id;
        if (fetched.size < 100) break;
      }
      // ordenar cronológicamente
      allMessages = allMessages.sort((a,b) => a.createdTimestamp - b.createdTimestamp);
    } catch (err) {
      console.warn("No se pudieron leer todos los mensajes para transcripción:", err);
    }

    // Construir texto de transcripción
    let transcript = `Transcripción - Ticket #${ticket.number} - ${channel.name}\nCreado por: <@${ticket.ownerId}>\nCategoría: ${ticket.category}\nCerrado por: <@${message.author.id}>\nFecha: ${new Date().toISOString()}\n\n--- Mensajes ---\n\n`;
    for (const m of allMessages) {
      const time = new Date(m.createdTimestamp).toISOString();
      const author = `${m.author.tag} (${m.author.id})`;
      let content = m.content || "";
      if (m.attachments && m.attachments.size > 0) {
        const urls = m.attachments.map(a => a.url).join(", ");
        content += (content ? " " : "") + `[Adjuntos: ${urls}]`;
      }
      transcript += `[${time}] ${author}: ${content}\n`;
    }

    // Crear archivo temporal
    const filename = `transcript-${channel.name || ticket.number}.txt`;
    const tmpPath = path.join(os.tmpdir(), `${Date.now()}-${filename}`);
    try {
      fs.writeFileSync(tmpPath, transcript, "utf8");
    } catch (err) {
      console.error("Error creando archivo temporal de transcripción:", err);
    }

    // Enviar embed + adjunto al canal de logs
    try {
      const logsChannel = await message.guild.channels.fetch(LOGS_CHANNEL_ID).catch(()=>null);
      const embed = new EmbedBuilder()
        .setTitle("📁 Transcripción de ticket")
        .setDescription(`Se ha cerrado el ticket **#${ticket.number}** (${channel.name}).`)
        .addFields(
          { name: "Usuario", value: `<@${ticket.ownerId}>`, inline: true },
          { name: "Cerrado por", value: `<@${message.author.id}>`, inline: true },
          { name: "Canal", value: `${channel.name}`, inline: true }
        )
        .setColor(0x00FF80)
        .setTimestamp();

      if (logsChannel) {
        const attachment = new AttachmentBuilder(tmpPath, { name: filename });
        await logsChannel.send({ embeds: [embed], files: [attachment] }).catch(err => {
          console.warn("No se pudo enviar la transcripción al canal logs:", err);
        });
      } else {
        console.warn("Canal de logs no encontrado, omitiendo envío de transcripción.");
      }
    } catch (err) {
      console.error("Error enviando transcripción al canal logs:", err);
    }

    // Limpiar referencias y eliminar canal tras breve delay
    delete data.userHasTicket[ticket.ownerId];
    delete data.channels[channel.id];
    saveData();

    await message.reply("🗑️ Ticket cerrado. Eliminando canal en 5 segundos...");
    setTimeout(async () => {
      try {
        await channel.delete("Ticket cerrado por staff");
      } catch (err) {
        console.error("Error eliminando canal de ticket:", err);
      } finally {
        // eliminar archivo temporal
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
      }
    }, 5000);

  } catch (err) {
    console.error("Error en comando de cierre de ticket:", err);
  }

// ===== Autogenerador de autoroles (comando !roles) + listeners de reacciones =====
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

// CONFIG
const ALLOWED_ROLE = "1423037245279047711"; // quien puede usar !roles
const TARGET_CHANNEL = "1422713049957273621"; // donde se enviarán los embeds

// Mapas de reacciones (emoji -> roleId)
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

const generoReacciones = {
  "🔒": "1268381141648277616",
  "⚧️": "1268377460286951488",
  "♂️": "1268377312227889223",
  "♀️": "1268377374781739070",
};

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

// Mensajes informativos (no tienen reacciones)
const staffEmbed = new EmbedBuilder()
  .setColor("#43B581")
  .setImage("https://media.discordapp.net/attachments/1225629661627682846/1422065793499136151/58_sin_titulo_20250928214126.png")
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

const nivelesEmbed = new EmbedBuilder()
  .setColor("#5DADEC")
  .setImage("https://media.discordapp.net/attachments/1225629661627682846/1422073914686701639/58_sin_titulo_20250928221347.png")
  .setDescription(
    "<@&1313716964383920269>: Usuarios que han llegado a nivel Nivel 100 — Personas que han llegado a nivel 100. Pueden añadir un emoji de su gusto al servidor y cambiarse el apodo del servidor a merced..\n\n" +
    "<@&1313716864790302730>: Usuarios que han llegado a nivel Nivel 75.\n\n" +
    "<@&1313716715934453761>: Usuarios que han llegado a nivel Nivel 50.\n\n" +
    "<@&1313716612452581437>: Usuarios que han llegado a nivel Nivel 40.\n\n" +
    "<@&1313716401021911102>: Usuarios que han llegado a nivel  Nivel 35 — Teniendo Acceso al canal de spam.\n\n" +
    "<@&1239330751334584421>: Nivel 25 — Pueden mandar imágenes y videos en ⁠#1422783198655545435.\n\n" +
    "<@&1313716306599481436>: Nivel 20.\n\n" +
    "<@&1313716235573264437>: Nivel 10 — Pueden mandar Gifs en ⁠#1422783198655545435.\n\n" +
    "<@&1313716079998140536>: Nivel 5 — Pueden mandar audios en ⁠#1422783198655545435.\n\n" +
    "<@&1313715879816597514>: Nivel 1.\n\n" +
    "📘 **Nota:** Todos los que queden a partir del Top 10 en la tabla de niveles obtendrán un rol exclusivo, y el Top 1 su propio rol exclusivo.\n\n" +
    "<@&1255562775888003124>: Temporada 1 (Top 10+).\n\n" +
    "<@&1267286215439421534>: Temporada 2 (Top 10+).\n\n" +
    "<@&1316821713362878594>: Temporada 3 (Top 10+)."
  );

const exclusivosEmbed = new EmbedBuilder()
  .setColor("#9B59B6")
  .setImage("https://media.discordapp.net/attachments/1225629661627682846/1422246097820057742/58_sin_titulo_20250929093723.png")
  .setDescription(
    "<@&1229938887955189843>: Boosters — Acceso a canales exclusivos.\n\n" +
    "<@&1433610447944417312>: Usuarios que aportan sugerencias.\n\n" +
    "<@&1230595787717611686>: Suscriptores de Sirgio.\n\n" +
    "<@&1422077772393746583>: Actualización del 1/10/25.\n\n" +
    "<@&1431822024833241188>: Participantes en la Sapo Invasión.\n\n" +
    "<@&1268066983333593088>: Usuarios activos en ⁠#1422813008815456347."
  );

const paisesEmbed = new EmbedBuilder()
  .setColor("#E67E22")
  .setImage("https://media.discordapp.net/attachments/1225629661627682846/1422283408935092376/58_sin_titulo_20250929120620.png")
  .setDescription("🌎 Reacciona con la bandera de tu país para obtener el rol correspondiente.");

const generoEmbed = new EmbedBuilder()
  .setColor("#E74C3C")
  .setImage("https://media.discordapp.net/attachments/1225629661627682846/1422283408935092376/58_sin_titulo_20250929120620.png")
  .setDescription("🔒 Privado\n\n⚧️ No binarie\n\n♂️ Hombre\n\n♀️ Mujer");

const juegosEmbed = new EmbedBuilder()
  .setColor("#00C6FF")
  .setImage("https://media.discordapp.net/attachments/1225629661627682846/1422289906079629403/58_sin_titulo_20250929123134.png")
  .setDescription("⬛ 🚀 🟧 ⭐ 🔫 ⛏️ 🪠 🎤 🦟 👑 ⚽\nReacciona para obtener roles de tus juegos favoritos.");

const anunciosEmbed = new EmbedBuilder()
  .setColor("#C8FF00")
  .setImage("https://media.discordapp.net/attachments/1225629661627682846/1422305674318053426/58_sin_titulo_20250929133434.png")
  .setDescription("🎉 📺 🎵 👾 📼 🎶 📣 📝\nReacciona para recibir notificaciones específicas.");

// Lista de mensajes que se enviarán
const mensajes = [
  { embed: staffEmbed },
  { embed: nivelesEmbed },
  { embed: exclusivosEmbed },
  { embed: paisesEmbed, reactions: paisesReacciones },
  { embed: generoEmbed, reactions: generoReacciones },
  { embed: juegosEmbed, reactions: juegosReacciones },
  { embed: anunciosEmbed, reactions: anunciosReacciones },
];

// Guardamos en memoria los IDs de los mensajes que generó el bot
const autorolesMessageIds = new Set();

// Listener: comando !roles (texto)
client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;
    if (message.content.trim().toLowerCase() !== '!roles') return;

    // canal / rol requerido
    if (message.channel.id !== TARGET_CHANNEL) {
      return message.reply(`❌ Usa este comando en <#${TARGET_CHANNEL}>.`);
    }
    if (!message.member.roles.cache.has(ALLOWED_ROLE)) {
      return message.reply('❌ No tienes permiso para usar este comando.');
    }

    const botMember = message.guild.members.me;
    if (!botMember.permissionsIn(message.channel).has([
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.EmbedLinks,
      PermissionsBitField.Flags.AddReactions,
      PermissionsBitField.Flags.ManageRoles
    ])) {
      return message.reply('❌ No tengo permisos suficientes en ese canal (Enviar mensajes, Insertar enlaces, Añadir reacciones, Gestionar roles).');
    }

    // Enviar los embeds uno por uno y reaccionar
    for (const { embed, reactions } of mensajes) {
      const sent = await message.channel.send({ embeds: [embed] });
      autorolesMessageIds.add(sent.id);

      if (reactions) {
        // reacciona en el orden de las keys
        for (const emoji of Object.keys(reactions)) {
          try { await sent.react(emoji); } catch (err) { console.warn('No se pudo reaccionar con', emoji, err.message); }
        }
      }

      // opcional: espera 600ms entre mensajes para evitar ratelimits
      await new Promise(r => setTimeout(r, 600));
    }

    await message.reply('✅ Autoroles enviados correctamente.');
  } catch (err) {
    console.error('Error en !roles:', err);
    message.reply('❌ Ocurrió un error al intentar enviar los autoroles (mira la consola).');
  }
});

// Listener: agregar rol cuando reaccionan en los mensajes generados por el bot
client.on('messageReactionAdd', async (reaction, user) => {
  try {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    if (!autorolesMessageIds.has(reaction.message.id)) return; // importante: solo en mensajes generados por !roles

    const emoji = reaction.emoji.name;
    const guild = reaction.message.guild;
    if (!guild) return;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    // comprobar en cada mapa
    const roleId = paisesReacciones[emoji] || generoReacciones[emoji] || juegosReacciones[emoji] || anunciosReacciones[emoji];
    if (!roleId) return;

    // evadir errores si no se puede asignar
    await member.roles.add(roleId).catch(e => console.warn('No se pudo añadir rol:', roleId, e.message));
  } catch (err) {
    console.error('Err en messageReactionAdd:', err);
  }
});

// Listener: quitar rol cuando quitan reacción
client.on('messageReactionRemove', async (reaction, user) => {
  try {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    if (!autorolesMessageIds.has(reaction.message.id)) return;

    const emoji = reaction.emoji.name;
    const guild = reaction.message.guild;
    if (!guild) return;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const roleId = paisesReacciones[emoji] || generoReacciones[emoji] || juegosReacciones[emoji] || anunciosReacciones[emoji];
    if (!roleId) return;

    await member.roles.remove(roleId).catch(e => console.warn('No se pudo remover rol:', roleId, e.message));
  } catch (err) {
    console.error('Err en messageReactionRemove:', err);
  }
});

// -------------------------
// READY, Express y login
// -------------------------
client.once("ready", () => {
  console.log(`✅ SirgioBOT conectado como ${client.user.tag}`);
  client.user.setActivity("El Bot del Lag", { type: 3 });
});

const app = express();
app.get("/", (req, res) => res.send("SirgioBOT is alive!"));
app.listen(process.env.PORT || 3000, () => console.log("🌐 Servidor web activo para mantener el bot despierto."));

client.login(process.env.DISCORD_TOKEN || process.env.TOKEN);
  
