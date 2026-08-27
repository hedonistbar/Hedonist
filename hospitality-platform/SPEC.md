# Техническое задание: AI Digital Onboarding & Presence Platform for Independent Hospitality

Версия 0.1 (черновик архитектуры и MVP-объём). Отдельный продукт от Hedonist
AI-marketer (`../SPEC.md`) — общего у них только репозиторий на этом этапе и,
возможно, часть инфраструктуры (Supabase, Claude API, TypeScript). Разная
целевая аудитория, разная бизнес-модель, разный жизненный цикл.

---

## 1. Что это и зачем

Продукт для владельцев небольших независимых hospitality-объектов:
chambres d'hôtes, gîtes, maisons d'hôtes, небольших независимых отелей,
небольших ресторанов, table d'hôtes и похожих малых объектов — в первую
очередь во Франции.

Целевой пользователь **не разбирается в digital** и не хочет разбираться в
SaaS, CMS, PMS, SEO, Google Business, Booking.com, API, channel managers,
website builders. Он хочет, чтобы объект был виден в интернете и принимал
брони — и всё.

Продуктовая формула:

> Tell us which property is yours. We do the digital work.

Главный продуктовый принцип (пронизывает весь onboarding, весь UX, весь
data-слой):

> **Never ask the owner for information the system can find itself.**

Пользователь начинает с двух полей — **название объекта** и **город** — и
дальше система (Discovery Engine + AI Layer) самостоятельно находит,
сопоставляет, нормализует и оценивает максимум доступной публичной
информации, прежде чем задать хотя бы один следующий вопрос.

Это **не**:
- ещё один PMS;
- ещё один channel manager;
- ещё один website builder;
- ещё одно маркетинговое агентство;
- ещё один AI copywriter.

Это — AI Digital Onboarding and Presence Platform: слой, который находит
цифровой след объекта, приводит его в порядок, улучшает и затем поддерживает
в согласованном виде во времени.

---

## 2. Отношение к Hedonist AI-marketer (Restomarq)

Этот продукт живёт в том же репозитории (`hospitality-platform/`), но это
**отдельный продукт** с отдельным жизненным циклом:

| | Hedonist AI-marketer (`app/`, `src/`) | Hospitality Onboarding Platform (`hospitality-platform/`) |
|---|---|---|
| Аудитория | Уже digital-грамотные рестораторы с налаженным Instagram/FB | Владельцы малых объектов без digital-присутствия вообще |
| Job to be done | Ежедневный SMM/маркетинг вместо владельца | Найти/собрать/улучшить цифровое присутствие и запустить сайт+бронирование с нуля |
| Точка входа | Уже есть бренд-контекст, Google Drive с фото | Два поля: название + город |
| Основной артефакт | Поток контента в соцсети | Canonical Property Graph + сгенерированный сайт + booking |
| Стадия жизни клиента | Operate | Onboard → Present → Maintain |

Общие переиспользуемые слои (по мере готовности): Supabase-проект (отдельные
схемы/таблицы, **не** переиспользовать таблицы `restaurants`/`content_items`
Hedonist — это разные предметные области), Claude API как AI-провайдер,
общие практики (`стоп-кран`-подобный kill switch для автопубликаций).

---

## 3. Позиционирование и антипаттерны

Не показывать пользователю то, что имеет смысл только для digital-грамотного
человека:

- НЕ API settings, JSON, webhooks;
- НЕ SEO-терминология («meta description», «NAP consistency», «schema
  markup»);
- НЕ сложная аналитика/дашборды в духе GA4;
- НЕ developer settings;
- НЕ длинная форма из десятков полей на входе.

Каждый экран — **один понятный вопрос или одно действие**. Технический
смысл поля всегда переводится в бытовой:

| Технически | Показать владельцу |
|---|---|
| `SEO meta description missing` | «Google недостаточно понимает, чем ваш объект отличается от других. Исправить?» |
| `NAP inconsistency detected` | «На Booking и Google указан разный телефон. Какой правильный?» |

---

## 4. Onboarding flow (MVP)

