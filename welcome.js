// =========================
// SirgioBOT - Sistema de Bienvenidas (versión corregida)
// =========================

const { EmbedBuilder, ChannelType } = require("discord.js");

const WELCOME_CHANNEL_ID = "1255251210173153342"; // Canal de bienvenidas
const RULES_CHANNEL_ID = "1212998742505037864";
const ROLES_CHANNEL_ID = "1422713049957273621";

module.exports = (client) => {
    client.on("guildMemberAdd", async (member) => {
        try {
            console.log(`[Welcome] Nuevo miembro detectado: ${member.user.tag}`);

            // Intentar obtener el canal correctamente
            let channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);

            // Si no está en caché, intentar obtenerlo con fetch
            if (!channel) {
                channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
            }

            // Verificar que sea un canal de texto válido
            if (!channel || channel.type !== ChannelType.GuildText) {
                console.error(`[Welcome] El canal con ID ${WELCOME_CHANNEL_ID} no es de texto o no existe.`);
                return;
            }

            // Crear embed de bienvenida
            const embed = new EmbedBuilder()
                .setColor("#00BFFF") // Celeste
                .setTitle(`¡Bienvenid@ ${member.user.username}! ✨`)
                .setDescription(
                    `¡Hola ${member}! Bienvenid@ a **${member.guild.name}** 💫\n\n` +
                    `Por favor, pasa a leer <#${RULES_CHANNEL_ID}> 📜 y visita <#${ROLES_CHANNEL_ID}> 🎭 para obtener tus roles.\n\n` +
                    `¡Esperamos que disfrutes tu estancia en el servidor! 🌈`
                )
                .setImage("https://images-ext-1.discordapp.net/external/gA9Y8BTjysXecAKEi8pwfnh7inNh6kawKGVhZQnlwDM/https/cdn.nekotina.com/guilds/1212886282645147768/23ff9a0e-6163-4852-abcb-54a938a41121.jpg?format=webp&width=800&height=834")
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setFooter({
                    text: "¿Cuánto tiempo durarás con el lag? :3",
                    iconURL: member.guild.iconURL({ dynamic: true })
                });

            // Enviar mensaje
            await channel.send({
                content: `✨ ${member} ha ingresado al servidor`,
                embeds: [embed],
            });

            console.log(`[Welcome] Mensaje enviado correctamente en ${channel.name}`);
        } catch (error) {
            console.error("Error al enviar mensaje de bienvenida:", error);
        }
    });
};
