import { Screen } from '../components/Screen';
import type { Candidate } from '../types';

export function StepCandidates({
  candidates,
  onConfirm,
  onManual,
  onBack,
}: {
  candidates: Candidate[];
  onConfirm: (c: Candidate) => void;
  onManual: () => void;
  onBack?: () => void;
}) {
  const [best, ...rest] = candidates;
  return (
    <Screen
      eyebrow="Étape 3 sur 11"
      title="Nous avons trouvé votre établissement. C'est bien lui ?"
      onBack={onBack}
      footer={<span className="hint">Vous pourrez corriger n'importe quelle information plus tard.</span>}
    >
      <div className="candidate-card candidate-best">
        <img src={best.photoUrl} alt="" />
        <div className="candidate-info">
          <h3>{best.name}</h3>
          <p>{best.address}</p>
          <p className="candidate-type">{best.type}</p>
          <div className="ratings">
            {best.googleRating && <span>⭐ Google {best.googleRating}</span>}
            {best.bookingRating && <span>🏨 Booking {best.bookingRating}</span>}
          </div>
          <button className="btn-primary" onClick={() => onConfirm(best)}>
            Oui, c'est mon établissement
          </button>
        </div>
      </div>

      {rest.length > 0 && (
        <details className="more-candidates">
          <summary>Ce n'est pas le bon ? Voir d'autres résultats</summary>
          {rest.map((c) => (
            <div className="candidate-card" key={c.id}>
              <img src={c.photoUrl} alt="" />
              <div className="candidate-info">
                <h3>{c.name}</h3>
                <p>{c.address}</p>
                <button className="btn-secondary" onClick={() => onConfirm(c)}>
                  Choisir celui-ci
                </button>
              </div>
            </div>
          ))}
        </details>
      )}

      <button className="btn-link" onClick={onManual}>
        Aucun de ces résultats — mon établissement est nouveau
      </button>
    </Screen>
  );
}
