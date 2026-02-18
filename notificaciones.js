const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const parser = new Parser();
const DATA_FILE = path.join(__dirname, 'notificaciones_data.json');
const LOG_PREFIX = '[Notificaciones]';

const CANALES = [
  {
    nombre: 'Sirgio_o',
    channelId: process.env.YOUTUBE_CHANNEL_1,
    mensaje: '¡Sirgio subio nuevo video en Sirgio_o! vayan a verlo'
  },
  {
    nombre: 'Sirgiotv',
    channelId: process.env.YOUTUBE_CHANNEL_2,
    mensaje: '¡Sirgio subio nuevo video en Sirgiotv! vayan a verlo'
  }
];

const { NOTIFICATION_CHANNEL_ID, ROLE_TO_MENTION } = require('./config');
const CHECK_INTERVAL_MINUTES = 3;

let data = {
  lastVideos: {}
};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = { ...data, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
    console.log(`${LOG_PREFIX} notificaciones_data.json cargado`);
  } catch (err) {
    console.error(`${LOG_PREFIX} Error cargando notificaciones_data.json:`, err.message);
  }
}

async function loadDataFromDB() {
  try {
    const { db } = require('./database');
    const stored = await db.getConfig('notificaciones_lastVideos');
    if (stored && typeof stored === 'object' && Object.keys(stored).length > 0) {
      data.lastVideos = { ...data.lastVideos, ...stored };
      console.log(`${LOG_PREFIX} Estado lastVideos cargado desde MongoDB`);
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Error cargando lastVideos desde DB:`, err.message);
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`${LOG_PREFIX} Error guardando notificaciones_data.json:`, err.message);
  }
  try {
    const { db } = require('./database');
    db.setConfig('notificaciones_lastVideos', data.lastVideos).catch(e => {
      console.error(`${LOG_PREFIX} Error guardando lastVideos en DB:`, e.message);
    });
  } catch (e) {}
}

module.exports = (client) => {
  const canalesConfigurados = CANALES.filter(c => c.channelId);
  
  if (canalesConfigurados.length === 0) {
    console.warn('⚠️ No hay canales de YouTube configurados - Sistema de notificaciones desactivado');
    console.warn('   Configura YOUTUBE_CHANNEL_1 y YOUTUBE_CHANNEL_2 con los Channel IDs');
    return;
  }

  console.log(`📢 Sistema de notificaciones cargado - ${canalesConfigurados.length} canal(es) configurado(s)`);

  async function checkYouTubeChannel(canal) {
    if (!canal.channelId) return null;

    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${canal.channelId}`;
    try {
      const feed = await parser.parseURL(feedUrl).catch(e => {
        const status = e.response?.status ?? e.statusCode ?? 'N/A';
        console.error(`${LOG_PREFIX} Error parser.parseURL ${canal.nombre} | URL: ${feedUrl} | message: ${e.message} | status: ${status}`);
        throw e;
      });

      if (feed.items && feed.items.length > 0) {
        const latestVideo = feed.items[0];
        const videoId = latestVideo.id.replace('yt:video:', '');
        const canalKey = canal.nombre;

        console.log(`🎬 Último video detectado para ${canal.nombre}: "${latestVideo.title}" (ID: ${videoId})`);

        if (!data.lastVideos[canalKey]) {
          data.lastVideos[canalKey] = videoId;
          saveData();
          console.log(`📌 Video inicial guardado para ${canal.nombre}: ${videoId}`);
          return null;
        }

        if (data.lastVideos[canalKey] !== videoId) {
          console.log(`🔔 ¡Nuevo video detectado! ${data.lastVideos[canalKey]} -> ${videoId}`);
          data.lastVideos[canalKey] = videoId;
          saveData();

          return {
            canal: canal.nombre,
            mensaje: canal.mensaje,
            titulo: latestVideo.title,
            url: latestVideo.link,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
            autor: latestVideo.author
          };
        } else {
          console.log(`ℹ️ No hay videos nuevos para ${canal.nombre} (ID actual: ${videoId})`);
        }
      } else {
        console.warn(`⚠️ El feed de ${canal.nombre} no contiene items.`);
      }

      return null;
    } catch (err) {
      console.error(`${LOG_PREFIX} Error crítico verificando YouTube para ${canal.nombre}:`, err.stack || err.message);
      return null;
    }
  }

  async function sendNotification(videoData) {
    try {
      console.log(`${LOG_PREFIX} Enviando notificación: ${videoData.canal} - ${videoData.titulo} -> canal ${NOTIFICATION_CHANNEL_ID}`);
      const channel = await client.channels.fetch(NOTIFICATION_CHANNEL_ID).catch(e => {
        console.error(`${LOG_PREFIX} Error fetching canal ${NOTIFICATION_CHANNEL_ID}:`, e.message);
        return null;
      });

      if (!channel) {
        console.error(`${LOG_PREFIX} Canal de notificaciones no encontrado o sin acceso: ${NOTIFICATION_CHANNEL_ID}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎬 ${videoData.titulo}`)
        .setDescription(`${videoData.mensaje}\n\n${videoData.url}`)
        .setColor(0xFF0000)
        .setImage(videoData.thumbnail)
        .setTimestamp();

      await channel.send({ 
        content: `<@&${ROLE_TO_MENTION}>\n${videoData.mensaje}\n${videoData.url}`,
        embeds: [embed] 
      }).catch(e => {
        console.error(`${LOG_PREFIX} Error al enviar mensaje al canal:`, e.message, e.stack || '');
        throw e;
      });

      console.log(`${LOG_PREFIX} Notificación enviada: ${videoData.canal} - ${videoData.titulo}`);
    } catch (err) {
      console.error(`${LOG_PREFIX} Error enviando notificación:`, err.stack || err.message);
    }
  }

  async function checkAllChannels() {
    console.log(`${LOG_PREFIX} Inicio verificación de canales...`);

    for (const canal of canalesConfigurados) {
      const result = await checkYouTubeChannel(canal);
      if (result) {
        await sendNotification(result);
      }
    }
  }

  // Nueva función para obtener los últimos 3 videos de un canal
  async function getRecentVideos(canal) {
    if (!canal.channelId) return [];

    try {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${canal.channelId}`;
      const feed = await parser.parseURL(feedUrl);

      if (feed.items && feed.items.length > 0) {
        return feed.items.slice(0, 3).map(item => ({
          canal: canal.nombre,
          mensaje: canal.mensaje,
          titulo: item.title,
          url: item.link,
          thumbnail: `https://i.ytimg.com/vi/${item.id.replace('yt:video:', '')}/maxresdefault.jpg`,
          autor: item.author
        }));
      }
      return [];
    } catch (err) {
      console.error(`${LOG_PREFIX} Error obteniendo videos recientes para ${canal.nombre}:`, err.message);
      return [];
    }
  }

  client.once('ready', async () => {
    console.log(`${LOG_PREFIX} Sistema de notificaciones de YouTube iniciado`);
    console.log(`${LOG_PREFIX} Canal de notificaciones: ${NOTIFICATION_CHANNEL_ID}`);
    console.log(`${LOG_PREFIX} Intervalo de verificación: ${CHECK_INTERVAL_MINUTES} min`);
    await loadDataFromDB();

    setTimeout(() => {
      checkAllChannels();
    }, 10000);

    setInterval(checkAllChannels, CHECK_INTERVAL_MINUTES * 60 * 1000);
  });

  return {
    checkAllChannels,
    sendNotification,
    getRecentVideos,
    canalesConfigurados
  };
};
