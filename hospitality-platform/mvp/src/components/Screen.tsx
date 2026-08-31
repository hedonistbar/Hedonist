import type { ReactNode } from 'react';

export function Screen({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  onBack,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer: ReactNode;
  onBack?: () => void;
}) {
  return (
    <div className="screen">
      <div className="screen-body">
        {onBack && (
          <button className="btn-link back-link" onClick={onBack}>
            ← Retour
          </button>
        )}
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
        {children}
      </div>
      <div className="screen-footer">{footer}</div>
    </div>
  );
}
