import { useState } from 'react';
import { Screen } from '../components/Screen';
import type { ContentField } from '../types';

const STATUS_LABEL: Record<ContentField['status'], string> = {
  pending: '',
  accepted: 'Version IA acceptée',
  edited: 'Votre version enregistrée',
  kept: 'Original conservé',
};

export function StepContent({
  fields,
  onDone,
  onBack,
}: {
  fields: ContentField[];
  onDone: (fields: ContentField[]) => void;
  onBack?: () => void;
}) {
  const [items, setItems] = useState(fields);
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const field = items[index];
  const isLast = index === items.length - 1;
  const rightLabel = field.status === 'edited' ? 'Votre version' : "Version améliorée par l'IA";
  const rightText = field.status === 'edited' && field.editedValue ? field.editedValue : field.improved;

  function apply(status: ContentField['status'], editedValue?: string) {
    const next = items.map((f, i) => (i === index ? { ...f, status, editedValue } : f));
    setItems(next);
    setEditing(false);
    if (isLast) onDone(next);
    else setIndex(index + 1);
  }

  function back() {
    setEditing(false);
    if (index > 0) setIndex(index - 1);
    else onBack?.();
  }

  return (
    <Screen
      eyebrow={`Étape 6 sur 11 — ${index + 1}/${items.length}`}
      title={field.label}
      subtitle="L'IA a amélioré ce texte à partir de ce qu'elle a trouvé. Vous décidez."
      onBack={onBack ? back : undefined}
      footer={
        editing ? (
          <div className="edit-actions">
            <button className="btn-secondary" onClick={() => setEditing(false)}>
              Annuler
            </button>
            <button className="btn-primary" onClick={() => apply('edited', draft)}>
              Enregistrer
            </button>
          </div>
        ) : (
          <div className="content-actions">
            <button className="btn-secondary" onClick={() => apply('kept')}>
              Garder l'original
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setDraft(field.status === 'edited' && field.editedValue ? field.editedValue : field.improved);
                setEditing(true);
              }}
            >
              Modifier
            </button>
            <button className="btn-primary" onClick={() => apply('accepted')}>
              Accepter
            </button>
          </div>
        )
      }
    >
      {editing ? (
        <textarea className="text-area" value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} />
      ) : (
        <>
          {field.status !== 'pending' && (
            <p className="hint">✓ {STATUS_LABEL[field.status]} — vous pouvez encore changer d'avis ci-dessous.</p>
          )}
          <div className="content-compare">
            <div className={`content-block ${field.status === 'kept' ? 'content-block-chosen' : ''}`}>
              <div className="content-block-label">Version actuelle</div>
              <p>{field.current || <em>(vide)</em>}</p>
            </div>
            <div
              className={`content-block content-block-improved ${
                field.status === 'accepted' || field.status === 'edited' ? 'content-block-chosen' : ''
              }`}
            >
              <div className="content-block-label">{rightLabel}</div>
              <p>{rightText}</p>
            </div>
          </div>
        </>
      )}
    </Screen>
  );
}
