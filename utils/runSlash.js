/**
 * Helper para ejecutar handlers de comandos slash con deferReply y manejo de errores,
 * evitando "interaction failed" cuando la lógica tarda o lanza.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{ ephemeral?: boolean, defer?: boolean, execute: (i: import('discord.js').ChatInputCommandInteraction) => Promise<void> }} options
 */
async function runSlash(interaction, options) {
  const { ephemeral = true, defer = true, execute } = options;

  try {
    if (defer) {
      await interaction.deferReply({ ephemeral });
    }
    await execute(interaction);
  } catch (err) {
    console.error('[runSlash] Error:', err);
    const msg = '❌ Ocurrió un error al ejecutar el comando. Intenta de nuevo más tarde.';
    try {
      if (interaction.deferred) {
        await interaction.editReply({ content: msg }).catch(() => {});
      } else {
        await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
      }
    } catch (e) {
      console.error('[runSlash] No se pudo enviar mensaje de error:', e);
    }
  }
}

module.exports = { runSlash };
