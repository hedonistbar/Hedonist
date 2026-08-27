import { Screen } from '../components/Screen';
import type { WebsiteStyle } from '../types';

const STYLES: { id: WebsiteStyle; label: string; description: string; color: string }[] = [
  { id: 'classic', label: 'Classique', description: "Pour château ou maison d'hôtes", color: '#6b5b4a' },
  { id: 'modern', label: 'Moderne', description: 'Pour boutique hôtel', color: '#2f3b52' },
  { id: 'nature', label: 'Nature', description: 'Pour gîte ou propriété à la campagne', color: '#4c6b45' },
];

export function StepStyle({ onSelect }: { onSelect: (style: WebsiteStyle) => void }) {
  return (
    <Screen
      eyebrow="Étape 8 sur 11"
      title="Choisissez le style de votre site"
      subtitle="Nous générons le site automatiquement à partir de vos informations — vous n'avez rien à concevoir."
      footer={<span className="hint">Vous pourrez changer de style plus tard.</span>}
    >
      <div className="style-grid">
        {STYLES.map((s) => (
          <button key={s.id} className="style-card" onClick={() => onSelect(s.id)}>
            <div className="style-swatch" style={{ background: s.color }} />
            <strong>{s.label}</strong>
            <span>{s.description}</span>
          </button>
        ))}
      </div>
    </Screen>
  );
}
