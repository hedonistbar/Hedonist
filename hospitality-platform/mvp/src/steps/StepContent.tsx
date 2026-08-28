import { useState } from 'react';
import { Screen } from '../components/Screen';
import type { ContentField } from '../types';

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
                setDraft(field.improved);
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
        <div className="content-compare">
          <div className="content-block">
            <div className="content-block-label">Version actuelle</div>
            <p>{field.current || <em>(vide)</em>}</p>
          </div>
          <div className="content-block content-block-improved">
            <div className="content-block-label">Version améliorée par l'IA</div>
            <p>{field.improved}</p>
          </div>
        </div>
      )}
    </Screen>
  );
}
