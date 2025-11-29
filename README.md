```markdown
# SirgioBOT - con panel de Tickets (!panel)

Este repo contiene tu bot principal (index.js) con integración del sistema de tickets. El panel se publica cuando un moderador escribe `!panel` en un canal (envía embed verde con menú de categorías).

Archivos principales
- index.js: bot principal (bienvenida, automod, autoroles, comandos, !panel).
- ticket-system.js: módulo que maneja la lógica de tickets (select, confirmación, creación, claim, cierre).
- deploy-commands.js: script opcional para registrar /ticket panel como comando slash (requiere CLIENT_ID y GUILD_ID).
- package.json: dependencias y scripts.

Variables de entorno recomendadas (no subas .env al repositorio)
- DISCORD_TOKEN (obligatorio)
- CLIENT_ID (opcional si vas a registrar slash commands desde el servidor)
- GUILD_ID (opcional para deploy-commands)
- STAFF_ROLE_IDS (CSV) — por ejemplo: 1229140504310972599,1212891335929897030
- LOGS_CHANNEL_ID — ID del canal donde se subirán transcripciones
- PANEL_THUMBNAIL_URL — URL de la imagen del thumbnail del embed
- EMBED_COLOR — color hex del embed (ej. #2ecc71)
- TICKET_CATEGORY_NAME, ARCHIVE_CATEGORY_NAME, CLOSE_MODE (archive|delete)

Instalación
1. Copia los archivos a tu proyecto.
2. Ejecuta `npm install`.
3. Crea un archivo `.env` local (o configura variables en Render) con al menos:
   - DISCORD_TOKEN=tu_token_aqui
   - STAFF_ROLE_IDS=1229140504310972599,1212891335929897030
   - LOGS_CHANNEL_ID=1431416957160259764
   - PANEL_THUMBNAIL_URL=https://.../79794618.png
   - EMBED_COLOR=#2ecc71
4. (Opcional) Registrar comandos slash:
   - Rellena CLIENT_ID y GUILD_ID en .env y ejecuta `npm run deploy-commands`.
5. Ejecuta `npm start` para iniciar el bot.

Uso del panel
- Comando de mensaje: !panel (solo moderadores, según el rol configurado en el index como MOD_ROLE_ID).
  - Envía el embed con el menú de categorías.
  - Usuario elige una categoría -> confirma -> se le pedirá una descripción en el mismo canal (60s).
  - Se crea un canal en la categoría TICKETS (por defecto) con permisos para el creador y staff.
  - En el canal del ticket aparece un embed de bienvenida con botón "Atender ticket" para el staff.
  - Staff puede pulsar "Atender ticket" y se anuncia quién atenderá.
  - Cierre: los staff pueden usar comandos en el canal de ticket: !cerrar, !cerrarticket, !close, !eliminar, !borrar
    - Al cerrar se genera una transcripción (.txt) y se envía al canal de logs configurado (LOGS_CHANNEL_ID).
    - Por defecto el canal se mueve a la categoría ARCHIVE y se bloquea al propietario (CLOSE_MODE=archive).

Notas importantes
- Persistencia: current implementation uses tickets.json (local). En Render el filesystem es efímero; para producción migra a MongoDB/Postgres o usa disco persistente.
- Permisos: el bot necesita ManageChannels, ManageRoles, SendMessages, ReadMessageHistory, EmbedLinks, AttachFiles.
- Intents: si usas MESSAGE_CONTENT, activa esa privileged intent en el Developer Portal.

¿Siguiente paso?
- Si quieres que integre esto directamente en tu repo (suba cambios a GitHub) puedo crear los commits si me das el repo. Si vas a desplegar en Render y quieres persistencia duradera, puedo adaptar a MongoDB (pásame MONGODB_URI).

```
