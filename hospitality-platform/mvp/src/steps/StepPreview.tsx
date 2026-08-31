import { Screen } from '../components/Screen';
import type { ContentField, PhotoAsset, PropertyGraph, WebsiteStyle } from '../types';

function textFor(field: ContentField): string {
  if (field.status === 'edited' && field.editedValue) return field.editedValue;
  if (field.status === 'kept') return field.current;
  // A skipped blank field has no real content yet — field.improved there is
  // only a writing prompt, never text to publish.
  if (field.isBlank) return '';
  return field.improved;
}

export function StepPreview({
  graph,
  style,
  checkIn,
  photos,
  onNext,
  onBack,
}: {
  graph: PropertyGraph;
  style: WebsiteStyle;
  checkIn: string;
  photos: PhotoAsset[];
  onNext: () => void;
  onBack?: () => void;
}) {
  const hero = photos.find((p) => p.isHero) ?? photos[0];
  const gallery = photos.filter((p) => p.id !== hero?.id);

  return (
    <Screen
      eyebrow="Étape 10 sur 11"
      title="Aperçu de votre site"
      subtitle="Généré automatiquement à partir de vos informations. Rien à mettre en page."
      onBack={onBack}
      footer={
        <button className="btn-primary" onClick={onNext}>
          Tout est bon, continuer
        </button>
      }
    >
      <div className={`site-preview site-preview-${style}`}>
        <div
          className={`site-hero ${!hero ? 'site-hero-empty' : ''}`}
          style={hero ? { backgroundImage: `url(${hero.url})` } : undefined}
        >
          <div className="site-hero-overlay">
            <h2>{graph.identity.name.value}</h2>
            <p>{graph.location.city}, {graph.location.country}</p>
          </div>
        </div>
        {textFor(graph.descriptions.long) && (
          <div className="site-section">
            <p>{textFor(graph.descriptions.long)}</p>
          </div>
        )}
        {graph.amenities.length > 0 && (
          <div className="site-section site-amenities">
            {graph.amenities.map((a) => (
              <span className="amenity-pill" key={a.value}>{a.value}</span>
            ))}
          </div>
        )}
        {gallery.length > 0 && (
          <div className="site-section site-gallery">
            {gallery.map((p) => (
              <img key={p.id} src={p.url} alt={p.label} />
            ))}
          </div>
        )}
        {(checkIn || graph.policies.checkOut.value) && (
          <div className="site-section site-policies">
            {checkIn && <span>Arrivée : {checkIn}</span>}
            {graph.policies.checkOut.value && <span>Départ : {graph.policies.checkOut.value}</span>}
          </div>
        )}
        {textFor(graph.descriptions.nearby) && (
          <div className="site-section site-nearby">
            <h3>À proximité</h3>
            <p>{textFor(graph.descriptions.nearby)}</p>
          </div>
        )}
        <button className="btn-primary site-cta">Réserver</button>
      </div>
    </Screen>
  );
}
