import { useState } from 'react';
import { Screen } from '../components/Screen';
import type { PhotoAsset } from '../types';

export function StepPhotos({
  photos,
  onNext,
}: {
  photos: PhotoAsset[];
  onNext: (photos: PhotoAsset[]) => void;
}) {
  const [items, setItems] = useState(photos);

  function setHero(id: string) {
    setItems((prev) => prev.map((p) => ({ ...p, isHero: p.id === id })));
  }
  function enhance(id: string) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, enhancement: 'applied' } : p)));
  }
  function removeDuplicate(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <Screen
      eyebrow="Étape 7 sur 11"
      title="Vos photos"
      subtitle="Nous avons rassemblé les photos déjà publiées et repéré doublons et retouches possibles."
      footer={
        <button className="btn-primary" onClick={() => onNext(items)}>
          Continuer
        </button>
      }
    >
      <div className="photo-grid">
        {items.map((p) => (
          <div className={`photo-card ${p.isHero ? 'photo-hero' : ''}`} key={p.id}>
            <img src={p.url} alt={p.label} />
            <div className="photo-meta">
              <span>{p.label}</span>
              <span className="photo-quality">Qualité : {p.qualityScore}/100</span>
            </div>
            <div className="photo-actions">
              {!p.isHero && (
                <button className="btn-link" onClick={() => setHero(p.id)}>
                  Définir comme photo principale
                </button>
              )}
              {p.isHero && <span className="hero-badge">Photo principale</span>}
              {p.isDuplicate && (
                <button className="btn-link btn-link-danger" onClick={() => removeDuplicate(p.id)}>
                  Doublon probable — supprimer
                </button>
              )}
              {p.enhancement === 'suggested' && (
                <button className="btn-link" onClick={() => enhance(p.id)}>
                  Améliorer la lumière (IA)
                </button>
              )}
              {p.enhancement === 'applied' && <span className="hero-badge">Améliorée</span>}
            </div>
          </div>
        ))}
      </div>
      <p className="hint">
        L'IA n'ajoute jamais de meuble, n'agrandit jamais une pièce et ne modifie jamais la vue — uniquement
        lumière, netteté et cadrage.
      </p>
    </Screen>
  );
}
