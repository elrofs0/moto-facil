const mercadoPagoAdapter = require('./paymentAdapters/mercadoPagoAdapter');
const asaasAdapter = require('./paymentAdapters/asaasAdapter');
const walletService = require('./walletService');
const evolutionService = require('./evolutionService');
const env = require('../config/env');
const { Driver, WalletRecharge } = require('../models');
const { logger } = require('../utils');

// Ponto único de acesso a pagamento no resto do sistema. O único fluxo de
// dinheiro real que passa pela plataforma hoje é a RECARGA DE CARTEIRA do
// motoboy — o valor da corrida em si é sempre pago direto do cliente pro
// motoboy (dinheiro ou Pix pessoal dele), nunca toca a MotoFácil.
//
// O provedor ativo (Asaas ou Mercado Pago) é escolhido pela variável
// PAYMENT_PROVIDER, então trocar de gateway é mudança de env var, não de
// código.
function getAdapter() {
  return env.paymentProvider === 'mercadopago' ? mercadoPagoAdapter : asaasAdapter;
}

// Gera um Pix real pro motoboy recarregar a carteira, de onde saem os
// leads cobrados por corrida aceita (ver rideService.acceptRide).
async function createDriverWalletRecharge(driverId, amount) {
  const driver = await Driver.findByPk(driverId);
  if (!driver) throw new Error('Motoboy não encontrado');

  const recharge = await WalletRecharge.create({
    driver_id: driverId,
    amount,
    provider: env.paymentProvider,
    provider_charge_id: `pending-${driverId}-${Date.now()}`, // placeholder até o gateway responder
    status: 'pending',
  });

  const { providerId, pixQrCodeBase64, pixCopyPaste } = await getAdapter().createPixCharge({
    externalReference: recharge.id,
    customerName: driver.name,
    customerWhatsapp: driver.whatsapp,
    value: parseFloat(amount),
    description: `Recarga de carteira MotoFácil - ${driver.name}`,
  });

  await recharge.update({
    provider_charge_id: providerId,
    pix_qr_code_base64: pixQrCodeBase64,
    pix_copy_paste: pixCopyPaste,
  });

  return recharge;
}

// Chamado pelo webhook do gateway. Sempre reconsulta o pagamento
// diretamente na API (verifyPayment) em vez de confiar cegamente no corpo
// da notificação — evita fraude de webhook falsificado.
async function confirmPaymentFromWebhook(paymentId) {
  const result = await getAdapter().verifyPayment(paymentId);
  if (!result.externalReference) {
    logger.warn(`Webhook de pagamento sem externalReference (paymentId=${paymentId})`);
    return null;
  }

  const recharge = await WalletRecharge.findByPk(result.externalReference);
  if (!recharge) {
    logger.warn(`Webhook de pagamento recebido para referência desconhecida: ${result.externalReference}`);
    return null;
  }

  return { type: 'recharge', record: await confirmWalletRecharge(recharge, result, true) };
}

// Motoboy manda o comprovante do Pix por WhatsApp (foto/PDF) antes do
// webhook do gateway confirmar — às vezes demora. Credita na hora contra o
// valor já conhecido da recarga pending (o valor foi fixado quando o QR
// foi gerado em createDriverWalletRecharge, não precisa ler o comprovante).
// Fica marcado como NÃO verificado pelo gateway — se o comprovante for
// falso, o saldo já terá sido liberado; o admin precisa bloquear o motoboy
// manualmente (ver adminCommandFlow set_user_blocked).
async function confirmWalletRechargeFromReceipt(driverId) {
  const recharge = await WalletRecharge.findOne({
    where: { driver_id: driverId, status: 'pending' },
    order: [['created_at', 'DESC']],
  });
  if (!recharge) return null;

  return confirmWalletRecharge(recharge, { status: 'approved' }, false);
}

// Idempotente: se a recarga já estiver 'paid', não credita de novo (o
// gateway pode reenviar o mesmo webhook mais de uma vez, ou o motoboy manda
// o comprovante depois do webhook já ter confirmado).
async function confirmWalletRecharge(recharge, result, verifiedByGateway) {
  if (recharge.status === 'paid') return recharge;

  if (result.status === 'approved') {
    const description = verifiedByGateway
      ? `Recarga via Pix (${recharge.provider})`
      : 'Recarga via Pix (comprovante enviado pelo motoboy — não verificado pelo gateway)';

    const newBalance = await walletService.creditDriver(recharge.driver_id, recharge.amount, description);
    await recharge.update({ status: 'paid', paid_at: new Date() });

    const driver = await Driver.findByPk(recharge.driver_id);
    if (driver) {
      await evolutionService.sendText(
        driver.whatsapp,
        `✅ Recarga de R$ ${parseFloat(recharge.amount).toFixed(2)} confirmada! Seu novo saldo é R$ ${parseFloat(newBalance).toFixed(2)}.`
      ).catch((err) => logger.error('Falha ao notificar motoboy sobre recarga confirmada', err));

      if (env.adminCommands.adminWhatsapp) {
        const unverifiedNote = verifiedByGateway ? '' : '\n⚠️ Não verificado pelo gateway — confirmado só pelo comprovante enviado pelo motoboy.';
        await evolutionService.sendText(
          env.adminCommands.adminWhatsapp,
          `💰 Recarga confirmada: ${driver.name} (${driver.whatsapp}) — R$ ${parseFloat(recharge.amount).toFixed(2)}.${unverifiedNote}`
        ).catch((err) => logger.error('Falha ao notificar admin sobre recarga confirmada', err));
      }
    }
  } else if (result.status === 'rejected') {
    await recharge.update({ status: 'failed' });
  }

  return recharge;
}

module.exports = {
  createDriverWalletRecharge,
  confirmPaymentFromWebhook,
  confirmWalletRechargeFromReceipt,
};
