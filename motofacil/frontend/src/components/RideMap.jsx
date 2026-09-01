import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Mapa simplificado com Leaflet — mostra a origem de cada corrida ativa.
// Santa Maria/RS como centro padrão do mapa.
const SANTA_MARIA_CENTER = [-29.6842, -53.8069];

export default function RideMap({ rides }) {
  return (
    <div className="h-80 rounded-sm overflow-hidden border border-ink/10">
      <MapContainer center={SANTA_MARIA_CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {rides
          .filter((r) => r.origin_lat && r.origin_lng)
          .map((r) => (
            <Marker key={r.id} position={[parseFloat(r.origin_lat), parseFloat(r.origin_lng)]}>
              <Popup>
                {r.tracking_code}<br />
                {r.origin_address} → {r.destination_address}
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
