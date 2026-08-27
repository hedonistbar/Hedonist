import { useState } from 'react';
import { Screen } from '../components/Screen';

export function StepPublish({
  autoFillPercentage,
  onRestart,
}: {
  autoFillPercentage: number;
  onRestart: () => void;
}) {
  const [published, setPublished] = useState(false);

  if (published) {
    return (
      <Screen
        eyebrow="Terminé"
        title="Votre site est en ligne 🎉"
        subtitle="Vous pouvez désormais suivre vos avis, vos visites et vos demandes de réservation depuis votre tableau de bord."
        footer={
          <button className="btn-secondary" onClick={onRestart}>
            Refaire une démonstration
          </button>
        }
      >
        <div className="kpi-box">
          <div>
            <strong>{autoFillPercentage}%</strong>
            <span>du profil rempli automatiquement, sans aucune saisie manuelle</span>
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow="Étape 11 sur 11"
      title="Prêt à publier ?"
      subtitle="Une fois publié, votre site est accessible publiquement et connecté à la réservation."
      footer={
        <button className="btn-primary" onClick={() => setPublished(true)}>
          Publier mon site
        </button>
      }
    >
      <p className="hint">
        Vous avez répondu à moins de questions qu'il n'y a d'étapes dans ce parcours — le reste, nous
        l'avons trouvé pour vous.
      </p>
    </Screen>
  );
}
