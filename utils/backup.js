const fs = require('fs');
const path = require('path');
const { db, mongoose } = require('../database');

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

    const collections = ['Ticket', 'Warning', 'Sanction', 'Suggestion', 'BannedWord', 'Mute', 'TicketStats', 'Config'];
    const backup = {
      timestamp: new Date().toISOString(),
      version: '2.0-mongodb',
      data: {}
    };

    for (const collectionName of collections) {
      try {
        const Model = mongoose.model(collectionName);
        const docs = await Model.find().lean();
        backup.data[collectionName.toLowerCase()] = docs;
      } catch (err) {
        console.warn(`No se pudo hacer backup de ${collectionName}:`, err.message);
        backup.data[collectionName.toLowerCase()] = [];
      }
    }

    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`💾 Backup creado: ${backupFile}`);

    await cleanupOldBackups();

    await db.addAuditLog('BACKUP_CREATE', null, null, null, {
      filename: path.basename(backupFile),
      collections: collections.length,
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

module.exports.createBackup = createBackup;
