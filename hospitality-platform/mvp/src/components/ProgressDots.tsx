export function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="progress-dots" aria-label={`Step ${step + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i <= step ? 'dot dot-done' : 'dot'} />
      ))}
    </div>
  );
}
