import React from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Mesmo padrão do RideMap.jsx — Santa Maria/RS como centro padrão.
const SANTA_MARIA_CENTER = [-29.6842, -53.8069];

// Pino em formato de gota (o mesmo truque clássico de mapa: círculo com um
// canto reto, rotacionado 45°) na cor âmbar da marca — a ponta aponta
// exatamente pra coordenada, como um pino de mapa de verdade. O emoji de
// scooter dentro já é reconhecível de cara, sem depender de desenhar um
// ícone do zero.
const driverIcon = L.divIcon({
  className: '', // sem isso o Leaflet aplica seu próprio fundo/borda branca padrão por cima
  html: `
    <div style="
      width: 34px; height: 34px;
      background: #DB8E2E;
      border: 2px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 1px 4px rgba(33, 29, 23, 0.45);
      display: flex; align-items: center; justify-content: center;
    ">
      <span style="transform: rotate(45deg); font-size: 16px; line-height: 1;">🛵</span>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -32],
});

function formatLastLocation(value) {
  if (!value) return 'sem horário registrado';
  return new Date(value).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DriverMap({ drivers }) {
  const withLocation = drivers.filter((d) => d.status === 'available' && d.last_lat && d.last_lng);

  return (
    <div className="overflow-hidden rounded-md border border-ink/10">
      <div className="flex items-center gap-2 border-b border-ink/10 bg-white px-4 py-2.5 text-xs text-ink/55">
        <span className="pulse-dot h-2 w-2 rounded-full bg-emerald-500" />
        {withLocation.length} motoboy{withLocation.length === 1 ? '' : 's'} {withLocation.length === 1 ? 'disponível' : 'disponíveis'} no mapa agora
      </div>
      <div className="h-72 md:h-[28rem]">
        <MapContainer center={SANTA_MARIA_CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {withLocation.map((d) => (
            <Marker key={d.id} position={[parseFloat(d.last_lat), parseFloat(d.last_lng)]} icon={driverIcon}>
              <Popup>
                <strong>{d.name}</strong> {d.gender === 'motogirl' ? '(motogirl)' : '(motoboy)'}<br />
                {d.whatsapp}<br />
                Localização de: {formatLastLocation(d.last_location_at)}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
