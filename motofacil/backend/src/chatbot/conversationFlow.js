const conversationState = require('../services/conversationStateService');
const rideService = require('../services/rideService');
const paymentService = require('../services/paymentService');
const referralService = require('../services/referralService');
const evolutionService = require('../services/evolutionService');
const env = require('../config/env');
const { User, Driver, Vehicle, Ride, WalletTransaction } = require('../models');
const { logger } = require('../utils');

// Máquina de estados simples e explícita — cada etapa só sabe processar
// a mensagem esperada naquela etapa. Preferido a um NLP livre porque o
// público do MotoFácil inclui pessoas menos familiarizadas com tecnologia;
// menus/etapas previsíveis erram menos que interpretação de texto livre.
//
// Um único ponto de entrada (handleIncomingMessage) atende três públicos
// diferentes pelo mesmo número de WhatsApp: cliente pedindo corrida,
// candidato a motoboy se cadastrando, e motoboy já cadastrado recarregando
// carteira — o webhook não sabe de antemão "quem" está escrevendo, só
// distinguimos pelo texto e pelo estado da conversa.

const STEPS = {
  // Cliente pedindo corrida/entrega
  ASKING_ORIGIN: 'ASKING_ORIGIN',
  ASKING_DESTINATION: 'ASKING_DESTINATION',
  ASKING_MORE_STOPS: 'ASKING_MORE_STOPS',
  ASKING_STOP_ADDRESS: 'ASKING_STOP_ADDRESS',
  // Endereço que falhou geocodificação vira 3 perguntas separadas (rua,
  // número, complemento/referência) em vez de um texto livre só — o motivo
  // mais comum de falha era formatação (ex: sem vírgula antes do número),
  // então juntar os pedaços certos evita repetir o mesmo erro.
  FIXING_ADDRESS_STREET: 'FIXING_ADDRESS_STREET',
  FIXING_ADDRESS_NUMBER: 'FIXING_ADDRESS_NUMBER',
  FIXING_ADDRESS_COMPLEMENT: 'FIXING_ADDRESS_COMPLEMENT',
  ASKING_PRICE_CONFIRMATION: 'ASKING_PRICE_CONFIRMATION',
  PRICE_REJECTED_CHOICE: 'PRICE_REJECTED_CHOICE',
  ASKING_PAYMENT_METHOD: 'ASKING_PAYMENT_METHOD',

  // Gênero — só entra no fluxo de corrida de PASSAGEIRO (mototáxi), nunca
  // em entrega. ASKING_CLIENT_GENDER só roda uma vez na vida da cliente
  // (fica salvo em User.gender); ASKING_DRIVER_GENDER_PREFERENCE e
  // ASKING_ACCEPT_ANY_DRIVER são por corrida, nunca salvos.
  ASKING_CLIENT_GENDER: 'ASKING_CLIENT_GENDER',
  ASKING_DRIVER_GENDER_PREFERENCE: 'ASKING_DRIVER_GENDER_PREFERENCE',
  ASKING_ACCEPT_ANY_DRIVER: 'ASKING_ACCEPT_ANY_DRIVER',

  // Agendamento — perguntado logo depois de escolher entrega/corrida,
  // antes até do motoboy de preferência (agendar ou não é a decisão mais
  // "de cima" do pedido).
  ASKING_SCHEDULE_CHOICE: 'ASKING_SCHEDULE_CHOICE',
  ASKING_SCHEDULE_DATETIME: 'ASKING_SCHEDULE_DATETIME',

  // Motoboy de preferência — perguntado logo depois de escolher
  // entrega/corrida, antes de qualquer pergunta de gênero.
  ASKING_PREFERRED_DRIVER: 'ASKING_PREFERRED_DRIVER',

  // Nome de contato — perguntado antes de QUALQUER outra coisa (até antes
  // do menu inicial) na primeira mensagem de um WhatsApp que a gente nunca
  // viu, e também pra quem já existe mas ainda só tem o placeholder
  // (User.name === User.whatsapp, de antes dessa funcionalidade existir).
  ASKING_CONTACT_NAME: 'ASKING_CONTACT_NAME',

  // Cadastro de motoboy
  DRIVER_REG_NAME: 'DRIVER_REG_NAME',
  DRIVER_REG_USERNAME: 'DRIVER_REG_USERNAME',
  DRIVER_REG_GENDER: 'DRIVER_REG_GENDER',
  DRIVER_REG_SERVICES: 'DRIVER_REG_SERVICES',
  DRIVER_REG_PLATE: 'DRIVER_REG_PLATE',
  DRIVER_REG_MODEL: 'DRIVER_REG_MODEL',
  // Documentos de verificação — reforço de segurança do cadastro (CNH,
  // CRLV e selfie são obrigatórios, sem opção de "pular"; diferente do
  // alvará, que continua opcional/adiável por só valer pra passageiro).
  DRIVER_REG_CNH_NUMBER: 'DRIVER_REG_CNH_NUMBER',
  DRIVER_REG_CNH_PHOTO: 'DRIVER_REG_CNH_PHOTO',
  DRIVER_REG_CRLV_PHOTO: 'DRIVER_REG_CRLV_PHOTO',
  DRIVER_REG_SELFIE_PHOTO: 'DRIVER_REG_SELFIE_PHOTO',
  DRIVER_REG_PIX_KEY: 'DRIVER_REG_PIX_KEY',
  DRIVER_REG_ALVARA: 'DRIVER_REG_ALVARA',

  // Recarga de carteira do motoboy
  DRIVER_RECHARGE_AMOUNT: 'DRIVER_RECHARGE_AMOUNT',

  // Motoboy digitou "disponível" mas ainda não tem localização salva —
  // esperando ele compartilhar pra só então marcar status='available'
  // de verdade (ver handleDriverLocation).
  DRIVER_AWAITING_LOCATION_FOR_AVAILABILITY: 'DRIVER_AWAITING_LOCATION_FOR_AVAILABILITY',

  // Motoboy recebeu oferta de corrida (texto puro "1 - Aceitar / 2 -
  // Recusar", ver rideService.sendRideOfferMessage) e ainda não respondeu.
  // O valor precisa bater exatamente com a string literal usada em
  // rideService.js — não dá pra importar STEPS lá sem criar dependência
  // circular (rideService já é importado por este arquivo).
  DRIVER_RIDE_OFFER_RESPONSE: 'DRIVER_RIDE_OFFER_RESPONSE',
};

// Enquanto o gateway de pagamento (Asaas/Mercado Pago) não estiver validado
// e configurado, deixe CASH_ONLY_MODE=true no .env — some as opções de
// Pix/cartão/boleto do menu e força só dinheiro, sem precisar mexer em
// código quando o gateway ficar pronto (é só apagar essa variável).
const CASH_ONLY_MODE = process.env.CASH_ONLY_MODE === 'true';

const PAYMENT_OPTIONS = CASH_ONLY_MODE
  ? { '1': 'cash' }
  : {
    '1': 'pix',
    '2': 'credit_card',
    '3': 'debit_card',
    '4': 'cash',
  };

const PAYMENT_MENU_TEXT = CASH_ONLY_MODE
  ? 'Pagamento por enquanto só em dinheiro, direto com o motoboy — responda 1 para confirmar.'
  : 'Como você quer pagar?\n1 - Pix\n2 - Cartão de crédito\n3 - Cartão de débito\n4 - Dinheiro (direto com o motoboy)';

const SERVICE_OPTIONS = {
  '1': { atende_entregas: true, atende_passageiro: false },
  '2': { atende_entregas: false, atende_passageiro: true },
  '3': { atende_entregas: true, atende_passageiro: true },
};

const DRIVER_GENDER_OPTIONS = { '1': 'motoboy', '2': 'motogirl' };
const CLIENT_GENDER_OPTIONS = { '1': 'feminino', '2': 'masculino', '0': 'indiferente' };

// Só letras/números/underscore, 3 a 20 caracteres — sem espaço, sem
// acento. Aceita o @ na frente (cliente/motoboy podem digitar com ou sem)
// e sempre normaliza pra minúsculo, pra @Elrofs e @elrofs serem a mesma
// pessoa.
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

// Versão vigente dos Termos de Uso/Política de Privacidade — exibida (não
// exige aceite explícito) bem no início do cadastro de motoboy. Trocar aqui
// quando o documento for atualizado (o PDF em si mora em
// frontend/public/termos.pdf).
const TERMS_VERSION = '1.0';
const TERMS_URL = 'https://motofacil.tech/termos.pdf';

// Landing page explicando o MotoFácil pra quem ainda não conhece — mandada
// como primeira mensagem do cadastro de motoboy, antes até dos Termos
// (arquivo estático em frontend/public/comece.html, mesmo esquema do
// termos.pdf acima).
const LANDING_URL = 'https://motofacil.tech/comece.html';

function normalizeUsername(text) {
  return (text || '').trim().toLowerCase().replace(/^@/, '');
}

