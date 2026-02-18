const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sirgiobot';

const ticketSchema = new mongoose.Schema({
  channelId: { type: String, required: true, unique: true },
  ownerId: { type: String, required: true },
  ticketNumber: { type: String, required: true },
  category: { type: String, default: 'otro' },
  status: { type: String, default: 'open' },
  claimedBy: { type: String, default: null },
  claimedAt: { type: Date, default: null },
  closedBy: { type: String, default: null },
  closedAt: { type: Date, default: null },
  rating: { type: Number, default: null },
  ratingComment: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

const warningSchema = new mongoose.Schema({
  odId: { type: String, required: true, index: true },
  oderId: { type: String, required: true },
  reason: { type: String, required: true },
  category: { type: String, default: null },
  date: { type: Date, default: Date.now }
});

const sanctionSchema = new mongoose.Schema({
  odId: { type: String, required: true, index: true },
  oderId: { type: String, required: true },
  type: { type: String, required: true },
  reason: { type: String, required: true },
  category: { type: String, default: null },
  duration: { type: String, default: null },
  proof: { type: String, default: null },
  date: { type: Date, default: Date.now }
});

const suggestionSchema = new mongoose.Schema({
  suggestionId: { type: String, required: true, unique: true },
  odId: { type: String, required: true },
  messageId: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  status: { type: String, default: 'pending' },
  reviewedBy: { type: String, default: null },
  reviewReason: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const bannedWordSchema = new mongoose.Schema({
  word: { type: String, required: true, unique: true },
  addedBy: { type: String, required: true },
  isHidden: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const muteSchema = new mongoose.Schema({
  odId: { type: String, required: true, unique: true },
  oderId: { type: String, required: true },
  reason: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ticketStatsSchema = new mongoose.Schema({
  staffId: { type: String, required: true, unique: true },
  ticketsClaimed: { type: Number, default: 0 },
  ticketsClosed: { type: Number, default: 0 },
  totalRating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

const auditLogSchema = new mongoose.Schema({
  actionType: { type: String, required: true, index: true },
  odId: { type: String, default: null, index: true },
  targetId: { type: String, default: null },
  staffId: { type: String, default: null },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

const configSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now }
});

const tempBanSchema = new mongoose.Schema({
  odId: { type: String, required: true, unique: true },
  oderId: { type: String, required: true },
  reason: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

const rateLimitSchema = new mongoose.Schema({
  odId: { type: String, required: true },
  command: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});
rateLimitSchema.index({ odId: 1, command: 1 });
rateLimitSchema.index({ timestamp: 1 }, { expireAfterSeconds: 300 });

const Ticket = mongoose.model('Ticket', ticketSchema);
const Warning = mongoose.model('Warning', warningSchema);
const Sanction = mongoose.model('Sanction', sanctionSchema);
const Suggestion = mongoose.model('Suggestion', suggestionSchema);
const BannedWord = mongoose.model('BannedWord', bannedWordSchema);
const Mute = mongoose.model('Mute', muteSchema);
const TicketStats = mongoose.model('TicketStats', ticketStatsSchema);
const AuditLog = mongoose.model('AuditLog', auditLogSchema);
const Config = mongoose.model('Config', configSchema);
const TempBan = mongoose.model('TempBan', tempBanSchema);
const RateLimit = mongoose.model('RateLimit', rateLimitSchema);

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
    return true;
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    return false;
  }
}

const db = {
  async createTicket(channelId, ownerId, ticketNumber, category = 'otro') {
    const ticket = new Ticket({
      channelId,
      ownerId,
      ticketNumber,
      category
    });
    return await ticket.save();
  },

  async getTicketByChannel(channelId) {
    return await Ticket.findOne({ channelId });
  },

  async getTicketByOwner(ownerId) {
    return await Ticket.findOne({ ownerId, status: 'open' });
  },

  async getTicketByNumber(ticketNumber) {
    return await Ticket.findOne({ ticketNumber });
  },

  async getLastTicketNumber() {
    const lastTicket = await Ticket.findOne().sort({ createdAt: -1 });
    if (!lastTicket) return 0;
    return parseInt(lastTicket.ticketNumber) || 0;
  },

  async claimTicket(channelId, staffId) {
    return await Ticket.findOneAndUpdate(
      { channelId },
      { claimedBy: staffId, claimedAt: new Date() },
      { new: true }
    );
  },

  async closeTicket(channelId, closedBy) {
    return await Ticket.findOneAndUpdate(
      { channelId },
      { status: 'closed', closedBy, closedAt: new Date() },
      { new: true }
    );
  },

  async rateTicket(ticketNumber, rating, comment = null) {
    return await Ticket.findOneAndUpdate(
      { ticketNumber },
      { rating, ratingComment: comment },
      { new: true }
    );
  },

  async addWarning(odId, oderId, reason, category = null) {
    const warning = new Warning({ odId, oderId, reason, category });
    return await warning.save();
  },

  async getWarnings(odId) {
    return await Warning.find({ odId }).sort({ date: -1 });
  },

  async getWarningCount(odId) {
    return await Warning.countDocuments({ odId });
  },

  async removeLastWarning(odId) {
    const lastWarn = await Warning.findOne({ odId }).sort({ date: -1 });
    if (lastWarn) {
      await Warning.deleteOne({ _id: lastWarn._id });
      return true;
    }
    return false;
  },

  async resetWarnings(odId) {
    const result = await Warning.deleteMany({ odId });
    return result.deletedCount;
  },

  async cleanupOldWarnings() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await Warning.deleteMany({ date: { $lt: thirtyDaysAgo } });
    return result.deletedCount;
  },

  async addSanction(odId, oderId, type, reason, category = null, duration = null, proof = null) {
    const sanction = new Sanction({ odId, oderId, type, reason, category, duration, proof });
    return await sanction.save();
  },

  async getSanctions(odId) {
    return await Sanction.find({ odId }).sort({ date: -1 });
  },

  async createSuggestion(suggestionId, odId, messageId, title, content) {
    const suggestion = new Suggestion({
      suggestionId,
      odId,
      messageId,
      title,
      content
    });
    return await suggestion.save();
  },

  async getSuggestion(suggestionId) {
    return await Suggestion.findOne({ suggestionId });
  },

  async updateSuggestionStatus(suggestionId, status, reviewedBy = null, reason = null) {
    return await Suggestion.findOneAndUpdate(
      { suggestionId },
      { 
        status, 
        reviewedBy, 
        reviewReason: reason,
        updatedAt: new Date()
      },
      { new: true }
    );
  },

  async addBannedWord(word, addedBy, isHidden = false) {
    const bannedWord = new BannedWord({ word: word.toLowerCase(), addedBy, isHidden });
    return await bannedWord.save();
  },

  async removeBannedWord(word) {
    const result = await BannedWord.deleteOne({ word: word.toLowerCase() });
    return result.deletedCount > 0;
  },

  async getBannedWords() {
    const words = await BannedWord.find({ isHidden: false });
    return words.map(w => w.word);
  },

  async getAllBannedWords() {
    const words = await BannedWord.find();
    return words.map(w => w.word);
  },

  async addMute(odId, oderId, reason, expiresAt) {
    return await Mute.findOneAndUpdate(
      { odId },
      { odId, oderId, reason, expiresAt, createdAt: new Date() },
      { upsert: true, new: true }
    );
  },

  async getMute(odId) {
    return await Mute.findOne({ odId });
  },

  async removeMute(odId) {
    const result = await Mute.deleteOne({ odId });
    return result.deletedCount > 0;
  },

  async getExpiredMutes() {
    return await Mute.find({ expiresAt: { $lte: new Date() } });
  },

  async updateStaffStats(staffId, action, ticketNumber = null, rating = null) {
    const update = { updatedAt: new Date() };
    
    if (action === 'claim') {
      update.$inc = { ticketsClaimed: 1 };
    } else if (action === 'close') {
      update.$inc = { ticketsClosed: 1 };
    } else if (action === 'rate' && rating !== null) {
      update.$inc = { totalRating: rating, ratingCount: 1 };
    }

    return await TicketStats.findOneAndUpdate(
      { staffId },
      update,
      { upsert: true, new: true }
    );
  },

  async getStaffStats(staffId = null) {
    if (staffId) {
      return await TicketStats.findOne({ staffId });
    }
    return await TicketStats.find().sort({ ticketsClosed: -1 }).limit(10);
  },

  async getTicketStats() {
    const openTickets = await Ticket.countDocuments({ status: 'open' });
    const closedTickets = await Ticket.countDocuments({ status: 'closed' });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const closedToday = await Ticket.countDocuments({ 
      status: 'closed', 
      closedAt: { $gte: today } 
    });

    const ratedTickets = await Ticket.find({ rating: { $ne: null } });
    const totalRating = ratedTickets.reduce((sum, t) => sum + (t.rating || 0), 0);
    const avgRating = ratedTickets.length > 0 ? totalRating / ratedTickets.length : null;

    return {
      open_tickets: openTickets,
      closed_tickets: closedTickets,
      closed_today: closedToday,
      avg_rating: avgRating,
      rated_tickets: ratedTickets.length
    };
  },

  async addAuditLog(actionType, odId = null, targetId = null, staffId = null, details = {}) {
    const log = new AuditLog({ actionType, odId, targetId, staffId, details });
    return await log.save();
  },

  async getAuditLogs(options = {}) {
    const query = {};
    if (options.odId) query.odId = options.odId;
    if (options.actionType) query.actionType = new RegExp(options.actionType, 'i');
    
    return await AuditLog.find(query).sort({ createdAt: -1 }).limit(options.limit || 50);
  },

  async getConfig(key) {
    const config = await Config.findOne({ key });
    return config ? config.value : null;
  },

  async setConfig(key, value) {
    return await Config.findOneAndUpdate(
      { key },
      { value, updatedAt: new Date() },
      { upsert: true, new: true }
    );
  },

  async checkRateLimit(odId, command, limitMs) {
    const cutoff = new Date(Date.now() - limitMs);
    const existing = await RateLimit.findOne({
      odId,
      command,
      timestamp: { $gt: cutoff }
    });
    return !!existing;
  },

  async setRateLimit(odId, command) {
    const rateLimit = new RateLimit({ odId, command });
    return await rateLimit.save();
  },

  async addTempBan(odId, oderId, reason, expiresAt) {
    return await TempBan.findOneAndUpdate(
      { odId },
      { odId, oderId, reason, expiresAt, createdAt: new Date() },
      { upsert: true, new: true }
    );
  },

  async getTempBan(odId) {
    return await TempBan.findOne({ odId });
  },

  async removeTempBan(odId) {
    const result = await TempBan.deleteOne({ odId });
    return result.deletedCount > 0;
  },

  async getExpiredTempBans() {
    return await TempBan.find({ expiresAt: { $lte: new Date() } });
  },

  async getActiveTempBans() {
    return await TempBan.find({ expiresAt: { $gt: new Date() } });
  },

  async getActiveMutes() {
    return await Mute.find({ expiresAt: { $gt: new Date() } });
  },

  async cleanupRateLimits() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await RateLimit.deleteMany({ timestamp: { $lt: fiveMinutesAgo } });
  },

  async query(queryString, params = []) {
    console.warn('SQL query called on MongoDB - this should be migrated');
    return { rows: [] };
  }
};

module.exports = { connectDB, db, mongoose };
