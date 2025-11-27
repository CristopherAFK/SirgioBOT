const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Módulo de Autoroles
 * 
 * Instrucciones:
 * 1. Requiere este archivo en tu index.js principal: require('./autoroles.js')(client);
 * 2. Asegúrate de que tu bot tenga los INTENTS activados (GuildMessages, MessageContent, Guilds).
 * 3. Usa el comando !setup-autoroles en Discord.
 * 
 * IMPORTANTE: Si editas este archivo, asegúrate de usar emojis Unicode (🇻🇪) y no texto (:flag_ve:) en las claves.
 * Los botones de Discord NO soportan el formato de texto (:nombre:).
 */

module.exports = (client) => {

    // Configuración de Roles con Emojis Unicode corregidos
    const config = {
        paises: {
            title: "Roles de Países",
            color: 0xFF0000, // Rojo fuerte
            image: "https://media.discordapp.net/attachments/1225629661627682846/1422268955170443274/58_sin_titulo_20250929110844.png",
            roles: {
                "🇻🇪": "1268383665168060517", // :flag_ve:
                "🇨🇴": "1268383284023525426", // :flag_co:
                "🇪🇨": "1268384015925252240", // :flag_ec:
                "🇨🇱": "1268384143054471220", // :flag_cl:
                "🇦🇷": "1268384222796582993", // :flag_ar:
                "🇵🇪": "1268384464115994686", // :flag_pe:
                "🇧🇴": "1268384560325066864", // :flag_bo:
                "🇺🇾": "1268384709461934160", // :flag_uy:
                "🇵🇾": "1268384785403875350", // :flag_py:
                "🇵🇦": "1268384817645359215", // :flag_pa:
                "🇭🇳": "1268384915011932312", // :flag_hn:
                "🇬🇹": "1268385256507965450", // :flag_gt:
                "🇸🇻": "1268385050802651217", // :flag_sv:
                "🇨🇷": "1413710208546508901", // :flag_cr:
                "🇲🇽": "1268385311038246943", // :flag_mx:
                "🇪🇸": "1268385402704756847", // :flag_es:
                "🇵🇷": "1268385447722356767", // :flag_pr:
                "🇩🇴": "1268406577522806845"  // :flag_do:
            }
        },
        generos: {
            title: "Roles de Géneros",
            color: 0x000000, // Negro
            image: "https://media.discordapp.net/attachments/1225629661627682846/1422283408935092376/58_sin_titulo_20250929120620.png",
            roles: {
                "🔒": "1268381141648277616",      // :lock:
                "⚧️": "1268377460286951488",
                "♂️": "1268377312227889223",      // :male_sign:
                "♀️": "1268377374781739070"       // :female_sign:
            }
        },
        juegos: {
            title: "Roles de Videojuegos",
            color: 0x0000FF, // Azul fuerte
            image: "https://media.discordapp.net/attachments/1225629661627682846/1422289906079629403/58_sin_titulo_20250929123134.png",
            roles: {
                "⬛": "1350919243339923609", // :black_large_square:
                "🚀": "1350917758988324885", // :rocket:
                "🟧": "1350917038939308272", // :orange_square:
                "⭐": "1350918091873320980", // :star:
                "🔫": "1350917298051092651", // :gun:
                "⛏️": "1350917442557313257", // :pick:
                "🪠": "1413239980196626452", // :plunger:
                "🎤": "1413240385521713222", // :microphone:
                "🦟": "1413243773990862968", // :mosquito:
                "👑": "1413243772703215679", // :crown:
                "⚽": "1413241320566161518"  // :soccer:
            }
        },
        anuncios: {
            title: "Roles de Anuncios",
            color: 0xFFA500, // Naranja
            image: "https://media.discordapp.net/attachments/1225629661627682846/1422305674318053426/58_sin_titulo_20250929133434.png",
            roles: {
                "🎉": "1268376127920148510", // :tada:
                "📺": "1268374279913996328", // :tv:
                "🎵": "1268375078949621770", // :musical_note:
                "👾": "1268374348641865769", // :space_invader:
                "📼": "1268375969823985744", // :vhs:
                "🎶": "1268376833720586332", // :notes:
                "📣": "1268374164595675309", // :mega:
                "📝": "1268375562997600338"  // :pencil:
            }
        }
    };

    // Evento para escuchar el comando de configuración
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        
        if (message.content === '!setup-autoroles') {
            console.log("Intentando enviar paneles de autoroles...");

            try {
                for (const [key, category] of Object.entries(config)) {
                    const embed = new EmbedBuilder()
                        .setTitle(category.title)
                        .setColor(category.color)
                        .setImage(category.image);

                    let description = "";
                    const rows = [];
                    let currentRow = new ActionRowBuilder();
                    let buttonCount = 0;
                    
                    // Set para rastrear IDs duplicados en este panel y evitar error 50035
                    const seenRoleIds = new Set();

                    for (const [emoji, roleId] of Object.entries(category.roles)) {
                        // Obtener nombre del rol
                        const role = message.guild.roles.cache.get(roleId);
                        const roleName = role ? role.name : `Rol Desconocido (${roleId})`;
                        
                        description += `${emoji} <@&${roleId}>\n\n`;

                        // Generar Custom ID Único
                        // Si un ID de rol se repite (ej: Guatemala y El Salvador tienen el mismo ID),
                        // le agregamos un sufijo para que Discord no rechace el botón.
                        let customId = `role_${roleId}`;
                        if (seenRoleIds.has(roleId)) {
                            customId = `role_${roleId}_dup${seenRoleIds.size}`;
                        }
                        seenRoleIds.add(roleId);

                        const button = new ButtonBuilder()
                            .setCustomId(customId)
                            .setLabel(roleName.length > 50 ? roleName.substring(0, 47) + '...' : roleName)
                            .setStyle(ButtonStyle.Secondary);

                        // Asignación segura de emojis
                        try {
                            // FIX CRÍTICO: Discord crashea si el emoji es texto ":alias:".
                            // Solo permitimos Unicode o IDs.
                            if (emoji.startsWith(':')) {
                                // Es un alias de texto, saltamos el emoji para que el botón funcione (solo texto)
                                // console.warn(`Emoji omitido por formato incompatible: ${emoji}`);
                            } else {
                                button.setEmoji(emoji); 
                            }
                        } catch (e) {
                            console.warn(`No se pudo poner el emoji ${emoji} en el botón:`, e);
                        }
                        
                        currentRow.addComponents(button);
                        buttonCount++;

                        if (buttonCount === 5) {
                            rows.push(currentRow);
                            currentRow = new ActionRowBuilder();
                            buttonCount = 0;
                        }
                    }

                    if (buttonCount > 0) {
                        rows.push(currentRow);
                    }

                    embed.setDescription(description || "Selecciona tus roles abajo:");

                    await message.channel.send({ embeds: [embed], components: rows });
                }
                
                message.reply('✅ Paneles de autoroles enviados correctamente.');
                console.log("Paneles enviados con éxito.");

            } catch (error) {
                console.error("Error al enviar los paneles:", error);
                message.reply('❌ Hubo un error al intentar enviar los paneles. Revisa la consola para más detalles.');
            }
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('role_')) return;

        // Extraemos el ID del rol
        // El formato puede ser "role_12345" o "role_12345_dup1" (si había duplicados)
        // split('_') -> ["role", "12345", "dup1"]
        // El ID siempre está en la posición 1
        const roleId = interaction.customId.split('_')[1];
        
        // Fetch rol si no está en caché
        let role = interaction.guild.roles.cache.get(roleId);
        if (!role) {
            try {
                role = await interaction.guild.roles.fetch(roleId);
            } catch (e) {
                console.error("Rol no encontrado:", e);
            }
        }

        if (!role) {
            return interaction.reply({ 
                content: '❌ El rol configurado no se encuentra en este servidor (puede haber sido borrado).', 
                ephemeral: true 
            });
        }

        const member = interaction.member;
        // Asegurarse de tener el miembro completo
        if (!member.roles) {
            return interaction.reply({ content: 'Error al obtener información del usuario.', ephemeral: true });
        }

        try {
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(role);
                await interaction.reply({ 
                    content: `❌ Se te ha quitado el rol **${role.name}**.`, 
                    ephemeral: true 
                });
            } else {
                await member.roles.add(role);
                await interaction.reply({ 
                    content: `✅ Se te ha asignado el rol **${role.name}**.`, 
                    ephemeral: true 
                });
            }
        } catch (error) {
            console.error(`Error al asignar rol ${roleId}:`, error);
            await interaction.reply({ 
                content: '❌ Hubo un error al gestionar el rol. Verifica que mi rol de bot esté por encima del rol que intentas dar.', 
                ephemeral: true 
            });
        }
    });
};