// Atalhos numéricos do menu inicial (1/2/3) — a frase completa continua
// funcionando igual, o número é só um jeito mais rápido de responder
// pelo WhatsApp sem digitar a frase inteira.
function detectRideIntent(normalized) {
  const passengerPhrases = ['mototaxi', 'moto taxi', 'quero uma corrida', 'preciso de uma corrida', 'preciso de um passageiro'];
  const deliveryPhrases = ['preciso de uma moto', 'quero uma entrega', 'preciso de entrega', 'preciso de um motoboy'];
  if (normalized === '2' || passengerPhrases.some((p) => normalized.includes(p))) return 'passenger';
  if (normalized === '1' || deliveryPhrases.some((p) => normalized.includes(p))) return 'delivery';
  return null;
}

function detectDriverRegistrationIntent(normalized) {
  if (normalized === '3') return true;
  return ['quero ser motoboy', 'cadastrar motoboy', 'cadastro de motoboy', 'ser entregador', 'quero entregar', 'trabalhar como motoboy']
    .some((p) => normalized.includes(p));
}

function detectRechargeIntent(normalized) {
  return ['recarregar carteira', 'recarregar minha carteira', 'recarregar', 'recarga', 'adicionar saldo', 'colocar saldo']
    .some((p) => normalized.includes(p));
}

function detectSendAlvaraIntent(normalized) {
  return ['enviar alvara', 'mandar alvara', 'enviar alvará', 'mandar alvará'].some((p) => normalized.includes(p));
}

// Checado DEPOIS de detectRechargeIntent (a ordem em handleIncomingMessage
// importa) — "adicionar saldo"/"colocar saldo" são frases de recarga que
// também contêm a palavra "saldo", então recarga precisa vencer primeiro.
function detectBalanceIntent(normalized) {
  return ['saldo', 'meu saldo', 'ver saldo', 'consultar saldo', 'quanto eu tenho', 'quanto tenho de saldo']
    .some((p) => normalized.includes(p));
}

function detectStatementIntent(normalized) {
  return ['extrato', 'movimentações', 'movimentacoes', 'histórico da carteira', 'historico da carteira', 'meu histórico', 'meu historico']
    .some((p) => normalized.includes(p));
}

function detectUsernameQueryIntent(normalized) {
  return ['meu usuario', 'meu usuário', 'meu @', 'qual meu usuario', 'qual meu usuário', 'meu nome de usuario', 'meu nome de usuário']
    .some((p) => normalized.includes(p));
}

// Sistema de indicação de motoboys — liberado informalmente por enquanto
// (só quem sabe o comando usa), mas o mecanismo em si é genérico: qualquer
// motoboy com @ cadastrado pode pedir o próprio link.
function detectReferralLinkIntent(normalized) {
  return ['meu link de indicacao', 'meu link de indicação', 'link de indicacao', 'link de indicação', 'indicar motoboy', 'indicar um motoboy']
    .some((p) => normalized.includes(p));
}

function detectAvailabilityIntent(normalized) {
  // "indisponível" checado ANTES de "disponível" de propósito: a palavra
  // normalizada "indisponivel" contém "disponivel" como substring, então
  // checar disponível primeiro sempre dava match errado (motoboy digitava
  // "indisponível" e o sistema entendia "disponível").
  if (['indisponivel', 'indisponível', 'ficar offline', 'sair', 'parar'].some((p) => normalized.includes(p))) return 'offline';
  if (['disponivel', 'disponível', 'estou disponivel', 'ficar disponivel'].some((p) => normalized.includes(p))) return 'available';
  return null;
}

// Aviso de saldo baixo ao ficar disponível — mesmo problema silencioso já
// resolvido para localização (motoboy ficava "disponível" mas nunca
// recebia oferta por falta de saldo pro lead fee, sem nenhum aviso disso).
// Só avisa, não bloqueia — a trava de saldo de verdade já existe em
// rideService (acceptRide/findNearbyAvailableDrivers).
function buildAvailabilityConfirmationMessage(driver, baseMessage) {
  const balance = parseFloat(driver.wallet_balance);
  if (balance < env.leadFee.amount) {
    return `${baseMessage}\n\n⚠️ Seu saldo está baixo (R$ ${balance.toFixed(2)}). Recomendamos recarregar pra não perder corridas.`;
  }
  return baseMessage;
}

function detectCompleteRideIntent(normalized) {
  return ['entreguei', 'entregue', 'concluido', 'concluído', 'concluir', 'finalizei', 'cheguei', 'corrida concluida', 'corrida concluída']
    .some((p) => normalized.includes(p));
}

// Cliente cancelando por conta própria, fora de qualquer fluxo em
// andamento (ver handleClientCancelRide) — não colide com os "2 - cancelar"
// que já existem dentro de fluxos específicos (esses são tratados dentro
// de continueFlow, só quando há state ativo; aqui só roda sem state).
function detectCancelRideIntent(normalized) {
  return ['cancelar', 'cancela'].some((p) => normalized.includes(p));
}

// Correção pra quem respondeu "0 - Prefiro não informar" no gênero e depois
// quer poder pedir motogirl — como ASKING_CLIENT_GENDER só roda uma vez na
// vida da cliente (ver comentário em STEPS), sem isso ela ficaria travada
// em "indiferente" pra sempre.
function detectGenderCorrectionIntent(normalized) {
  return normalized === 'girl';
}

// ---------------- Agendamento (corrida/entrega pra horário futuro) ----------------
const MIN_SCHEDULE_MS = 60 * 60 * 1000; // 1 hora
const MAX_SCHEDULE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

// Interpreta "DD/MM HH:MM" como horário de Santa Maria/RS (America/Sao_Paulo,
// UTC-3 fixo — sem horário de verão no Brasil desde 2019) e devolve um Date
// de verdade. Sem ano na entrada: assume o ano corrente, e vira o ano
// seguinte sozinho se a data já ficou mais de 1 dia no passado (cobre quem
// agenda perto da virada do ano, dentro da janela de 7 dias).
function parseScheduleDateTime(text) {
  const match = /^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/.exec((text || '').trim());
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const hour = parseInt(match[3], 10);
  const minute = parseInt(match[4], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const referenceYear = new Date(Date.now() - 3 * 60 * 60 * 1000).getUTCFullYear();
  // +3 converte horário local de Santa Maria pra UTC. Date.UTC normaliza
  // sozinho valores "fora da faixa" (ex: hora 22 + 3 = 25 vira 01h do dia seguinte).
  let candidate = new Date(Date.UTC(referenceYear, month - 1, day, hour + 3, minute));
  if (candidate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    candidate = new Date(Date.UTC(referenceYear + 1, month - 1, day, hour + 3, minute));
  }
  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

function validateScheduleWindow(date) {
  const diff = date.getTime() - Date.now();
  if (diff < MIN_SCHEDULE_MS) {
    return { ok: false, message: 'Preciso de pelo menos 1 hora de antecedência pra agendar. Escolhe um horário mais à frente.' };
  }
  if (diff > MAX_SCHEDULE_MS) {
    return { ok: false, message: 'Só dá pra agendar com até 7 dias de antecedência. Escolhe uma data mais próxima.' };
  }
  return { ok: true };
}

function formatScheduledDateTime(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(date));
}

// Comparação EXATA (depois de tirar pontuação no final), não .includes()
// — "oi" e "olá" são curtos demais e apareceriam como substring dentro de
// palavras completamente sem relação (ex: "oi" dentro de "coisa"). Só
// conta como saudação se a mensagem inteira for basicamente isso.
const GREETING_PHRASES = ['oi', 'oii', 'oie', 'ola', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'eae', 'e ai', 'e aí', 'opa', 'salve', 'hey', 'hello'];

function detectGreetingIntent(normalized) {
  const stripped = normalized.replace(/[!?.,]+$/g, '').trim();
  return GREETING_PHRASES.includes(stripped);
}

// Horário de Santa Maria/RS (America/Sao_Paulo) — hourCycle: 'h23' evita
// o bug conhecido de hour12:false devolver "24" em vez de "00" à meia-noite.
// `date` opcional só pra dar pra testar horários fixos (mesmo padrão de
// pricingService.calculatePrice).
function getSantaMariaHour(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hourCycle: 'h23',
  });
  return parseInt(formatter.format(date), 10);
}

function buildTimeBasedGreeting(date = new Date()) {
  const hour = getSantaMariaHour(date);
  if (hour >= 5 && hour < 12) return 'Bom dia!';
  if (hour >= 12 && hour < 18) return 'Boa tarde!';
  return 'Boa noite!';
}

// User.name === User.whatsapp é o placeholder de quando o nome nunca foi
// perguntado de verdade (ver STEPS.ASKING_CONTACT_NAME) — não é um nome
// de verdade, então não deve ser usado pra personalizar nada.
function hasRealName(user) {
  return !!(user && user.name && user.name !== user.whatsapp);
}

