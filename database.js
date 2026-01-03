const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

const connectDB = async () => {
  if (!MONGODB_URI) {
    console.warn('⚠️ MONGODB_URI no configurada - usando almacenamiento en archivos JSON como respaldo');
    return false;
  }
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
    return true;
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    return false;
  }
};

const warningSchema = new mongoose.Schema({
  odId: { type: String, required: true },
  reason: { type: String, required: true },
  date: { type: Date, default: Date.now },
  detectedWord: { type: String, default: null },
  staffId: { type: String, default: null },
  category: { type: String, default: null }
});

const sanctionSchema = new mongoose.Schema({
  odId: { type: String, required: true },
  odTag: { type: String },
  type: { type: String, enum: ['warn', 'mute', 'ban'], required: true },
  reason: { type: String, required: true },
  category: { type: String },
  duration: { type: Number, default: 0 },
  staffId: { type: String, required: true },
  staffTag: { type: String },
  proof: { type: String, default: null },
  infractions: { type: Number, default: 1 },
  additionalInfractions: [{ type: String }],
  date: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
  active: { type: Boolean, default: true }
});

const ticketSchema = new mongoose.Schema({
  odId: { type: String, required: true },
  channelId: { type: String, required: true },
  number: { type: String, required: true },
  category: { type: String },
  createdAt: { type: Date, default: Date.now },
  claimedBy: { type: String, default: null },
  closedBy: { type: String, default: null },
  closedAt: { type: Date, default: null },
  rating: { type: Number, default: null },
  ratingComment: { type: String, default: null }
});

const ticketCounterSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  lastTicket: { type: Number, default: 0 }
});

const muteSchema = new mongoose.Schema({
  odId: { type: String, required: true },
  guildId: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  reason: { type: String },
  staffId: { type: String },
  active: { type: Boolean, default: true }
});

const bannedWordSchema = new mongoose.Schema({
  word: { type: String, required: true, unique: true, lowercase: true },
  addedBy: { type: String },
  addedAt: { type: Date, default: Date.now },
  hidden: { type: Boolean, default: false }
});

const sensitiveWordSchema = new mongoose.Schema({
  word: { type: String, required: true, unique: true, lowercase: true },
  addedBy: { type: String },
  addedAt: { type: Date, default: Date.now }
});

const suggestionSchema = new mongoose.Schema({
  odId: { type: String, required: true },
  messageId: { type: String, required: true },
  content: { type: String, required: true },
  votes: {
    up: [{ type: String }],
    down: [{ type: String }]
  },
  status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const postulacionStatusSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  open: { type: Boolean, default: false }
});

const maintenanceModeSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  channelId: { type: String, default: null },
  originalPermissions: { type: Map, of: Object }
});

const Warning = mongoose.model('Warning', warningSchema);
const Sanction = mongoose.model('Sanction', sanctionSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);
const TicketCounter = mongoose.model('TicketCounter', ticketCounterSchema);
const Mute = mongoose.model('Mute', muteSchema);
const BannedWord = mongoose.model('BannedWord', bannedWordSchema);
const SensitiveWord = mongoose.model('SensitiveWord', sensitiveWordSchema);
const Suggestion = mongoose.model('Suggestion', suggestionSchema);
const PostulacionStatus = mongoose.model('PostulacionStatus', postulacionStatusSchema);
const MaintenanceMode = mongoose.model('MaintenanceMode', maintenanceModeSchema);

module.exports = {
  connectDB,
  mongoose,
  Warning,
  Sanction,
  Ticket,
  TicketCounter,
  Mute,
  BannedWord,
  SensitiveWord,
  Suggestion,
  PostulacionStatus,
  MaintenanceMode
};
