const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Conectado a PostgreSQL');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        channel_id VARCHAR(32) UNIQUE NOT NULL,
        owner_id VARCHAR(32) NOT NULL,
        ticket_number VARCHAR(10) NOT NULL,
        category VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        claimed_by VARCHAR(32),
        claimed_at TIMESTAMP,
        closed_by VARCHAR(32),
        closed_at TIMESTAMP,
        rating INTEGER,
        rating_comment TEXT,
        status VARCHAR(20) DEFAULT 'open'
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS warnings (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(32) NOT NULL,
        reason TEXT NOT NULL,
        detected_word VARCHAR(100),
        staff_id VARCHAR(32),
        category VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sanctions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(32) NOT NULL,
        user_tag VARCHAR(100),
        type VARCHAR(20) NOT NULL,
        reason TEXT NOT NULL,
        category VARCHAR(50),
        duration INTEGER DEFAULT 0,
        staff_id VARCHAR(32) NOT NULL,
        staff_tag VARCHAR(100),
        proof TEXT,
        infractions INTEGER DEFAULT 1,
        additional_infractions TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        active BOOLEAN DEFAULT TRUE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS suggestions (
        id SERIAL PRIMARY KEY,
        suggestion_id VARCHAR(50) UNIQUE NOT NULL,
        user_id VARCHAR(32) NOT NULL,
        message_id VARCHAR(32),
        title VARCHAR(200),
        content TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        reviewed_by VARCHAR(32),
        review_reason TEXT,
        votes_up TEXT[] DEFAULT '{}',
        votes_down TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS banned_words (
        id SERIAL PRIMARY KEY,
        word VARCHAR(100) UNIQUE NOT NULL,
        added_by VARCHAR(32),
        hidden BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS mutes (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(32) NOT NULL,
        guild_id VARCHAR(32) NOT NULL,
        reason TEXT,
        staff_id VARCHAR(32),
        expires_at TIMESTAMP NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ticket_stats (
        id SERIAL PRIMARY KEY,
        staff_id VARCHAR(32) NOT NULL,
        tickets_claimed INTEGER DEFAULT 0,
        tickets_closed INTEGER DEFAULT 0,
        total_rating NUMERIC DEFAULT 0,
        rating_count INTEGER DEFAULT 0,
        avg_response_time INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action_type VARCHAR(50) NOT NULL,
        user_id VARCHAR(32),
        target_id VARCHAR(32),
        staff_id VARCHAR(32),
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS config (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(32) NOT NULL,
        command VARCHAR(50) NOT NULL,
        used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_owner ON tickets(owner_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action_type)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON rate_limits(user_id, command)
    `);

    client.release();
    return true;
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error.message);
    return false;
  }
};

const db = {
  query: (text, params) => pool.query(text, params),
  
  async createTicket(channelId, ownerId, ticketNumber, category) {
    const result = await pool.query(
      `INSERT INTO tickets (channel_id, owner_id, ticket_number, category) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [channelId, ownerId, ticketNumber, category]
    );
    return result.rows[0];
  },

  async getTicketByChannel(channelId) {
    const result = await pool.query(
      'SELECT * FROM tickets WHERE channel_id = $1',
      [channelId]
    );
    return result.rows[0];
  },

  async getTicketByOwner(ownerId) {
    const result = await pool.query(
      `SELECT * FROM tickets WHERE owner_id = $1 AND status = 'open'`,
      [ownerId]
    );
    return result.rows[0];
  },

  async claimTicket(channelId, staffId) {
    const result = await pool.query(
      `UPDATE tickets SET claimed_by = $1, claimed_at = CURRENT_TIMESTAMP 
       WHERE channel_id = $2 RETURNING *`,
      [staffId, channelId]
    );
    return result.rows[0];
  },

  async closeTicket(channelId, staffId) {
    const result = await pool.query(
      `UPDATE tickets SET closed_by = $1, closed_at = CURRENT_TIMESTAMP, status = 'closed' 
       WHERE channel_id = $2 RETURNING *`,
      [staffId, channelId]
    );
    return result.rows[0];
  },

  async rateTicket(ticketNumber, rating, comment) {
    const result = await pool.query(
      `UPDATE tickets SET rating = $1, rating_comment = $2 
       WHERE ticket_number = $3 RETURNING *`,
      [rating, comment, ticketNumber]
    );
    return result.rows[0];
  },

  async getTicketByNumber(ticketNumber) {
    const result = await pool.query(
      'SELECT * FROM tickets WHERE ticket_number = $1',
      [ticketNumber]
    );
    return result.rows[0];
  },

  async getLastTicketNumber() {
    const result = await pool.query(
      `SELECT MAX(CAST(ticket_number AS INTEGER)) as last FROM tickets`
    );
    return result.rows[0]?.last || 0;
  },

  async addWarning(userId, reason, detectedWord = null, staffId = null, category = null) {
    const result = await pool.query(
      `INSERT INTO warnings (user_id, reason, detected_word, staff_id, category) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, reason, detectedWord, staffId, category]
    );
    return result.rows[0];
  },

  async getWarnings(userId) {
    const result = await pool.query(
      `SELECT * FROM warnings WHERE user_id = $1 
       AND created_at > NOW() - INTERVAL '30 days' 
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  },

  async getWarningCount(userId) {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM warnings WHERE user_id = $1 
       AND created_at > NOW() - INTERVAL '30 days'`,
      [userId]
    );
    return parseInt(result.rows[0].count);
  },

  async resetWarnings(userId) {
    await pool.query('DELETE FROM warnings WHERE user_id = $1', [userId]);
  },

  async removeLastWarning(userId) {
    const result = await pool.query(
      `DELETE FROM warnings WHERE id = (
        SELECT id FROM warnings WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
      ) RETURNING *`,
      [userId]
    );
    return result.rows[0];
  },

  async createSuggestion(suggestionId, userId, messageId, title, content) {
    const result = await pool.query(
      `INSERT INTO suggestions (suggestion_id, user_id, message_id, title, content) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [suggestionId, userId, messageId, title, content]
    );
    return result.rows[0];
  },

  async getSuggestion(suggestionId) {
    const result = await pool.query(
      'SELECT * FROM suggestions WHERE suggestion_id = $1',
      [suggestionId]
    );
    return result.rows[0];
  },

  async updateSuggestionStatus(suggestionId, status, reviewedBy, reviewReason) {
    const result = await pool.query(
      `UPDATE suggestions SET status = $1, reviewed_by = $2, review_reason = $3 
       WHERE suggestion_id = $4 RETURNING *`,
      [status, reviewedBy, reviewReason, suggestionId]
    );
    return result.rows[0];
  },

  async addAuditLog(actionType, userId, targetId, staffId, details) {
    const result = await pool.query(
      `INSERT INTO audit_logs (action_type, user_id, target_id, staff_id, details) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [actionType, userId, targetId, staffId, details]
    );
    return result.rows[0];
  },

  async getAuditLogs(filters = {}) {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.actionType) {
      query += ` AND action_type = $${paramIndex++}`;
      params.push(filters.actionType);
    }
    if (filters.userId) {
      query += ` AND (user_id = $${paramIndex} OR target_id = $${paramIndex++})`;
      params.push(filters.userId);
    }
    if (filters.staffId) {
      query += ` AND staff_id = $${paramIndex++}`;
      params.push(filters.staffId);
    }

    query += ' ORDER BY created_at DESC LIMIT 100';
    const result = await pool.query(query, params);
    return result.rows;
  },

  async updateStaffStats(staffId, action, responseTime = null, rating = null) {
    const existing = await pool.query(
      'SELECT * FROM ticket_stats WHERE staff_id = $1',
      [staffId]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO ticket_stats (staff_id, tickets_claimed, tickets_closed) VALUES ($1, 0, 0)`,
        [staffId]
      );
    }

    if (action === 'claim') {
      await pool.query(
        `UPDATE ticket_stats SET tickets_claimed = tickets_claimed + 1, updated_at = CURRENT_TIMESTAMP 
         WHERE staff_id = $1`,
        [staffId]
      );
    } else if (action === 'close') {
      await pool.query(
        `UPDATE ticket_stats SET tickets_closed = tickets_closed + 1, updated_at = CURRENT_TIMESTAMP 
         WHERE staff_id = $1`,
        [staffId]
      );
    } else if (action === 'rate' && rating) {
      await pool.query(
        `UPDATE ticket_stats SET total_rating = total_rating + $1, rating_count = rating_count + 1, updated_at = CURRENT_TIMESTAMP 
         WHERE staff_id = $2`,
        [rating, staffId]
      );
    }
  },

  async getStaffStats(staffId = null) {
    if (staffId) {
      const result = await pool.query(
        'SELECT * FROM ticket_stats WHERE staff_id = $1',
        [staffId]
      );
      return result.rows[0];
    }
    const result = await pool.query(
      'SELECT * FROM ticket_stats ORDER BY tickets_closed DESC'
    );
    return result.rows;
  },

  async checkRateLimit(userId, command, limitMs) {
    const result = await pool.query(
      `SELECT * FROM rate_limits 
       WHERE user_id = $1 AND command = $2 AND used_at > NOW() - INTERVAL '1 second' * $3`,
      [userId, command, limitMs / 1000]
    );
    return result.rows.length > 0;
  },

  async setRateLimit(userId, command) {
    await pool.query(
      `INSERT INTO rate_limits (user_id, command) VALUES ($1, $2)`,
      [userId, command]
    );
  },

  async cleanupRateLimits() {
    await pool.query(`DELETE FROM rate_limits WHERE used_at < NOW() - INTERVAL '1 hour'`);
  },

  async getConfig(key) {
    const result = await pool.query('SELECT value FROM config WHERE key = $1', [key]);
    return result.rows[0]?.value;
  },

  async setConfig(key, value) {
    await pool.query(
      `INSERT INTO config (key, value) VALUES ($1, $2) 
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
      [key, value]
    );
  },

  async getTicketStats() {
    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'open') as open_tickets,
        COUNT(*) FILTER (WHERE status = 'closed') as closed_tickets,
        COUNT(*) FILTER (WHERE status = 'closed' AND closed_at > NOW() - INTERVAL '24 hours') as closed_today,
        AVG(rating) FILTER (WHERE rating IS NOT NULL) as avg_rating,
        COUNT(*) FILTER (WHERE rating IS NOT NULL) as rated_tickets
      FROM tickets
    `);
    return result.rows[0];
  },

  async cleanupOldWarnings() {
    const result = await pool.query(
      `DELETE FROM warnings WHERE created_at < NOW() - INTERVAL '30 days' RETURNING user_id`
    );
    return result.rows;
  }
};

module.exports = { connectDB, db, pool };