async function handleIncomingMessage({ whatsapp, text }) {
  const normalized = (text || '').trim().toLowerCase();
  const state = await conversationState.getState(whatsapp);

  if (state) {
    return continueFlow(whatsapp, normalized, text, state);
  }

  // Sem conversa em andamento — decide qual dos três públicos está falando.
  const existingDriver = await Driver.findOne({ where: { whatsapp } });
  const existingUser = await User.findOne({ where: { whatsapp } });

  // Primeiro contato de verdade (nunca virou User nem Driver) OU cliente
  // antigo que só tem o placeholder de nome (de antes dessa funcionalidade
  // existir) — pergunta o nome antes de qualquer menu, guardando a
  // mensagem original pra retomar o que a pessoa queria depois de responder.
  // Motoboy já cadastrado nunca cai aqui — ele já deu o nome no cadastro.
  if (!existingDriver && (!existingUser || !hasRealName(existingUser))) {
    await conversationState.setState(whatsapp, { step: STEPS.ASKING_CONTACT_NAME, originalText: text });
    return evolutionService.sendText(whatsapp, 'Oi! Antes de começar, qual é o seu nome?');
  }

  if (!existingDriver && detectDriverRegistrationIntent(normalized)) {
    // Sistema de indicação: quem indicou esse WhatsApp já foi capturado uma
    // única vez, lá na criação do User (ver STEPS.ASKING_CONTACT_NAME), a
    // partir da primeira mensagem que essa pessoa mandou — não importa se
    // ela decidiu virar motoboy nessa mesma mensagem ou só depois, numa
    // conversa separada. Só repassa pro Driver que está sendo criado agora.
    const referrerDriverId = existingUser?.referred_by_driver_id || null;

    // Página explicando o MotoFácil pra quem nunca ouviu falar — mandada
    // antes de qualquer outra coisa, inclusive antes dos Termos. Só
    // informativo, não espera confirmação nem muda o estado da conversa.
    await evolutionService.sendText(
      whatsapp,
      `Antes de começar, dá uma olhada em como funciona o MotoFácil: ${LANDING_URL}`
    );

    // Termos de Uso/Política de Privacidade — exibidos aqui, bem no início
    // do cadastro, antes de qualquer outra pergunta. Aceitação passiva (não
    // exige "aceito" digitado), mas o momento exato e a versão vigente
    // ficam registrados no Driver ao final (ver finishDriverRegistration),
    // como comprovante de que a pessoa teve acesso ao documento.
    const termsShownAt = new Date().toISOString();
    await evolutionService.sendText(
      whatsapp,
      `Antes de continuar, dá uma olhada nos nossos Termos de Uso e Política de Privacidade: ${TERMS_URL} — ` +
      'ao seguir com o cadastro, você concorda com eles.'
    );

    // A esta altura, se chegou aqui sem ser motoboy, o gate acima já
    // garante que existingUser existe com nome de verdade — reaproveita
    // em vez de perguntar de novo.
    if (hasRealName(existingUser)) {
      await conversationState.setState(whatsapp, { name: existingUser.name, step: STEPS.DRIVER_REG_USERNAME, referrerDriverId, termsShownAt });
      return evolutionService.sendText(
        whatsapp,
        `Show, ${existingUser.name}! Agora escolha seu nome de usuário (@) — é assim que os clientes vão poder te chamar direto. ` +
        'Só letras, números e underscore, de 3 a 20 caracteres (ex: elrofs).'
      );
    }
    await conversationState.setState(whatsapp, { step: STEPS.DRIVER_REG_NAME, referrerDriverId, termsShownAt });
    return evolutionService.sendText(whatsapp, 'Show, vamos te cadastrar! Qual é o seu nome completo?');
  }

  // Motoboy já cadastrado tentando se cadastrar de novo — antes disso
  // caía direto no menu genérico do cliente sem explicação nenhuma,
  // parecendo que o cadastro simplesmente não funcionava.
  if (existingDriver && detectDriverRegistrationIntent(normalized)) {
    const handle = existingDriver.username ? `@${existingDriver.username}` : existingDriver.name;
    return evolutionService.sendText(whatsapp, `Você já é motoboy cadastrado (${handle}). Pra ficar disponível, digite "disponível".`);
  }

  if (existingDriver && detectRechargeIntent(normalized)) {
    await conversationState.setState(whatsapp, { step: STEPS.DRIVER_RECHARGE_AMOUNT, driverId: existingDriver.id });
    return evolutionService.sendText(whatsapp, `Seu saldo atual é R$ ${existingDriver.wallet_balance}. Quanto você quer recarregar? (só o número, ex: 50)`);
  }

  if (existingDriver && detectStatementIntent(normalized)) {
    return sendDriverStatement(existingDriver);
  }

  if (existingDriver && detectBalanceIntent(normalized)) {
    return evolutionService.sendText(whatsapp, `💰 Seu saldo atual é R$ ${parseFloat(existingDriver.wallet_balance).toFixed(2)}.`);
  }

  if (existingDriver && detectUsernameQueryIntent(normalized)) {
    return evolutionService.sendText(
      whatsapp,
      existingDriver.username
        ? `Seu nome de usuário é @${existingDriver.username}`
        : 'Você ainda não tem um nome de usuário cadastrado.'
    );
  }

  if (existingDriver && detectReferralLinkIntent(normalized)) {
    return sendReferralLink(whatsapp, existingDriver);
  }

  if (existingDriver && detectSendAlvaraIntent(normalized)) {
    await conversationState.setState(whatsapp, { step: STEPS.DRIVER_REG_ALVARA, driverId: existingDriver.id, isStandalone: true });
    return evolutionService.sendText(whatsapp, 'Manda o alvará da prefeitura em foto ou PDF, por favor.');
  }

  if (existingDriver) {
    const availability = detectAvailabilityIntent(normalized);
    if (availability === 'available') {
      if (existingDriver.status === 'blocked') {
        return evolutionService.sendText(whatsapp, 'Seu cadastro está bloqueado. Fale com o administrador.');
      }
      if (!existingDriver.documents_approved) {
        return evolutionService.sendText(whatsapp, 'Seu cadastro ainda está aguardando aprovação — assim que for aprovado, você já pode ficar disponível.');
      }
      if (!existingDriver.last_lat || !existingDriver.last_lng) {
        await conversationState.setState(whatsapp, { step: STEPS.DRIVER_AWAITING_LOCATION_FOR_AVAILABILITY });
        return evolutionService.sendText(
          whatsapp,
          '📍 Antes de ficar disponível, preciso saber onde você está. Manda sua localização pelo clipe/anexo → ' +
          'Localização — de preferência "localização em tempo real", que me mantém sabendo onde você está mesmo ' +
          'enquanto você anda. Assim que eu receber, já te deixo disponível.'
        );
      }
      await existingDriver.update({ status: 'available' });
      return evolutionService.sendText(
        whatsapp,
        buildAvailabilityConfirmationMessage(existingDriver, '✅ Você está disponível! Vou te avisar assim que tiver uma corrida por perto.')
      );
    }
    if (availability === 'offline') {
      if (existingDriver.status === 'busy') {
        return evolutionService.sendText(whatsapp, 'Você está em corrida agora — assim que finalizar, digite "indisponível" de novo.');
      }
      await existingDriver.update({ status: 'offline' });
      return evolutionService.sendText(whatsapp, 'Tudo bem, você ficou indisponível. É só mandar "disponível" quando quiser voltar.');
    }

    if (detectCompleteRideIntent(normalized)) {
      return handleDriverCompletesRide(whatsapp, existingDriver);
    }
  }

  if (existingUser && detectCancelRideIntent(normalized)) {
    return handleClientCancelRide(whatsapp, existingUser);
  }

  if (existingUser && detectGenderCorrectionIntent(normalized)) {
    await existingUser.update({ gender: 'feminino' });
    return evolutionService.sendText(whatsapp, 'Prontinho! Já anotei — a partir da próxima corrida você pode pedir só motogirl.');
  }

  const rideType = detectRideIntent(normalized);
  if (rideType) {
    await conversationState.setState(whatsapp, { step: STEPS.ASKING_SCHEDULE_CHOICE, type: rideType });
    return evolutionService.sendText(whatsapp, 'Quer agora ou agendar pra depois?\n1 - Agora\n2 - Agendar');
  }

  // Saudação simples ("oi", "bom dia"...) ganha um cumprimento de verdade
  // baseado no horário, com o nome quando já sabemos (ex: "Boa noite,
  // João!") — o resto do menu é idêntico pra qualquer entrada não
  // reconhecida, só a abertura muda.
  const greetingWord = (detectGreetingIntent(normalized) ? buildTimeBasedGreeting() : 'Oi!').replace(/!$/, '');
  const namePart = hasRealName(existingUser) ? `, ${existingUser.name}` : '';

  return evolutionService.sendText(
    whatsapp,
    `${greetingWord}${namePart}! Digite o número ou a frase:\n` +
    '1 - "Preciso de uma moto" para pedir uma entrega\n' +
    '2 - "Preciso de uma corrida" para pedir um mototáxi\n' +
    '3 - "Quero ser motoboy" para se cadastrar como entregador/motoboy'
  );
}

// Depois de saber se a cliente quer um motoboy específico: entrega vai
// direto pro endereço; passageiro ainda passa pela pergunta de gênero
// (só uma vez na vida dela) antes do endereço. scheduledFor (ISO string ou
// null) só atravessa esses degraus — quem usa de verdade é startRideCreation.
async function afterPreferredDriverChoice(whatsapp, type, preferredDriverId, scheduledFor) {
  if (type === 'delivery') {
    return startOriginStep(whatsapp, type, null, preferredDriverId, scheduledFor);
  }

  const [user] = await User.findOrCreate({
    where: { whatsapp },
    defaults: { name: whatsapp, whatsapp },
  });
  if (!user.gender) {
    await conversationState.setState(whatsapp, { step: STEPS.ASKING_CLIENT_GENDER, type, preferredDriverId, scheduledFor });
    return evolutionService.sendText(
      whatsapp,
      'Antes de continuar — perguntamos isso só uma vez, pra próxima corrida já ser direto. Você é...\n1 - Feminino\n2 - Masculino\n0 - Prefiro não informar'
    );
  }
  return afterClientGenderKnown(whatsapp, type, user.gender, preferredDriverId, scheduledFor);
}

