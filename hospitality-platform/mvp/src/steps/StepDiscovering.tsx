import { useEffect, useState } from 'react';

const MESSAGES = [
  'Recherche sur Google...',
  'Recherche sur Booking.com...',
  'Recherche sur Instagram...',
  'Recoupement des informations trouvées...',
];

export function StepDiscovering({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => Math.min(n + 1, MESSAGES.length - 1)), 550);
    const done = setTimeout(onDone, 2400);
    return () => {
      clearInterval(id);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen discovering">
      <div className="spinner" />
      <p className="discovering-message">{MESSAGES[i]}</p>
    </div>
  );
}