```
Step 1 — Property name
Step 2 — City
        ↓ Discovery Engine (async, с индикатором прогресса)
Step 3 — "Мы нашли ваш объект. Это он?"
         показать: название, адрес, фото, Google rating, Booking rating, тип объекта
         [Yes, this is my property]  [Not quite — show more candidates]  [I'll enter manually]
Step 4 — Digital Audit (Digital Score)
         Google Business 82/100 · Booking 71/100 · Website 0/100
         Photos 58/100 · Reviews 84/100 · Direct booking 0/100 · Social 34/100
         Overall Digital Score: 55/100
Step 5 — Information review — ТОЛЬКО конфликты и пробелы
         "Google: check-in 16:00 — Booking: check-in 15:00 — какое верное?"
Step 6 — AI Content Improvement (по одному тексту за раз)
         Current version / Improved version → Accept / Edit / Keep original
Step 7 — Photos — сбор, дедупликация, оценка качества, группировка, hero images,
         порядок; AI enhancement (свет/экспозиция/баланс белого/шум/резкость/
         кадрирование) — НЕ генерация контента
Step 8 — Website style (Classic / Modern / Nature) → генерация сайта
Step 9 — Booking connect (существующий booking engine ИЛИ наш direct booking)
Step 10 — Preview
Step 11 — Publish
```

Правило: если на шаге N система не уверена (нет данных, конфликт
источников, низкий confidence) — задаётся **один** простой вопрос, а не
форма. Если данные есть и уверенность высокая — шаг пропускается молча.

---

## 5. Digital Identity / Property Graph

