import { useState } from 'react';
import { Screen } from '../components/Screen';

export function StepCity({
  propertyName,
  value,
  onSearch,
  onBack,
}: {
  propertyName: string;
  value: string;
  onSearch: (city: string) => void;
  onBack?: () => void;
}) {
  const [city, setCity] = useState(value);
  return (
    <Screen
      eyebrow="Étape 2 sur 11"
      title="Dans quelle ville ?"
      subtitle={`Nous allons chercher tout ce qui existe déjà en ligne sur "${propertyName}".`}
      onBack={onBack}
      footer={
        <button className="btn-primary" disabled={!city.trim()} onClick={() => onSearch(city.trim())}>
          Rechercher mon établissement
        </button>
      }
    >
      <input
        autoFocus
        className="text-input"
        placeholder="ex. Langres"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && city.trim() && onSearch(city.trim())}
      />
    </Screen>
  );
}
