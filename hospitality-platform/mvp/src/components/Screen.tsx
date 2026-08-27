import type { ReactNode } from 'react';

export function Screen({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="screen">
      <div className="screen-body">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
        {children}
      </div>
      <div className="screen-footer">{footer}</div>
    </div>
  );
}
