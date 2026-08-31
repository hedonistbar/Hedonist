// Mocked Discovery Engine output.
//
// The demo property ("Maison Sereine", Langres) is a fictional composite,
// not a real business — see mvp/README.md for why. Its shape (fields,
// sources, confidence, conflicts) is deliberately realistic: this is what a
// real run against Google Places, Booking.com, and a property's Instagram
// would produce, per hospitality-platform/SPEC.md §5-6. Swapping this
// module for a real Discovery Engine call is the only change needed to go
// from prototype to live product — every screen after Step 2 reads only
// from `PropertyGraph`.

import type { Candidate, PropertyGraph } from '../types';
import { sourced } from '../types';
import { placeholderImage } from './placeholderImage';

const GOOGLE = { name: 'Google Business Profile', url: 'https://maps.google.com', fetchedAt: '2026-08-27T08:55:00Z' };
const BOOKING = { name: 'Booking.com', url: 'https://booking.com', fetchedAt: '2026-08-27T08:56:00Z' };
const SITE = { name: 'Official website', url: 'https://maison-sereine.example', fetchedAt: '2026-08-27T08:57:00Z' };
const INSTA = { name: 'Instagram', url: 'https://instagram.com/maisonsereine', fetchedAt: '2026-08-27T08:58:00Z' };
const TRIPADVISOR = { name: 'Tripadvisor', url: 'https://tripadvisor.com', fetchedAt: '2026-08-27T08:59:00Z' };

export function searchCandidates(name: string, city: string): Candidate[] {
  const normalized = name.trim().toLowerCase();
  if (normalized.length === 0) return [];
  // In production this fans out to Google Places / OSM Overpass (see
  // RESEARCH.md §3) and runs entity resolution (Splink + LLM) across the
  // results. Here it returns one strong match plus one decoy, to exercise
  // the "not quite — show more candidates" path in the UI.
  return [
    {
      id: 'maison-sereine',
      name: `Maison ${cap(name)}`,
      address: `4 rue des Fossés, ${cap(city) || 'Langres'}`,
      city: cap(city) || 'Langres',
      type: "Chambre d'hôtes",
      photoUrl: placeholderImage('Maison Sereine', '#6b5b4a'),
      googleRating: 4.7,
      bookingRating: 8.9,
    },
    {
      id: 'decoy',
      name: `${cap(name)} — annexe`,
      address: `Zone artisanale, ${cap(city) || 'Langres'}`,
      city: cap(city) || 'Langres',
      type: 'Hôtel',
      photoUrl: placeholderImage('Autre résultat', '#8a8a8a'),
      googleRating: 3.9,
    },
  ];
}

function cap(s: string): string {
  const t = s.trim();
  return t.length ? t[0].toUpperCase() + t.slice(1) : t;
}

