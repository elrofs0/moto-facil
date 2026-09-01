# Arquitetura — MotoFácil

## Visão geral

```
Cliente (WhatsApp) ──┐
                      ├──> Evolution API ──> Webhook ──> conversationFlow.js ──> rideService.js
Motoboy (WhatsApp) ───┘                                                              │
                                                                                       ▼
                                                                          Banco (PostgreSQL)
                                                                                       ▲
                                                              Painel Admin (React) ────┘
```

## Por que uma máquina de estados simples no chatbot, e não NLP livre

O público do MotoFácil em Santa Maria inclui pessoas com diferentes níveis
de familiaridade com tecnologia. Um fluxo com etapas previsíveis
(endereço → destino → forma de pagamento) erra muito menos que tentar
interpretar frases livres, e é mais fácil de debugar quando algo dá errado.

## Por que Redis para estado de conversa

Sem guardar em que etapa cada número está, mensagens de clientes diferentes
conversando ao mesmo tempo se misturariam — o bot não tem uma "sessão" como
um app teria. O Redis guarda isso com expiração automática (15 min), então
conversas abandonadas não ficam presas para sempre.

## Por que a atualização atômica no aceite de corrida

Quando uma corrida é oferecida a até 5 motoboys ao mesmo tempo, mais de um
pode tentar aceitar simultaneamente. A trava é feita no próprio banco:

```sql
UPDATE rides SET driver_id = X, status = 'accepted'
WHERE id = Y AND status = 'searching_driver'
```

Só o primeiro UPDATE afeta uma linha; o segundo não afeta nenhuma, e o
motoboy recebe a mensagem de que a corrida já foi aceita. Não é necessário
lock manual nem fila adicional para isso.

## Por que carteira interna (wallet) para corridas em dinheiro

Quando o cliente paga em dinheiro direto ao motoboy, a plataforma não
recebe automaticamente sua comissão. Por isso, cada motoboy tem um saldo:
ele só recebe ofertas de corrida em dinheiro se tiver saldo suficiente
para cobrir a comissão daquela corrida, e a comissão é debitada
automaticamente da carteira dele ao concluir a corrida.

## Escalabilidade e próximos passos

- Trocar a Evolution API por WhatsApp Business Cloud API oficial se o
  volume de mensagens crescer (risco de banimento do número na versão
  não-oficial).
- Hospedar o OSRM em uma instância própria em vez do servidor demo
  público, para não depender de rate limit externo.
- Adicionar fila (BullMQ sobre o Redis já existente) para o disparo de
  notificações a múltiplos motoboys, se o volume de corridas simultâneas
  crescer muito.
