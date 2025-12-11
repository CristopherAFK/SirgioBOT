const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {

    const config = {
        paises: {
            title: "Auto Roles de Países",
            color: 0xFFA500,
            image: "https://media.discordapp.net/attachments/1225629661627682846/1422268955170443274/58_sin_titulo_20250929110844.png",
            roles: {
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
                "🇩🇴": "1268406577522806845"
            },
            descriptions: {
                "1268383665168060517": "Venezuela",
                "1268383284023525426": "Colombia",
                "1268384015925252240": "Ecuador",
                "1268384143054471220": "Chile",
                "1268384222796582993": "Argentina",
                "1268384464115994686": "Perú",
                "1268384560325066864": "Bolivia",
                "1268384709461934160": "Uruguay",
                "1268384785403875350": "Paraguay",
                "1268384817645359215": "Panamá",
                "1268384915011932312": "Honduras",
                "1268385256507965450": "Guatemala",
                "1268385050802651217": "El Salvador",
                "1413710208546508901": "Costa Rica",
                "1268385311038246943": "México",
                "1268385402704756847": "España",
                "1268385447722356767": "Puerto Rico",
                "1268406577522806845": "República Dominicana"
            }
        },
        generos: {
            title: "Auto Roles de Géneros",
            color: 0xFF0000,
            image: "https://media.discordapp.net/attachments/1225629661627682846/1422283408935092376/58_sin_titulo_20250929120620.png",
            roles: {
                "🔒": "1268381141648277616",
                "⚧": "1268377460286951488",
                "👨": "1268377312227889223",
                "👩": "1268377374781739070"
            },
            descriptions: {
                "1268381141648277616": "Prefiero no decir",
                "1268377460286951488": "No binario/Otro",
                "1268377312227889223": "Hombre",
                "1268377374781739070": "Mujer"
            }
        },
        juegos: {
            title: "Auto Roles de Videojuegos",
            color: 0x00D9FF,
            image: "https://media.discordapp.net/attachments/1225629661627682846/1422289906079629403/58_sin_titulo_20250929123134.png",
            roles: {
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
            },
            descriptions: {
                "1350919243339923609": "Roblox",
                "1350917758988324885": "Among Us",
                "1350917038939308272": "Geometry Dash",
                "1350918091873320980": "Brawlstars",
                "1350917298051092651": "Fortnite",
                "1350917442557313257": "Minecraft",
                "1413239980196626452": "Mario 64",
                "1413240385521713222": "Friday Night Funkin",
                "1413243773990862968": "Hollow Knight",
                "1413243772703215679": "Clash Royale",
                "1413241320566161518": "Blue Lock Rivals"
            }
        },
        anuncios: {
            title: "Auto Roles de Anuncios",
            color: 0x39FF14,
            image: "https://media.discordapp.net/attachments/1225629661627682846/1422305674318053426/58_sin_titulo_20250929133434.png",
            roles: {
                "🎉": "1268376127920148510",
                "📺": "1268374279913996328",
                "🎵": "1268375078949621770",
                "👾": "1268374348641865769",
                "📼": "1268375969823985744",
                "🎶": "1268376833720586332",
                "📣": "1268374164595675309",
                "📝": "1268375562997600338"
            },
            descriptions: {
                "1268376127920148510": "Notificaciones de eventos",
                "1268374279913996328": "Anuncios de Directos en youtube",
                "1268375078949621770": "Notificaciones de Lives en tiktok",
                "1268374348641865769": "Notificaciones de Streams",
                "1268375969823985744": "Notificaciones de nuevos videos en youtube",
                "1268376833720586332": "Notificaciones de nuevos tiktoks",
                "1268374164595675309": "avisos generales",
                "1268375562997600338": "Anuncios de cambios"
            }
        }
    };

    const allRoleEmojis = {};
    for (const [key, category] of Object.entries(config)) {
        for (const [emoji, roleId] of Object.entries(category.roles)) {
            allRoleEmojis[emoji] = roleId;
        }
    }

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        
        if (message.content === '!setup-autoroles') {
            console.log("Iniciando envío de paneles con reacciones...");
            let successCount = 0;

            for (const [key, category] of Object.entries(config)) {
                try {
                    const embed = new EmbedBuilder()
                        .setTitle(category.title)
                        .setColor(category.color)
                        .setImage(category.image);

                    let description = "**Reacciona con el emoji correspondiente para obtener el rol:**\n\n";

                    for (const [emoji, roleId] of Object.entries(category.roles)) {
                        const roleDescription = category.descriptions[roleId] || "Sin descripción";
                        description += `${emoji} → <@&${roleId}> - *${roleDescription}*\n\n`;
                    }

                    embed.setDescription(description);
                    embed.setFooter({ text: "Reacciona para obtener/quitar el rol" });

                    const sentMessage = await message.channel.send({ embeds: [embed] });

                    for (const emoji of Object.keys(category.roles)) {
                        try {
                            await sentMessage.react(emoji);
                            await new Promise(resolve => setTimeout(resolve, 500));
                        } catch (err) {
                            console.error(`Error añadiendo reacción ${emoji}:`, err.message);
                        }
                    }

                    successCount++;
                    console.log(`✅ Panel ${category.title} enviado con reacciones.`);

                } catch (error) {
                    console.error(`❌ Error en panel ${category.title}:`, error);
                    message.channel.send(`⚠️ Error al enviar panel **${category.title}**: ${error.message}`);
                }
            }
            
            message.reply(`✅ Proceso finalizado. Paneles enviados: ${successCount}/${Object.keys(config).length}`);
        }
    });

    client.on('messageReactionAdd', async (reaction, user) => {
        if (user.bot) return;

        try {
            if (reaction.partial) {
                await reaction.fetch();
            }
        } catch (error) {
            console.error('Error fetching reaction:', error);
            return;
        }

        const emoji = reaction.emoji.name;
        const roleId = allRoleEmojis[emoji];

        if (!roleId) return;

        try {
            const guild = reaction.message.guild;
            if (!guild) return;

            const member = await guild.members.fetch(user.id);
            const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId);

            if (!role) {
                console.error(`Rol no encontrado: ${roleId}`);
                return;
            }

            if (!member.roles.cache.has(roleId)) {
                await member.roles.add(role);
                console.log(`✅ Rol ${role.name} añadido a ${user.tag}`);
                
                try {
                    await user.send({ content: `✅ Rol **${role.name}** asignado en ${guild.name}` });
                } catch {}
            }
        } catch (error) {
            console.error('Error añadiendo rol:', error);
        }
    });

    client.on('messageReactionRemove', async (reaction, user) => {
        if (user.bot) return;

        try {
            if (reaction.partial) {
                await reaction.fetch();
            }
        } catch (error) {
            console.error('Error fetching reaction:', error);
            return;
        }

        const emoji = reaction.emoji.name;
        const roleId = allRoleEmojis[emoji];

        if (!roleId) return;

        try {
            const guild = reaction.message.guild;
            if (!guild) return;

            const member = await guild.members.fetch(user.id);
            const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId);

            if (!role) {
                console.error(`Rol no encontrado: ${roleId}`);
                return;
            }

            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(role);
                console.log(`❌ Rol ${role.name} removido de ${user.tag}`);
                
                try {
                    await user.send({ content: `❌ Rol **${role.name}** removido en ${guild.name}` });
                } catch {}
            }
        } catch (error) {
            console.error('Error removiendo rol:', error);
        }
    });
};
