import { useEffect, useState } from 'react';
import { Screen } from '../components/Screen';
import type { PropertyGraph } from '../types';

export function StepConflicts({
  graph,
  onResolve,
}: {
  graph: PropertyGraph;
  onResolve: (checkIn: string) => void;
}) {
  const conflict = graph.policies.checkIn;
  const alt = conflict.conflictsWith?.[0];
  const [choice, setChoice] = useState<string>(conflict.value);

  useEffect(() => {
    // Nothing to resolve — this step is silently skipped when sources agree.
    if (!alt) onResolve(conflict.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alt]);

  if (!alt) {
    return null;
  }

  return (
    <Screen
      eyebrow="Étape 5 sur 11"
      title="Une information diffère selon la source"
      subtitle="Nous ne montrons que ce qui pose question — tout le reste a déjà été rempli."
      footer={
        <button className="btn-primary" onClick={() => onResolve(choice)}>
          Confirmer
        </button>
      }
    >
      <div className="conflict-box">
        <p className="conflict-question">Quelle est l'heure d'arrivée (check-in) ?</p>
        <label className="conflict-option">
          <input type="radio" checked={choice === conflict.value} onChange={() => setChoice(conflict.value)} />
          <strong>{conflict.value}</strong> — d'après {conflict.sources.map((s) => s.name).join(', ')}
        </label>
        <label className="conflict-option">
          <input type="radio" checked={choice === alt.value} onChange={() => setChoice(alt.value)} />
          <strong>{alt.value}</strong> — d'après {alt.sources.map((s) => s.name).join(', ')}
        </label>
      </div>
    </Screen>
  );
}
