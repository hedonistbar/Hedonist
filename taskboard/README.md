# Ivchenko Hub

Личный таск-менеджер в духе Trello: несколько досок, списки, карточки с
датой выполнения, чек-листами, описанием и вложениями, доступ к доске можно
открыть другому человеку (например, супругу/супруге) по email.

Это отдельный проект от Hedonist AI-marketer в этом репозитории — своя
Supabase-база, свой набор таблиц, ничего общего с рестораном.

## Возможности

- Несколько независимых досок, у каждой свой владелец.
- Списки (колонки) внутри доски, карточки внутри списков.
- Перетаскивание карточек между списками и колонок между собой (drag & drop).
- В карточке: заголовок, описание, дата/время выполнения (жёлтая за день до
  срока, красная в день срока и если просрочена), исполнитель из участников
  доски, чек-лист с прогресс-баром, вложения (любые файлы).
- Push-уведомления: приходят тому, кого назначили на карточку (сразу), и
  всем, у кого срок подходит в течение суток (проверка каждые 15 минут).
  Работает даже когда приложение закрыто — обычный Web Push, «Включить
  уведомления» на экране «Мои доски».
- ✨ ИИ-ассистент внутри каждой карточки (на базе Claude): открывается кнопкой
  «✨ ИИ-ассистент» в карточке — чат с контекстом карточки (заголовок,
  описание, чек-лист, срок), плюс быстрые кнопки «План проекта», «Черновик
  письма», «Чек-лист шагов». Любой ответ можно одним кликом превратить в
  реальный чек-лист, прикрепить как файл к карточке или сделать описанием —
  без слепого автозапуска: вы решаете, что из ответа применить. Один общий
  Anthropic API-ключ на всё приложение — задаётся один раз в настройках
  («✨ ИИ» на экране «Мои доски»), хранится зашифрованным в Vault.
- 📅 Google Calendar (настоящая интеграция, не заглушка): подключите свой
  аккаунт («Google Calendar» в профиле / «📅 Google Calendar» на «Мои доски»)
  — события на ближайшие 14 дней показываются на вкладке «Календарь» рядом с
  задачами, отдельным пунктирным блоком «Из Google Calendar». Требует
  разовой настройки Google Cloud-проекта (см. «Настройка» ниже) — своя
  учётная запись подключается потом одной кнопкой каждым из вас отдельно.
- Фон доски — 7 фирменных градиентов на палитре Pantone 2026 (Cloud Dancer,
  Александрит, Мандарин и др.) или своя фотография («Фон» в шапке доски).
- 🌗/☀️/🌙 переключатель темы (как в системе / светлая / тёмная), запоминается.
- Поделиться доской по email — приглашённый видит и редактирует её наравне
  с владельцем (владелец может убрать участника, участник может уйти сам).
- Живые обновления: изменения от второго человека на той же доске
  подтягиваются автоматически (Supabase Realtime), без перезагрузки страницы.
- Устанавливается как PWA на телефон/десктоп (иконка на главном экране,
  работает в отдельном окне).

## Настройка

Уже настроено — есть готовый Supabase-проект (`taskboard`, регион
eu-central-1), все миграции применены, две Edge Functions (`send-push`,
`due-reminders`) задеплоены, cron на проверку сроков настроен. Ничего
создавать не нужно, можно сразу запускать.

**Кроме ИИ-ассистента** — это единственная часть, которую нужно включить
руками (ключ и внешний вызов трогают деньги, поэтому не активируется сам
по себе):

1. Выполните `migrations/0005_ai_assistant.sql` в SQL Editor Supabase-проекта.
2. Задеплойте `supabase/functions/ai-chat` (Supabase CLI: `supabase functions
   deploy ai-chat`, либо вручную через дашборд — файл один,
   `supabase/functions/ai-chat/index.ts`).
3. Откройте приложение → «Мои доски» → «✨ ИИ» → вставьте свой Anthropic
   API-ключ (console.anthropic.com → API Keys) → «Сохранить». Ключ один на
   всё приложение (и на вас, и на того, с кем поделились доской).

После этого «✨ ИИ-ассистент» в каждой карточке заработает. Использование
API — платное согласно тарифам Anthropic, ключ и его расходы — ваши.

**Свой фон-фото на доске** тоже требует одной ручной миграции — она создаёт
приватный Storage-бакет, поэтому не входит в 0001–0004:

1. Выполните `migrations/0006_board_background_photo.sql` в SQL Editor.

После этого в «Фон доски» появится кнопка «📷 Своё фото».

**Нативные push для iPhone-приложения** (не для PWA — та работает через
обычный Web Push и её отдельно включать не нужно) требуют APNs-ключ, который
можно получить только с платным Apple Developer Program ($99/год):

1. Выполните `migrations/0007_native_push.sql` в SQL Editor.
2. App Store Connect → Certificates, Identifiers & Profiles → Keys → создайте
   ключ с возможностью «Apple Push Notifications service», скачайте `.p8`.
