module.exports = (client) => {
  const STAFF_ROLE_ID = '1230949715127042098';
  const AVISO_ROLE_ID = '1268374164595675309';

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase().trim();

    if (content === '!aviso' || content === '!avisos') {
      try {
        await message.delete();
      } catch (err) {
        console.error('Error eliminando mensaje !aviso:', err.message);
      }

      const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
      if (!member) return;

      const isStaff = member.roles.cache.has(STAFF_ROLE_ID);
      if (!isStaff) {
        const reply = await message.channel.send('❌ Solo el staff puede usar este comando.');
        setTimeout(() => reply.delete().catch(() => {}), 5000);
        return;
      }

      await message.channel.send(`<@&${AVISO_ROLE_ID}>`);
      return;
    }

    if (content === '!everyone') {
      try {
        await message.delete();
      } catch (err) {
        console.error('Error eliminando mensaje !everyone:', err.message);
      }

      const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
      if (!member) return;

      const isStaff = member.roles.cache.has(STAFF_ROLE_ID);
      if (!isStaff) {
        const reply = await message.channel.send('❌ Solo el staff puede usar este comando.');
        setTimeout(() => reply.delete().catch(() => {}), 5000);
        return;
      }

      await message.channel.send('@everyone');
      return;
    }
  });

  console.log('📢 Sistema de avisos cargado (!aviso, !everyone)');
};
