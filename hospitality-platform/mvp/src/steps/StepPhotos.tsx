import { useRef, useState } from 'react';
import { Screen } from '../components/Screen';
import type { PhotoAsset } from '../types';

export function StepPhotos({
  photos,
  onNext,
  onBack,
}: {
  photos: PhotoAsset[];
  onNext: (photos: PhotoAsset[]) => void;
  onBack?: () => void;
}) {
  const [items, setItems] = useState(photos);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function setHero(id: string) {
    setItems((prev) => prev.map((p) => ({ ...p, isHero: p.id === id })));
  }
  function enhance(id: string) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, enhancement: 'applied' } : p)));
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setItems((prev) => [
          ...prev,
          {
            id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            url,
            label: file.name,
            group: 'room',
            qualityScore: 70,
            isHero: false,
            enhancement: 'none',
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }

  return (
    <Screen
      eyebrow="Étape 7 sur 11"
      title="Vos photos"
      subtitle="Nous avons rassemblé les photos déjà publiées et repéré doublons et retouches possibles. Vous pouvez aussi ajouter les vôtres."
      onBack={onBack}
      footer={
        <button className="btn-primary" onClick={() => onNext(items)}>
          Continuer
        </button>
      }
    >
      <div className="photo-grid">
        <button className="photo-card photo-add" onClick={() => fileInputRef.current?.click()}>
          <span className="photo-add-icon">+</span>
          <span>Ajouter une photo</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
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
              {p.isDuplicate && <span className="hint">Doublon probable</span>}
              {p.enhancement === 'suggested' && (
                <button className="btn-link" onClick={() => enhance(p.id)}>
                  Améliorer la lumière (IA)
                </button>
              )}
              {p.enhancement === 'applied' && <span className="hero-badge">Améliorée</span>}
              <button className="btn-link btn-link-danger" onClick={() => remove(p.id)}>
                Supprimer
              </button>
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
