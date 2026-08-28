import { useState } from 'react';
import { Screen } from '../components/Screen';

export function StepBooking({
  initialMode,
  initialUrl,
  onNext,
  onBack,
}: {
  initialMode?: 'existing' | 'direct' | null;
  initialUrl?: string;
  onNext: (choice: 'existing' | 'direct', url?: string) => void;
  onBack?: () => void;
}) {
  const [mode, setMode] = useState<'existing' | 'direct' | null>(initialMode ?? null);
  const [url, setUrl] = useState(initialUrl ?? '');

  return (
    <Screen
      eyebrow="Étape 9 sur 11"
      title="Comment vos clients réservent-ils aujourd'hui ?"
      onBack={onBack}
      footer={
        mode === 'existing' ? (
          <button className="btn-primary" disabled={!url.trim()} onClick={() => onNext('existing', url.trim())}>
            Connecter ce système de réservation
          </button>
        ) : mode === 'direct' ? (
          <button className="btn-primary" onClick={() => onNext('direct')}>
            Activer la réservation directe
          </button>
        ) : (
          <span className="hint">Choisissez une option ci-dessus.</span>
        )
      }
    >
      <div className="booking-choice">
        <button className={`choice-card ${mode === 'existing' ? 'choice-card-active' : ''}`} onClick={() => setMode('existing')}>
          <strong>J'ai déjà un système de réservation</strong>
          <span>Booking.com, Smoobu, Amenitiz...</span>
        </button>
        <button className={`choice-card ${mode === 'direct' ? 'choice-card-active' : ''}`} onClick={() => setMode('direct')}>
          <strong>Je n'en ai pas</strong>
          <span>Utiliser notre moteur de réservation directe</span>
        </button>
      </div>
      {mode === 'existing' && (
        <input
          autoFocus
          className="text-input"
          placeholder="Lien vers votre page de réservation"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      )}
    </Screen>
  );
}