// Depois de saber o gênero da cliente (recém-respondido ou já salvo de
// corrida anterior): mulher tem a opção de pedir só motogirl (perguntada
// EM TODA corrida, nunca salva — é diferente do gênero dela, que é fixo).
// Homem segue direto pro endereço, sem pergunta nenhuma a mais (não existe
// o inverso — ver rideService.findNearbyAvailableDrivers). Se ela já
// escolheu um motoboy específico pelo @, essa pergunta nem faz sentido —
// a escolha explícita sobrepõe a preferência de só motogirl.
async function afterClientGenderKnown(whatsapp, type, gender, preferredDriverId, scheduledFor) {
  if (gender === 'feminino' && !preferredDriverId) {
    await conversationState.setState(whatsapp, { step: STEPS.ASKING_DRIVER_GENDER_PREFERENCE, type, preferredDriverId, scheduledFor });
    return evolutionService.sendText(
      whatsapp,
      'Quer ser atendida só por motogirl nessa corrida?\n1 - Sim, só motogirl\n2 - Não, qualquer motoboy'
    );
  }
  return startOriginStep(whatsapp, type, null, preferredDriverId, scheduledFor);
}

async function startOriginStep(whatsapp, type, driverGenderPreference, preferredDriverId, scheduledFor) {
  await conversationState.setState(whatsapp, { step: STEPS.ASKING_ORIGIN, type, driverGenderPreference, preferredDriverId, scheduledFor });
  return evolutionService.sendText(
    whatsapp,
    'Show! Vamos organizar sua corrida. Qual é o endereço de partida (coleta)? ' +
    '(pode digitar ou mandar sua localização pelo clipe/anexo → Localização)'
  );
}

// Passos das perguntas separadas de correção (rua/número/complemento) —
// localização chegando em qualquer um deles pula direto pro fim, sem
// precisar terminar as perguntas restantes.
const FIXING_ADDRESS_STEPS = new Set([
  STEPS.FIXING_ADDRESS_STREET,
  STEPS.FIXING_ADDRESS_NUMBER,
  STEPS.FIXING_ADDRESS_COMPLEMENT,
]);

// Passos em que uma localização compartilhada (em vez de texto) faz
// sentido — fora deles, a localização não serve pra nada nesse momento.
const ADDRESS_COLLECTION_STEPS = new Set([
  STEPS.ASKING_ORIGIN,
  STEPS.ASKING_DESTINATION,
  STEPS.ASKING_STOP_ADDRESS,
  ...FIXING_ADDRESS_STEPS,
]);

// Cliente manda localização (pino ou "tempo real") em vez de digitar o
// endereço — vira um link do Maps que geoService reconhece direto (ver
// SHARED_LOCATION_PATTERN), sem geocodificar nada.
async function handleClientLocation({ whatsapp, location }) {
  const state = await conversationState.getState(whatsapp);
  if (!ADDRESS_COLLECTION_STEPS.has(state?.step)) {
    return evolutionService.sendText(whatsapp, 'Recebi sua localização, mas não é isso que eu preciso agora.');
  }
  const addressText = `https://maps.google.com/?q=${location.lat},${location.lng}`;

  // Nas perguntas separadas (rua/número/complemento), localização substitui
  // TUDO de uma vez — não faz sentido continuar pedindo número depois de já
  // ter a coordenada exata.
  if (FIXING_ADDRESS_STEPS.has(state.step)) {
    return applyFixedAddress(whatsapp, state, addressText);
  }
  // Fora da correção (pedido normal de origem/destino/parada), esses casos
  // só usam `text` puro — reaproveita o mesmo switch de continueFlow
  // passando o link como se fosse o texto digitado, sem duplicar lógica.
  return continueFlow(whatsapp, '', addressText, state);
}