3. Сохраните секреты через Vault (SQL Editor) — `.p8` открывается текстовым
   редактором, вставьте содержимое файла целиком:
   ```sql
   select vault.create_secret('<содержимое .p8 файла>', 'apns_auth_key');
   select vault.create_secret('<Key ID из App Store Connect>', 'apns_key_id');
   select vault.create_secret('<Team ID из App Store Connect>', 'apns_team_id');
   select vault.create_secret('com.ivchenkohub.app', 'apns_bundle_id');
   ```

До этого шага нативное приложение всё равно можно собрать и поставить на
телефон — просто push туда не будет доходить (шлётся молча, без ошибки).

**Google Calendar** — бесплатно (в отличие от Apple), но тоже требует
разовой настройки своего Google Cloud-проекта:

1. Выполните `migrations/0008_google_calendar.sql` в SQL Editor.
2. Задеплойте `supabase/functions/google-calendar-auth` и
   `supabase/functions/google-calendar-events`. Для `google-calendar-auth`
   обязательно выключите проверку JWT (`supabase functions deploy
   google-calendar-auth --no-verify-jwt`, либо через Supabase CLI подтянется
   само из `supabase/config.toml`, либо вручную в дашборде — Edge Functions →
   google-calendar-auth → Details → «Enforce JWT Verification» выключить) —
   иначе не сработает callback от Google, у которого нет вашего JWT.
