# MotoFácil

Marketplace de mobilidade urbana e entregas via WhatsApp para Santa Maria/RS.
Clientes pedem uma corrida ou entrega direto pelo WhatsApp; motoboys parceiros
aceitam pelo próprio WhatsApp; o pagamento é dividido automaticamente entre a
plataforma e o motoboy no momento da transação.

## Stack

- **Backend**: Node.js + Express + Sequelize (PostgreSQL)
- **Fila/estado de conversa**: Redis
- **Frontend (painel admin)**: React + Vite + Tailwind CSS
- **WhatsApp**: Evolution API
- **Pagamentos**: Mercado Pago (Pix, cartão, boleto, split automático de comissão)
  + carteira interna para corridas em dinheiro

## Por que essas escolhas

- **Split de pagamento nativo do Mercado Pago**: a comissão da plataforma e o
  repasse ao motoboy acontecem no mesmo pagamento, sem processo manual de
  repasse por PIX depois.
- **Carteira interna (wallet)**: corridas pagas em dinheiro debitam a comissão
  automaticamente do saldo do motoboy. Ele só recebe ofertas de corrida em
  dinheiro se tiver saldo positivo — sem isso, o modelo de comissão quebra.
- **Redis para estado de conversa**: cada número de WhatsApp em conversa com o
  bot tem uma etapa (endereço → destino → confirmação → pagamento) guardada
  com expiração automática, para não misturar conversas simultâneas.
- **OSRM para geocodificação/rota**: evita custo por chamada de API paga em
  volume alto; Google Maps fica como fallback opcional.
- **Atualização atômica no aceite de corrida**: o `UPDATE ... WHERE status =
  'searching_driver'` garante que só o primeiro motoboy a aceitar fica com a
  corrida, mesmo que vários cliquem "Aceitar" ao mesmo tempo.

## Estrutura

```
backend/   → API, banco de dados, integração WhatsApp e pagamento
frontend/  → Painel administrativo (corridas, motoboys, usuários, faturamento)
docs/      → Documentação de arquitetura e fluxo de pagamento
```

## Como rodar localmente

```bash
cp .env.example .env
# preencha as variáveis (banco, Redis, Evolution API, Mercado Pago)
docker-compose up --build
```

O backend sobe em `http://localhost:3000`, o painel em `http://localhost:5174`.

## Rodando as migrations

```bash
cd backend
npx sequelize-cli db:migrate
```

## Importante antes de ir pra produção

1. Hospedar em um servidor com uptime estável (VPS) — a sessão da Evolution
   API cai se o processo parar, e a reconexão exige escanear o QR Code de novo.
2. Configurar o Webhook do Mercado Pago apontando para
   `https://SEUDOMINIO/api/webhooks/pagamento` (nunca confiar só no retorno
   do navegador para confirmar pagamento).
3. Revisar a documentação legal de moto-táxi (Lei 12.009/2009 e regras
   municipais de Santa Maria) antes de habilitar corridas de passageiro — o
   MVP atual está desenhado para entregas B2B, que têm exigências mais leves.