async function continueFlow(whatsapp, normalized, text, state) {
  switch (state.step) {
    // Nome de contato — pega o que a pessoa mandar (sem validar formato,
    // mesmo padrão de outros campos de texto livre no sistema) e retoma
    // a mensagem original guardada antes de perguntar (pode ser "oi", um
    // pedido de corrida, "quero ser motoboy" etc.).
    case STEPS.ASKING_CONTACT_NAME: {
      const name = text.trim();
      if (!name) {
        return evolutionService.sendText(whatsapp, 'Não entendi. Qual é o seu nome?');
      }
      // Sistema de indicação: captura o indicador aqui, uma única vez, a
      // partir da mensagem ORIGINAL que trouxe essa pessoa (ex: link wa.me
      // pré-preenchido com "...indicado por @julio") — sem diferenciação
      // nenhuma entre virar motoboy ou continuar como cliente/estabelecimento
      // depois disso. Só se aplica na criação (findOrCreate não sobrescreve
      // quem já existe).
      const referrer = await referralService.findReferrerFromText(state.originalText);
      const [user] = await User.findOrCreate({
        where: { whatsapp },
        defaults: { name, whatsapp, referred_by_driver_id: referrer ? referrer.id : null },
      });
      if (user.name !== name) {
        await user.update({ name });
      }
      await conversationState.clearState(whatsapp);
      return handleIncomingMessage({ whatsapp, text: state.originalText });
    }

    // Agora ou agendar — perguntado logo depois de escolher entrega/corrida.
    case STEPS.ASKING_SCHEDULE_CHOICE: {
      if (normalized === '1') {
        await conversationState.setState(whatsapp, { step: STEPS.ASKING_PREFERRED_DRIVER, type: state.type });
        return evolutionService.sendText(
          whatsapp,
          'Tem um motoboy de preferência? Digite o @ dele (ex: @elrofs), ou "0" para buscarmos o mais próximo automaticamente.'
        );
      }
      if (normalized === '2') {
        await conversationState.setState(whatsapp, { ...state, step: STEPS.ASKING_SCHEDULE_DATETIME });
        return evolutionService.sendText(
          whatsapp,
          'Pra quando você quer agendar? Manda a data e hora assim: DD/MM HH:MM (ex: 25/12 14:30).\n' +
          'Precisa ser com pelo menos 1 hora de antecedência, e no máximo 7 dias.'
        );
      }
      return evolutionService.sendText(whatsapp, 'Não entendi. Responda 1 para agora, ou 2 para agendar.');
    }

    case STEPS.ASKING_SCHEDULE_DATETIME: {
      const parsedDate = parseScheduleDateTime(text);
      if (!parsedDate) {
        return evolutionService.sendText(whatsapp, 'Não entendi a data/hora. Manda assim: DD/MM HH:MM (ex: 25/12 14:30).');
      }
      const validation = validateScheduleWindow(parsedDate);
      if (!validation.ok) {
        return evolutionService.sendText(whatsapp, validation.message);
      }
      await conversationState.setState(whatsapp, { ...state, scheduledFor: parsedDate.toISOString(), step: STEPS.ASKING_PREFERRED_DRIVER });
      return evolutionService.sendText(
        whatsapp,
        `Agendado pra ${formatScheduledDateTime(parsedDate)}. Tem um motoboy de preferência? Digite o @ dele (ex: @elrofs), ou "0" para buscarmos o mais próximo automaticamente.`
      );
    }

    // Motoboy de preferência — "0" busca automática, ou @ de um motoboy
    // específico. Não valida elegibilidade aqui (offline, sem saldo, fora
    // da área) — isso só é checado na hora de despachar (startRideCreation
    // ou, pra corrida agendada, rideService.sweepScheduledRides), porque a
    // situação do motoboy pode mudar entre agora e lá.
    case STEPS.ASKING_PREFERRED_DRIVER: {
      if (normalized === '0') {
        return afterPreferredDriverChoice(whatsapp, state.type, null, state.scheduledFor);
      }
      const username = normalizeUsername(text);
      if (!USERNAME_REGEX.test(username)) {
        return evolutionService.sendText(whatsapp, 'Não entendi. Digite o @ do motoboy (ex: @elrofs), ou "0" para busca automática.');
      }
      const driver = await rideService.findDriverByUsername(username);
      if (!driver) {
        return evolutionService.sendText(whatsapp, `Não encontrei nenhum motoboy com @${username}. Confere o nome de usuário, ou digite "0" para busca automática.`);
      }
      return afterPreferredDriverChoice(whatsapp, state.type, driver.id, state.scheduledFor);
    }

    // ---------------- Gênero (só corrida de passageiro) ----------------
    case STEPS.ASKING_CLIENT_GENDER: {
      const gender = CLIENT_GENDER_OPTIONS[normalized];
      if (!gender) {
        return evolutionService.sendText(whatsapp, 'Não entendi. Responda 1 para feminino, 2 para masculino ou 0 para não informar.');
      }
      await User.update({ gender }, { where: { whatsapp } });
      return afterClientGenderKnown(whatsapp, state.type, gender, state.preferredDriverId, state.scheduledFor);
    }

    case STEPS.ASKING_DRIVER_GENDER_PREFERENCE: {
      if (normalized === '1') {
        return startOriginStep(whatsapp, state.type, 'motogirl', state.preferredDriverId, state.scheduledFor);
      }
      if (normalized === '2') {
        return startOriginStep(whatsapp, state.type, null, state.preferredDriverId, state.scheduledFor);
      }
      return evolutionService.sendText(whatsapp, 'Não entendi. Responda 1 para só motogirl, ou 2 para qualquer motoboy.');
    }

    // Cliente avisada que não tem motogirl disponível — não cancela
    // direto, oferece aceitar motoboy (sem sistema de fila/espera hoje).
    case STEPS.ASKING_ACCEPT_ANY_DRIVER: {
      if (normalized === '1') {
        await conversationState.clearState(whatsapp);
        const ride = await rideService.removeDriverGenderPreference(state.rideId);
        const result = await rideService.dispatchRideToDrivers(ride);
        if (result.notified === 0) {
          return evolutionService.sendText(
            whatsapp,
            'Ainda não encontrei nenhum motoboy disponível perto de você agora. Vou continuar de olho — ' +
            'se aparecer alguém, te aviso por aqui.'
          );
        }
        return evolutionService.sendText(whatsapp, 'Beleza! Buscando qualquer motoboy disponível...');
      }
      if (normalized === '2') {
        await conversationState.clearState(whatsapp);
        await rideService.cancelRide(state.rideId, 'Cliente preferiu esperar por motogirl — nenhuma disponível no momento.');
        return evolutionService.sendText(whatsapp, 'Tudo bem, corrida cancelada por enquanto. Quando quiser tentar de novo, é só chamar.');
      }
      return evolutionService.sendText(whatsapp, 'Não entendi. Responda 1 para aceitar motoboy, ou 2 para cancelar por enquanto.');
    }

    // ---------------- Cliente: pedido de corrida/entrega ----------------
    case STEPS.ASKING_ORIGIN:
      await conversationState.setState(whatsapp, { ...state, origin: text, step: STEPS.ASKING_DESTINATION });
      return evolutionService.sendText(whatsapp, 'Perfeito. E qual é o endereço de destino?');

    // O endereço aqui não é necessariamente o destino final — se o
    // cliente adicionar paradas depois, o último endereço da lista que
    // vira o destino de verdade (ver finalizeStopsAndQuote). Por isso só
    // guardamos no array `stops` e perguntamos se quer adicionar mais.
    case STEPS.ASKING_DESTINATION:
      await conversationState.setState(whatsapp, { ...state, stops: [text], step: STEPS.ASKING_MORE_STOPS });
      return evolutionService.sendText(whatsapp, 'Quer adicionar outra parada?\n1 - Sim\n2 - Não, seguir assim');

    case STEPS.ASKING_MORE_STOPS: {
      if (normalized === '1' || normalized === 'sim') {
        await conversationState.setState(whatsapp, { ...state, step: STEPS.ASKING_STOP_ADDRESS });
        return evolutionService.sendText(whatsapp, 'Qual o endereço dessa parada?');
      }
      if (normalized === '2' || normalized === 'não' || normalized === 'nao') {
        return finalizeStopsAndQuote(whatsapp, state);
      }
      return evolutionService.sendText(whatsapp, 'Não entendi. Responda 1 para adicionar outra parada, ou 2 para seguir assim.');
    }

    case STEPS.ASKING_STOP_ADDRESS:
      await conversationState.setState(whatsapp, { ...state, stops: [...state.stops, text], step: STEPS.ASKING_MORE_STOPS });
      return evolutionService.sendText(whatsapp, 'Quer adicionar outra parada?\n1 - Sim\n2 - Não, seguir assim');

    // Endereço que falhou vira 3 perguntas (rua, número, complemento) em
    // vez de um texto livre só — o motivo mais comum de falha era
    // formatação (ex: sem vírgula antes do número), juntar os pedaços
    // certos evita repetir o mesmo erro.
    case STEPS.FIXING_ADDRESS_STREET:
      await conversationState.setState(whatsapp, { ...state, fixingStreet: text, step: STEPS.FIXING_ADDRESS_NUMBER });
      return evolutionService.sendText(whatsapp, 'Qual é o número?');

    case STEPS.FIXING_ADDRESS_NUMBER:
      await conversationState.setState(whatsapp, { ...state, fixingNumber: text, step: STEPS.FIXING_ADDRESS_COMPLEMENT });
      return evolutionService.sendText(whatsapp, 'Bairro, complemento ou ponto de referência? Se não tiver, responda "não".');

    case STEPS.FIXING_ADDRESS_COMPLEMENT: {
      const hasComplement = !['não', 'nao', 'n', '-'].includes(normalized);
      const composedAddress = [state.fixingStreet, state.fixingNumber, hasComplement ? text : null].filter(Boolean).join(', ');
      return applyFixedAddress(whatsapp, state, composedAddress);
    }

    case STEPS.ASKING_PRICE_CONFIRMATION: {
      if (normalized === '1' || normalized === 'sim' || normalized === 'confirmar') {
        await conversationState.setState(whatsapp, { ...state, step: STEPS.ASKING_PAYMENT_METHOD });
        return evolutionService.sendText(whatsapp, PAYMENT_MENU_TEXT);
      }
      if (normalized === '2' || normalized === 'não' || normalized === 'nao') {
        await conversationState.setState(whatsapp, { type: state.type, driverGenderPreference: state.driverGenderPreference, preferredDriverId: state.preferredDriverId, scheduledFor: state.scheduledFor, step: STEPS.PRICE_REJECTED_CHOICE });
        return evolutionService.sendText(
          whatsapp,
          'Sem problema. O que você quer fazer?\n1 - Tentar com outro endereço\n2 - Cancelar o pedido'
        );
      }
      return evolutionService.sendText(whatsapp, 'Não entendi. Responda 1 para confirmar o preço, ou 2 se quiser mudar o endereço.');
    }

    case STEPS.PRICE_REJECTED_CHOICE: {
      if (normalized === '1') {
        await conversationState.setState(whatsapp, { type: state.type, driverGenderPreference: state.driverGenderPreference, preferredDriverId: state.preferredDriverId, scheduledFor: state.scheduledFor, step: STEPS.ASKING_ORIGIN });
        return evolutionService.sendText(whatsapp, 'Beleza, vamos de novo. Qual é o endereço de partida (coleta)?');
      }
      if (normalized === '2') {
        await conversationState.clearState(whatsapp);
        return evolutionService.sendText(whatsapp, 'Pedido cancelado. Quando quiser, é só chamar de novo.');
      }
      return evolutionService.sendText(whatsapp, 'Não entendi. Responda 1 para tentar outro endereço, ou 2 para cancelar o pedido.');
    }

    case STEPS.ASKING_PAYMENT_METHOD: {
      const paymentMethod = PAYMENT_OPTIONS[normalized];
      if (!paymentMethod) {
        return evolutionService.sendText(whatsapp, CASH_ONLY_MODE ? 'Responda 1 para confirmar pagamento em dinheiro.' : 'Não entendi. Responda com um número de 1 a 4.');
      }
      return startRideCreation(whatsapp, { ...state, paymentMethod });
    }

    // ---------------- Cadastro de motoboy ----------------
    case STEPS.DRIVER_REG_NAME:
      await conversationState.setState(whatsapp, { ...state, name: text, step: STEPS.DRIVER_REG_USERNAME });
      return evolutionService.sendText(
        whatsapp,
        'Agora escolha seu nome de usuário (@) — é assim que os clientes vão poder te chamar direto. ' +
        'Só letras, números e underscore, de 3 a 20 caracteres (ex: elrofs).'
      );

    case STEPS.DRIVER_REG_USERNAME: {
      const username = normalizeUsername(text);
      if (!USERNAME_REGEX.test(username)) {
        return evolutionService.sendText(whatsapp, 'Nome de usuário inválido. Use só letras, números e underscore, de 3 a 20 caracteres, sem espaço.');
      }
      const existing = await Driver.findOne({ where: { username } });
      if (existing) {
        return evolutionService.sendText(whatsapp, `@${username} já está em uso. Tenta outro nome de usuário.`);
      }
      await conversationState.setState(whatsapp, { ...state, username, step: STEPS.DRIVER_REG_GENDER });
      return evolutionService.sendText(whatsapp, 'Você é motoboy ou motogirl?\n1 - Motoboy\n2 - Motogirl');
    }

    case STEPS.DRIVER_REG_GENDER: {
      const gender = DRIVER_GENDER_OPTIONS[normalized];
      if (!gender) {
        return evolutionService.sendText(whatsapp, 'Não entendi. Responda 1 para motoboy ou 2 para motogirl.');
      }
      await conversationState.setState(whatsapp, { ...state, gender, step: STEPS.DRIVER_REG_SERVICES });
      return evolutionService.sendText(
        whatsapp,
        'Qual serviço você quer atender?\n1 - Só entregas\n2 - Só passageiro (mototáxi)\n3 - Entregas e passageiro'
      );
    }

    case STEPS.DRIVER_REG_SERVICES: {
      const services = SERVICE_OPTIONS[normalized];
      if (!services) {
        return evolutionService.sendText(whatsapp, 'Não entendi. Responda com 1, 2 ou 3.');
      }
      await conversationState.setState(whatsapp, { ...state, services, step: STEPS.DRIVER_REG_PLATE });
      return evolutionService.sendText(whatsapp, 'Qual a placa da sua moto?');
    }

    case STEPS.DRIVER_REG_PLATE:
      await conversationState.setState(whatsapp, { ...state, plate: text, step: STEPS.DRIVER_REG_MODEL });
      return evolutionService.sendText(whatsapp, 'E o modelo da moto (ex: Honda CG 160)?');

    case STEPS.DRIVER_REG_MODEL:
      await conversationState.setState(whatsapp, { ...state, model: text, step: STEPS.DRIVER_REG_CNH_NUMBER });
      return evolutionService.sendText(whatsapp, 'Qual é o número da sua CNH? (11 dígitos, só números)');

    case STEPS.DRIVER_REG_CNH_NUMBER: {
      const cnhNumero = normalized.replace(/\D/g, '');
      if (!/^\d{11}$/.test(cnhNumero)) {
        return evolutionService.sendText(whatsapp, 'CNH inválida — preciso dos 11 números da sua CNH, sem espaço ou traço.');
      }
      await conversationState.setState(whatsapp, { ...state, cnhNumero, step: STEPS.DRIVER_REG_CNH_PHOTO });
      return evolutionService.sendText(whatsapp, 'Agora manda uma foto da sua CNH (frente).');
    }

    case STEPS.DRIVER_REG_CNH_PHOTO:
      return evolutionService.sendText(whatsapp, 'Preciso de uma FOTO da sua CNH pra continuar — manda a imagem, não texto.');

    case STEPS.DRIVER_REG_CRLV_PHOTO:
      return evolutionService.sendText(whatsapp, 'Preciso de uma FOTO do CRLV (documento do veículo) pra continuar — manda a imagem, não texto.');

    case STEPS.DRIVER_REG_SELFIE_PHOTO:
      return evolutionService.sendText(whatsapp, 'Preciso de uma SELFIE sua pra continuar — manda a foto do seu rosto, não texto.');

    case STEPS.DRIVER_REG_PIX_KEY: {
      const pixKey = text.trim();
      if (!pixKey) {
        return evolutionService.sendText(whatsapp, 'Preciso de uma chave Pix válida pra continuar o cadastro. Qual é a sua?');
      }
      const nextState = { ...state, pixKey };
      if (nextState.services.atende_passageiro) {
        await conversationState.setState(whatsapp, { ...nextState, step: STEPS.DRIVER_REG_ALVARA });
        return evolutionService.sendText(
          whatsapp,
          'Como você vai atender passageiro (mototáxi), preciso do seu alvará da prefeitura. ' +
          'Manda a foto ou PDF agora — ou digite "pular" para enviar depois (você só recebe corrida de ' +
          'passageiro depois que o alvará for aprovado).'
        );
      }
      return finishDriverRegistration(whatsapp, nextState);
    }

    case STEPS.DRIVER_REG_ALVARA:
      if (normalized === 'pular') {
        if (state.isStandalone) {
          await conversationState.clearState(whatsapp);
          return evolutionService.sendText(whatsapp, 'Sem problema, é só digitar "enviar alvará" quando quiser mandar.');
        }
        return finishDriverRegistration(whatsapp, state);
      }
      return evolutionService.sendText(whatsapp, 'Manda a foto/PDF do alvará, ou digite "pular" para enviar depois.');

    // ---------------- Recarga de carteira ----------------
    case STEPS.DRIVER_RECHARGE_AMOUNT: {
      const amount = parseFloat(normalized.replace(',', '.'));
      if (!amount || amount <= 0) {
        return evolutionService.sendText(whatsapp, 'Manda só o valor em número, ex: 50');
      }
      await conversationState.clearState(whatsapp);
      try {
        const recharge = await paymentService.createDriverWalletRecharge(state.driverId, amount);

        await evolutionService.sendText(
          whatsapp,
          `Pix de R$ ${amount.toFixed(2)} gerado! Escaneie o QR Code abaixo ou copie o código da próxima ` +
          `mensagem. Assim que o pagamento cair, seu saldo é atualizado na hora.`
        );

        if (recharge.pix_qr_code_base64) {
          await evolutionService.sendImage(whatsapp, recharge.pix_qr_code_base64, 'QR Code Pix');
        }

        // Sozinho, sem nenhum texto antes/depois — fica fácil selecionar
        // e copiar o código inteiro de uma vez, sem risco de cortar.
        if (recharge.pix_copy_paste) {
          await evolutionService.sendText(whatsapp, recharge.pix_copy_paste);
        }
      } catch (err) {
        logger.error('Falha ao gerar Pix de recarga', err.message);
        await evolutionService.sendText(whatsapp, 'Não consegui gerar o Pix agora. Tenta de novo em instantes.');
      }
      return;
    }

    // ---------------- Motoboy: aguardando localização pra ficar disponível ----------------
    case STEPS.DRIVER_AWAITING_LOCATION_FOR_AVAILABILITY:
      return evolutionService.sendText(
        whatsapp,
        '📍 Ainda preciso da sua localização pra te deixar disponível — manda pelo clipe/anexo → Localização.'
      );

    // ---------------- Motoboy: respondendo oferta de corrida (1/2 em texto) ----------------
    case STEPS.DRIVER_RIDE_OFFER_RESPONSE:
      if (normalized === '1') {
        await conversationState.clearState(whatsapp);
        return acceptRideOffer(whatsapp, state.rideId, state.driverId);
      }
      if (normalized === '2') {
        await conversationState.clearState(whatsapp);
        return rejectRideOffer(whatsapp, state.rideId, state.driverId);
      }
      return evolutionService.sendText(whatsapp, 'Não entendi. Responda 1 para aceitar ou 2 para recusar a corrida.');

    default:
      await conversationState.clearState(whatsapp);
      return evolutionService.sendText(whatsapp, 'Vamos recomeçar. Digite "Preciso de uma moto" para pedir uma corrida.');
  }
}

