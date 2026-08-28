import { useMemo, useState } from 'react';
import { ProgressDots } from './components/ProgressDots';
import { buildPropertyGraph, computeAutoFillPercentage, searchCandidates } from './data/mockDiscovery';
import { StepBooking } from './steps/StepBooking';
import { StepCandidates } from './steps/StepCandidates';
import { StepCity } from './steps/StepCity';
import { StepConflicts } from './steps/StepConflicts';
import { StepContent } from './steps/StepContent';
import { StepDigitalScore } from './steps/StepDigitalScore';
import { StepDiscovering } from './steps/StepDiscovering';
import { StepPhotos } from './steps/StepPhotos';
import { StepPreview } from './steps/StepPreview';
import { StepPropertyName } from './steps/StepPropertyName';
import { StepPublish } from './steps/StepPublish';
import { StepStyle } from './steps/StepStyle';
import type { Candidate, ContentField, DigitalScoreBreakdown, PhotoAsset, PropertyGraph, WebsiteStyle } from './types';

type Step =
  | 'name'
  | 'city'
  | 'discovering'
  | 'candidates'
  | 'score'
  | 'conflicts'
  | 'content'
  | 'photos'
  | 'style'
  | 'booking'
  | 'preview'
  | 'publish';

const STEP_ORDER: Step[] = [
  'name', 'city', 'discovering', 'candidates', 'score', 'conflicts',
  'content', 'photos', 'style', 'booking', 'preview', 'publish',
];

// A fixed demo audit — in production this is computed from Property Graph
// field coverage/confidence per hospitality-platform/SPEC.md §17, not
// hand-set. Kept static here so the "what does the score even mean" story
// is legible without wiring a live scoring function for the prototype.
const DEMO_SCORES: DigitalScoreBreakdown = {
  googleBusiness: 82,
  booking: 71,
  website: 0,
  photos: 58,
  reviews: 84,
  directBooking: 0,
  social: 34,
};

export default function App() {
  const [step, setStep] = useState<Step>('name');
  const [propertyName, setPropertyName] = useState('');
  const [city, setCity] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [graph, setGraph] = useState<PropertyGraph | null>(null);
  const [checkIn, setCheckIn] = useState('');
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [style, setStyle] = useState<WebsiteStyle>('classic');
  const [bookingMode, setBookingMode] = useState<'existing' | 'direct' | null>(null);
  const [bookingUrl, setBookingUrl] = useState('');

  const autoFillPercentage = useMemo(() => (graph ? computeAutoFillPercentage(graph) : 0), [graph]);
  const stepIndex = STEP_ORDER.indexOf(step);

  function back() {
    let prevIndex = stepIndex - 1;
    // 'discovering' auto-advances on its own — there's nothing to sit on
    // when arriving at it backwards, so skip straight past it.
    if (STEP_ORDER[prevIndex] === 'discovering') prevIndex -= 1;
    if (prevIndex < 0) return;
    setStep(STEP_ORDER[prevIndex]);
  }

  function selectCandidate(c: Candidate) {
    const g = buildPropertyGraph(c);
    setGraph(g);
    setCheckIn(g.policies.checkIn.value);
    setPhotos(g.photos);
    setStep('score');
  }

  function applyContent(fields: ContentField[]) {
    if (!graph) return;
    setGraph({
      ...graph,
      descriptions: {
        short: fields.find((f) => f.key === 'short')!,
        long: fields.find((f) => f.key === 'long')!,
        seo: fields.find((f) => f.key === 'seo')!,
        nearby: fields.find((f) => f.key === 'nearby')!,
      },
    });
    setStep('photos');
  }

  function restart() {
    setStep('name');
    setPropertyName('');
    setCity('');
    setCandidates([]);
    setGraph(null);
    setCheckIn('');
    setPhotos([]);
    setStyle('classic');
    setBookingMode(null);
    setBookingUrl('');
  }

  return (
    <div className="app-shell">
      {step !== 'discovering' && <ProgressDots step={stepIndex} total={STEP_ORDER.length} />}

      {step === 'name' && (
        <StepPropertyName
          value={propertyName}
          onNext={(name) => {
            setPropertyName(name);
            setStep('city');
          }}
        />
      )}

      {step === 'city' && (
        <StepCity
          propertyName={propertyName}
          value={city}
          onSearch={(c) => {
            setCity(c);
            setCandidates(searchCandidates(propertyName, c));
            setStep('discovering');
          }}
          onBack={back}
        />
      )}

      {step === 'discovering' && <StepDiscovering onDone={() => setStep('candidates')} />}

      {step === 'candidates' && (
        <StepCandidates candidates={candidates} onConfirm={selectCandidate} onBack={back} />
      )}

      {step === 'score' && graph && (
        <StepDigitalScore
          scores={DEMO_SCORES}
          autoFillPercentage={autoFillPercentage}
          onNext={() => setStep('conflicts')}
          onBack={back}
        />
      )}

      {step === 'conflicts' && graph && (
        <StepConflicts
          graph={graph}
          currentValue={checkIn}
          onResolve={(value) => {
            setCheckIn(value);
            setStep('content');
          }}
          onBack={back}
        />
      )}

      {step === 'content' && graph && (
        <StepContent
          fields={[graph.descriptions.short, graph.descriptions.long, graph.descriptions.seo, graph.descriptions.nearby]}
          onDone={applyContent}
          onBack={back}
        />
      )}

      {step === 'photos' && (
        <StepPhotos photos={photos} onNext={(p) => { setPhotos(p); setStep('style'); }} onBack={back} />
      )}

      {step === 'style' && (
        <StepStyle selected={style} onSelect={(s) => { setStyle(s); setStep('booking'); }} onBack={back} />
      )}

      {step === 'booking' && (
        <StepBooking
          initialMode={bookingMode}
          initialUrl={bookingUrl}
          onNext={(mode, url) => {
            setBookingMode(mode);
            setBookingUrl(url ?? '');
            setStep('preview');
          }}
          onBack={back}
        />
      )}

      {step === 'preview' && graph && (
        <StepPreview
          graph={graph}
          style={style}
          checkIn={checkIn}
          photos={photos}
          onNext={() => setStep('publish')}
          onBack={back}
        />
      )}

      {step === 'publish' && (
        <StepPublish autoFillPercentage={autoFillPercentage} onRestart={restart} onBack={back} />
      )}
    </div>
  );
}
