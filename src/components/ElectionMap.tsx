import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { FeatureCollection } from 'geojson';
import 'leaflet/dist/leaflet.css';

// Official Swedish political party colors and full names
const PARTY_CONFIG: Record<string, { name: string; color: string }> = {
  S:  { name: 'Socialdemokraterna', color: '#e8112d' },
  SD: { name: 'Sverigedemokraterna', color: '#fcd116' },
  M:  { name: 'Moderaterna',        color: '#005293' },
  V:  { name: 'Vänsterpartiet',     color: '#da291c' },
  C:  { name: 'Centerpartiet',      color: '#009933' },
  KD: { name: 'Kristdemokraterna', color: '#000077' },
  MP: { name: 'Miljöpartiet',       color: '#83cf39' },
  L:  { name: 'Liberalerna',        color: '#006ab3' },
};

const DEFAULT_COLOR = '#94a3b8';

export default function ElectionMap() {
  const [geoJsonData, setGeoJsonData] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch('/data/processed_val2022.json')
      .then((res) => res.json())
      .then((data: FeatureCollection) => setGeoJsonData(data))
      .catch((err) => console.error('Error loading election data:', err));
  }, []);

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <MapContainer center={[62.0, 15.0]} zoom={5} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {geoJsonData && (
          <GeoJSON
            data={geoJsonData}
            style={(feature) => {
              const winner = feature?.properties?.winning_party || '';
              const color = PARTY_CONFIG[winner]?.color || DEFAULT_COLOR;
              return {
                fillColor: color,
                weight: 0.3,
                color: '#ffffff',
                fillOpacity: 0.75,
              };
            }}
            onEachFeature={(feature, layer) => {
              const props = feature.properties || {};
              const name = props.district_name || 'Voting District';
              const winner = props.winning_party || 'N/A';
              const votes = props.votes || {};

              // 1. Calculate total district votes dynamically
              const totalVotes = Object.values(votes).reduce(
                (sum: number, val: any) => sum + (Number(val) || 0),
                0
              ) as number;

              if (totalVotes === 0) {
                layer.bindPopup(`
                  <div style="font-family: sans-serif; padding: 4px;">
                    <h3 style="margin:0; font-size:14px;">${name}</h3>
                    <p style="margin:4px 0 0 0; color:#888; font-size:12px;">Inga röster registrerade</p>
                  </div>
                `);
                return;
              }

              // 2. Parse and compute dynamic party shares (%)
              const partyShares = Object.entries(votes)
                .map(([party, count]) => {
                  const numCount = Number(count) || 0;
                  return {
                    party,
                    count: numCount,
                    share: (numCount / totalVotes) * 100,
                  };
                })
                .sort((a, b) => b.share - a.share); // Highest % first

              // Filter out parties with 0 votes
              const activeParties = partyShares.filter((p) => p.share > 0);

              // 3. Build dynamic stacked bar segments with exact calculated widths
              const stackedBarHtml = activeParties
                .map((p) => {
                  const partyColor = PARTY_CONFIG[p.party]?.color || DEFAULT_COLOR;
                  return `<div style="width:${p.share.toFixed(2)}%; background:${partyColor}; height:100%;" title="${p.party}: ${p.share.toFixed(1)}%"></div>`;
                })
                .join('');

              // 4. Build detailed list showing all parties with votes
              const partyListHtml = activeParties
                .map((p) => {
                  const partyColor = PARTY_CONFIG[p.party]?.color || DEFAULT_COLOR;
                  const fullName = PARTY_CONFIG[p.party]?.name || p.party;
                  return `
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; margin-top:4px;">
                      <span style="display:flex; align-items:center; gap:5px;">
                        <span style="width:8px; height:8px; background:${partyColor}; border-radius:50%; display:inline-block;"></span>
                        <strong>${p.party}</strong>
                        <span style="color:#777; font-size:10px;">(${fullName})</span>
                      </span>
                      <span>
                        <strong>${p.share.toFixed(1)}%</strong>
                        <span style="color:#888; font-size:10px;"> (${p.count.toLocaleString('sv-SE')})</span>
                      </span>
                    </div>
                  `;
                })
                .join('');

              const winnerColor = PARTY_CONFIG[winner]?.color || DEFAULT_COLOR;
              const winnerFullName = PARTY_CONFIG[winner]?.name || winner;

              // 5. Construct final Popup HTML
              const popupContent = `
                <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 220px; max-width: 280px; padding: 2px;">
                  <h3 style="margin: 0 0 2px 0; font-size: 14px; font-weight: 700;">${name}</h3>
                  <p style="margin: 0 0 8px 0; font-size: 12px; color: #555;">
                    Vinnare: <strong style="color: ${winnerColor};">${winner}</strong> 
                    <span style="font-size: 10px; color: #777;">(${winnerFullName})</span>
                  </p>

                  <div style="margin-bottom: 8px;">
                    <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:600; color:#777; margin-bottom:3px;">
                      <span>PARTIFÖRDELNING</span>
                      <span>Totalt: ${totalVotes.toLocaleString('sv-SE')} röster</span>
                    </div>
                    <div style="display:flex; height:10px; border-radius:4px; overflow:hidden; background:#eee;">
                      ${stackedBarHtml}
                    </div>
                  </div>

                  <div style="max-height:160px; overflow-y:auto; border-top:1px solid #f0f0f0; padding-top:4px;">
                    ${partyListHtml}
                  </div>
                </div>
              `;

              layer.bindPopup(popupContent, { maxWidth: 300 });

              // Hover highlight effects
              layer.on({
                mouseover: (e) => {
                  const l = e.target;
                  l.setStyle({ fillOpacity: 0.95, weight: 1.5 });
                },
                mouseout: (e) => {
                  const l = e.target;
                  l.setStyle({ fillOpacity: 0.75, weight: 0.3 });
                },
              });
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}