// Chamado pelo webhook quando um motoboy manda localização (estática ou em
// tempo real — ver evolutionService.parseIncomingMessage). Sempre salva a
// posição; se ele estava esperando isso pra ficar disponível (ver STEPS.
// DRIVER_AWAITING_LOCATION_FOR_AVAILABILITY, acima), completa o processo
// aqui e só então avisa que está disponível de verdade.
async function handleDriverLocation({ whatsapp, location }, driver) {
  await driver.update({ last_lat: location.lat, last_lng: location.lng, last_location_at: new Date() });

  const state = await conversationState.getState(whatsapp);
  if (state?.step === STEPS.DRIVER_AWAITING_LOCATION_FOR_AVAILABILITY) {
    await conversationState.clearState(whatsapp);
    await driver.update({ status: 'available' });
    return evolutionService.sendText(
      whatsapp,
      buildAvailabilityConfirmationMessage(driver, '✅ Localização recebida! Você está disponível — vou te avisar assim que tiver uma corrida por perto.')
    );
  }
}

// Chamado pelo webhook quando chega uma FOTO/PDF (sem texto). `document` já
// vem com o conteúdo real decodificado ({ base64, mimetype }) — ver
// evolutionService.fetchMediaBase64. Cobre os documentos de verificação do
// cadastro (CNH, CRLV, selfie) e o envio do alvará (durante ou depois do
// cadastro).
async function handleIncomingDocument({ whatsapp, document }) {
  const state = await conversationState.getState(whatsapp);

  if (state?.step === STEPS.DRIVER_REG_CNH_PHOTO) {
    await conversationState.setState(whatsapp, { ...state, cnhFoto: document, step: STEPS.DRIVER_REG_CRLV_PHOTO });
    return evolutionService.sendText(whatsapp, 'Recebi! Agora manda uma foto do CRLV (documento do veículo).');
  }

  if (state?.step === STEPS.DRIVER_REG_CRLV_PHOTO) {
    await conversationState.setState(whatsapp, { ...state, crlvFoto: document, step: STEPS.DRIVER_REG_SELFIE_PHOTO });
    return evolutionService.sendText(whatsapp, 'Recebi! Por último, manda uma selfie sua (foto do seu rosto, bem visível).');
  }

  if (state?.step === STEPS.DRIVER_REG_SELFIE_PHOTO) {
    await conversationState.setState(whatsapp, { ...state, selfieFoto: document, step: STEPS.DRIVER_REG_PIX_KEY });
    return evolutionService.sendText(
      whatsapp,
      'Recebi! Qual é a sua chave Pix para receber dos clientes? Pode ser CPF, celular, e-mail ou chave aleatória ' +
      '— é obrigatória pra completar o cadastro, é assim que você recebe o dinheiro das corridas.'
    );
  }

  if (state?.step !== STEPS.DRIVER_REG_ALVARA) {
    const driver = await Driver.findOne({ where: { whatsapp } });
    if (driver) {
      const recharge = await paymentService.confirmWalletRechargeFromReceipt(driver.id);
      if (recharge) return; // confirmWalletRechargeFromReceipt já avisa o motoboy e o admin
    }
    return evolutionService.sendText(
      whatsapp,
      'Recebi um arquivo, mas não sei o que fazer com ele agora. Se é o alvará, digite "enviar alvará" primeiro.'
    );
  }

  if (state.isStandalone) {
    await Driver.update({ alvara_document: document }, { where: { id: state.driverId } });
    await conversationState.clearState(whatsapp);
    await notifyAdminNewAlvara(whatsapp);
    return evolutionService.sendText(
      whatsapp,
      'Alvará recebido! Está aguardando aprovação do administrador — assim que for aprovado, você já pode receber corridas de passageiro.'
    );
  }

  return finishDriverRegistration(whatsapp, { ...state, alvaraDocumentRef: document });
}

