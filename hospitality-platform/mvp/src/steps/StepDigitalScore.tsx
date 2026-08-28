import { Screen } from '../components/Screen';
import type { DigitalScoreBreakdown } from '../types';

const LABELS: Record<keyof DigitalScoreBreakdown, string> = {
  googleBusiness: 'Google Business',
  booking: 'Booking.com',
  website: 'Site web',
  photos: 'Photos',
  reviews: 'Avis',
  directBooking: 'Réservation directe',
  social: 'Réseaux sociaux',
};

const WEIGHTS: DigitalScoreBreakdown = {
  googleBusiness: 0.2,
  booking: 0.15,
  website: 0.2,
  photos: 0.15,
  reviews: 0.15,
  directBooking: 0.1,
  social: 0.05,
};

export function StepDigitalScore({
  scores,
  autoFillPercentage,
  onNext,
  onBack,
}: {
  scores: DigitalScoreBreakdown;
  autoFillPercentage: number;
  onNext: () => void;
  onBack?: () => void;
}) {
  const overall = Math.round(
    (Object.keys(scores) as (keyof DigitalScoreBreakdown)[]).reduce(
      (sum, k) => sum + scores[k] * WEIGHTS[k],
      0,
    ),
  );

  return (
    <Screen
      eyebrow="Étape 4 sur 11"
      title="Votre bilan digital"
      subtitle={`Nous avons déjà rempli ${autoFillPercentage}% du profil de votre établissement sans vous poser une seule question.`}
      onBack={onBack}
      footer={
        <button className="btn-primary" onClick={onNext}>
          Continuer
        </button>
      }
    >
      <div className="score-bars">
        {(Object.keys(scores) as (keyof DigitalScoreBreakdown)[]).map((k) => (
          <div className="score-row" key={k}>
            <span className="score-label">{LABELS[k]}</span>
            <div className="score-track">
              <div className="score-fill" style={{ width: `${scores[k]}%` }} />
            </div>
            <span className="score-value">{scores[k]}</span>
          </div>
        ))}
      </div>
      <div className="overall-score">
        Score digital global : <strong>{overall}/100</strong>
      </div>
    </Screen>
  );
}
