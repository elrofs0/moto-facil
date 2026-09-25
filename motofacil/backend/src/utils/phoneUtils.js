// Normaliza número de WhatsApp brasileiro pro formato canônico (celular
// sempre COM o 9º dígito). A Evolution API/Baileys já reportou o mesmo
// aparelho com e sem o 9 em dias diferentes (ambiguidade conhecida dessas
// bibliotecas) — sem normalizar na entrada, a mesma pessoa vira dois
// registros (Driver/User) diferentes, com o unique constraint de
// `whatsapp` não pegando porque as strings são tecnicamente distintas.
//
// Só mexe no padrão Brasil (55 + DDD de 2 dígitos + número local de 8
// dígitos = 12 dígitos no total). Fixo nunca ganhou o 9º dígito — número
// local de fixo começa com 2-5, celular (antigo, sem o 9) começa com 6-9.
// Qualquer coisa fora desse padrão (já com 13 dígitos, outro país,
// formato inesperado) passa direto, sem mexer.
function normalizeWhatsapp(raw) {
  const digits = (raw || '').replace(/\D/g, '');

  if (digits.length !== 12 || !digits.startsWith('55')) return digits;

  const ddd = digits.slice(2, 4);
  const localNumber = digits.slice(4);

  if (/^[6-9]/.test(localNumber)) {
    return `55${ddd}9${localNumber}`;
  }

  return digits;
}

module.exports = { normalizeWhatsapp };
