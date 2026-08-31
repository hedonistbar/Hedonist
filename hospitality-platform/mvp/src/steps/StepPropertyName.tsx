import { useState } from 'react';
import { Screen } from '../components/Screen';

export function StepPropertyName({
  value,
  onNext,
}: {
  value: string;
  onNext: (name: string) => void;
}) {
  const [name, setName] = useState(value);
  return (
    <Screen
      eyebrow="Étape 1 sur 11"
      title="Quel est le nom de votre établissement ?"
      subtitle="C'est la seule information dont nous avons vraiment besoin pour commencer."
      footer={
        <button className="btn-primary" disabled={!name.trim()} onClick={() => onNext(name.trim())}>
          Continuer
        </button>
      }
    >
      <input
        autoFocus
        className="text-input"
        placeholder="ex. Sereine"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && name.trim() && onNext(name.trim())}
      />
    </Screen>
  );
}
