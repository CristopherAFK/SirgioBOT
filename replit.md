# SirgioBOT - Discord Bot

## Overview
SirgioBOT es un bot de Discord para el servidor de Sirgio con múltiples sistemas de moderación, tickets, autoroles y más.

## Características Principales

### Sistema de AutoMod Mejorado
- Detección de palabras prohibidas con bypass prevention
- Normalización de texto para detectar variaciones (números por letras, caracteres especiales)
- Palabras ocultas que no aparecen al hacer click en "ver palabras prohibidas"
- Comando `/sancion` unificado con opciones de Warn/Mute/Ban
- Comando `/panelautomod` para el panel de moderación del staff
- Sistema de categorías de sanciones (Flood, Spam, Bypass, etc.)
- Soporte para pruebas adjuntas (imágenes/videos)

### Sistema de Tickets
- Mensajes específicos por categoría de ticket
- Botón "Ver Preguntas Frecuentes" en confirmación
- Solo moderadores pueden ver el botón "Atender ticket"
- Sistema de calificación al cerrar tickets (1-5 estrellas)
- Transcripciones automáticas enviadas al canal de logs

### Sistema de Autoroles
- Basado en reacciones (en lugar de botones)
- Categorías: Países, Géneros, Videojuegos, Anuncios
- Los usuarios añaden/quitan roles reaccionando

### Sistema de Postulaciones
- Comandos `/abrir_postulaciones` y `/cerrar_postulaciones` funcionales
- Estado persistente (sobrevive reinicios)
- Comando `/estado_postulaciones` para ver estado actual

### Comandos de Staff
- `/sancion` - Comando unificado para Warn/Mute/Ban con categorías
- `/panelautomod` - Panel interactivo de moderación
- `/mantenimiento` - Activa/desactiva modo mantenimiento
- `/ping_role` - Menciona cualquier rol incluyendo @everyone
- `/vigilar` - Inicia vigilancia de un usuario

### Permisos de Roles
- **Helpers** (1230949752733175888): Solo pueden dar warns y mutes
- **Moderadores** (1229140504310972599): Pueden dar warns, mutes y bans
- **Admins** (1212891335929897030): Permisos completos

## Estructura de Archivos
```
├── index.js           # Archivo principal, sistema de tickets
├── automod.js         # Sistema de moderación automática
├── autoroles.js       # Sistema de autoroles por reacciones
├── postulaciones.js   # Sistema de postulaciones
├── welcome.js         # Mensajes de bienvenida
├── sugerencias.js     # Sistema de sugerencias
├── notificaciones.js  # Notificaciones de YouTube
├── avisos.js          # Sistema de avisos
├── embed.js           # Generador de embeds
├── anuncio.js         # Sistema de anuncios
├── bannedWords.json   # Lista de palabras prohibidas (visibles)
├── sensitiveWords.json # Lista de palabras sensibles
├── tickets.json       # Datos de tickets
├── warns.json         # Advertencias de usuarios
├── suggestions.json   # Sugerencias
```

## Variables de Entorno Requeridas
- `DISCORD_TOKEN` o `TOKEN` - Token del bot de Discord
- `MONGODB_URI` o `MONGO_URI` (opcional) - URI de MongoDB para persistencia

## Comandos Disponibles

### Staff
- `/sancion usuario tipo categoria [razon] [tiempo] [veces] [infracciones_adicionales] [prueba]`
- `/panelautomod` - Panel de moderación
- `/mantenimiento on|off` - Modo mantenimiento
- `/ping_role rol [mensaje]` - Mencionar rol
- `/viewwarns usuario` - Ver advertencias
- `/resetwarns usuario` - Resetear advertencias
- `/removewarn usuario` - Eliminar última advertencia
- `/addword palabra` - Agregar palabra prohibida
- `/removeword palabra` - Quitar palabra prohibida
- `/vigilar usuario tiempo` - Iniciar vigilancia
- `/cerrar_vigilancia usuario` - Cerrar vigilancia
- `/remove_mute usuario` - Quitar mute
- `/automod on|off|status` - Controlar AutoMod
- `/abrir_postulaciones` - Abrir postulaciones
- `/cerrar_postulaciones` - Cerrar postulaciones

### Usuarios
- `/postular categoria` - Enviar postulación
- `/estado_postulaciones` - Ver estado de postulaciones

### Prefijo
- `!panel` - Enviar panel de tickets
- `!cerrar` / `!close` - Cerrar ticket
- `!setup-autoroles` - Configurar paneles de autoroles

## Última Actualización
Diciembre 2024 - Mejoras de automod, sistema de sanciones unificado, autoroles por reacciones, sistema de calificación de tickets.
