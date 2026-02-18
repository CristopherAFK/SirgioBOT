# 🤖 SirgioBOT - Bot de Discord Multifuncional

Bot de Discord avanzado con sistema de tickets, moderación automática, postulaciones de staff y comandos de utilidad.

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Requisitos](#-requisitos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Comandos](#-comandos)
- [Sistemas](#-sistemas)
- [Despliegue](#-despliegue)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Solución de Problemas](#-solución-de-problemas)
- [Contribuir](#-contribuir)
- [Licencia](#-licencia)

## ✨ Características

### 🎫 Sistema de Tickets
- Creación de tickets mediante botones interactivos
- Sistema de reclamación (claim) de tickets por staff
- Cierre de tickets con transcripciones
- Sistema de calificación (rating) post-cierre
- Estadísticas de tickets por usuario
- Logs de auditoría completos

### 🛡️ Moderación Automática
- Filtro de palabras prohibidas (personalizable)
- Detección y bloqueo de enlaces
- Control de spam de emojis
- Sistema de advertencias automáticas
- Logs de moderación
- Gestión de palabras prohibidas mediante comandos

### 📝 Sistema de Postulaciones
- Postulaciones para 5 roles de staff:
  - TikTok MOD
  - Twitch MOD
  - Editor
  - Programador
  - Helper
- Sistema de revisión con botones (Aceptar/Rechazar)
- Notificaciones automáticas al postulante
- Asignación automática de roles al aceptar
- Logs de postulaciones

### 🔧 Comandos de Utilidad
- Información de usuarios
- Información del servidor
- Estadísticas del bot
- Ping y latencia
- Contador de miembros

### 💾 Base de Datos
- MongoDB para persistencia de datos
- Estadísticas de tickets
- Logs de auditoría
- Almacenamiento de configuraciones

## 📦 Requisitos

- **Node.js**: v16.9.0 o superior
- **npm**: v7.0.0 o superior
- **MongoDB**: v4.0 o superior (local o MongoDB Atlas)
- **Discord Bot Token**: Obtenido desde [Discord Developer Portal](https://discord.com/developers/applications)

### Permisos del Bot en Discord

El bot requiere los siguientes permisos:
- `ADMINISTRATOR` (recomendado) o los siguientes permisos específicos:
  - Gestionar Canales
  - Gestionar Roles
  - Gestionar Mensajes
  - Ver Canales
  - Enviar Mensajes
  - Insertar Enlaces
  - Adjuntar Archivos
  - Leer Historial de Mensajes
  - Usar Comandos de Aplicación
  - Gestionar Hilos

### Intents Requeridos

En el Discord Developer Portal, habilita los siguientes intents:
- ✅ PRESENCE INTENT
- ✅ SERVER MEMBERS INTENT
- ✅ MESSAGE CONTENT INTENT
- ✅ GUILDS
- ✅ GUILD_MESSAGES
- ✅ GUILD_MEMBERS

## 🚀 Instalación

### 1. Clonar el Repositorio

```bash
git clone https://github.com/CristopherAFK/SirgioBOT.git
cd SirgioBOT
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales:

```env
DISCORD_TOKEN=tu_token_de_discord_aqui
MONGODB_URI=mongodb://localhost:27017/sirgio_bot
PORT=3000
```

### 4. Iniciar el Bot

```bash
npm start
```

Para desarrollo con auto-reinicio:

```bash
npm run dev
```

## ⚙️ Configuración

### Configuración del Bot en Discord

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Crea una nueva aplicación o selecciona una existente
3. En la sección "Bot":
   - Copia el token y agrégalo a `.env`
   - Habilita todos los Privileged Gateway Intents
4. En "OAuth2" > "URL Generator":
   - Selecciona scope: `bot` y `applications.commands`
   - Selecciona permisos: `Administrator` (recomendado)
   - Usa la URL generada para invitar el bot a tu servidor

### Configuración de MongoDB

#### Opción 1: MongoDB Local

```bash
# Instalar MongoDB (Ubuntu/Debian)
sudo apt-get install mongodb

# Iniciar servicio
sudo systemctl start mongodb

# Verificar estado
sudo systemctl status mongodb
```

Usar en `.env`:
```env
MONGODB_URI=mongodb://localhost:27017/sirgio_bot
```

#### Opción 2: MongoDB Atlas (Cloud)

1. Crea una cuenta en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crea un cluster gratuito
3. Configura acceso de red (IP Whitelist: 0.0.0.0/0 para acceso desde cualquier lugar)
4. Crea un usuario de base de datos
5. Obtén la cadena de conexión

Usar en `.env`:
```env
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/sirgio_bot?retryWrites=true&w=majority
```

### IDs de Canales y Roles

Edita `index.js` para configurar los IDs específicos de tu servidor:

```javascript
const CONFIG = {
  TICKET_CATEGORY_ID: 'ID_CATEGORIA_TICKETS',
  TICKET_CHANNEL_ID: 'ID_CANAL_TICKETS',
  LOGS_CHANNEL_ID: 'ID_CANAL_LOGS',
  POSTULACIONES_CHANNEL_ID: 'ID_CANAL_POSTULACIONES',
  STAFF_ROLE_ID: 'ID_ROL_STAFF',
  // ... otros IDs
};
```

Para obtener IDs en Discord:
1. Activa el Modo Desarrollador: Configuración > Avanzado > Modo Desarrollador
2. Click derecho en canal/rol/usuario > Copiar ID

## 📚 Comandos

### Comandos de Slash (/)

#### Información
- `/userinfo [usuario]` - Muestra información detallada de un usuario
- `/serverinfo` - Muestra información del servidor
- `/ping` - Muestra la latencia del bot
- `/membercount` - Muestra el número de miembros del servidor

#### Moderación (Solo Staff)
- `/addword <palabra>` - Agrega una palabra a la lista de prohibidas
- `/removeword <palabra>` - Elimina una palabra de la lista de prohibidas
- `/listwords` - Muestra todas las palabras prohibidas
- `/warn <usuario> <razón>` - Advierte a un usuario
- `/kick <usuario> <razón>` - Expulsa a un usuario
- `/ban <usuario> <razón>` - Banea a un usuario

#### Tickets (Solo Staff)
- `/ticket-stats [usuario]` - Muestra estadísticas de tickets

### Comandos de Botones

#### Sistema de Tickets
- **Crear Ticket** - Botón en el canal de tickets para crear un nuevo ticket
- **Claim** - Reclama un ticket (solo staff)
- **Close** - Cierra un ticket y genera transcripción
- **Rating** - Sistema de calificación (⭐ 1-5 estrellas)

#### Sistema de Postulaciones
- **Postular a [Rol]** - Botones para postular a diferentes roles de staff
- **Aceptar** - Acepta una postulación (solo administradores)
- **Rechazar** - Rechaza una postulación (solo administradores)

## 🔧 Sistemas

### 1. Sistema de Tickets (`tickets/ticketSystem.js`)

**Funcionalidades:**
- Creación automática de canales privados para tickets
- Asignación de permisos específicos por ticket
- Sistema de claim para que staff tome tickets
- Cierre con transcripción en formato TXT
- Sistema de rating post-cierre
- Estadísticas por usuario y globales

**Flujo de Trabajo:**
1. Usuario presiona botón "Crear Ticket"
2. Se crea canal privado con nombre `ticket-{username}`
3. Staff puede reclamar el ticket con botón "Claim"
4. Al resolver, staff presiona "Close"
5. Usuario califica la atención (1-5 estrellas)
6. Se genera transcripción y se elimina el canal

**Base de Datos:**
```javascript
TicketSchema {
  ticketId: String,
  userId: String,
  username: String,
  staffId: String,
  staffUsername: String,
  createdAt: Date,
  closedAt: Date,
  rating: Number,
  status: String // 'open', 'claimed', 'closed'
}
```

### 2. Sistema de Moderación Automática (`automod.js`)

**Funcionalidades:**
- Filtro de palabras prohibidas (case-insensitive)
- Detección de enlaces (http://, https://, www.)
- Control de spam de emojis (máximo 5 por mensaje)
- Sistema de advertencias automáticas
- Logs detallados de todas las acciones

**Configuración:**
```javascript
const automodConfig = {
  maxEmojis: 5,
  blockLinks: true,
  warnThreshold: 3, // Advertencias antes de acción
  logChannel: 'ID_CANAL_LOGS'
};
```

**Palabras Prohibidas:**
- Almacenadas en `bannedWords.json`
- Gestionables mediante comandos `/addword` y `/removeword`
- Detección con variaciones (espacios, caracteres especiales)

### 3. Sistema de Postulaciones (`postulaciones.js`)

**Roles Disponibles:**
1. **TikTok MOD** - Moderador de TikTok
2. **Twitch MOD** - Moderador de Twitch
3. **Editor** - Editor de contenido
4. **Programador** - Desarrollador
5. **Helper** - Ayudante general

**Formulario de Postulación:**
- Nombre completo
- Edad
- País
- Experiencia previa
- Motivación
- Disponibilidad horaria

**Proceso:**
1. Usuario selecciona rol y completa formulario
2. Se envía embed al canal de postulaciones
3. Administradores revisan con botones Aceptar/Rechazar
4. Usuario recibe notificación del resultado
5. Si acepta: se asigna rol automáticamente
6. Se registra en logs

### 4. Comandos de Utilidad (`utils/commands.js`)

**Comandos Implementados:**

#### `/userinfo [usuario]`
Muestra:
- Avatar y banner
- Fecha de creación de cuenta
- Fecha de unión al servidor
- Roles asignados
- Estado actual
- ID de usuario

#### `/serverinfo`
Muestra:
- Icono y banner del servidor
- Propietario
- Fecha de creación
- Número de miembros (total, humanos, bots)
- Número de canales (texto, voz, categorías)
- Número de roles
- Nivel de verificación
- Boost level y boosters

#### `/ping`
Muestra:
- Latencia del bot
- Latencia de la API de Discord
- Tiempo de respuesta

#### `/membercount`
Muestra:
- Total de miembros
- Miembros humanos
- Bots
- Miembros online

### 5. Base de Datos (`database.js`)

**Modelos:**

#### Ticket Model
```javascript
{
  ticketId: String,
  userId: String,
  username: String,
  staffId: String,
  staffUsername: String,
  createdAt: Date,
  closedAt: Date,
  rating: Number,
  status: String,
  messages: Array
}
```

#### Audit Log Model
```javascript
{
  action: String,
  moderatorId: String,
  moderatorUsername: String,
  targetId: String,
  targetUsername: String,
  reason: String,
  timestamp: Date,
  details: Object
}
```

#### User Stats Model
```javascript
{
  userId: String,
  username: String,
  ticketsCreated: Number,
  ticketsClosed: Number,
  averageRating: Number,
  warnings: Number,
  lastActive: Date
}
```

**Funciones Principales:**
- `connectDB()` - Conecta a MongoDB
- `getTicketStats(userId)` - Obtiene estadísticas de tickets
- `saveAuditLog(data)` - Guarda log de auditoría
- `getUserStats(userId)` - Obtiene estadísticas de usuario

## 🚀 Despliegue

### Despliegue en Render

Para instrucciones detalladas de despliegue en Render, consulta [README_DEPLOYMENT.md](./README_DEPLOYMENT.md).

**Resumen rápido:**

1. Crea una cuenta en [Render](https://render.com)
2. Conecta tu repositorio de GitHub
3. Crea un nuevo Web Service
4. Configura variables de entorno:
   - `DISCORD_TOKEN`
   - `MONGODB_URI`
   - `PORT=3000`
5. Comando de inicio: `npm start`
6. Despliega

### Despliegue en Heroku

```bash
# Instalar Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Login
heroku login

# Crear app
heroku create sirgio-bot

# Configurar variables
heroku config:set DISCORD_TOKEN=tu_token
heroku config:set MONGODB_URI=tu_mongodb_uri

# Desplegar
git push heroku main
```

### Despliegue en VPS (Ubuntu)

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PM2
sudo npm install -g pm2

# Clonar y configurar
git clone https://github.com/CristopherAFK/SirgioBOT.git
cd SirgioBOT
npm install

# Configurar .env
nano .env

# Iniciar con PM2
pm2 start index.js --name sirgio-bot
pm2 save
pm2 startup
```

## 📁 Estructura del Proyecto

```
SirgioBOT/
├── index.js                    # Archivo principal del bot
├── database.js                 # Configuración de MongoDB
├── automod.js                  # Sistema de moderación automática
├── postulaciones.js            # Sistema de postulaciones
├── package.json                # Dependencias y scripts
├── .env                        # Variables de entorno (no incluido en repo)
├── .env.example                # Ejemplo de variables de entorno
├── README.md                   # Este archivo
├── README_DEPLOYMENT.md        # Guía de despliegue en Render
├── tickets/
│   └── ticketSystem.js         # Sistema de tickets
├── utils/
│   └── commands.js             # Comandos de utilidad
├── data/
│   ├── bannedWords.json        # Palabras prohibidas
│   └── postulaciones.json      # Estado de postulaciones
├── scripts/
│   ├── diagnose.js             # Script de diagnóstico
│   ├── test-connection.js      # Test de conexión
│   └── test-render.js          # Test específico para Render
└── node_modules/               # Dependencias (generado por npm)
```

## 🔍 Solución de Problemas

### El bot no se conecta

**Problema:** Bot no inicia o no se conecta a Discord

**Soluciones:**
1. Verifica que el token en `.env` sea correcto
2. Asegúrate de que todos los intents estén habilitados en Discord Developer Portal
3. Ejecuta el script de diagnóstico:
   ```bash
   npm run diagnose
   ```

### Error de conexión a MongoDB

**Problema:** `MongooseError: Could not connect to MongoDB`

**Soluciones:**
1. Verifica que MongoDB esté corriendo: `sudo systemctl status mongodb`
2. Comprueba la URI en `.env`
3. Si usas MongoDB Atlas, verifica:
   - IP Whitelist configurada
   - Usuario y contraseña correctos
   - Cluster activo

### Comandos slash no aparecen

**Problema:** Los comandos `/` no se muestran en Discord

**Soluciones:**
1. Espera 1-2 horas (Discord puede tardar en actualizar)
2. Verifica que el bot tenga permiso `applications.commands`
3. Reinicia Discord (Ctrl+R)
4. Vuelve a invitar el bot con la URL correcta

### Permisos insuficientes

**Problema:** `DiscordAPIError: Missing Permissions`

**Soluciones:**
1. Verifica que el bot tenga rol con permisos adecuados
2. Asegúrate de que el rol del bot esté por encima de los roles que intenta gestionar
3. Revisa permisos específicos del canal

### El bot se desconecta constantemente

**Problema:** Bot se desconecta y reconecta repetidamente

**Soluciones:**
1. Verifica la estabilidad de tu conexión a internet
2. Comprueba logs: `pm2 logs sirgio-bot`
3. Aumenta recursos si estás en servidor compartido
4. Verifica que no haya múltiples instancias corriendo

### Scripts de Diagnóstico

#### Diagnóstico General
```bash
npm run diagnose
```

Verifica:
- Dependencias instaladas
- Variables de entorno
- Conexión a Discord
- Conexión a MongoDB

#### Test de Conexión
```bash
npm run test-connection
```

Prueba:
- Token de Discord válido
- Intents configurados
- Permisos del bot

#### Test para Render
```bash
npm run test-render
```

Específico para problemas en Render:
- Variables de entorno en Render
- Puerto configurado
- Health check endpoint

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Si deseas contribuir:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Guías de Contribución

- Sigue el estilo de código existente
- Comenta tu código cuando sea necesario
- Actualiza la documentación si agregas nuevas características
- Prueba tu código antes de hacer PR

## 📝 Changelog

### v1.0.0 (Actual)
- ✅ Sistema de tickets completo
- ✅ Moderación automática
- ✅ Sistema de postulaciones
- ✅ Comandos de utilidad
- ✅ Integración con MongoDB
- ✅ Scripts de diagnóstico
- ✅ Documentación completa

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver archivo `LICENSE` para más detalles.

## 👥 Autor

**CristopherAFK**
- GitHub: [@CristopherAFK](https://github.com/CristopherAFK)
- Discord: [Tu servidor de Discord]

## 🙏 Agradecimientos

- Discord.js por la excelente librería
- MongoDB por la base de datos
- Render por el hosting gratuito
- Comunidad de Discord por el apoyo

## 📞 Soporte

Si necesitas ayuda:
1. Revisa la sección de [Solución de Problemas](#-solución-de-problemas)
2. Consulta [README_DEPLOYMENT.md](./README_DEPLOYMENT.md) para problemas de despliegue
3. Abre un [Issue en GitHub](https://github.com/CristopherAFK/SirgioBOT/issues)
4. Únete a nuestro servidor de Discord [enlace]

---

**Nota:** Este bot está en desarrollo activo. Algunas características pueden cambiar o mejorarse en futuras versiones.

**Última actualización:** 2024
