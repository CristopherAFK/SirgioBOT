// =========================
// SirgioBOT - Sistema de Postulaciones (archivo único)
// - Comando /postulaciones
// - Cuestionario con modal (nombre, edad, experiencia, motivo)
// - Envío automático al canal de postulaciones
// =========================

const {
    Client,
    GatewayIntentBits,
    Partials,
    Collection,
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    REST,
    Routes,
} = require("discord.js");
const { token, clientId, guildId } = require("./config.json");

// Crear cliente
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel],
});

client.commands = new Collection();

// =========================
// Definición del comando
// =========================
const postulacionesCommand = {
    data: new SlashCommandBuilder()
        .setName("postulaciones")
        .setDescription("Abre el panel de postulaciones del servidor"),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor("#3498db")
            .setTitle("📋 Postulaciones del Staff")
            .setDescription("¿Quieres formar parte del equipo del servidor?\n\nPulsa el botón **Postularme** para comenzar tu solicitud.")
            .setFooter({ text: "SirgioBOT • Sistema de Postulaciones" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("abrir_postulacion")
                .setLabel("📨 Postularme")
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },
};

// Agregar a la colección de comandos
client.commands.set(postulacionesCommand.data.name, postulacionesCommand);

// =========================
// Registro del comando (sin deploy externo)
// =========================
const rest = new REST({ version: "10" }).setToken(token);
(async () => {
    try {
        console.log("🌀 Registrando comando /postulaciones...");
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
            body: [postulacionesCommand.data.toJSON()],
        });
        console.log("✅ Comando /postulaciones registrado correctamente.");
    } catch (error) {
        console.error(error);
    }
})();

// =========================
// Eventos del bot
// =========================
client.once("ready", () => {
    console.log(`✅ Conectado como ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
    // Ejecución del comando
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: "⚠️ Hubo un error al ejecutar el comando.", ephemeral: true });
        }
    }

    // Abrir formulario
    if (interaction.isButton() && interaction.customId === "abrir_postulacion") {
        const modal = new ModalBuilder()
            .setCustomId("modal_postulacion")
            .setTitle("Formulario de Postulación");

        const nombre = new TextInputBuilder()
            .setCustomId("nombre_input")
            .setLabel("¿Cuál es tu nombre o apodo?")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const edad = new TextInputBuilder()
            .setCustomId("edad_input")
            .setLabel("¿Cuántos años tienes?")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const experiencia = new TextInputBuilder()
            .setCustomId("experiencia_input")
            .setLabel("¿Tienes experiencia en staff?")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const motivo = new TextInputBuilder()
            .setCustomId("motivo_input")
            .setLabel("¿Por qué quieres unirte al staff?")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(nombre),
            new ActionRowBuilder().addComponents(edad),
            new ActionRowBuilder().addComponents(experiencia),
            new ActionRowBuilder().addComponents(motivo)
        );

        await interaction.showModal(modal);
    }

    // Procesar envío del formulario
    if (interaction.isModalSubmit() && interaction.customId === "modal_postulacion") {
        const nombre = interaction.fields.getTextInputValue("nombre_input");
        const edad = interaction.fields.getTextInputValue("edad_input");
        const experiencia = interaction.fields.getTextInputValue("experiencia_input");
        const motivo = interaction.fields.getTextInputValue("motivo_input");

        const embed = new EmbedBuilder()
            .setColor("#2ecc71")
            .setTitle("📨 Nueva Postulación Recibida")
            .addFields(
                { name: "👤 Nombre", value: nombre, inline: true },
                { name: "🎂 Edad", value: edad, inline: true },
                { name: "💼 Experiencia", value: experiencia },
                { name: "📝 Motivo", value: motivo },
            )
            .setFooter({ text: `Postulación enviada por ${interaction.user.tag}` })
            .setTimestamp();

        // Reemplaza este ID por el del canal donde quieres que se envíen las postulaciones
        const canalDestino = interaction.guild.channels.cache.get("1435091853308461179");

        if (canalDestino) {
            await canalDestino.send({ embeds: [embed] });
        }

        await interaction.reply({ content: "✅ Tu postulación fue enviada correctamente. ¡Gracias!", ephemeral: true });
    }
});
