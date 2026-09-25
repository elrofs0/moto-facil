module.exports = (sequelize, DataTypes) => {
  const Ride = sequelize.define('Ride', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tracking_code: { type: DataTypes.STRING, allowNull: false, unique: true },
    type: { type: DataTypes.ENUM('passenger', 'delivery'), allowNull: false },
    // Nula pra corrida vinda de parceiro (ver `source`) — não existe
    // cliente MotoFácil nesse caso, quem pediu foi o painel do parceiro.
    client_id: { type: DataTypes.UUID, allowNull: true },
    driver_id: { type: DataTypes.UUID, allowNull: true },
    // 'motofacil' = pedida por cliente MotoFácil normal (WhatsApp/painel).
    // 'partner' = veio de um sistema parceiro (hoje só o PedidoFácil) via
    // POST /api/partners/dispatch — sem geocodificação nem preço calculados
    // aqui, o parceiro já manda tudo pronto.
    source: { type: DataTypes.STRING, allowNull: false, defaultValue: 'motofacil' },
    // Id da entrega no sistema do parceiro — usado pra idempotência
    // (reenvio por timeout de rede não cria duplicata) e pro webhook de
    // volta saber a qual entrega dele isso corresponde.
    external_reference: { type: DataTypes.STRING, allowNull: true },
    // Nome do estabelecimento parceiro, só pra exibir na oferta ao motoboy.
    partner_establishment_name: { type: DataTypes.STRING, allowNull: true },
    status: {
      type: DataTypes.ENUM(
        'pending_payment', 'scheduled', 'searching_driver', 'accepted', 'in_transit', 'completed', 'cancelled'
      ),
      allowNull: false,
      defaultValue: 'pending_payment',
    },
    // Só preenchido pra corrida agendada (ver rideService.sweepScheduledRides)
    // — quando a hora chega (15 min de antecedência), o status vira
    // 'searching_driver' e o despacho começa normalmente.
    scheduled_for: { type: DataTypes.DATE, allowNull: true },
    // Quando o despacho de fato começou — diferente de created_at pra
    // corrida agendada (pode ter sido criada dias antes). Usado por
    // sweepStaleSearchingRides pra contar os 30 min de busca a partir do
    // despacho de verdade, não da criação do registro.
    dispatch_started_at: { type: DataTypes.DATE, allowNull: true },
    origin_address: { type: DataTypes.STRING, allowNull: false },
    origin_lat: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    origin_lng: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    destination_address: { type: DataTypes.STRING, allowNull: false },
    destination_lat: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    destination_lng: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    // Paradas intermediárias em ordem (sem contar origem/destino), ex:
    // [{ address, lat, lng }, ...] — usado só pra montar a rota completa
    // e mostrar pro motoboy, nunca consultado individualmente.
    stops: { type: DataTypes.JSON, allowNull: true },
    // null = sem preferência (sempre o caso pra entrega). 'motogirl' =
    // cliente pediu atendimento só por motogirl NESSA corrida — é uma
    // escolha por corrida, não fica salva no perfil da cliente (o gênero
    // dela é que fica salvo, em User.gender).
    driver_gender_preference: { type: DataTypes.STRING, allowNull: true },
    // Motoboy escolhido pelo @ (fica gravado mesmo depois de cair pra
    // busca automática, só como registro de quem foi pedido).
    preferred_driver_id: { type: DataTypes.UUID, allowNull: true },
    // Setado quando a oferta é mandada SÓ pro motoboy preferido; zerado
    // quando cai pra busca automática (recusa, timeout ou inelegível).
    // A varredura periódica usa isso pra saber quando os 2 min estouraram.
    preferred_driver_offered_at: { type: DataTypes.DATE, allowNull: true },
    // Motoboys que já receberam oferta dessa corrida — evita notificar o
    // mesmo motoboy duas vezes quando a corrida recua e tenta de novo.
    notified_driver_ids: { type: DataTypes.JSON, allowNull: true },
    distance_km: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    driver_commission: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    platform_fee: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    payment_method: {
      type: DataTypes.ENUM('pix', 'credit_card', 'debit_card', 'boleto', 'cash', 'wallet'),
      allowNull: true,
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'approved', 'refused', 'refunded'),
      allowNull: false,
      defaultValue: 'pending',
    },
    payment_provider_id: { type: DataTypes.STRING, allowNull: true },
    cancelled_reason: { type: DataTypes.STRING, allowNull: true },
  }, {
    tableName: 'rides',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return Ride;
};
