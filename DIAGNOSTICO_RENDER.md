# 🔍 DIAGNÓSTICO COMPLETO - SirgioBOT en Render

## ❌ PROBLEMA REPORTADO
El bot no se conecta a Discord en Render, aunque:
- Las variables de entorno están configuradas
- Los intents están activados
- Todo aparece validado en Render

## 🎯 CAUSAS PROBABLES Y SOLUCIONES

### 1. TOKEN INVÁLIDO O MAL CONFIGURADO (Más Común)

**Síntomas:**
- El bot nunca muestra "Bot listo!" en los logs
- Error: "An invalid token was provided"
- El servicio se reinicia constantemente

**Soluciones:**
```bash
1. Ve a: https://discord.com/developers/applications
2. Selecciona tu aplicación "SirgioBOT"
3. Ve a la sección "Bot"
4. Click en "Reset Token" (esto invalida el token anterior)
5. Copia el NUEVO token (solo se muestra una vez)
6. En Render:
   - Ve a tu servicio
   - Environment → Edit
   - Actualiza DISCORD_TOKEN con el nuevo token
   - IMPORTANTE: Asegúrate de NO tener espacios al inicio o final
   - Save Changes
7. El servicio se reiniciará automáticamente
```

### 2. INTENTS NO ACTIVADOS EN DISCORD

**Síntomas:**
- Error: "Privileged intent provided is not enabled or whitelisted"
- El bot se desconecta inmediatamente

**Soluciones:**
```bash
1. Ve a: https://discord.com/developers/applications
2. Selecciona tu aplicación
3. Ve a "Bot" → "Privileged Gateway Intents"
4. ACTIVA estos 3 intents:
   ☑️ PRESENCE INTENT
   ☑️ SERVER MEMBERS INTENT
   ☑️ MESSAGE CONTENT INTENT
5. Click "Save Changes"
6. En Render, reinicia manualmente el servicio
```

### 3. MONGODB_URI INVÁLIDO

**Síntomas:**
- El bot se conecta a Discord pero luego falla
- Error: "MongooseError: The `uri` parameter to `openUri()` must be a string"

**Soluciones:**
```bash
1. Verifica que MONGODB_URI esté configurado en Render
2. El formato debe ser:
   mongodb+srv://usuario:contraseña@cluster.mongodb.net/database
3. Si no tienes MongoDB, puedes comentar temporalmente la conexión
```

### 4. RENDER NO DETECTA QUE EL SERVICIO ESTÁ "VIVO"

**Síntomas:**
- Render marca el servicio como "Failed"
- El bot se reinicia constantemente cada 10 minutos

**Soluciones:**
El código ya incluye un servidor web en el puerto correcto.
Verifica en Render:
```bash
Settings → Health Check Path: /health (debe estar configurado)
```

### 5. MÓDULOS FALTANTES O CON ERRORES

**Síntomas:**
- El bot se conecta pero luego crashea
- Error al cargar módulos específicos

**Soluciones:**
El código ya maneja errores en módulos individuales sin crashear el bot completo.

## 🧪 CÓMO DIAGNOSTICAR

### Opción A: Logs de Render (RECOMENDADO)
```bash
1. Ve a tu servicio en Render
2. Click en "Logs" (arriba a la derecha)
3. Busca estos mensajes clave:
   - "🚀 Iniciando SirgioBOT..." → El bot está arrancando
   - "✅ Token validado" → El token tiene formato correcto
   - "🔌 Intentando conectar a Discord..." → Intentando login
   - "✅ ¡Bot listo!" → ÉXITO TOTAL
   
4. Si ves errores, cópialos y compáralos con las causas arriba
```

### Opción B: Prueba Local
```bash
1. Clona el repo localmente
2. Crea archivo .env con:
   DISCORD_TOKEN=tu_token_aqui
   MONGODB_URI=tu_uri_aqui (opcional)
   PORT=5000
3. Ejecuta: npm install
4. Ejecuta: node diagnose.js
5. Si funciona localmente pero no en Render → problema de configuración en Render
```

## ✅ CHECKLIST DE CONFIGURACIÓN EN RENDER

```
☐ Build Command: npm install
☐ Start Command: npm start
☐ Environment Variables:
  ☐ DISCORD_TOKEN = Bot.XXXXXX.XXXXXX.XXXXXX (sin espacios)
  ☐ MONGODB_URI = mongodb+srv://... (opcional)
  ☐ PORT = (déjalo vacío, Render lo asigna automáticamente)
☐ Health Check Path: /health
☐ Auto-Deploy: Yes (para que se actualice con cada push)
```

## 🚀 PASOS PARA RESOLVER (ORDEN RECOMENDADO)

### PASO 1: Regenerar Token
```
1. Discord Developer Portal → Bot → Reset Token
2. Copiar nuevo token
3. Render → Environment → Actualizar DISCORD_TOKEN
4. Esperar reinicio automático
5. Revisar logs
```

### PASO 2: Verificar Intents
```
1. Discord Developer Portal → Bot → Privileged Gateway Intents
2. Activar los 3 intents
3. Save Changes
4. Render → Manual Deploy → Clear build cache & deploy
```

### PASO 3: Revisar Logs Detalladamente
```
1. Render → Logs
2. Buscar el primer error que aparece
3. Comparar con las causas arriba
4. Aplicar la solución correspondiente
```

### PASO 4: Si Nada Funciona
```
1. En Render, elimina el servicio actual
2. Crea un nuevo servicio desde cero
3. Conecta el mismo repositorio
4. Configura las variables de entorno cuidadosamente
5. Despliega
```

## 📋 INFORMACIÓN PARA SOPORTE

Si necesitas ayuda adicional, proporciona:
```
1. Últimas 50 líneas de logs de Render
2. Captura de pantalla de Environment Variables (oculta el token)
3. Captura de los Privileged Gateway Intents activados
4. Resultado de ejecutar: node diagnose.js localmente
```

## 🔗 ENLACES ÚTILES

- Discord Developer Portal: https://discord.com/developers/applications
- Render Dashboard: https://dashboard.render.com
- Documentación Discord.js: https://discord.js.org
- Repositorio: https://github.com/CristopherAFK/SirgioBOT

---
**Última actualización:** Sesión actual
**Versión del bot:** 1.0.0
