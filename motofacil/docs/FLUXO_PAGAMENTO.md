# Fluxo de pagamento — MotoFácil

## Métodos aceitos

Pix, cartão de crédito, cartão de débito e boleto (todos nativos do
Checkout Pro do Mercado Pago, sem restrição de método) — e dinheiro, via
carteira interna do motoboy.

## Passo a passo (pagamento digital)

1. Cliente confirma origem, destino e forma de pagamento pelo WhatsApp.
2. `rideService.createRide` calcula distância (OSRM) e preço
   (`pricingService`), já dividindo comissão da plataforma e repasse ao
   motoboy.
3. `paymentService.createChargeForRide` cria uma Preferência no Mercado
   Pago com **split de pagamento** (`marketplace_fee`) — o valor já sai
   dividido no momento do pagamento, sem repasse manual depois.
4. Cliente recebe o link de checkout pelo WhatsApp e paga.
5. Mercado Pago notifica via **Webhook** (nunca pelo redirecionamento do
   navegador) em `POST /api/webhooks/pagamento`.
6. O backend **revalida o pagamento diretamente na API do Mercado Pago**
   antes de confirmar — nunca confia apenas no corpo da notificação
   recebida, para evitar fraude de webhook falsificado.
7. Corrida muda para `searching_driver` e a oferta é disparada aos
   motoboys próximos.

## Passo a passo (pagamento em dinheiro)

1. Cliente escolhe "Dinheiro" no menu do WhatsApp.
2. `rideService.findNearbyAvailableDrivers` só considera motoboys com
   saldo suficiente na carteira para cobrir a comissão daquela corrida.
3. Corrida é oferecida e aceita normalmente.
4. Ao concluir a corrida, `paymentService.settleCashRide` debita a
   comissão da carteira do motoboy automaticamente.

## Pré-requisito para o split funcionar

Cada motoboy aprovado precisa ter uma subconta Mercado Pago vinculada
(processo de onboarding como vendedor/collaborator no Marketplace do
Mercado Pago) — sem isso, o `marketplace_fee` não tem para onde repassar
o valor do motoboy. Isso deve ser parte do fluxo de aprovação de cadastro,
como um passo adicional a ser implementado no `driverController.approveDriver`.