Центральный собственный модуль (moat #1). Единый canonical-профиль объекта.
Каждое **поле**, а не только объект целиком, хранит происхождение и
уверенность — это то, что не даёт AI выдавать найденное за факт без
основания.

```ts
type SourcedField<T> = {
  value: T;
  sources: { name: string; url?: string; fetchedAt: string }[];
  confidence: number;      // 0..1, агрегированная по числу и надёжности источников
  lastChecked: string;     // ISO datetime
  confirmedByOwner: boolean;
  conflictsWith?: SourcedField<T>[]; // альтернативные значения из др. источников
};

type PropertyGraph = {
  identity: { name: SourcedField<string>; type: SourcedField<PropertyType> };
  location: { address, city, postalCode, country, lat, lng, nearbyAttractions[] };
  contacts: { phone, email, website };
  accommodation: { roomCount, roomTypes[] };
  rooms: RoomProfile[];
  amenities: SourcedField<string>[]; // pool, spa, parking, pets, wifi, ...
  foodAndBeverage: { breakfast, restaurant, tableDHotes };
  policies: { checkIn, checkOut, cancellation, petPolicy, languages[] };
  images: ImageAsset[];
  descriptions: { short, long, seo, perRoom[] } // current + AI-improved
  reviews: ReviewAggregate;
  listings: ListingRef[];       // Google, Booking, Airbnb, Expedia, Tripadvisor, ...
  bookingChannels: BookingChannelRef[];
  socialAccounts: SocialRef[];
  website: { style, sections[], publishedUrl, languages[] };
};
```

Property Graph — источник истины для сайта, дашборда и AI-слоя. Никакое
поле не подставляется в публичный сайт без прохождения через
`confidence`-порог **или** явного `confirmedByOwner`.

---

## 6. Discovery Engine

Главная собственная технология (moat #2: **zero-form onboarding**).

**Input:** `{ propertyName, city, country? }`

**Pipeline:**

1. **Candidate search** — параллельные запросы к доступным источникам
   (см. §10 и `RESEARCH.md`): geodata/business search (Google Places API —
   платный, наиболее полный; OSM Overpass как fallback/дополнение),
   Booking.com/Airbnb/Tripadvisor — через партнёрские/официальные API, где
   доступны, иначе — через управляемые агрегаторы данных (не через
   неавторизованный скрейпинг чужих ToS-защищённых страниц в проде — юридический
   риск, отдельное решение по каждому источнику).
2. **Entity resolution** — разные листинги (Google Maps, Booking, Instagram,
   официальный сайт) должны быть распознаны как один физический объект.
   Кандидат на реализацию: вероятностное сопоставление по (нормализованное
   имя + адрес/координаты + телефон) — см. Splink/dedupe в `RESEARCH.md`,
   поверх — LLM-верификация неоднозначных случаев.
3. **Extraction** — структурирование данных каждого источника в поля
   Property Graph.
4. **Normalization** — единый формат (время в 24h, телефон в E.164, адрес по
   единой схеме).
5. **Conflict detection** — сравнение значений одного поля из разных
   источников, пометка расхождений для Step 5.
6. **Confidence scoring** — функция от (число источников, согласованность,
   надёжность источника, свежесть).

Discovery Engine должен работать **и без API-ключей от объекта** — оператор
никогда не логинится в свой Booking/Google аккаунт на этом этапе (это делает
онбординг небезопасным и медленным). Все данные первого прохода — публичные.

---

## 7. AI Layer

Функции (все — вызовы Claude API с типизированным output, echo источников в
промпте, никогда — «додумывание» фактов):

- **Entity resolution** (спорные случаи после алгоритмического matching);
- **Extraction** (из HTML/API-ответов в структурированные поля);
- **Normalization**;
- **Conflict detection** (объяснение конфликта человеку простыми словами);
- **Content improvement** (переписывание описаний, room descriptions,
  breakfast/restaurant descriptions, nearby attractions, FAQ, SEO-метаданные)
  — всегда в режиме current vs improved, никогда auto-apply;
- **Translation** (FR ⇄ EN на MVP; DE/ES/IT/NL позже);
- **SEO structure generation** (заголовки, meta, Schema.org, OpenGraph);
- **Review intelligence** (классификация, sentiment, повторяющиеся
  операционные проблемы, черновики ответов — не просто «generate reply», а
  «за 90 дней 7 гостей жаловались на шум»).

Правило anti-hallucination: любой факт, который AI выводит в UI или на сайт,
обязан ссылаться на `SourcedField` с `confidence` выше порога **или** быть
явно помечен как предложение AI, ожидающее подтверждения владельца.

---

## 8. Photos

Пайплайн: сбор (из найденных листингов + upload владельца) → дедупликация →
оценка качества (резкость/освещение/композиция) → группировка по
комнатам/зонам → выбор hero images → предложение порядка.

**AI enhancement разрешён только для:** света, экспозиции, баланса белого,
шумоподавления, лёгкой резкости, перспективы, кадрирования.

**Запрещено безусловно:** добавлять мебель, увеличивать помещения, менять
вид из окна, добавлять бассейн, менять интерьер, скрывать реальные
недостатки.

Принцип: **Enhance reality, do not invent reality.** Технически это
означает: только классические / диффузионные denoise-модели с ограниченной
силой эффекта на пиксельном уровне, никогда — генеративная замена контента
кадра (inpainting/outpainting запрещены в этом модуле).

---

## 9. Website generation

Владелец не проектирует сайт — выбирает один из стилей (**Classic** —
château/maison d'hôtes, **Modern** — boutique hotel, **Nature** —
gîte/countryside). Система собирает секции: Home, Rooms, Gallery, Amenities,
Breakfast/Restaurant, Experiences, Things to do nearby, Reviews, Contact,
FAQ, Policies, Booking page.

Автоматически: SEO title/meta, Schema.org (`LodgingBusiness`/`Hotel`/
`Restaurant`), OpenGraph, mobile layout, multilingual structure (FR/EN на
MVP).

Технически — статическая генерация (SSG) из Property Graph + выбранного
шаблона, не WYSIWYG-конструктор с нуля: владелец не должен иметь возможность
"сломать" сайт вёрсткой, только контентом через Step 5-7.

---

## 10. Booking

**MVP: не писать PMS/booking с нуля.** Два пути, определяются на этапе
Booking connect:

1. **У объекта уже есть booking engine** (Booking.com виджет, Smoobu,
   Amenitiz и т.п.) → встроить существующий виджет/ссылку в
   сгенерированный сайт, без интеграции на уровне данных.
2. **У объекта нет прямого бронирования** → предложить простой direct
   booking engine на базе открытого PMS-слоя (см. `RESEARCH.md` — кандидаты
   и статус проверки лицензии/готовности). Поток: `Search → Quote → Select
   room → Guest details → Payment/deposit → Confirm`.

Будущие интеграции (после MVP, по запросу): Amenitiz, Smoobu, Mews, Little
Hotelier, SiteMinder, Octorate, Reservit, Guesty, Cloudbeds — как
channel-manager-адаптеры поверх Property Graph, не как замена ему.

---

## 11. Reviews

Агрегация отзывов из доступных источников (Google, Booking, Tripadvisor —
где есть публичный/партнёрский доступ). Дашборд с рейтингами по площадкам.
AI: классификация, sentiment, operational issues, повторяющиеся темы,
предложенные ответы. Пример нужного уровня инсайта:

> За последние 90 дней 7 гостей пожаловались на шум.

не просто «Generate reply».

---

## 12. Restaurant / Table d'hôtes module

Не полноценный POS в MVP. Функции: загрузка меню (фото/PDF), распознавание
структуры (категории/блюда/цены/аллергены), переводы, QR-меню, web-меню,
синхронизация с сайтом. Позже: бронирование стола, Google-меню, соц.
контент, отзывы на блюда.

---

## 13. Digital Presence Management (после запуска)

После публикации сайта продукт превращается в assistant для поддержания
consistency (moat #3: **continuous digital consistency**):

- **Today** — новые отзывы, визиты на сайт, запросы прямого бронирования,
  просмотры Google-профиля;
- **Needs attention** — расхождения между источниками (расписание, цены,
  описание), некачественные фото, потенциально устаревшие часы работы;
- **AI recommends** — конкретные, выполняемые в один клик действия
  («Add parking information», «Answer Google review»).

Никакого «сырого» API/SEO языка в этом слое — см. §3.

---

## 14. MVP boundaries

**В MVP НЕ делаем:** enterprise PMS, сложный channel manager, POS,
housekeeping, payroll, accounting, inventory management, advanced revenue
management, большой CRM.

**MVP должен доказать одну вещь:**

> Может ли недиджитальный владелец ввести только название и город и
> получить почти готовое цифровое присутствие и сайт без ручного
> заполнения?

### Обязательные функции MVP (§15 брифа)

1. Property search 2. Entity identification 3. Data discovery 4. Source
list 5. Confidence scoring 6. Digital Score 7. Owner confirmation
8. AI content improvement 9. Photo collection/upload 10. Photo quality
analysis 11. Website generation 12. Website preview 13. Direct booking
widget 14. Website publish 15. Basic dashboard 16. Review aggregation
17. AI review replies 18. Missing-information alerts.

---

## 15. Архитектура и стек (предложение)

См. `RESEARCH.md` для полной module reuse matrix с лицензиями и рисками.
Итоговое предложение по стеку (согласовано с уже используемым в репозитории
TypeScript/Supabase, чтобы упростить общую инфраструктуру, но с независимым
Supabase-проектом/схемой):

- **Backend/orchestration:** Node.js + TypeScript (как в `src/` Hedonist).
- **Discovery Engine:** отдельный сервис (очередь задач + воркеры),
  дергающий внешние API/источники с rate-limit и кэшированием сырых
  ответов (нужно для conflict detection и повторных проверок).
- **Property Graph store:** Postgres (Supabase) — таблица `property_graph`
  как JSONB с `SourcedField`-обёрткой полей + отдельные таблицы для
  тяжёлых сущностей (`images`, `reviews`, `listings`).
- **AI layer:** Claude API, строго типизированный structured output
  (tool use / JSON schema), с промптом, включающим источники и
  инструкцией никогда не оценивать факт без ссылки на источник.
- **Website generation:** SSG-подход (шаблоны + Property Graph → статические
  страницы), хостинг — статический (аналогично GitHub Pages deploy,
  используемому для `app/`, либо Netlify/Vercel-класс для мультитенантности
  с собственными доменами).
- **Entity resolution:** алгоритмический слой (см. `RESEARCH.md` —
  Splink/dedupe-класс библиотек) + LLM для неоднозначных случаев.
- **Image pipeline:** `sharp` (уже используется в `app/`) для
  кадрирования/масштабирования; отдельные модели для enhancement (см.
  `RESEARCH.md`).
- **Booking (MVP):** встраивание существующего виджета ИЛИ адаптация
  открытого booking-engine слоя — требует отдельного PoC и юридической
  проверки лицензии перед выбором конкретного проекта (см. `RESEARCH.md`,
  раздел inPMS/QloApps).

Что обязательно писать самим (нет зрелых open-source аналогов с подходящей
лицензией):

- Discovery Engine / entity resolution поверх hospitality-специфичных
  источников;
- Property Graph модель (`SourcedField`, confidence scoring, conflict
  detection UX);
- AI Content Improvement и Review Intelligence промпт-слой;
- UX-слой «один вопрос на экран» и Digital Score;
- Website generator, специфичный под hospitality-контент из Property Graph.

---

## 16. Open-source стратегия

Правило перед принятием любого open-source компонента:

1. найти существующий проект;
2. проверить активность (issues/commits за последние 6–12 мес.);
3. проверить лицензию;
4. проверить security (известные CVE, практики релизов);
5. проверить совместимость со стеком (TS/Node предпочтительно, иначе —
   изолируемый сервис за API);
6. использовать только после явной проверки лицензии человеком (юридическое
   решение), не по умолчанию из этого документа.

Предпочтительные лицензии: MIT, Apache-2.0, BSD. Избегать без отдельного
юридического решения: AGPL, GPL для тесно интегрированных proprietary
модулей, OSL (в т.ч. QloApps core — OSL-3.0/AFL-3.0, см. `RESEARCH.md`).

---

## 17. Digital Score — формула (черновик)

Взвешенная сумма по категориям, каждая 0–100:

```
Overall = 0.20·GoogleBusiness + 0.15·BookingListing + 0.20·Website
        + 0.15·Photos + 0.15·Reviews + 0.10·DirectBooking + 0.05·Social
```

Веса — гипотеза для MVP, требуют калибровки на реальных объектах. Каждая
подкатегория считается из заполненности + confidence соответствующих полей
Property Graph, не «с потолка».

---

## 18. Коммерческая модель

- **Setup:** €299–499 разово — digital audit, импорт данных, описания,
  фото, сайт, booking setup.
- **Subscription:** €39–79/мес — hosting, AI monitoring, updates, reviews,
  digital consistency, website maintenance.
- **Done For You:** €149–299/мес — для владельцев, не желающих
  взаимодействовать с системой самостоятельно.

---

## 19. KPI

**Главный KPI MVP:**

> Какой процент профиля объекта система заполняет автоматически до первого
> вопроса пользователю. Цель: **≥ 70%**.

Дополнительные: onboarding completion rate; time to first website preview;
number of manual fields; percentage of sources correctly matched;
direct-booking activation; website publication rate.

---

## 20. Этапы сборки

**Фаза 0 — исследование и архитектура (этот документ + `RESEARCH.md`).**
Не программировать весь продукт сразу — сначала module reuse matrix,
финальная архитектура, решение по booking-слою.

**Фаза 1 — Discovery Engine MVP (полуавтоматический).** Property Graph
модель, ручной/полуавтоматический discovery (часть источников — заглушки/
управляемый импорт), Digital Score, onboarding flow Steps 1–5 кликабельно.

**Фаза 2 — AI Content + Photos.** Content improvement (Step 6), photo
pipeline и enhancement (Step 7, без auto-apply).

**Фаза 3 — Website generation + publish.** Steps 8–11, 2–3 стиля, FR/EN.

**Фаза 4 — Booking connect.** Виджет существующего провайдера ИЛИ PoC на
открытом booking-engine слое.

**Фаза 5 — Digital Presence Management.** Dashboard (§13), review
intelligence, missing-information alerts.

**Фаза 6 (позже) — реальные live-интеграции источников**, доп. языки,
channel-manager адаптеры, restaurant module.

---

## 21. Тестовый сценарий (демонстрация MVP)

Полный клик-through одного вымышленного, но реалистичного объекта (см.
`mvp/README.md` — почему демо-данные не привязаны к реальному
существующему заведению) от `Property name + City` до опубликованного
превью сайта, включая: candidates → confirm → digital score → conflict
resolution → AI content accept/edit → photo review → style pick → generated
site preview → booking stub → publish confirmation.