async function finishDriverRegistration(whatsapp, state) {
  await conversationState.clearState(whatsapp);

  let driver;
  try {
    driver = await Driver.create({
      name: state.name,
      whatsapp,
      username: state.username,
      atende_entregas: state.services.atende_entregas,
      atende_passageiro: state.services.atende_passageiro,
      gender: state.gender,
      pix_key: state.pixKey,
      cnh_numero: state.cnhNumero,
      cnh_foto: state.cnhFoto,
      crlv_foto: state.crlvFoto,
      selfie_foto: state.selfieFoto,
      alvara_document: state.alvaraDocumentRef || null,
      referred_by_driver_id: state.referrerDriverId || null,
      terms_shown_at: state.termsShownAt || null,
      terms_version: state.termsShownAt ? TERMS_VERSION : null,
      // status e autorizadoPrefeitura ficam no padrão (pending_approval /
      // false) — SEMPRE exigem aprovação manual do admin no painel,
      // mesmo com o alvará já enviado.
    });
  } catch (err) {
    // Corrida rara: duas pessoas escolhendo o mesmo @ ao mesmo tempo — a
    // checagem em DRIVER_REG_USERNAME não pega isso porque acontece bem
    // antes desse Driver.create, várias perguntas depois. A constraint
    // unique do banco pega na hora; pede só o @ de novo, sem perder o
    // resto do cadastro já preenchido.
    const isUsernameConflict = err.name === 'SequelizeUniqueConstraintError'
      && (err.fields?.username || err.errors?.some((e) => e.path === 'username'));
    if (isUsernameConflict) {
      await conversationState.setState(whatsapp, { ...state, step: STEPS.DRIVER_REG_USERNAME });
      return evolutionService.sendText(whatsapp, `Esse nome de usuário (@${state.username}) acabou de ser escolhido por outra pessoa. Tenta outro.`);
    }
    throw err;
  }

  await Vehicle.create({ driver_id: driver.id, plate: state.plate, model: state.model });

  if (state.alvaraDocumentRef) await notifyAdminNewAlvara(whatsapp);

  const alvaraNote = state.services.atende_passageiro
    ? state.alvaraDocumentRef
      ? '\n\nSeu alvará foi recebido e também está aguardando aprovação para corridas de passageiro.'
      : '\n\nVocê optou por atender passageiro mas ainda não mandou o alvará — digite "enviar alvará" quando quiser mandar.'
    : '';

  return evolutionService.sendText(
    whatsapp,
    `Cadastro recebido, ${state.name}! Está aguardando aprovação do administrador no painel — ` +
    `assim que for aprovado, você já pode ficar disponível para corridas.${alvaraNote}`
  );
}

// "saldo" e "extrato" pelo WhatsApp — sem isso o motoboy não tinha
// nenhuma forma de saber quanto ainda tem disponível sem entrar no meio
// do fluxo de recarga.
async function sendDriverStatement(driver) {
  const transactions = await WalletTransaction.findAll({
    where: { driver_id: driver.id },
    order: [['created_at', 'DESC']],
    limit: 10,
  });

  if (transactions.length === 0) {
    return evolutionService.sendText(driver.whatsapp, 'Você ainda não tem nenhuma movimentação na carteira.');
  }

  const lines = transactions.map((tx) => {
    const date = new Date(tx.created_at).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const sign = tx.type === 'credit' ? '+' : '-';
    return `${date} — ${tx.reason}: ${sign}R$ ${parseFloat(tx.amount).toFixed(2)} (saldo: R$ ${parseFloat(tx.balance_after).toFixed(2)})`;
  });

  return evolutionService.sendText(
    driver.whatsapp,
    `📒 Suas últimas ${transactions.length} movimentações:\n\n${lines.join('\n')}\n\n` +
    `Saldo atual: R$ ${parseFloat(driver.wallet_balance).toFixed(2)}`
  );
}

// Sistema de indicação — link wa.me pro próprio número do bot, pré-preenchido
// com uma mensagem NEUTRA que só contém o @ do indicador (de propósito: não
// pode conter "quero ser motoboy" nem nada que pareça pedido de corrida,
// senão a pessoa seria empurrada pro fluxo errado antes de decidir o que
// quer). A indicação é capturada na criação do User a partir dessa mensagem
// (ver STEPS.ASKING_CONTACT_NAME) — o mesmo link funciona tanto pra quem
// depois vira motoboy quanto pra quem só pede corrida/entrega como cliente,
// sem diferenciação nenhuma.
async function sendReferralLink(whatsapp, driver) {
  if (!driver.username) {
    return evolutionService.sendText(
      whatsapp,
      'Você ainda não tem um nome de usuário cadastrado — sem ele não dá pra gerar seu link de indicação.'
    );
  }
  if (!env.referral.platformWhatsapp) {
    return evolutionService.sendText(whatsapp, 'O link de indicação ainda não está configurado. Fala com o administrador.');
  }

  const mensagem = encodeURIComponent(`Oi! Vim pela indicação de @${driver.username}`);
  const link = `https://wa.me/${env.referral.platformWhatsapp}?text=${mensagem}`;

  return evolutionService.sendText(
    whatsapp,
    `Esse é o seu link de indicação:\n${link}\n\n` +
    `Qualquer pessoa que se cadastrar por ele — motoboy, cliente ou estabelecimento — fica vinculada a você. ` +
    `A cada corrida completada por quem se cadastrou assim, você ganha R$ ${env.referral.commissionAmount.toFixed(2)} de comissão.`
  );
}

async function notifyAdminNewAlvara(driverWhatsapp) {
  if (!env.adminCommands.adminWhatsapp) return;
  try {
    await evolutionService.sendText(
      env.adminCommands.adminWhatsapp,
      `📄 Novo alvará recebido do motoboy ${driverWhatsapp}, aguardando sua aprovação no painel.`
    );
  } catch (err) {
    logger.error('Falha ao notificar admin sobre novo alvará', err.message);
  }
}

// Descreve em português qual endereço não foi encontrado, pra mensagem
// de erro e pra decidir qual pedaço do estado corrigir.
function describeAddressField(addressField, stopIndex, totalStops) {
  if (addressField === 'origin') return 'o endereço de partida (coleta)';
  if (addressField === 'destination') return 'o endereço de destino';
  if (totalStops > 1) return `o endereço da parada ${stopIndex + 1}`;
  return 'o endereço da parada';
}

// Pede de novo SÓ o endereço que falhou, guardando no estado qual campo
// está sendo corrigido — os outros endereços já geocodificados com
// sucesso (origem, destino, demais paradas) ficam intactos em state.stops.
async function askToFixAddress(whatsapp, state, err, stopsList) {
  const { addressField, stopIndex } = err;
  const failedText = addressField === 'origin'
    ? state.origin
    : addressField === 'destination'
      ? stopsList[stopsList.length - 1]
      : stopsList[stopIndex];

  await conversationState.setState(whatsapp, {
    ...state,
    step: STEPS.FIXING_ADDRESS_STREET,
    fixingField: addressField,
    fixingStopIndex: stopIndex,
  });

  return evolutionService.sendText(
    whatsapp,
    `Não conseguimos localizar ${describeAddressField(addressField, stopIndex, stopsList.length - 1)} ` +
    `("${failedText}"). Os outros endereços que você já mandou continuam válidos — vamos tentar de outro jeito. ` +
    `Qual é o nome da rua? (ou manda sua localização pelo clipe/anexo → Localização)`
  );
}

// Corrige SÓ o endereço apontado em state.fixingField, sem perder os
// outros que já tinham geocodificado certo, e tenta cotar de novo.
async function applyFixedAddress(whatsapp, state, addressText) {
  const nextState = { ...state };
  if (state.fixingField === 'origin') {
    nextState.origin = addressText;
  } else {
    const stopsList = [...(state.stops || [])];
    const index = state.fixingField === 'destination' ? stopsList.length - 1 : state.fixingStopIndex;
    stopsList[index] = addressText;
    nextState.stops = stopsList;
  }
  delete nextState.fixingField;
  delete nextState.fixingStopIndex;
  delete nextState.fixingStreet;
  delete nextState.fixingNumber;
  return finalizeStopsAndQuote(whatsapp, nextState);
}