3. [console.cloud.google.com](https://console.cloud.google.com) → создайте
   проект → APIs & Services → включите **Google Calendar API** → Credentials
   → Create Credentials → OAuth client ID → тип «Web application» → Authorized
   redirect URIs: `<ваш Supabase URL>/functions/v1/google-calendar-auth`.
4. APIs & Services → OAuth consent screen → оставьте статус публикации
   **Testing** и добавьте оба ваших email в «Test users» — так не понадобится
   проходить недельную проверку Google (при 100 тестовых пользователях лимита
   вам за глаза хватит на двоих).
5. Откройте приложение → «Профиль» (или «📅 Google Calendar» на «Мои доски»
   на десктопе) → вставьте Client ID и Client Secret из шага 3 → «Сохранить».
6. Каждый из вас затем жмёт «Подключить Google Calendar» там же — откроется
   стандартное окно согласия Google, после него вернёт обратно в приложение.

После этого события ближайших 14 дней появятся на вкладке «Календарь».

Если захотите пересадить приложение на свой собственный Supabase-проект:

1. Создайте проект на [supabase.com](https://supabase.com), выполните
   `migrations/*.sql` по порядку в SQL Editor.
2. Сгенерируйте пару VAPID-ключей (`npx web-push generate-vapid-keys`) и
   сохраните секреты через Vault (SQL Editor):
   ```sql
   select vault.create_secret('<публичный ключ>', 'vapid_public_key');
   select vault.create_secret('<приватный ключ>', 'vapid_private_key');
   select vault.create_secret('mailto:you@example.com', 'vapid_subject');
   select vault.create_secret('<случайная строка>', 'cron_shared_secret');
   ```
3. Задеплойте `supabase/functions/send-push` и `supabase/functions/due-reminders`
   (`supabase functions deploy` через Supabase CLI, или вручную через дашборд).
4. Пропишите свой публичный VAPID-ключ в `src/lib/push.ts` (`VAPID_PUBLIC_KEY`).
5. Скопируйте `.env.example` в `.env` и заполните `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_PUBLISHABLE_KEY` из Project Settings → API.

## Запуск локально

```bash
cd taskboard
npm install
npm run dev
```

Откройте приложение, зарегистрируйтесь (email + пароль). Дальше можно
создавать доски и работать.

## Как поделиться доской с супругом/супругой

1. Она должна сначала сама зарегистрироваться в приложении (с любым email).
2. На доске нажмите «Поделиться» → введите её email → «Добавить».
3. Доска сразу появится у неё в списке «Мои доски» — изменения обеих сторон
   синхронизируются в реальном времени.

## Тестирование на iPhone вдвоём

Приложение — это PWA, ставится на домашний экран как обычное приложение,
без App Store:

1. На **обоих** iPhone откройте https://hedonistbar.github.io/Hedonist/taskboard/
   в Safari (не Chrome — «Add to Home Screen» есть только у Safari).
2. Кнопка «Поделиться» (квадрат со стрелкой вверх) → **«На экран
   "Домой"»** → «Добавить». Появится иконка — как у настоящего приложения,
   без адресной строки браузера.
3. Каждый человек регистрируется под своей почтой (шаг из раздела выше),
   затем один делится доской со вторым по email.
4. Включите push-уведомления на обоих телефонах («🔔 Включить уведомления»
   на экране «Мои доски») — тогда назначение карточки и приближающиеся
   сроки будут приходить каждому лично.

## Настоящее приложение для iPhone (не PWA)

PWA из раздела выше — это уже полноценный вариант «без App Store», но это
всё ещё сайт в обёртке Safari. Если нужен именно нативный `.ipa`,
устанавливаемый как обычное приложение (с настоящими push через APNs и
доступом к системному календарю), в репозитории есть Capacitor-обёртка
(`capacitor.config.ts`, `ios/`) — тот же веб-код, скомпилированный в
нативный iOS-проект.

**Жёсткое ограничение Apple**: собрать и поставить такое приложение на
физический iPhone — даже только себе и одному члену семьи, без App Store —
можно только с Apple Developer Program (**платно, $99/год**, оформляется на
apple.com/programs с любым Apple ID). Без него нативную сборку в принципе
некуда установить — это ограничение iOS, не этого проекта. Сама разработка
(этот репозиторий, весь код) остаётся бесплатной.

Как только Apple Developer Program оформлен:

1. Нужен Mac с Xcode (или GitHub Actions на раннере `macos-latest` — можно
   настроить). Локально: `cd taskboard && npm run build && npx cap sync ios`,
   затем откройте `ios/App/App.xcworkspace` в Xcode.
2. В Xcode: Signing & Capabilities → выберите свою команду (Team) из Apple
   Developer Program, включите capability «Push Notifications».
3. Product → Archive → Distribute App → **TestFlight** (не App Store) — это
   самый быстрый способ поставить сборку на 1-2 личных телефона без недель
   ревью Apple. Добавьте себя и супруга/супругу как тестировщиков в App Store
   Connect → TestFlight — оба получат приложение через приложение TestFlight
   на iPhone за минуты, а не через публичный App Store.
4. Настройте APNs (см. «Настройка» выше) — иначе push из шага 3 придут в
   PWA-версии, но не в нативном приложении.

Apple Calendar (EventKit) пока не подключён — это отдельный шаг поверх
готовой Capacitor-обёртки (нужен плагин вроде `@ebarooni/capacitor-calendar`
и реальный запуск на устройстве для проверки), в отличие от Google Calendar
не работает из веба вообще ни в каком виде — это ограничение iOS/Safari, а
не этого проекта.

## Деплой на GitHub Pages

Пуш в `main` или `claude/trello-like-task-app-sdlxis`, который затрагивает
`taskboard/**`, триггерит `.github/workflows/deploy-pages.yml` — этот же
workflow параллельно собирает и `app/` (Hedonist AI-marketer), объединяя оба
в один сайт (`app/` — корень, `taskboard/` — подпуть `/taskboard/`), потому
что GitHub Pages отдаёт один артефакт на весь репозиторий.

Ключи Supabase уже встроены как значение по умолчанию (см. «Настройка»
выше), так что деплой работает без каких-либо secrets. Опционально — если
подключите свой Supabase-проект — можно передать его через repo secrets
`TASKBOARD_SUPABASE_URL` / `TASKBOARD_SUPABASE_PUBLISHABLE_KEY`, они
переопределят значения по умолчанию только при сборке на Pages.

## Структура

```
taskboard/
  migrations/                 Схема БД, RLS, RPC — по порядку, 0001 → 0008
  supabase/functions/         send-push, due-reminders (cron), ai-chat, google-calendar-auth, google-calendar-events
  supabase/functions/_shared/ apns.ts — минимальный клиент APNs (без npm-зависимостей)
  supabase/config.toml        verify_jwt=false для due-reminders и google-calendar-auth
  src/lib/                     Supabase-клиент, авторизация, типы, push (Web + нативный), ии, google-календарь, фоны
  src/screens/                 AuthScreen, BoardsScreen, BoardScreen, MobileApp (мобильная навигация)
  src/components/              CardModal, CardAIPanel, AISettingsModal, GoogleCalendarSettingsModal, ShareModal, BackgroundModal
  src/sw.ts                    Service worker (кастомный, обрабатывает push)
  capacitor.config.ts, ios/    Нативная iOS-обёртка (см. «Настоящее приложение для iPhone»)
```

## Модель данных

`boards` (+ `background`) → `board_members` (доступ и роли: owner/member) →
`lists` → `cards` (+ `assigned_to`, `due_notified_at`) →
`checklist_items` / `attachments` (файлы — в приватном Storage-бакете
`attachments`, метаданные — в таблице) / `ai_messages` (история чата с
ИИ-ассистентом по карточке). `push_subscriptions` — одна запись на
браузер/устройство с включёнными Web Push-уведомлениями (PWA),
`native_push_tokens` — то же самое для нативного iOS-приложения (APNs).
`google_calendar_tokens` — refresh/access токен на пользователя (только
service role, наружу — только статус «подключено»/нет через RPC),
`google_oauth_states` — короткоживущие одноразовые записи для CSRF-защиты
OAuth-редиректа. Всё под Row Level Security: видно и редактируемо только
участникам конкретной доски. Anthropic API-ключ ИИ-ассистента и Google
Client ID/Secret — не в таблицах, а в Supabase Vault (см. «Настройка»).
