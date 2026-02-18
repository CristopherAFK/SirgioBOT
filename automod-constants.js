/**
 * Constantes para el módulo automod (categorías de sanción, palabras ocultas, etc.)
 */

const SANCTION_CATEGORIES = [
  { value: "flood", label: "Flood", emoji: "🌊" },
  { value: "spam", label: "Spam", emoji: "📢" },
  { value: "wall_of_text", label: "Wall of Text", emoji: "📄" },
  { value: "bypass_automod", label: "Bypass de AutoMod", emoji: "🔓" },
  { value: "vacio_legal", label: "Vacío legal", emoji: "⚖️" },
  { value: "romper_norma", label: "Romper Norma", emoji: "📜" },
  { value: "hacks_eventos", label: "Hacks en eventos", emoji: "🎮" },
  { value: "bypass_palabras", label: "Bypass de palabras prohibidas", emoji: "🚫" },
  { value: "canal_incorrecto", label: "Uso de canales incorrecto", emoji: "📍" },
  { value: "mencion_cp", label: "Mención de CP", emoji: "⛔" },
  { value: "publicidad", label: "Hacer publicidad", emoji: "📣" },
  { value: "perfil_inapropiado", label: "Perfil inapropiado/comprometido", emoji: "👤" },
  { value: "amenaza", label: "Amenaza", emoji: "⚠️" },
  { value: "intento_raid", label: "Intento de Raid", emoji: "💥" },
  { value: "ticket_innecesario", label: "Ticket innecesario", emoji: "🎫" },
  { value: "seguridad", label: "Seguridad", emoji: "🔒" },
  { value: "acoso", label: "Acoso", emoji: "😠" },
  { value: "contenido_nsfw", label: "Contenido NSFW", emoji: "🔞" },
  { value: "desinformacion", label: "Desinformación", emoji: "❌" },
  { value: "trolleo", label: "Trolleo", emoji: "🤡" },
  { value: "otro", label: "Otro", emoji: "📝" }
];

const HIDDEN_WORDS = ["fabio", "alle", "zuri", "error", "errorcode", "alleza", "itsalejo", "ist alejo", "imalejandro"];

module.exports = {
  SANCTION_CATEGORIES,
  HIDDEN_WORDS,
};
