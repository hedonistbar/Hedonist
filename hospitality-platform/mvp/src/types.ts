// Property Graph types — mirrors hospitality-platform/SPEC.md §5.
// Every fact carries where it came from and how sure we are of it, so the
// AI layer and the UI can never present a guess as a confirmed fact.

export type Source = {
  name: string;
  url?: string;
  fetchedAt: string;
};

export type SourcedField<T> = {
  value: T;
  sources: Source[];
  confidence: number; // 0..1
  lastChecked: string;
  confirmedByOwner: boolean;
  conflictsWith?: { value: T; sources: Source[] }[];
};

export function sourced<T>(
  value: T,
  sources: Source[],
  confidence: number,
  conflictsWith?: { value: T; sources: Source[] }[],
): SourcedField<T> {
  return {
    value,
    sources,
    confidence,
    lastChecked: '2026-08-27T09:00:00Z',
    confirmedByOwner: false,
    conflictsWith,
  };
}

export type Candidate = {
  id: string;
  name: string;
  address: string;
  city: string;
  type: string;
  photoUrl: string;
  googleRating?: number;
  bookingRating?: number;
};

export type DigitalScoreBreakdown = {
  googleBusiness: number;
  booking: number;
  website: number;
  photos: number;
  reviews: number;
  directBooking: number;
  social: number;
};

export type ContentField = {
  key: string;
  label: string;
  current: string;
  improved: string;
  status: 'pending' | 'accepted' | 'edited' | 'kept';
  editedValue?: string;
  // True when nothing was discovered for this field at all — there is no
  // "current" to compare against, so the UI should offer a plain writing
  // prompt instead of a current-vs-improved comparison.
  isBlank?: boolean;
};

export type PhotoGroup = 'exterior' | 'room' | 'breakfast' | 'common';

export type PhotoAsset = {
  id: string;
  url: string;
  label: string;
  group: PhotoGroup;
  qualityScore: number; // 0..100
  isHero: boolean;
  isDuplicate?: boolean;
  enhancement?: 'none' | 'suggested' | 'applied';
};

export type ReviewInsight = {
  source: string;
  rating: number;
  count: number;
};

export type OperationalTheme = {
  label: string;
  mentions: number;
  sentiment: 'positive' | 'negative';
};

export type PropertyGraph = {
  identity: {
    name: SourcedField<string>;
    type: SourcedField<string>;
  };
  location: {
    address: SourcedField<string>;
    city: string;
    country: string;
  };
  contacts: {
    phone: SourcedField<string>;
    email: SourcedField<string>;
    website: SourcedField<string | null>;
  };
  accommodation: {
    roomCount: SourcedField<number>;
  };
  amenities: SourcedField<string>[];
  foodAndBeverage: {
    breakfast: SourcedField<string>;
  };
  policies: {
    checkIn: SourcedField<string>;
    checkOut: SourcedField<string>;
    languages: SourcedField<string[]>;
  };
  descriptions: {
    short: ContentField;
    long: ContentField;
    seo: ContentField;
    nearby: ContentField;
  };
  reviews: ReviewInsight[];
  operationalThemes: OperationalTheme[];
  listings: { name: string; url: string; matched: boolean }[];
  photos: PhotoAsset[];
};

export type WebsiteStyle = 'classic' | 'modern' | 'nature';
