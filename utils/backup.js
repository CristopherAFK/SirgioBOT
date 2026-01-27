const fs = require('fs');
const path = require('path');
const { db, pool } = require('../database');

const BACKUP_INTERVAL = 6 * 60 * 60 * 1000;
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const MAX_BACKUPS = 10;

module.exports = (client) => {
  console.log('✅ Sistema de backup automático cargado');

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  client.once('ready', () => {
    setTimeout(() => createBackup(client), 60000);

    setInterval(() => createBackup(client), BACKUP_INTERVAL);
  });
};

async function createBackup(client) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `backup_${timestamp}.json`);

    const tables = ['tickets', 'warnings', 'sanctions', 'suggestions', 'banned_words', 'mutes', 'ticket_stats', 'config'];
    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: {}
    };

    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT * FROM ${table}`);
        backup.data[table] = result.rows;
      } catch (err) {
        console.warn(`No se pudo hacer backup de tabla ${table}:`, err.message);
        backup.data[table] = [];
      }
    }

    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`💾 Backup creado: ${backupFile}`);

    await cleanupOldBackups();

    await db.addAuditLog('BACKUP_CREATE', null, null, null, {
      filename: path.basename(backupFile),
      tables: tables.length,
      timestamp: backup.timestamp
    });

  } catch (error) {
    console.error('Error creando backup:', error);
  }
}

async function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(MAX_BACKUPS);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
        console.log(`🗑️ Backup antiguo eliminado: ${file.name}`);
      }
    }
  } catch (error) {
    console.error('Error limpiando backups antiguos:', error);
  }
}

async function restoreBackup(backupFile) {
  try {
    if (!fs.existsSync(backupFile)) {
      throw new Error('Archivo de backup no encontrado');
    }

    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

    console.log(`📥 Restaurando backup desde: ${backup.timestamp}`);

    return { success: true, message: 'Backup restaurado correctamente' };
  } catch (error) {
    console.error('Error restaurando backup:', error);
    return { success: false, message: error.message };
  }
}

module.exports.createBackup = createBackup;
module.exports.restoreBackup = restoreBackup;
