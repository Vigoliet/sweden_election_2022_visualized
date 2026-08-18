import { useEffect, useState } from 'react';
import { VotingMap } from './components/VotingMap';
import type { FeatureCollection } from 'geojson';

export default function App() {
  const [geoJsonData, setGeoJsonData] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch('/data/processed_val2022.json')
      .then((res) => res.json())
      .then((data: FeatureCollection) => setGeoJsonData(data))
      .catch((err) => console.error('Error loading election data:', err));
  }, []);

  return <VotingMap geoJsonData={geoJsonData} />;
}