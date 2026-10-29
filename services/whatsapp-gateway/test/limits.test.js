import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter, phoneFromKey, textOf } from '../src/limits.js';

test('limita 8 envios por minuto por conversa', () => {
  const l = createLimiter(8, 60_000);
  for (let i = 0; i < 8; i++) assert.equal(l.allow('a', 1000 + i), true);
  assert.equal(l.allow('a', 2000), false);
  assert.equal(l.allow('b', 2000), true);
  assert.equal(l.allow('a', 62_000), true);
});

test('extrai telefone do JID e ignora grupos', () => {
  assert.equal(phoneFromKey({ remoteJid: '5511987654321@s.whatsapp.net' }), '5511987654321');
  assert.equal(phoneFromKey({ remoteJid: '123@lid', senderPn: '5511987654321@s.whatsapp.net' }), '5511987654321');
  assert.equal(phoneFromKey({ remoteJid: '1203630@g.us' }), null);
});

test('lê texto de mensagens comuns', () => {
  assert.equal(textOf({ conversation: 'oi' }), 'oi');
  assert.equal(textOf({ extendedTextMessage: { text: 'sim' } }), 'sim');
  assert.equal(textOf(undefined), '');
});
