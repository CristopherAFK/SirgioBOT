const axios = require('axios');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const parser = new Parser();
const DATA_FILE = path.join(__dirname, 'notificaciones_data.json');

const COLORES = {
  youtube: 0xFF0000,
  youtube_live: 0xFF0000,
  twitch: 0x9146FF,
  tiktok: 0x00F2EA,
  tiktok_live: 0xFF0050
};

const EMOJIS = {
  youtube: '🎬',
  youtube_live: '🔴',
  twitch: '🟣',
  tiktok: '🎵',
  tiktok_live: '📱'
};

let data = {
  lastYouTubeVideo: null,
  lastTwitchStatus: false,
  lastYouTubeLive: false,
  twitchAccessToken: null,
  twitchTokenExpiry: 0
};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = { ...data, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
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

module.exports = (client, config) => {
  const {
    NOTIFICATION_CHANNEL_ID,
    YOUTUBE_CHANNEL_ID,
    YOUTUBE_API_KEY,
    TWITCH_CLIENT_ID,
    TWITCH_CLIENT_SECRET,
    TWITCH_USERNAME,
    TIKTOK_USERNAME,
    ROLE_TO_MENTION,
    CHECK_INTERVAL_MINUTES = 5
  } = config;

  if (!NOTIFICATION_CHANNEL_ID) {
    console.warn('⚠️ NOTIFICATION_CHANNEL_ID no configurado - Sistema de notificaciones desactivado');
    return;
  }

  console.log('📢 Sistema de notificaciones cargado');

  const checkIntervalMs = CHECK_INTERVAL_MINUTES * 60 * 1000;

  async function getTwitchAccessToken() {
    if (data.twitchAccessToken && Date.now() < data.twitchTokenExpiry) {
      return data.twitchAccessToken;
    }

    try {
      const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          client_id: TWITCH_CLIENT_ID,
          client_secret: TWITCH_CLIENT_SECRET,
          grant_type: 'client_credentials'
        }
      });

      data.twitchAccessToken = response.data.access_token;
      data.twitchTokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
      saveData();
      return data.twitchAccessToken;
    } catch (err) {
      console.error('Error obteniendo token de Twitch:', err.message);
      return null;
    }
  }

  async function checkTwitchStream() {
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !TWITCH_USERNAME) {
      return null;
    }

    try {
      const token = await getTwitchAccessToken();
      if (!token) return null;

      const response = await axios.get('https://api.twitch.tv/helix/streams', {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`
        },
        params: {
          user_login: TWITCH_USERNAME
        }
      });

      const streams = response.data.data;
      const isLive = streams.length > 0;

      if (isLive && !data.lastTwitchStatus) {
        const stream = streams[0];
        data.lastTwitchStatus = true;
        saveData();

        return {
          type: 'twitch',
          title: stream.title,
          game: stream.game_name,
          thumbnail: stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720'),
          url: `https://www.twitch.tv/${TWITCH_USERNAME}`,
          viewers: stream.viewer_count
        };
      } else if (!isLive && data.lastTwitchStatus) {
        data.lastTwitchStatus = false;
        saveData();
      }

      return null;
    } catch (err) {
      console.error('Error verificando Twitch:', err.message);
      return null;
    }
  }

  async function checkYouTubeVideo() {
    if (!YOUTUBE_CHANNEL_ID) return null;

    try {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;
      const feed = await parser.parseURL(feedUrl);

      if (feed.items && feed.items.length > 0) {
        const latestVideo = feed.items[0];
        const videoId = latestVideo.id.replace('yt:video:', '');

        if (data.lastYouTubeVideo !== videoId) {
          const oldVideo = data.lastYouTubeVideo;
          data.lastYouTubeVideo = videoId;
          saveData();

          if (oldVideo !== null) {
            return {
              type: 'youtube',
              title: latestVideo.title,
              url: latestVideo.link,
              thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
              author: latestVideo.author,
              published: latestVideo.pubDate
            };
          }
        }
      }

      return null;
    } catch (err) {
      console.error('Error verificando YouTube RSS:', err.message);
      return null;
    }
  }

  async function checkYouTubeLive() {
    if (!YOUTUBE_API_KEY || !YOUTUBE_CHANNEL_ID) return null;

    try {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          channelId: YOUTUBE_CHANNEL_ID,
          eventType: 'live',
          type: 'video',
          key: YOUTUBE_API_KEY
        }
      });

      const isLive = response.data.items && response.data.items.length > 0;

      if (isLive && !data.lastYouTubeLive) {
        const live = response.data.items[0];
        data.lastYouTubeLive = true;
        saveData();

        return {
          type: 'youtube_live',
          title: live.snippet.title,
          url: `https://www.youtube.com/watch?v=${live.id.videoId}`,
          thumbnail: live.snippet.thumbnails.high.url,
          description: live.snippet.description
        };
      } else if (!isLive && data.lastYouTubeLive) {
        data.lastYouTubeLive = false;
        saveData();
      }

      return null;
    } catch (err) {
      console.error('Error verificando YouTube Live:', err.message);
      return null;
    }
  }

  async function sendNotification(notificationData) {
    try {
      const channel = await client.channels.fetch(NOTIFICATION_CHANNEL_ID);
      if (!channel) {
        console.error('Canal de notificaciones no encontrado');
        return;
      }

      const { type, title, url, thumbnail } = notificationData;
      const emoji = EMOJIS[type] || '📢';
      const color = COLORES[type] || 0x00FF00;

      let description = '';
      let embedTitle = '';

      switch (type) {
        case 'youtube':
          embedTitle = `${emoji} Nuevo Video en YouTube!`;
          description = `**${title}**\n\n[Ver Video](${url})`;
          break;
        case 'youtube_live':
          embedTitle = `${emoji} EN VIVO en YouTube!`;
          description = `**${title}**\n\n[Ver Directo](${url})`;
          break;
        case 'twitch':
          embedTitle = `${emoji} EN VIVO en Twitch!`;
          description = `**${title}**\n${notificationData.game ? `Jugando: ${notificationData.game}` : ''}\n\n[Ver Stream](${url})`;
          break;
        case 'tiktok':
          embedTitle = `${emoji} Nuevo TikTok!`;
          description = `**${title || 'Nuevo video'}**\n\n[Ver TikTok](${url})`;
          break;
        case 'tiktok_live':
          embedTitle = `${emoji} EN VIVO en TikTok!`;
          description = `**${title || 'Transmitiendo ahora'}**\n\n[Ver Live](${url})`;
          break;
      }

      const embed = new EmbedBuilder()
        .setTitle(embedTitle)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();

      if (thumbnail) {
        embed.setImage(thumbnail);
      }

      let content = '';
      if (ROLE_TO_MENTION) {
        content = `<@&${ROLE_TO_MENTION}>`;
      }

      await channel.send({ content, embeds: [embed] });
      console.log(`📢 Notificación enviada: ${type} - ${title}`);

    } catch (err) {
      console.error('Error enviando notificación:', err);
    }
  }

  async function checkAllPlatforms() {
    console.log('🔍 Verificando plataformas...');

    const twitchResult = await checkTwitchStream();
    if (twitchResult) await sendNotification(twitchResult);

    const youtubeVideoResult = await checkYouTubeVideo();
    if (youtubeVideoResult) await sendNotification(youtubeVideoResult);

    const youtubeLiveResult = await checkYouTubeLive();
    if (youtubeLiveResult) await sendNotification(youtubeLiveResult);

  }

  client.once('ready', () => {
    console.log('📢 Sistema de notificaciones iniciado');
    
    setTimeout(() => {
      checkAllPlatforms();
    }, 10000);

    setInterval(checkAllPlatforms, checkIntervalMs);
  });

  client.notifyTikTokVideo = async (videoUrl, title = null) => {
    await sendNotification({
      type: 'tiktok',
      title: title || 'Nuevo TikTok',
      url: videoUrl || `https://www.tiktok.com/@${TIKTOK_USERNAME}`,
      thumbnail: null
    });
  };

  client.notifyTikTokLive = async (title = null) => {
    await sendNotification({
      type: 'tiktok_live',
      title: title || 'EN VIVO ahora!',
      url: `https://www.tiktok.com/@${TIKTOK_USERNAME}/live`,
      thumbnail: null
    });
  };

  client.notifyManual = async (type, title, url, thumbnail = null) => {
    await sendNotification({ type, title, url, thumbnail });
  };

  return {
    checkAllPlatforms,
    sendNotification,
    notifyTikTokVideo: client.notifyTikTokVideo,
    notifyTikTokLive: client.notifyTikTokLive
  };
};