export function buildPropertyGraph(candidate: Candidate): PropertyGraph {
  return {
    identity: {
      name: sourced(candidate.name, [GOOGLE, BOOKING], 0.97),
      type: sourced(candidate.type, [GOOGLE], 0.8),
    },
    location: {
      address: sourced(candidate.address, [GOOGLE, BOOKING, SITE], 0.95),
      city: candidate.city,
      country: 'France',
    },
    contacts: {
      phone: sourced('+33 3 25 87 12 34', [GOOGLE, BOOKING], 0.9),
      email: sourced('contact@maison-sereine.example', [SITE], 0.35),
      website: sourced<string | null>('https://maison-sereine.example', [SITE], 0.6),
    },
    accommodation: {
      roomCount: sourced(5, [BOOKING], 0.85),
    },
    amenities: [
      sourced('Parking privé', [GOOGLE], 0.8),
      sourced('Wi-Fi gratuit', [BOOKING], 0.9),
      sourced('Jardin', [SITE, INSTA], 0.75),
      sourced('Animaux acceptés', [BOOKING], 0.6),
    ],
    foodAndBeverage: {
      breakfast: sourced('Petit-déjeuner maison inclus', [BOOKING, SITE], 0.8),
    },
    policies: {
      checkIn: sourced(
        '15:00',
        [BOOKING],
        0.55,
        [{ value: '16:00', sources: [GOOGLE] }],
      ),
      checkOut: sourced('11:00', [GOOGLE, BOOKING], 0.9),
      languages: sourced(['Français', 'Anglais'], [SITE], 0.7),
    },
    descriptions: {
      short: {
        key: 'short',
        label: 'Description courte',
        current: 'Chambre d\'hôtes à Langres. 5 chambres. Petit-déjeuner inclus.',
        improved:
          "Une maison de caractère au cœur de Langres, cité fortifiée de Haute-Marne — 5 chambres chaleureuses et un petit-déjeuner fait maison servi face aux remparts.",
        status: 'pending',
      },
      long: {
        key: 'long',
        label: 'Description longue',
        current:
          "Maison Sereine propose 5 chambres. Wi-Fi gratuit. Parking. Jardin. Petit-déjeuner inclus. Animaux acceptés.",
        improved:
          "Nichée dans une ruelle calme à deux pas des remparts de Langres, Maison Sereine accueille ses hôtes dans 5 chambres au charme discret, chacune pensée pour le repos après une journée à arpenter la cité fortifiée. Le matin commence par un petit-déjeuner fait maison, servi dans le jardin dès les beaux jours. Wi-Fi, parking privé et compagnons à quatre pattes sont les bienvenus.",
        status: 'pending',
      },
      seo: {
        key: 'seo',
        label: 'Méta-description (SEO)',
        current: '',
        improved:
          "Chambre d'hôtes à Langres (Haute-Marne) — 5 chambres, petit-déjeuner maison, jardin, parking privé. Réservation directe.",
        status: 'pending',
      },
      nearby: {
        key: 'nearby',
        label: 'À proximité',
        current: '',
        improved:
          "À 5 minutes à pied des remparts de Langres et de la maison natale de Diderot ; 10 minutes du lac de la Liez pour les activités nautiques en été.",
        status: 'pending',
      },
    },
    reviews: [
      { source: 'Google', rating: 4.7, count: 62 },
      { source: 'Booking.com', rating: 8.9, count: 134 },
      { source: 'Tripadvisor', rating: 4.5, count: 28 },
    ],
    operationalThemes: [
      { label: 'Accueil chaleureux des hôtes', mentions: 41, sentiment: 'positive' },
      { label: 'Emplacement / proximité des remparts', mentions: 27, sentiment: 'positive' },
      { label: 'Confusion sur le stationnement', mentions: 6, sentiment: 'negative' },
      { label: 'Bruit de rue le matin', mentions: 4, sentiment: 'negative' },
    ],
    listings: [
      { name: 'Google Business Profile', url: GOOGLE.url!, matched: true },
      { name: 'Booking.com', url: BOOKING.url!, matched: true },
      { name: 'Instagram', url: INSTA.url!, matched: true },
      { name: 'Tripadvisor', url: TRIPADVISOR.url!, matched: true },
      { name: 'Site officiel', url: SITE.url!, matched: false },
    ],
    photos: [
      { id: 'p1', url: placeholderImage('Façade', '#6b5b4a'), label: 'Façade sur rue', group: 'exterior', qualityScore: 82, isHero: true, enhancement: 'none' },
      { id: 'p2', url: placeholderImage('Chambre 1', '#a3866b'), label: 'Chambre "Remparts"', group: 'room', qualityScore: 58, isHero: false, enhancement: 'suggested' },
      { id: 'p3', url: placeholderImage('Chambre 1 (dup)', '#a3866b'), label: 'Chambre "Remparts" (doublon probable)', group: 'room', qualityScore: 55, isHero: false, isDuplicate: true, enhancement: 'none' },
      { id: 'p4', url: placeholderImage('Petit-déjeuner', '#c9a24b'), label: 'Table du petit-déjeuner', group: 'breakfast', qualityScore: 74, isHero: false, enhancement: 'none' },
      { id: 'p5', url: placeholderImage('Jardin', '#5c8a5c'), label: 'Jardin', group: 'common', qualityScore: 39, isHero: false, enhancement: 'suggested' },
    ],
  };
}

// For a property with no discoverable online footprint at all — the
// "aucun de ces résultats, mon établissement est nouveau" path. Nothing is
// invented here: every SourcedField starts at confidence 0 with no
// sources, and the content fields carry a writing prompt instead of a
// fabricated AI example, since there is nothing real to base one on.
export function buildBlankPropertyGraph(name: string, city: string): PropertyGraph {
  const blank = <T,>(value: T) => sourced(value, [], 0);
  const blankField = (key: string, label: string, prompt: string) => ({
    key,
    label,
    current: '',
    improved: prompt,
    status: 'pending' as const,
    isBlank: true,
  });

  return {
    identity: {
      name: blank(cap(name)),
      type: blank(''),
    },
    location: {
      address: blank(''),
      city: cap(city),
      country: 'France',
    },
    contacts: {
      phone: blank(''),
      email: blank(''),
      website: blank<string | null>(null),
    },
    accommodation: {
      roomCount: blank(0),
    },
    amenities: [],
    foodAndBeverage: {
      breakfast: blank(''),
    },
    policies: {
      checkIn: blank(''),
      checkOut: blank(''),
      languages: blank([] as string[]),
    },
    descriptions: {
      short: blankField(
        'short',
        'Description courte',
        "Décrivez votre établissement en une phrase : ambiance, ce qui vous rend unique.",
      ),
      long: blankField(
        'long',
        'Description longue',
        "Racontez votre établissement : les chambres, ce qu'on y trouve, l'atmosphère, ce que vos hôtes remarquent en premier.",
      ),
      seo: blankField(
        'seo',
        'Méta-description (SEO)',
        "Résumez votre établissement et sa ville en une phrase pour Google — c'est ce que verront les visiteurs dans les résultats de recherche.",
      ),
      nearby: blankField(
        'nearby',
        'À proximité',
        "Qu'y a-t-il à voir ou à faire à proximité ? Sites, restaurants, activités.",
      ),
    },
    reviews: [],
    operationalThemes: [],
    listings: [],
    photos: [],
  };
}

export function computeAutoFillPercentage(graph: PropertyGraph): number {
  const fields: { confidence: number }[] = [
    graph.identity.name,
    graph.identity.type,
    graph.location.address,
    graph.contacts.phone,
    graph.contacts.email,
    graph.contacts.website,
    graph.accommodation.roomCount,
    graph.foodAndBeverage.breakfast,
    graph.policies.checkIn,
    graph.policies.checkOut,
    graph.policies.languages,
    ...graph.amenities,
  ];
  const filled = fields.filter((f) => f.confidence >= 0.5).length;
  return Math.round((filled / fields.length) * 100);
}
