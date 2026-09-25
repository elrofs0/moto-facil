import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Mapa simplificado com Leaflet — mostra a origem de cada corrida ativa.
// Santa Maria/RS como centro padrão do mapa.
const SANTA_MARIA_CENTER = [-29.6842, -53.8069];

export default function RideMap({ rides }) {
  const withLocation = rides.filter((r) => r.origin_lat && r.origin_lng);

  return (
    <div className="overflow-hidden rounded-md border border-ink/10">
      <div className="flex items-center gap-2 border-b border-ink/10 bg-white px-4 py-2.5 text-xs text-ink/55">
        <span className="pulse-dot h-2 w-2 rounded-full bg-ember-500" />
        {withLocation.length} corrida{withLocation.length === 1 ? '' : 's'} com localização no mapa agora
      </div>
      <div className="h-72 md:h-96">
        <MapContainer center={SANTA_MARIA_CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {withLocation.map((r) => (
            <Marker key={r.id} position={[parseFloat(r.origin_lat), parseFloat(r.origin_lng)]}>
              <Popup>
                {r.tracking_code}<br />
                {r.origin_address} → {r.destination_address}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
