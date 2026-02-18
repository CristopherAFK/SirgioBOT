/**
 * Funciones puras de utilidad para automod (loadWords, formatDuration, isStaff, canBan)
 */
const path = require("path");
const { STAFF_ROLE_IDS, CAN_BAN_ROLE_IDS } = require("./config");

function loadWords(filePath) {
  try {
    const fs = require("fs");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((w) => String(w).toLowerCase());
    if (parsed && Array.isArray(parsed.words)) return parsed.words.map((w) => String(w).toLowerCase());
    return [];
  } catch (e) {
    console.error("Error cargando palabras:", filePath, e);
    return [];
  }
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return "Permanente";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function isStaff(member) {
  if (!member) return false;
  return member.roles.cache.some((r) => STAFF_ROLE_IDS.includes(r.id));
}

function canBan(member) {
  if (!member) return false;
  return member.roles.cache.some((r) => CAN_BAN_ROLE_IDS.includes(r.id));
}

module.exports = {
  loadWords,
  formatDuration,
  isStaff,
  canBan,
};
