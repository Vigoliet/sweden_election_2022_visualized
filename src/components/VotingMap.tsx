import React, { useEffect, useRef, useState } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';

const PARTY_CONFIG: Record<string, { name: string; color: string }> = {
  S:  { name: 'Socialdemokraterna', color: '#e8112d' },
  SD: { name: 'Sverigedemokraterna', color: '#fcd116' },
  M:  { name: 'Moderaterna',         color: '#005293' },
  V:  { name: 'Vänsterpartiet',      color: '#da291c' },
  C:  { name: 'Centerpartiet',       color: '#009933' },
  KD: { name: 'Kristdemokraterna', color: '#000077' },
  MP: { name: 'Miljöpartiet',        color: '#83cf39' },
  L:  { name: 'Liberalerna',         color: '#006ab3' },
};

const DEFAULT_COLOR = '#94a3b8';

interface VotingMapProps {
  geoJsonData?: any;
}

export const VotingMap: React.FC<VotingMapProps> = ({ geoJsonData }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maptilersdk.Map | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!mapContainer.current) return;

    maptilersdk.config.apiKey = import.meta.env.VITE_MAPTILER_API_KEY;

    map.current = new maptilersdk.Map({
      container: mapContainer.current,
      style: isDarkMode ? maptilersdk.MapStyle.DATAVIZ.DARK : maptilersdk.MapStyle.DATAVIZ.LIGHT,
      center: [14.5, 62.0],
      zoom: 4,
    });

    const addLayers = () => {
      if (!map.current || !geoJsonData) return;

      // Rensa befintliga lager och källor vid omrendering
      if (map.current.getLayer('voting-fill')) map.current.removeLayer('voting-fill');
      if (map.current.getLayer('voting-borders')) map.current.removeLayer('voting-borders');
      if (map.current.getSource('voting-districts')) map.current.removeSource('voting-districts');

      map.current.addSource('voting-districts', {
        type: 'geojson',
        data: geoJsonData,
      });

      const colorMatchExpression: any = ['match', ['get', 'winning_party']];
      Object.entries(PARTY_CONFIG).forEach(([party, config]) => {
        colorMatchExpression.push(party, config.color);
      });
      colorMatchExpression.push(DEFAULT_COLOR);

      map.current.addLayer({
        id: 'voting-fill',
        type: 'fill',
        source: 'voting-districts',
        paint: {
          'fill-color': colorMatchExpression,
          'fill-opacity': 0.75,
        },
      });

      map.current.addLayer({
        id: 'voting-borders',
        type: 'line',
        source: 'voting-districts',
        paint: {
          'line-color': isDarkMode ? '#0f172a' : '#ffffff',
          'line-width': 0.3,
        },
      });

      setIsLoading(false);
    };

    map.current.on('load', addLayers);
    map.current.on('style.load', addLayers);

    // Klick-event för popup
    map.current.on('click', 'voting-fill', (e) => {
      if (!e.features || e.features.length === 0 || !map.current) return;
      const props = e.features[0].properties || {};
      
      const name = props.district_name || 'Valdistrikt';
      const winner = props.winning_party || 'N/A';
      
      let votes: Record<string, any> = {};
      try {
        votes = typeof props.votes === 'string' ? JSON.parse(props.votes) : (props.votes || {});
      } catch (err) { votes = {}; }

      const totalVotes = Object.values(votes).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0) as number;
      const partyShares = Object.entries(votes)
        .map(([party, count]) => ({ party, count: Number(count) || 0, share: (Number(count) / totalVotes) * 100 }))
        .sort((a, b) => b.share - a.share)
        .filter((p) => p.share > 0);

      const stackedBarHtml = partyShares.map(p => `<div style="width:${p.share.toFixed(2)}%; background:${PARTY_CONFIG[p.party]?.color || DEFAULT_COLOR}; height:100%;"></div>`).join('');
      const partyListHtml = partyShares.map(p => `
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; margin-top:5px;">
          <span style="display:flex; align-items:center; gap:6px;">
            <span style="width:8px; height:8px; background:${PARTY_CONFIG[p.party]?.color || DEFAULT_COLOR}; border-radius:50%; display:inline-block;"></span>
            <strong>${p.party}</strong>
          </span>
          <span>${p.share.toFixed(1)}% (${p.count.toLocaleString('sv-SE')})</span>
        </div>`).join('');

      new maptilersdk.Popup({ maxWidth: '320px' })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font-family: system-ui, sans-serif; min-width: 220px; padding: 5px;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #0f172a;">${name}</h3>
            <div style="display:flex; height:10px; border-radius:4px; overflow:hidden; background:#e2e8f0;">${stackedBarHtml}</div>
            <div style="margin-top:8px;">${partyListHtml}</div>
          </div>`)
        .addTo(map.current!);
    });

    map.current.on('mouseenter', 'voting-fill', () => { if (map.current) map.current.getCanvas().style.cursor = 'pointer'; });
    map.current.on('mouseleave', 'voting-fill', () => { if (map.current) map.current.getCanvas().style.cursor = ''; });

    return () => { map.current?.remove(); map.current = null; };
  }, [geoJsonData]);

  useEffect(() => {
    if (map.current) {
      setIsLoading(true);
      map.current.setStyle(isDarkMode ? maptilersdk.MapStyle.DATAVIZ.DARK : maptilersdk.MapStyle.DATAVIZ.LIGHT);
    }
  }, [isDarkMode]);

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: isDarkMode ? '#0f172a' : '#ffffff' }}>
      
      {/* Global CSS för att göra stängningsknappen (X) i popupsen tydlig */}
      <style>{`
        .maplibregl-popup-close-button {
          font-size: 18px !important;
          padding: 4px 8px !important;
          color: #0f172a !important;
          background-color: rgba(0, 0, 0, 0.06) !important;
          border-radius: 0 6px 0 6px !important;
          cursor: pointer !important;
          transition: background-color 0.2s ease;
        }
        .maplibregl-popup-close-button:hover {
          background-color: rgba(0, 0, 0, 0.15) !important;
        }
        @keyframes spin { 
          0% { transform: rotate(0deg); } 
          100% { transform: rotate(360deg); } 
        }
      `}</style>

      {isLoading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2000, 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            width: '40px', height: '40px',
            border: `4px solid ${isDarkMode ? '#ffffff' : '#0f172a'}`,
            borderTop: '4px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
        </div>
      )}

      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      
      <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        style={{
          position: 'absolute', bottom: '30px', right: '30px', zIndex: 1000,
          backgroundColor: isDarkMode ? '#ffffff' : '#1e293b',
          color: isDarkMode ? '#1e293b' : '#ffffff',
          padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 600,
          fontFamily: 'system-ui, sans-serif'
        }}
      >
        {isDarkMode ? '☀️ Light mode' : '🌙 dark mode'}
      </button>
    </div>
  );
};