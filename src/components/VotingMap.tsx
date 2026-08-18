import React, { useEffect, useRef } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';

interface VotingMapProps {
  geoJsonData?: any;
}

export const VotingMap: React.FC<VotingMapProps> = ({ geoJsonData }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maptilersdk.Map | null>(null);

  useEffect(() => {
    if (map.current || !mapContainer.current) return; // Prevent double initialization

    // Set MapTiler API Key
    maptilersdk.config.apiKey = import.meta.env.VITE_MAPTILER_API_KEY;

    // Initialize map
    map.current = new maptilersdk.Map({
      container: mapContainer.current,
      style: maptilersdk.MapStyle.DATAVIZ.LIGHT,
      center: [16.5, 62.0], // Sweden center
      zoom: 4.5,
    });

    map.current.on('load', () => {
      if (!map.current) return;

      // Add dynamic GeoJSON source if provided
      if (geoJsonData) {
        map.current.addSource('voting-districts', {
          type: 'geojson',
          data: geoJsonData,
        });

        // Choropleth Fill Layer
        map.current.addLayer({
          id: 'voting-fill',
          type: 'fill',
          source: 'voting-districts',
          paint: {
            'fill-color': [
              'interpolate',
              ['linear'],
              ['get', 'party_vote_pct'],
              0, '#fef0d9',
              25, '#fdcc8a',
              50, '#fc8d59',
              75, '#e34a33',
              100, '#b30000'
            ],
            'fill-opacity': 0.7,
          },
        });

        // Borders
        map.current.addLayer({
          id: 'voting-borders',
          type: 'line',
          source: 'voting-districts',
          paint: {
            'line-color': '#ffffff',
            'line-width': 1,
          },
        });
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [geoJsonData]);

  return (
    <div 
      ref={mapContainer} 
      style={{ width: '100%', height: '100vh' }} 
    />
  );
};