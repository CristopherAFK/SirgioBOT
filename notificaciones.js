const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const parser = new Parser();
const DATA_FILE = path.join(__dirname, 'notificaciones_data.json');

const CANALES = [
  {
    nombre: 'Sirgio_o',
    channelId: process.env.YOUTUBE_CHANNEL_1,
    mensaje: '¡Sirgio subio nuevo video en Sirgio_o! vayan a verlo'
  },
  {
    nombre: 'Sirgiotv',
    channelId: process.env.YOUTUBE_CHANNEL_2,
    mensaje: '¡Sirgio subio nuevo video en Sirgiotv vayan a verlo'
  }
];

const NOTIFICATION_CHANNEL_ID = '1228731751006736426';
const CHECK_INTERVAL_MINUTES = 3;

let data = {
  lastVideos: {}
};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = { ...data, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
    console.log('📁 notificaciones_data.json cargado');
  } catch (err) {
    console.error('Error cargando notificaciones_data.json:', err);
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error guardando notificaciones_data.json:', err);
  }
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

    try {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${canal.channelId}`;
      const feed = await parser.parseURL(feedUrl);

      if (feed.items && feed.items.length > 0) {
        const latestVideo = feed.items[0];
        const videoId = latestVideo.id.replace('yt:video:', '');
        const canalKey = canal.nombre;

        if (!data.lastVideos[canalKey]) {
          data.lastVideos[canalKey] = videoId;
          saveData();
          console.log(`📌 Video inicial guardado para ${canal.nombre}: ${videoId}`);
          return null;
        }

        if (data.lastVideos[canalKey] !== videoId) {
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
        }
      }

      return null;
    } catch (err) {
      console.error(`Error verificando YouTube para ${canal.nombre}:`, err.message);
      return null;
    }
  }

  async function sendNotification(videoData) {
    try {
      const channel = await client.channels.fetch(NOTIFICATION_CHANNEL_ID);
      if (!channel) {
        console.error('Canal de notificaciones no encontrado:', NOTIFICATION_CHANNEL_ID);
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎬 ${videoData.titulo}`)
        .setDescription(`${videoData.mensaje}\n\n${videoData.url}`)
        .setColor(0xFF0000)
        .setImage(videoData.thumbnail)
        .setTimestamp();

      await channel.send({ 
        content: videoData.mensaje + '\n' + videoData.url,
        embeds: [embed] 
      });
      
      console.log(`📢 Notificación enviada: ${videoData.canal} - ${videoData.titulo}`);

    } catch (err) {
      console.error('Error enviando notificación:', err);
    }
  }

  async function checkAllChannels() {
    console.log('🔍 Verificando canales de YouTube...');

    for (const canal of canalesConfigurados) {
      const result = await checkYouTubeChannel(canal);
      if (result) {
        await sendNotification(result);
      }
    }
  }

  client.once('ready', () => {
    console.log('📢 Sistema de notificaciones de YouTube iniciado');
    console.log(`   Canal de notificaciones: ${NOTIFICATION_CHANNEL_ID}`);
    console.log(`   Intervalo de verificación: ${CHECK_INTERVAL_MINUTES} minutos`);
    
    setTimeout(() => {
      checkAllChannels();
    }, 10000);

    setInterval(checkAllChannels, CHECK_INTERVAL_MINUTES * 60 * 1000);
  });

  return {
    checkAllChannels
  };
};
