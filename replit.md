# SirgioBOT - Discord Bot

## Overview
SirgioBOT es un bot de Discord para el servidor de Sirgio con múltiples sistemas de moderación, tickets, autoroles y más. Ahora utiliza **MongoDB** como base de datos principal para mayor confiabilidad y persistencia en Render.

## Base de Datos
El bot usa **MongoDB** (compatible con MongoDB Atlas) para almacenar:
- Tickets y calificaciones
- Sugerencias
- Advertencias y sanciones
- Estadísticas de staff
- Logs de auditoría
- Configuración

## Características Principales

### Sistema de AutoMod Mejorado
- Detección de palabras prohibidas con bypass prevention
- Normalización de texto para detectar variaciones (números por letras, caracteres especiales)
- Palabras ocultas que no aparecen al hacer click en "ver palabras prohibidas"
- Comando `/sancion` unificado con opciones de Warn/Mute/Ban
- Comando `/stafftools` para el panel de moderación del staff
- Sistema de categorías de sanciones (Flood, Spam, Bypass, etc.)
- Soporte para pruebas adjuntas (imágenes/videos)

### Sistema de Tickets (MongoDB)
- Mensajes específicos por categoría de ticket
- Botón "Ver Preguntas Frecuentes" en confirmación
- Solo moderadores pueden ver el botón "Atender ticket"
- Sistema de calificación al cerrar tickets (1-5 estrellas)
- Transcripciones automáticas enviadas al canal de logs
- Tickets de apelación integrados correctamente con el sistema principal
- Estadísticas de staff (tickets atendidos, calificación promedio)

### Sistema de Sugerencias (Reconstruido)
- Usa deferReply() para evitar timeouts
- Prevención de duplicados con tracking de interacciones
- Almacenamiento en MongoDB
- Botones de revisión para staff (Aceptar/Rechazar/Indefinido)

### Sistema de Autoroles
- Basado en reacciones (en lugar de botones)
- Categorías: Países, Géneros, Videojuegos, Anuncios
- Los usuarios añaden/quitan roles reaccionando

### Sistema de Postulaciones
- Comandos `/abrir_postulaciones` y `/cerrar_postulaciones` funcionales
- Estado persistente (sobrevive reinicios)
- Comando `/estado_postulaciones` para ver estado actual

### Sistema de Estadísticas (/stats)
- `/stats tickets` - Estadísticas generales de tickets
- `/stats staff` - Ranking de staff por rendimiento
- `/stats personal` - Estadísticas personales del staff

### Sistema de Recordatorios
- Notifica tickets sin atender después de 1 hora
- Recuerda a usuarios sobre tickets esperando respuesta

### Sistema de Auditoría (/audit)
- `/audit recent` - Logs más recientes
- `/audit user` - Logs por usuario
- `/audit type` - Filtrar por tipo de acción
- `/audit search` - Buscar en logs

### Comandos de Utilidad
- `/userinfo` - Información de usuario
- `/serverinfo` - Información del servidor
- `/avatar` - Avatar de usuario
- `/banner` - Banner de usuario
- `/ping` - Latencia del bot
- `/membercount` - Conteo de miembros

### Rate Limiting
- Protección contra spam de comandos
- Límites configurables por comando

### Backup Automático
- Backups cada 6 horas
- Máximo 10 backups guardados
- Almacenamiento en carpeta /backups

## Estructura de Archivos
```
├── index.js           # Archivo principal, sistema de tickets
├── database.js        # Conexión y funciones MongoDB
├── automod.js         # Sistema de moderación automática
├── autoroles.js       # Sistema de autoroles por reacciones
├── postulaciones.js   # Sistema de postulaciones
├── welcome.js         # Mensajes de bienvenida
├── sugerencias.js     # Sistema de sugerencias (reconstruido)
├── notificaciones.js  # Notificaciones de YouTube
├── avisos.js          # Sistema de avisos
├── embed.js           # Generador de embeds
├── anuncio.js         # Sistema de anuncios
├── utils/
│   ├── commands.js    # Comandos de utilidad
│   ├── stats.js       # Sistema de estadísticas
│   ├── reminders.js   # Sistema de recordatorios
│   ├── ratelimit.js   # Rate limiting
│   ├── backup.js      # Backup automático
│   └── audit.js       # Sistema de auditoría
├── backups/           # Carpeta de backups
```

## Variables de Entorno Requeridas
- `DISCORD_TOKEN` o `TOKEN` - Token del bot de Discord
- `MONGODB_URI` o `MONGO_URI` - URL de conexión MongoDB Atlas

## Configuración para Render

### 1. Crear base de datos en MongoDB Atlas (Gratis)
1. Ve a mongodb.com/atlas y crea una cuenta
2. Crea un cluster gratuito (M0)
3. En "Database Access", crea un usuario con contraseña
4. En "Network Access", añade `0.0.0.0/0` para permitir acceso desde cualquier IP
5. Obtén la URI de conexión (formato: `mongodb+srv://usuario:password@cluster.xxxxx.mongodb.net/sirgiobot`)

### 2. Configurar en Render
1. Crea un nuevo Web Service conectado a tu repo GitHub
2. **Build Command**: `npm install`
3. **Start Command**: `node index.js`
4. En Environment Variables, añade:
   - `DISCORD_TOKEN` = tu token del bot
   - `MONGODB_URI` = tu URI de MongoDB Atlas

## Comandos Disponibles

### Staff
- `/sancion usuario tipo categoria [razon] [tiempo] [veces] [infracciones_adicionales] [prueba]`
- `/stafftools` - Panel de herramientas de staff
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
- `/stats tickets|staff|personal` - Estadísticas
- `/audit recent|user|type|search` - Auditoría

### Usuarios
- `/sugerir` - Enviar sugerencia
- `/postular categoria` - Enviar postulación
- `/estado_postulaciones` - Ver estado de postulaciones
- `/userinfo [usuario]` - Info de usuario
- `/serverinfo` - Info del servidor
- `/avatar [usuario]` - Ver avatar
- `/banner [usuario]` - Ver banner
- `/ping` - Latencia del bot
- `/membercount` - Conteo de miembros

### Prefijo
- `!panel` - Enviar panel de tickets
- `!cerrar` / `!close` - Cerrar ticket
- `!setup-autoroles` - Configurar paneles de autoroles
- `!aviso` - Mencionar rol de avisos
- `!everyone` - Mencionar @everyone

## Permisos de Roles
- **Helpers** (1230949752733175888): Solo pueden dar warns y mutes
- **Moderadores** (1229140504310972599): Pueden dar warns, mutes y bans
- **Admins** (1212891335929897030): Permisos completos
- **Head Admins** (1230952139015327755): Permisos completos + comandos avanzados

## Última Actualización
Enero 2026 - Migración a MongoDB para persistencia en Render, reconstrucción del sistema de sugerencias, corrección de bugs en tickets de apelación y calificaciones, nuevos sistemas de estadísticas, recordatorios, auditoría, rate limiting y backups.