// Fecha a lista de paradas (state.stops) e calcula o preço da rota
// completa. O ÚLTIMO endereço da lista é o destino de verdade — tudo
// antes dele são paradas intermediárias (ver comentário no
// STEPS.ASKING_DESTINATION). Mostra o preço e pede confirmação, estilo
// 99/Uber, só depois de ordenar tudo.
async function finalizeStopsAndQuote(whatsapp, state) {
  const stopsList = state.stops || [];
  const destination = stopsList[stopsList.length - 1];
  const intermediateStops = stopsList.slice(0, -1);

  let quote;
  try {
    quote = await rideService.quoteRide({
      originAddress: state.origin,
      destinationAddress: destination,
      stopAddresses: intermediateStops,
    });
  } catch (err) {
    if (err.statusCode === 422 && err.addressField) {
      return askToFixAddress(whatsapp, state, err, stopsList);
    }
    if (err.statusCode === 422) {
      await conversationState.setState(whatsapp, { type: state.type, driverGenderPreference: state.driverGenderPreference, preferredDriverId: state.preferredDriverId, scheduledFor: state.scheduledFor, step: STEPS.ASKING_ORIGIN });
      return evolutionService.sendText(whatsapp, `${err.message}\n\nVamos tentar de novo — qual é o endereço de partida (coleta)?`);
    }
    logger.error('Falha ao calcular cotação da corrida', err.message);
    await conversationState.clearState(whatsapp);
    return evolutionService.sendText(whatsapp, 'Não consegui calcular o valor agora. Tenta de novo em instantes.');
  }

  await conversationState.setState(whatsapp, {
    ...state,
    destination,
    stops: intermediateStops,
    quote,
    step: STEPS.ASKING_PRICE_CONFIRMATION,
  });
  return evolutionService.sendText(
    whatsapp,
    `Sua ${state.type === 'passenger' ? 'corrida' : 'entrega'} vai custar R$ ${quote.price.toFixed(2)} ` +
    `(${quote.route.distanceKm.toFixed(1)} km). Confirma?\n1 - Sim, confirmar\n2 - Não, quero mudar o endereço`
  );
}

// Cliente paga o motoboy DIRETO (dinheiro ou Pix pessoal dele) — a
// plataforma nunca cobra o cliente, então toda corrida vai direto pra
// busca de motoboy, sem etapa de checkout nenhuma. paymentMethod fica só
// como informação pro motoboy saber como vai receber.
async function startRideCreation(whatsapp, { type, origin, destination, paymentMethod, quote, driverGenderPreference, preferredDriverId, scheduledFor }) {
  const [user] = await User.findOrCreate({
    where: { whatsapp },
    defaults: { name: whatsapp, whatsapp },
  });

  let ride;
  try {
    ride = await rideService.createRide({
      clientId: user.id,
      type,
      originAddress: origin,
      destinationAddress: destination,
      paymentMethod,
      quote,
      driverGenderPreference,
      preferredDriverId,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    });
  } catch (err) {
    logger.error('Falha ao criar corrida após confirmação de preço', err.message);
    await conversationState.clearState(whatsapp);
    return evolutionService.sendText(whatsapp, 'Não consegui confirmar sua corrida agora. Tenta de novo em instantes.');
  }

  await conversationState.clearState(whatsapp);

  // Corrida agendada: preço já travado agora (regras vigentes no momento
  // do agendamento, não recalculado depois) — só confirma e some. O
  // despacho de verdade só começa 15 min antes da hora marcada, disparado
  // pela varredura periódica (ver rideService.sweepScheduledRides).
  if (scheduledFor) {
    await evolutionService.sendText(
      whatsapp,
      `Agendado! Corrida ${ride.tracking_code} marcada pra ${formatScheduledDateTime(scheduledFor)}. ` +
      `Valor: R$ ${ride.price} — pague direto ao motoboy quando ele chegar. Vou começar a buscar um motoboy perto da hora.`
    );
    return;
  }

  await evolutionService.sendText(
    whatsapp,
    `Corrida ${ride.tracking_code} criada! Valor: R$ ${ride.price} — pague direto ao motoboy quando ele chegar. Buscando alguém disponível...`
  );

  await rideService.dispatchOrOfferRide(ride);
}

// Chamado quando o motoboy clica em [Aceitar] ou [Recusar] na oferta de corrida.
// Motoboy avisando pelo WhatsApp que a corrida acabou — sem isso, a
// única forma de concluir seria pelo painel admin, o que não dá pra
// esperar de quem está na rua entregando. Acha a corrida ativa dele
// automaticamente (não precisa dizer o código). O lead já foi cobrado no
// ACEITE (rideService.acceptRide) — aqui só fecha a corrida, sem cobrar
// nada de novo.
async function handleDriverCompletesRide(whatsapp, driver) {
  const activeRide = await Ride.findOne({
    where: { driver_id: driver.id, status: ['accepted', 'in_transit'] },
    order: [['created_at', 'DESC']],
  });

  if (!activeRide) {
    return evolutionService.sendText(whatsapp, 'Não encontrei nenhuma corrida em andamento no seu nome agora.');
  }

  const ride = await rideService.completeRide(activeRide.id);

  await evolutionService.sendText(whatsapp, `✅ Corrida ${ride.tracking_code} concluída! Você já está disponível pra próxima.`);

  const client = await User.findByPk(ride.client_id);
  if (client) {
    evolutionService.sendText(client.whatsapp, `Sua corrida ${ride.tracking_code} foi concluída. Obrigado por usar a MotoFácil!`)
      .catch((err) => logger.error('Falha ao notificar cliente sobre conclusão', err.message));
  }
}

// Cliente cancelando por conta própria ("cancelar"), fora de qualquer fluxo
// em andamento — acha a corrida ativa dele automaticamente (procurando
// motoboy ou já aceita), sem precisar de código. Espelha o mesmo padrão do
// handleDriverCompletesRide pro lado do motoboy. O estorno do lead fee (se
// já tinha motoboy aceito) e o aviso a quem precisa ser avisado acontecem
// dentro de rideService.cancelRide.
async function handleClientCancelRide(whatsapp, user) {
  const activeRide = await Ride.findOne({
    where: { client_id: user.id, status: ['scheduled', 'searching_driver', 'accepted'] },
    order: [['created_at', 'DESC']],
  });

  if (!activeRide) {
    return evolutionService.sendText(whatsapp, 'Você não tem nenhuma corrida em andamento pra cancelar agora.');
  }

  await rideService.cancelRide(activeRide.id, 'Cancelada pelo cliente.');
  return evolutionService.sendText(whatsapp, `Corrida ${activeRide.tracking_code} cancelada.`);
}

async function acceptRideOffer(whatsapp, rideId, driverId) {
  try {
    const { ride, driverBalance } = await rideService.acceptRide(rideId, driverId);
    await evolutionService.sendText(
      whatsapp,
      `Corrida ${ride.tracking_code} confirmada! Siga para: ${ride.origin_address}\n\n` +
      `💰 Saldo atual: R$ ${parseFloat(driverBalance).toFixed(2)}`
    );
  } catch (err) {
    if (typeof err.message === 'string' && err.message.startsWith('NOT_AUTHORIZED_PASSENGER:')) {
      await evolutionService.sendText(whatsapp, err.message.replace('NOT_AUTHORIZED_PASSENGER:', ''));
      return;
    }
    if (typeof err.message === 'string' && err.message.startsWith('SALDO_INSUFICIENTE:')) {
      await evolutionService.sendText(whatsapp, '⚠️ ' + err.message.replace('SALDO_INSUFICIENTE:', '') + '\n\nA corrida continua disponível pra outro motoboy.');
      return;
    }
    logger.info(`Motoboy ${driverId} tentou aceitar corrida ${rideId} já aceita por outro (ou indisponível).`);
    await evolutionService.sendText(whatsapp, 'Essa corrida já foi aceita por outro motoboy. Fique de olho na próxima!');
  }
}

async function rejectRideOffer(whatsapp, rideId, driverId) {
  try {
    const result = await rideService.rejectRide(rideId, driverId);
    if (result.fellBackToBroadcast) {
      logger.info(`Motoboy ${driverId} recusou a corrida ${rideId} — corrida voltou pra busca automática (${result.notified} motoboy(s) notificado(s)).`);
    }
  } catch (err) {
    logger.error(`Falha ao processar recusa da corrida ${rideId} pelo motoboy ${driverId}`, err.message);
  }
}

// Compatibilidade com ofertas antigas já enviadas por botão nativo antes da
// mudança pra texto puro — se o motoboy ainda tiver uma dessas mensagens
// na conversa e tocar nela, o payload accept_ride:/reject_ride: continua
// chegando e sendo tratado normalmente aqui.
async function handleDriverResponse({ whatsapp, buttonId }, driverId) {
  const [action, rideId] = buttonId.split(':');
  if (action === 'accept_ride') return acceptRideOffer(whatsapp, rideId, driverId);
  if (action === 'reject_ride') return rejectRideOffer(whatsapp, rideId, driverId);
}

module.exports = {
  handleIncomingMessage,
  handleIncomingDocument,
  handleDriverResponse,
  handleDriverLocation,
  handleClientLocation,
  STEPS,
  // Exportados só pra teste direto (evita ter que simular horário via
  // relógio real de verdade nos testes).
  detectGreetingIntent,
  buildTimeBasedGreeting,
};
