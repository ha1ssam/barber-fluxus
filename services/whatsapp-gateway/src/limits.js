// Anti-spam por conversa: no máximo N envios por janela (padrão: 8 por minuto, como na spec).
export function createLimiter(max = 8, windowMs = 60_000) {
  const hits = new Map();
  return {
    allow(key, now = Date.now()) {
      const list = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
      if (list.length >= max) {
        hits.set(key, list);
        return false;
      }
      list.push(now);
      hits.set(key, list);
      return true;
    },
  };
}

/** Extrai o telefone (só dígitos) de um JID do WhatsApp, preferindo o número real quando vier um LID. */
export function phoneFromKey(key) {
  const jid = key.senderPn || key.remoteJidAlt || key.participantPn || key.remoteJid || '';
  if (jid.endsWith('@g.us') || jid === 'status@broadcast') return null;
  const digits = jid.split('@')[0].split(':')[0].replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

export function textOf(message) {
  if (!message) return '';
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.buttonsResponseMessage?.selectedDisplayText ||
    message.listResponseMessage?.title ||
    message.templateButtonReplyMessage?.selectedDisplayText ||
    ''
  );
}
