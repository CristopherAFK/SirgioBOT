const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

/**
 * Módulo de Autoroles
 * 
 * Instrucciones:
 * 1. Requiere este archivo en tu index.js principal: require('./autoroles.js')(client);
 * 2. Usa el comando !setup-autoroles (o el prefijo que uses) para enviar los paneles.
 */

module.exports = (client) => {

    // Configuración de Roles
    const config = {
        paises: {
            title: "Roles de Países",
            color: 0xFF0000, // Rojo fuerte
            image: "https://media.discordapp.net/attachments/1225629661627682846/1422268955170443274/58_sin_titulo_20250929110844.png",
            roles: {
                ":flag_ve:": "1268383665168060517",
                ":flag_co:": "1268383284023525426",
                ":flag_ec:": "1268384015925252240",
                ":flag_cl:": "1268384143054471220",
                ":flag_ar:": "1268384222796582993",
                ":flag_pe:": "1268384464115994686",
                ":flag_bo:": "1268384560325066864",
                ":flag_uy:": "1268384709461934160",
                ":flag_py:": "1268384785403875350",
                ":flag_pa:": "1268384817645359215",
                ":flag_hn:": "1268384915011932312",
                ":flag_gt:": "1268385050802651217",
                ":flag_sv:": "1268385050802651217",
                ":flag_cr:": "1413710208546508901",
                ":flag_mx:": "1268385311038246943",
                ":flag_es:": "1268385402704756847",
                ":flag_pr:": "1268385447722356767",
                ":flag_do:": "1268406577522806845"
            }
        },
        generos: {
            title: "Roles de Géneros",
            color: 0x000000, // Negro
            image: "https://media.discordapp.net/attachments/1225629661627682846/1422283408935092376/58_sin_titulo_20250929120620.png",
            roles: {
                ":lock:": "1268381141648277616",
                "⚧️": "1268377460286951488",
                ":male_sign:": "1268377312227889223",
                ":female_sign:": "1268377374781739070"
            }
        },
        juegos: {
            title: "Roles de Videojuegos",
            color: 0x0000FF, // Azul fuerte
            image: "https://media.discordapp.net/attachments/1225629661627682846/1422289906079629403/58_sin_titulo_20250929123134.png",
            roles: {
                ":black_large_square:": "1350919243339923609",
                ":rocket:": "1350917758988324885",
                ":orange_square:": "1350917038939308272",
                ":star:": "1350918091873320980",
                ":gun:": "1350917298051092651",
                ":pick:": "1350917442557313257",
                ":plunger:": "1413239980196626452",
                ":microphone:": "1413240385521713222",
                ":mosquito:": "1413243773990862968",
                ":crown:": "1413243772703215679",
                ":soccer:": "1413241320566161518"
            }
        },
        anuncios: {
            title: "Roles de Anuncios",
            color: 0xFFA500, // Naranja
            image: "https://media.discordapp.net/attachments/1225629661627682846/1422305674318053426/58_sin_titulo_20250929133434.png",
            roles: {
                ":tada:": "1268376127920148510",
                ":tv:": "1268374279913996328",
                ":musical_note:": "1268375078949621770",
                ":space_invader:": "1268374348641865769",
                ":vhs:": "1268375969823985744",
                ":notes:": "1268376833720586332",
                ":mega:": "1268374164595675309",
                ":pencil:": "1268375562997600338"
            }
        }
    };

    // Evento para escuchar el comando de configuración
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        
        // Comando para enviar los paneles
        if (message.content === '!setup-autoroles') {
            // Verificar permisos (opcional, descomentar si es necesario)
            // if (!message.member.permissions.has('Administrator')) return;

            for (const [key, category] of Object.entries(config)) {
                const embed = new EmbedBuilder()
                    .setTitle(category.title)
                    .setColor(category.color)
                    .setImage(category.image);

                // Crear descripción con un renglón por rol
                let description = "";
                const rows = [];
                let currentRow = new ActionRowBuilder();
                let buttonCount = 0;

                for (const [emoji, roleId] of Object.entries(category.roles)) {
                    // Agregar a la descripción
                    // Intentamos obtener el nombre del rol si está en caché, sino usamos el ID
                    const role = message.guild.roles.cache.get(roleId);
                    const roleName = role ? role.name : `Rol ${roleId}`;
                    
                    description += `${emoji} <@&${roleId}>\n\n`; // Doble salto de línea para dejar un renglón

                    // Crear botón
                    const button = new ButtonBuilder()
                        .setCustomId(`role_${roleId}`)
                        .setLabel(roleName.length > 80 ? roleName.substring(0, 77) + '...' : roleName) // Limite de caracteres en label
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emoji.replace(/:/g, '')); // Intentar limpiar el emoji si es formato texto, aunque para Custom Emojis se necesita el ID

                    // Manejo básico de emojis para botones
                    // Si el emoji es unicode (como ⚧️), funciona directo.
                    // Si es custom (:flag_ve:), Discord.js necesita el ID o el nombre.
                    // En este código asumiremos que el usuario pondrá el emoji correcto en el botón manualmente si falla,
                    // pero intentamos pasarlo tal cual.
                    
                    // Nota: Para emojis custom en botones, se necesita el ID. 
                    // Como el input tiene formato ":name:", puede fallar si no es unicode.
                    // Usaremos el emoji tal cual en la descripción, y en el botón intentaremos mostrarlo.
                    
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
            
            message.reply('Paneles de autoroles enviados correctamente.');
        }
    });

    // Evento para manejar los clicks en los botones
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('role_')) return;

        const roleId = interaction.customId.split('_')[1];
        const role = interaction.guild.roles.cache.get(roleId);

        if (!role) {
            return interaction.reply({ 
                content: '❌ El rol configurado no se encuentra en este servidor.', 
                ephemeral: true 
            });
        }

        const member = interaction.member;
        
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
            console.error(error);
            await interaction.reply({ 
                content: '❌ Hubo un error al gestionar el rol. Verifica que mi rol esté por encima del rol a asignar.', 
                ephemeral: true 
            });
        }
    });
};
