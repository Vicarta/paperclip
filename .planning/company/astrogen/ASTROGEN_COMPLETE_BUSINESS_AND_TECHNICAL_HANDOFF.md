# Astrogen: повний бізнесовий і технічний handoff

- Оновлено: 2026-08-05
- Мова операцій: українська
- Ринок: Україна
- Часова зона: `Europe/Kiev` / `Europe/Kyiv`
- Статус Paperclip: повністю зупинений за рішенням власника
- Призначення: відтворити й продовжити процеси Astrogen в окремій програмній системі, яка не залежить від Paperclip

## 1. Як користуватися цим документом

Це не історія листування і не опис інтерфейсу Paperclip. Це migration handoff, який фіксує:

- бізнес-контекст Astrogen;
- продукти, маршрути й сегменти аудиторії;
- джерела семантики, контенту, аналітики та технічного SEO;
- чинні правила вибору тем і запобігання канібалізації;
- контент-планування;
- повний lifecycle створення, перевірки, оформлення та доставки статті;
- SEO/GEO, trend discovery, internal linking і post-publication measurement;
- зовнішні сервіси, API/MCP та secret references;
- фактичні результати роботи;
- відомі помилки й рішення, які не можна відтворювати;
- мінімальну архітектуру нової системи та порядок перенесення.

Пріоритет джерел у разі суперечності:

1. Рішення власника, зафіксовані в розділі **Чинна політика** цього документа.
2. Поточні зовнішні джерела істини: Payload CMS, Semantic Core MCP/outputs, SERP Winning Structure MCP, GSC/GA4, CrawlObserver.
3. Versioned contracts у `ops/paperclip-astrogen-clean/reference/` і `manifests/`.
4. Історичні Paperclip issues, comments, plans та execution logs.

Старі документи містять суперечності. Наприклад, у ранніх версіях Claude/OpenRouter або ChatGPT по черзі були основним автором, а тренди звужувалися до продуктів. Чинне рішення: **Claude CLI є єдиним основним автором статей; тренди залишаються audience-first; західна астрологія навчається за правилом одна стаття = одне нове поняття**.

## 2. Коротко про Astrogen

Astrogen — україномовний сервіс і контентна платформа про астрологію, суміжні інтерпретаційні практики та вибір експертів. Цінність бренду не повинна будуватися на фатальних прогнозах. Матеріали мають допомагати читачеві:

- краще зрозуміти себе й ситуацію;
- структурувати життєве рішення;
- побачити можливі патерни без передачі відповідальності системі чи консультанту;
- обрати формат продукту або експерта;
- розрізняти можливості, обмеження та небезпечні обіцянки;
- поступово вивчати західну астрологію без перевантаження термінами.

Основна бізнес-мета процесів: **зростання релевантного органічного трафіку, довіри, переходів до продуктів/експертів і продажів**, а не випуск контенту заради кількості.

## 3. Поточний технічний стан

### 3.1. Що зупинено

За командою власника повністю зупинена лише діяльність clean Paperclip Astrogen:

- `paperclip-astrogen-clean.service`;
- clean Paperclip app і PostgreSQL compose;
- Paperclip GSC proxy units;
- Paperclip OAuth guard timer/service;
- Paperclip Bright Data reconciliation timer/service;
- усі Paperclip routines, agents, heartbeats, plugin jobs і повідомлення.

Units додатково runtime-masked. Не запускати Paperclip без окремої команди власника.

Історичний clean endpoint був `http://ubuntu-oc.tailbd4e1c.ts.net:3210`, Tailscale IP `100.98.5.50`, compose package `ops/paperclip-astrogen-clean/`. Старий Paperclip на `127.0.0.1:3200` більше не є джерелом істини.

### 3.2. Що залишилося незалежним і не було зупинене

- Astrogen website і Payload CMS;
- `semantic-core-mcp`;
- `winning-structure-mcp`;
- `text-humanize-mcp`;
- CrawlObserver;
- GSC/GA4 upstream services, якщо вони працюють поза Paperclip proxy;
- Hermes та його dashboard;
- SEO dashboard і ClickHouse;
- інші не-Paperclip контейнери на сервері.

Нова система повинна інтегруватися з цими сервісами напряму через API/MCP, а не через Paperclip plugin protocol.

## 4. Джерела істини і де їх дивитися

| Дані | Канонічне джерело | Локальна/мережева адреса |
|---|---|---|
| Продукти та live routes | production site + sitemap | `https://astrogen.com.ua/`, `https://astrogen.com.ua/sitemap.xml` |
| Статті та чернетки | Payload CMS PostgreSQL/API | `https://cms.astrogen.com.ua/admin/collections/blogPosts`, `https://cms.astrogen.com.ua/api` |
| Семантичне ядро | Semantic Core MCP та його immutable outputs | `/Users/savitsky/CodexProjects/seo-semantic-core/outputs/astrogen-*` |
| Агреговані accepted keywords | Semantic Core output | `/Users/savitsky/CodexProjects/seo-semantic-core/outputs/astrogen-all-layers-v1/all_layers__accepted_keywords.csv` |
| Кластери | Semantic Core output | `/Users/savitsky/CodexProjects/seo-semantic-core/outputs/astrogen-all-layers-v1/all_layers__clusters.csv` |
| Review queue | Semantic Core output | `/Users/savitsky/CodexProjects/seo-semantic-core/outputs/astrogen-all-layers-v1/all_layers__review_candidates.csv` |
| Parked/rejected | Semantic Core output | `all_layers__parked_outside_layer.csv`, `all_layers__rejected_noise.csv` у тому самому каталозі |
| Keyword-volume research | окремий report | `/Users/savitsky/CodexProjects/seo-semantic-core/reports/ua-keyword-volume-2026-07-22.csv` |
| MCP spend/query audit | окремі reports | `/Users/savitsky/CodexProjects/seo-semantic-core/reports/mcp-provider-queries-*.csv`, `mcp-serp-queries-*.csv` |
| Trend evidence | Semantic Core trend reports | `/Users/savitsky/CodexProjects/seo-semantic-core/reports/` та durable records нової системи |
| Trend/semantic MCP contract | canonical service guide | `/Users/savitsky/CodexProjects/seo-semantic-core/docs/AI_AGENT_MCP_USAGE.md` |
| SERP structure lifecycle | SERP Winning Structure MCP | `/Users/savitsky/CodexProjects/seo-winning-structure/docs/AGENT_INTEGRATION_GUIDE.md` |
| Article editorial policy | versioned references | `ops/paperclip-astrogen-clean/reference/content-quality-contract.yaml`, `article-value-system.yaml` |
| Image policy | versioned references | `reference/image-generation-settings.json`, `docs/reference/ARTICLE_IMAGE_DESIGN_SYSTEM.md` |
| Curriculum | versioned graph | `reference/western-astrology-curriculum.yaml` |
| Compatibility cluster | versioned graph | `reference/zodiac-compatibility-cluster.yaml` |
| Historical plans/results | project planning | `.planning/company/astrogen/` |

Native case-документ Paperclip `next-content-plan` існував лише в runtime. Paperclip зупинено, а під час цього аудиту віддалений workspace вимагав повторної авторизації Tailscale, тому цей документ **не є надійним переносним джерелом**. Нова система має відновити актуальні рядки плану із семантичних доказів, CMS ownership, чинної політики та історії завершених/зарезервованих тем, після чого зберігати план у власній БД.

## 5. Продукти, маршрути та комерційні цілі

### 5.1. Підтверджені live/indexed routes на 2026-08-05

| Route | Продукт/роль | Основний reader outcome |
|---|---|---|
| `/` | бренд, натальна карта, основний вхід | зрозуміти пропозицію Astrogen |
| `/money` | фінансова натальна карта | осмислити гроші, роботу, кар'єрні патерни |
| `/relationships` | аналіз сумісності пари | зрозуміти динаміку стосунків без вироку |
| `/children` | дитяча натальна карта | побачити темперамент, таланти й потреби дитини без ярликів |
| `/astrocode-2026` | персональний річний прогноз | отримати рамку тем і фокусів 2026 року |
| `/experts` | каталог експертів | обрати метод і спеціаліста |
| `/for-astrologers` | B2B маршрут | залучити астрологів/практиків на платформу |

### 5.2. Категорії експертів

- астрологія;
- таро;
- нумерологія;
- Human Design;
- психологія;
- матриця долі;
- коучинг;
- тілесні та духовні практики;
- кармічний менеджмент / кармологія;
- регресологія, гіпнотерапія, родові практики.

### 5.3. Історичні або непідтверджені як indexed routes

У старих планах присутні `/solar`, `/horoscope`, `/astrocalendar`. На snapshot 2026-08-05 їх немає в основному sitemap. До використання як CTA або SEO owner нова система повинна перевірити HTTP state, indexability, продуктову актуальність і canonical ownership. Не переносити їх автоматично як активні цілі.

### 5.4. Продуктова межа в контенті

- Назва продукту або послуги не додається в title/H1 трендової теми, якщо її не було в самому audience signal.
- Продукт можна згадати в body лише коли це природний наступний крок.
- Для одного продукту нормальний default: одна contextual body link + одна фінальна quiet CTA.
- Продуктова сторінка не стає owner будь-якої ширшої аудиторної теми лише через тематичну близькість.
- Комерційна стаття створюється лише за реально незакритим попитом.

## 6. Сегменти цільової аудиторії

Сегмент — це людина в ситуації, а не назва продукту.

### 6.1. П'ять основних audience-first сегментів

| ID | Сегмент | Типові ситуації 2026 | Що шукає |
|---|---|---|---|
| `life_decisions` | люди в періоді життєвих рішень | релокація/повернення, зміна роботи, фінансова невизначеність, decision fatigue | спосіб структурувати вибір без фаталізму |
| `relationships` | люди, які осмислюють стосунки | дистанційні стосунки, міграція, цифрова недовіра, dating-app fatigue, спільний бюджет | ненав'язливу мову для розуміння ситуації |
| `self_reflection` | аудиторія самопізнання | втома від швидких порад, AI-контенту й інформаційного шуму | практики самоспостереження й осмислення без готової відповіді |
| `family_and_parenting` | батьки та сімейна аудиторія | навчальна нестабільність, цифрові звички дітей, розділені родини | недіагностичну мову без ярликів |
| `expert_selection` | люди, які обирають консультанта | онлайн-консультації, AI-поради, шахрайські обіцянки | критерії довіри, межі компетентності, red flags |

### 6.2. Наскрізні стани

- «Я заплутався/заплуталась у собі».
- «Мені потрібно звіритися із собою».
- «Я не розумію, що відбувається у стосунках».
- «Я хочу зрозуміти гроші, роботу і свій напрям».
- «Я хвилююся за дитину».
- «Я знаю метод, але не знаю експерта».
- «Я не знаю, який метод мені потрібен».

### 6.3. Тон для сегментів

- гендерно нейтральний голос бренду;
- не писати від імені жінки або чоловіка;
- не давати вироків і гарантованих прогнозів;
- не діагностувати;
- не підміняти медичну, юридичну, фінансову або психологічну професійну допомогу;
- допомагати читачеві сформулювати питання і зберігати власну відповідальність.

Повна початкова карта: `.planning/company/astrogen/AUDIENCE_SEGMENTS_BY_PRODUCT_UA.md`.

## 7. Організаційна модель

У Paperclip було багато агентів, але переносити треба не персонажів, а відповідальності.

| Роль | Відповідальність | Чого не робить |
|---|---|---|
| CEO | бізнес-напрям, портфель ставок, revenue/product/customer/platform risk, делегування CMO/CTO | не виконує SEO, CMS, research чи writing |
| CMO | контентний і growth portfolio, пріоритети, WIP, outcome targets, контроль підлеглих, continuity | не пише статті, не генерує картинки, не редагує CMS |
| CTO | інтеграції, runtime, backup/rollback, process reliability, self-learning improvements | не вирішує маркетингові пріоритети |
| SEO Performance Analyst | GSC/GA4/CrawlObserver/Payload evidence, weekly SEO/GEO action cycle | не створює article slots напряму |
| Semantic Core Strategist/Validator | семантика, trend validation, review decisions, evidence packets | не створює статтю з сирого trend report |
| Content Strategist | intent clustering, ownership, cannibalization, internal links, topic/brief inputs | не пише фінальний текст |
| Brief Strategist | compact writer brief із locked scope | не переносить raw MCP artifacts у текст |
| Claude Writer | основний текст статті | не робить layout/image/CMS/delivery |
| Content Validator | факти, scope, terminology, value, claims | не виправляє все через layout |
| Humanizer | один bounded naturalness pass | не змінює факти, структуру, intent чи evidence |
| MC Quality | substantive quality gate | не оцінює дизайн/related posts |
| Layout Editor/Validator | `articleContent.v1`, links, CTA, `Коротко`, CMS envelope | не переписує substance |
| Image Executor/QA | art direction, one generation, visual history, attachment | не створює статтю |
| CMS Connector | draft create/update/readback | не публікує автоматично |

У новій системі ці ролі можуть бути typed stages і services, а не окремі LLM agents. LLM потрібен лише там, де є справжнє мовне/аналітичне завдання.

## 8. Чинна контентна стратегія

### 8.1. Rolling portfolio на 25 тем

| Напрям | Ціль готових тем |
|---|---:|
| Західна астрологія як навчальна система | 12 |
| Прикладні життєві питання аудиторії | 5 |
| Audience-first трендові теми | 3 |
| Довіра, вибір експерта, межі методів | 3 |
| Продуктові/комерційні теми з реально незакритим попитом | 2 |

Це rolling future supply, а не місячний publication quota. Audience segments — diversity guardrail, не жорсткі квоти. Не створювати filler для виконання числа.

### 8.2. Виробнича місткість

- ціль: 3 CMS drafts на день;
- dispatch checks: 10:00, 14:00, 18:00 Europe/Kyiv;
- productive WIP cap: 3;
- healthy three-day buffer: 9 незалежно dispatchable тем;
- загальний ready + reserved plan target: 25;
- один blocker не займає productive WIP і не зупиняє інші статті;
- один query/allocation family — максимум одна стаття на daily batch;
- compatibility family — максимум одна стаття на daily batch;
- audience-interest editorial lane — ціль 2, максимум 4 на календарний місяць, максимум одна на daily batch.

### 8.3. Заборонені topic families

- гороскоп «на сьогодні»;
- щоденні гороскопи за знаком;
- теми про конкретну дату народження на кшталт «22 травня знак зодіаку»;
- rolling current-day content;
- шаблонне масове створення сторінок;
- продуктове звуження audience-first trend;
- нова стаття, якщо intent уже має owner;
- вигадана тема заради заповнення quota.

Існуюча CMS draft `130` «Гороскоп Скорпіона на сьогодні» суперечить чинній політиці й не повинна відновлюватися в новому production plan.

## 9. Семантичне ядро

### 9.1. Архітектура шарів

1. `core_product_intent` — прямі продукт/категорія/бренд запити.
2. `adjacent_use_case_intent` — ситуації й рішення, які можуть бути підтримані експертизою Astrogen.
3. `audience_need_intent` — явно сформульована потреба/проблема аудиторії.
4. `audience_interest_intent` — ширші інтереси аудиторії з defensible editorial bridge.

### 9.2. Поточний локальний агрегований snapshot

Джерело: `outputs/astrogen-all-layers-v1/all_layers__summary.md`.

| Метрика | Значення |
|---|---:|
| Accepted keywords | 164 |
| Review candidates | 47 |
| Parked outside layer | 371 |
| Rejected noise | 9 |
| Clusters | 136 |
| SERP segments | 21 |
| Audience gaps | 13 |
| Merge candidates | 1 |

По шарах:

| Layer output | Accepted | Review | Parked | Rejected | Clusters |
|---|---:|---:|---:|---:|---:|
| `astrogen-core-product-v3` | 88 | 4 | 43 | 1 | 64 |
| `astrogen-adjacent-use-case-v2` | 5 | 0 | 134 | 1 | 5 |
| `astrogen-audience-need-v2` | 0 | 33 | 115 | 0 | 0 |
| `astrogen-audience-interest-v3` | 71 | 10 | 79 | 7 | 67 |

Не змішувати старий Paperclip portal snapshot (27 accepted та інші історичні counts) із цим новішим local output. Перед production intake нова система повинна зареєструвати `project_id=astrogen-ukraine`, прочитати актуальний MCP inventory і звірити immutable run IDs.

### 9.3. Keyword lifecycle

`candidate -> candidate_review -> accepted | parked | rejected`

- `accepted` не означає автоматично `new_article`;
- `candidate_review` є нетермінальним і вимагає append-only human/validator decision та materialized rerun;
- parked keywords не є сміттям: їх можна повернути при новому layer/policy/evidence;
- rejected noise не використовувати повторно без нового обґрунтування;
- кожна accepted phrase перед native topic intake групується в intent cluster.

### 9.4. Intent clustering

Одна opportunity відповідає одному reader intent, а не одній фразі.

Обов'язкові поля:

- `intentClusterKey`;
- `clusterDedupeKey`;
- `queryFamilyFingerprint`;
- `primaryQuery`;
- `supportingQueries[]`;
- `sourceSemanticCandidateIds[]`;
- `sourceClusterIds[]`;
- `primaryAudienceSegmentId`;
- `contentPortfolioTrack`.

Три фрази «чи повертатися в Україну», «план повернення» і «залишитися чи повернутися» можуть бути одним intent cluster, якщо вони мають один reader outcome, page type та SERP family.

### 9.5. Semantic Core MCP

- SSH alias: `mcpsemcor_ubuntu_oc`;
- user: `mcpsemcor`;
- host: `ubuntu-oc.tailbd4e1c.ts.net`;
- app path: `/opt/semantic-core/seo-semantic-core`;
- container: `semantic-core-mcp`;
- MCP URL: `http://100.98.5.50:8001/mcp`;
- transport: `streamable-http`;
- auth: `Authorization: Bearer ${SEMANTIC_CORE_MCP_TOKEN}`;
- server token file: `/home/mcpsemcor/.config/semantic-core/bearer_token`;
- token value не читати, не логувати, не копіювати в repo.

Канонічний client guide: `/Users/savitsky/CodexProjects/seo-semantic-core/docs/AI_AGENT_MCP_USAGE.md`.

Provider rules:

- normal workflows are async;
- provider-backed run only intentionally with `mode=provider`;
- `provider_queue=standard` by default;
- `include_search_intent=false`;
- `include_content_parsing=false`, якщо немає окремої evidence request;
- content parsing — окремий `evidence_only` async operation;
- `provider_cache_mode=read_only` is no-spend; `read_write/refresh/bypass` require explicit runbook/authorization;
- `get_run_costs(run_id).actual_cost` is authoritative;
- provider HTTP 200 alone is not success; validate top-level and task status codes;
- не надсилати research instructions як keyword/SERP query.

Trend-specific SERP queries: **не більше 4 слів**. Запит із 5+ слів має бути відхилений до billable provider call.

На дату canonical guide live trend execution locked server-wide. Нова система не повинна обходити lock. Вона має показати `provider_disabled`/`awaiting_explicit_enablement`, а не заміняти production evidence fixture-результатом.

## 10. Вибір дії для кожного search-demand cluster

Кожний cluster проходить state machine:

```text
discovered
-> evidence_ready
-> ownership_review
-> action_selected
-> delegated
-> verified
-> measured
```

Рівно одне рішення:

| Action | Коли використовувати |
|---|---|
| `new_article` | попит accepted, intent uncovered, сторінка дає самостійну цінність |
| `refresh` | є canonical owner, але content gap можна закрити в ньому |
| `merge` | кілька сторінок ділять один intent і мають бути консолідовані |
| `reposition` | URL існує, але потребує іншого primary intent/роль |
| `internal_link` | контент достатній, проблема в discovery/authority/navigation |
| `technical` | metadata, sitemap, indexability, rendering, schema, route ownership |
| `no_action` | owner already satisfies intent або evidence недостатньо |

Тільки `new_article` створює topic-inventory candidate. Інші дії йдуть у власні execution lanes і не зупиняють refill нових тем.

### 10.1. Ownership/cannibalization gate

Перед `new_article`:

1. Завантажити повний CMS inventory: published + drafts.
2. Перевірити service/product/category pages.
3. Перевірити active/reserved generation jobs.
4. Порівняти primary query, supporting queries, reader outcome, page type і SERP result family.
5. Визначити current owner URL і competing URLs.
6. Вирішити `new_article/refresh/merge/reposition/internal_link/technical/no_action`.
7. Створити incoming/outgoing internal-link plan.

Exact slug absence не доводить, що тема не покрита.

## 11. Trend discovery

### 11.1. Що є трендом

Поточна або emerging зміна в ситуаціях, мові, тривогах, питаннях, поведінці порівняння, культурі, сезонності чи інформаційних потребах сегмента ЦА.

Не є трендом:

- нова варіація продуктового keyword;
- «астрологія/таро/Human Design» з trend label;
- evergreen how-to без current signal;
- перефразування існуючої статті;
- clinical/medical topic як основна Astrogen lane.

### 11.2. Trend workflow

1. Вибрати один недопокритий audience segment.
2. Передати нейтральний audience-first project context без product seeds.
3. Викликати `generate_trend_topic_report` один раз у межах бюджету.
4. Зберегти `run_id`, clusters, watchlist, rejected signals, warnings, research/cache summary, `cost.events`, Markdown.
5. Відібрати bounded audience signals.
6. Перетворити їх на конкретні українські search phrases до 4 слів для provider SERP query.
7. Валідувати через нормальний Semantic Core layer.
8. Group phrases into intent clusters.
9. Пройти ownership/cannibalization/action selection.
10. Лише `new_article` потрапляє у content plan.

Trend report не додає keywords у semantic core і не є контент-планом.

### 11.3. Product narrowing заборонене

Наприклад, trend «втома від цифрових порад у стосунках» не можна перетворювати на «Таро для самопізнання» лише тому, що Astrogen має тарологів. Product/modal terms заборонені в trend-derived:

- primary query;
- title/H1;
- slug;
- topic key;
- action reason.

Продукт можна згадати тільки в body як корисний контекстний міст.

### 11.4. Відомі trend результати

Успішні audience-first матеріали/чернетки:

- `133` — «Як обрати між залишитися за кордоном і повернутися в Україну»;
- `134` — «Як порівняти витрати на переїзд і нову роботу»;
- `135` — «Стосунки на відстані: як домовитися про зв'язок»;
- `136` — draft «Що означає сленг у переписці з хлопцем: як читати повідомлення без зайвих висновків».

Історичний report `astrogen-trend-topic-report-2026-07-17` був продуктово звуженим навколо фінансових гороскопів і соцформатів. Він є доказом роботи adapter/cost telemetry, але **не є чинним контент-планом** і не повинен повторно імпортуватися.

## 12. Західна астрологія як навчальний граф

Головне правило: **одна стаття навчає рівно одному новому астрологічному поняттю**.

- максимум один unavoidable supporting term;
- supporting term визначається одним простим реченням при першій появі;
- він не отримує heading, table, FAQ, list, comparison чи окремий workflow;
- aliases `дім/будинок/дом` — одне поняття;
- prerequisite згадується коротко й лінкується, але не перевикладається;
- dependent article не публікується раніше prerequisite.

### 12.1. Канонічна послідовність

| Order | Node | Поняття | Working title | Prerequisites | Snapshot |
|---:|---|---|---|---|---|
| 1 | `wa-01-natal-chart` | натальна карта | Що таке натальна карта і для чого її читають | — | ownership review; CMS `129` може перетинатися |
| 2 | `wa-02-planet` | планета | Що означає планета в натальній карті | `wa-01` | draft `140` |
| 3 | `wa-03-zodiac-sign` | знак зодіаку | Що означає знак зодіаку в натальній карті | `wa-01` | draft `141` |
| 4 | `wa-04-house` | дім | Що таке дім у натальній карті | `wa-01` | draft `138`, needs substantive review |
| 5 | `wa-05-ascendant` | асцендент | Що таке асцендент у натальній карті | `wa-01,03,04` | not created |
| 6 | `wa-06-sun` | Сонце | Що означає Сонце в натальній карті | `wa-01,02,03` | not created |
| 7 | `wa-07-moon` | Місяць | Що означає Місяць у натальній карті | `wa-01,02,03` | not created |
| 8 | `wa-08-mercury` | Меркурій | Що означає Меркурій у натальній карті | `wa-01,02,03` | not created |
| 9 | `wa-09-venus` | Венера | Що означає Венера в натальній карті | `wa-01,02,03` | not created |
| 10 | `wa-10-mars` | Марс | Що означає Марс у натальній карті | `wa-01,02,03` | not created |
| 11 | `wa-11-aspect` | аспект | Що таке аспект у натальній карті | `wa-01,02` | draft `137` rejected for concept overload |
| 12 | `wa-12-transit` | транзит | Що таке транзит в астрології | `wa-01,02,11` | not created |

Draft `137` є прикладом «як не треба»: введено понад десять понять. Draft `138` кращий, але потребував простого пояснення терміна «куспід» і correct `Коротко` style. Не вважати ці матеріали accepted curriculum nodes без повторної substantive validation.

SERP analysis потрібен, але відсутність classic SERP value gap не відхиляє prerequisite article, якщо він потрібен графу, має унікальну teaching role, safe ownership і internal-link plan.

## 13. Кластер сумісності знаків

Стратегія:

```text
1 canonical pillar
-> 12 sign hubs
-> перші 12-20 pair pages за попитом
-> measurement
-> поступове розширення до максимум 78 unordered pairs
```

Правила:

- 12x12 не означає 144 canonical pages: reverse order не створює нову сторінку;
- максимум 78 unordered pairs разом із same-sign pairs;
- gender variants є supporting queries за замовчуванням;
- окрема gender page лише при доведеному іншому intent/SERP family і без стереотипів;
- кожна сторінка має власний accepted `pageKeywordPacket` із Semantic Core;
- batch discovery дозволений до 50 candidate keywords, але page evidence лишається окремим;
- одна compatibility article на daily batch;
- не створювати весь масив одним шаблонним пакетом;
- pillar -> hubs -> pairs internal linking обов'язковий.

CMS ownership зараз конфліктний: уже є кілька published матеріалів про загальну сумісність, зокрема IDs `45` і `61`, плюс product education IDs `19, 20, 23–25, 28–31, 62–63, 111`. Перед новим pillar треба вибрати canonical owner і `refresh/merge/reposition`, а не створювати ще один.

Створені cluster pages:

- `139` published — «Рак і Скорпіон сумісність»;
- `142` draft — «Телець і Скорпіон сумісність»;
- `143` draft — «Риби сумісність з іншими знаками»;
- `144` draft — «Рак сумісність з іншими знаками».

## 14. Модель даних контент-плану

Кожний plan row повинен бути DB entity, а не Markdown/chat comment.

```json
{
  "topicId": "uuid",
  "topicKey": "stable-key",
  "titleUk": "...",
  "primaryQuery": "...",
  "supportingQueries": [],
  "intentClusterKey": "...",
  "queryFamilyFingerprint": "...",
  "contentPortfolioTrack": "western_astrology_learning|audience_applied_questions|audience_trends|trust_expert_method_boundaries|commercial_unmet_demand",
  "portfolioLane": "search_demand_core|audience_interest_editorial",
  "primaryAudienceSegmentId": "...",
  "secondaryAudienceSegmentIds": [],
  "semanticRunIds": [],
  "semanticCandidateIds": [],
  "searchVolume": null,
  "frequencyStatus": "known|unknown|unavailable_not_zero",
  "cmsOwnerUrl": null,
  "competingUrls": [],
  "ownershipVerdict": "uncovered|owned|conflict",
  "selectedAction": "new_article|refresh|merge|reposition|internal_link|technical|no_action",
  "incomingLinks": [],
  "outgoingLinks": [],
  "ctaTarget": null,
  "status": "candidate|evidence_ready|ready|reserved|consumed|rejected|expired",
  "cooldownUntil": null,
  "evidenceRefs": [],
  "createdAt": "...",
  "updatedAt": "...",
  "version": 1
}
```

Умови переходу в `ready`:

- accepted semantic evidence або approved curriculum proof;
- unique intent cluster;
- full CMS ownership verdict;
- no active duplicate;
- cannibalization action selected;
- incoming/outgoing internal links;
- safety/tone restrictions;
- portfolio track;
- exactly one primary audience segment;
- stable idempotency key.

## 15. Article production lifecycle

Канонічна state machine:

```text
opportunity
-> strategy_input
-> winning_structure
-> structure_decision (only when paused for a typed decision)
-> structure_review
-> brief
-> draft
-> validate
-> humanize
-> mc_quality
-> layout
-> layout_validate
-> image
-> image_recovery_review (only on real defect)
-> cms_draft
-> cmo_delivery
-> delivered
```

`cancelled` — terminal alternative. Кожний stage має durable input/output artifact, typed error, retry policy, idempotency key і next action.

### 15.1. Opportunity

- atomically reserve one ready topic;
- create one article job by `articleParentKey`;
- prevent duplicate parent;
- preserve topic lineage;
- validate curriculum and family caps;
- do not write, research SERP, generate image or mutate CMS here.

### 15.2. Strategy input

- lock operation: `create` або `refresh`;
- load CMS snapshot, semantic evidence, ownership, audience, product bridge, internal links;
- classify exactly one article type;
- select 2–4 evidence-backed value units;
- build exact SERP Winning Structure input;
- keep raw source/provider payloads out of LLM context.

### 15.3. SERP Winning Structure

- Production endpoint: `http://100.98.5.50:8000/mcp`
- Auth: `Authorization: Bearer ${WINNING_STRUCTURE_MCP_TOKEN}`
- Client key: `astrogen-ukraine`

Required operations:

1. `validate_task_input`;
2. `start_winning_structure_run` exactly once;
3. `get_run_status` by stored `run_id`;
4. `submit_run_decisions` only for the exact pending decision and authority;
5. `get_run_result` after completed.

Store:

- original/effective input hashes;
- immutable result;
- content-selection audit;
- meta-evidence brief;
- provider provenance;
- quality flags;
- raw artifact references;
- cache telemetry;
- full cost telemetry;
- expiry/retention.

SERP Winning Structure gives recommendations, not publishable prose. Never copy its instructions, audit notes, metadata brief or handoff-only sections into the article.

Modes for the new service:

- `off` — non-SEO editorial/repair;
- `required` — SEO acquisition, compatibility, substantial refresh;
- `conditional` — curriculum prerequisite, audience trend or bounded refresh according to typed rules;
- `provided_result` — caller supplies a previously completed compatible result;
- `on_demand` — separate explicit API/MCP call.

### 15.4. Article value

Classify one article type:

- `zodiac_profile`;
- `product_education`;
- `expert_method_selection`;
- `life_situation_decision`;
- `concept_explainer`;
- `relationship_compatibility`;
- `forecast_cycle`;
- `historical_cultural_explainer`.

Select 2–4 value units. A FAQ, table, checklist, quiz, callout або layout block не є цінністю сам по собі. Value unit має містити:

- reader problem;
- concrete contribution;
- target intent;
- evidence або due-before-publication commitment;
- claim boundaries;
- substantive difference from sibling pages;
- observable acceptance criteria.

Приклади реальної додаткової цінності:

- decision map;
- comparison by reader criteria;
- facts/interpretations/fears split;
- bounded worked example;
- sourced historical context;
- concept relationship map;
- communication reflection framework;
- uncertainty/boundary map;
- expert quality signals;
- practical input-to-result guide.

### 15.5. Writer brief

Окремий compact JSON artifact, максимум 48,000 UTF-8 characters. Містить лише:

- locked title/topic/intent;
- reader profile;
- selected value units;
- reader-facing section IDs;
- concise evidence and claim boundaries;
- internal links/CTA constraints;
- forbidden claims;
- curriculum scope when relevant.

Не містить provider provenance, raw MCP artifacts, operational instructions, CMS field inventory чи repeated history.

### 15.6. Draft

- основний author: **Claude CLI/local через активну Claude subscription**;
- модель: Sonnet, якщо інше не задано project settings;
- Claude не використовується в інших stages;
- ChatGPT/Codex fallback — лише після durable Claude CLI blocker або explicit recovery;
- OpenRouter/OpenCode text fallback не використовувати в normal writing;
- output — canonical Markdown + structured section IDs;
- no layout/image/CMS/delivery actions.

### 15.7. Validation

Перевірити:

- title/intent fulfillment;
- factual and evidence boundaries;
- additional value units;
- duplicate/sibling differentiation;
- product capability accuracy;
- nonfatalistic/safety language;
- internal-link commitments;
- curriculum one-concept gate;
- absence of handoff/process/SEO residue.

### 15.8. Humanize

Один bounded pass. Прибирати лише observed stiffness:

- throat-clearing;
- formulaic openers/closers;
- forced triads;
- repeated transitions/sentence shapes;
- vague abstraction;
- over-fragmented headings;
- redundant explanation.

Не змінювати facts, evidence, structure, claims, keywords, CTA, section purpose. Не використовувати AI detection score і не запускати recursive rewrite loops.

### 15.9. Main Content Quality gate

Окремо від layout. Axes:

- purpose fulfillment;
- effort/provenance;
- original contribution;
- depth/limits;
- usefulness;
- completeness;
- specificity;
- clarity;
- information density;
- differentiation;
- safety.

Outcomes: `pass`, `revise_surface`, `revise_substantive`, `reject_unsafe`.

### 15.10. Refresh

Refresh не означає автоматично додати `Коротко`, FAQ, CTA чи links. Спочатку SERP/current-owner analysis, потім substantive value gap.

- preserve existing cover/OG media by default;
- no image regeneration without explicit image defect;
- create before/after diff artifact;
- metadata-only, related-only, link-only і layout-only fixes йдуть у deterministic repair lanes;
- не переписувати всю статтю через transport/schema error.

## 16. Оформлення статті

### 16.1. Payload `articleContent.v1`

```json
{
  "schemaVersion": "articleContent.v1",
  "blocks": []
}
```

Allowed blocks:

- `paragraph`;
- `heading`;
- `list`;
- `editorialCallout`;
- `iconList`;
- `twoColumnText`;
- `quietCta`.

### 16.2. Обов'язкові елементи

- intro;
- перший `editorialCallout` після intro з title `Коротко`;
- для `Коротко` variant **рівно `soft`**;
- 2–4 concise summary sentences;
- useful later editorial blocks only where they clarify meaning;
- one final quiet CTA;
- exactly 3 relevant published/indexable `relatedPosts`;
- non-empty `seoTitle`;
- non-empty `metaDescription`;
- category resolved by slug at delivery time;
- cover image set as both `coverImage` and `ogImage`.

### 16.3. Links

- no raw URLs in visible text;
- contextual links are safe structured spans;
- safe targets: internal `/...` або HTTPS;
- максимум 5 linked spans per text block, 20 per article;
- no adjacent synonym anchors to same URL;
- product-like reference must be linked;
- free offer must explicitly say `безкоштовно`/equivalent;
- promised next step must have a concrete link/CTA.

### 16.4. CTA

- at most one special CTA block;
- quiet, helpful, not sales-heavy;
- closes editorial argument first;
- primary target in button, optional secondary route as natural inline link;
- never stack repeated brand/pink cards.

### 16.5. Related posts

- exactly three;
- published and indexable;
- relevant to reader's next questions;
- numeric CMS relation IDs resolved only in CMS connector;
- selection is verified by readback after write.

### 16.6. CMS delivery

- create/update draft only;
- `_status=draft`;
- `workflowStatus=draft`;
- automatic publish forbidden;
- read back title, slug, status, article content, media relations, author/category, related posts;
- return exact admin edit URL: `https://cms.astrogen.com.ua/admin/collections/blogPosts/{id}`;
- final owner notification contains only useful human text and CMS admin draft URLs, not public 404 URLs or technical logs.

## 17. Image generation

### 17.1. Чинні налаштування

- provider: OpenRouter;
- model: `google/gemini-2.5-flash-image`;
- one normal paid generation;
- preferred size: `1472x822`;
- aspect ratio: 16:9;
- format: WebP preferred;
- accept provider-native output when width and height each deviate by no more than 20% and visual QA passes;
- do not upscale, stretch, destructively crop or regenerate only for dimension/format;
- a second paid generation requires a proven hard visual defect and explicit recovery;
- no alternate model automatically.

### 17.2. Subject modes

`human_scene`:

- human decisions, relationships, family/children, money/career, consultation, emotion;
- one article-specific emotional beat;
- at least two visible emotion cues;
- natural action, not static stock pose;
- occasional viewer-facing gaze only when meaningful;
- rotate setting, subject arrangement, action, emotion, gaze, framing, camera angle and props.

`abstract_graphic`:

- definitions, systems, signs, frameworks, comparisons, metrics;
- no people, faces, hands, bodies, silhouettes;
- premium minimalist 3D/paper-cut or acrylic still life;
- pale gallery/marble base, restrained burgundy/wine and warm gold, negative space;
- reference style:
  - `https://cms.astrogen.com.ua/api/media/file/hero-image-mr12ez8a-20d1660f-1472x822.webp`
  - `https://cms.astrogen.com.ua/api/media/file/hero-image-mr13ynnw-f6efd203-1472x822.webp`

### 17.3. Variation/history

- read latest 8 visual fingerprints before a human-scene prompt;
- new direction must differ from every recent fingerprint on at least 4 of 9 axes;
- avoid repeated seated person/couple at wooden table + bright window + laptop/notebook/cup/plant + burgundy sweater;
- image must reveal article meaning within two seconds without title text.

### 17.4. Hard defects

- readable text/numbers;
- language-like glyph clutter;
- fabricated UI/screen content;
- reflected fake screen on laptop lid;
- malformed hands/faces;
- incoherent symbols;
- off-topic generic wellness scene;
- near-duplicate recent cover;
- emotionally blank template-like cover.

Cover metadata:

- `alt` = exact article title;
- caption/credit/source URL empty or omitted.

## 18. Internal linking

| Target | Source themes | Natural anchors/purpose |
|---|---|---|
| `/relationships` | compatibility, conflict, repeated patterns, partnership | check/understand pair dynamics |
| `/money` | money, career, calling, self-esteem, professional cycles | understand financial patterns |
| `/children` | temperament, talents, education choice, parenting uncertainty | understand child's strengths |
| `/experts` | method choice, consultation, trust, complex request | choose a specialist |
| `/experts/astrologiya` | natal chart, solar, compatibility, astrologer questions | choose an astrologer |
| `/experts/human-design-dyzayn-lyudyny` | self-understanding, decisions, Human Design basics | choose HD specialist |

Learning graph links prerequisites -> deepening articles. Compatibility graph links pillar -> sign hubs -> pair pages -> both hubs + pillar.

Internal-link plan is part of topic readiness, not an afterthought after writing.

## 19. Автоматичні бізнес-цикли, які були налаштовані

Нова система може зберегти schedules, але реалізувати їх deterministic jobs без LLM heartbeat.

### 19.1. Daily

| Kyiv time | Process | Result |
|---:|---|---|
| 06:10 | deterministic evidence collection | compact GSC/GA4/Payload/Crawl evidence packet + upsert actions |
| 06:20 | due-URL GSC indexing audit | inspect up to 10 due URLs; route/watch/cooldown |
| 06:40 | leadership backlog triage | classify/reroute up to 10 stale/unassigned/blocker items |
| 08:30 | article capacity planner | today + 2 days matrix, healthy buffer 9 |
| 10:00 | article allocator | dispatch current deficit up to daily target/WIP cap |
| 14:00 | allocator continuation | fill only remaining same-day deficit |
| 18:00 | allocator continuation | fill only remaining same-day deficit |

### 19.2. Weekly, Wednesday–Tuesday business week

| Time | Process |
|---:|---|
| Wednesday 09:00 | SEO/GEO action cycle for completed Wed–Tue window |
| Wednesday 10:15 | CMO growth portfolio plan |
| Wednesday 11:00 | CEO business direction review |
| Wednesday 12:30 | CTO operating self-improvement review |

Tuesday 06:00 Paperclip release check was platform-specific and should not move into the new content system. Replace it with normal dependency/security update monitoring.

### 19.3. Monthly

- day 1, 08:00 — audience-first trend discovery;
- day 2, 08:30 — scaled-content/near-duplicate audit.

### 19.4. Cycle safety

- no LLM polling timers;
- deterministic scheduler, leases, retries, monitors and state transitions use zero LLM tokens;
- missed schedules skip by default;
- bounded same-day article continuation is allowed but capped;
- a single case can wait without freezing another lane;
- provider cooldown is lane-local;
- terminal status without delivery/evidence proof is not completion.

## 20. SEO/GEO process

### 20.1. Weekly evidence

- GSC property: `sc-domain:astrogen.com.ua`;
- GA4 purchases, revenue, product split, organic landing sessions/conversions;
- full Payload article inventory and publication dates;
- latest completed trusted full CrawlObserver session;
- current sitemap and route state;
- current Semantic Core accepted/review/parked inventory;
- SERP evidence only when it is needed for an action.

Use current week Wednesday–Tuesday and prior Wednesday–Tuesday. Latest two days may be provisional due to source latency.

### 20.2. Weekly decision output

For every finding:

- action now;
- watch/cooldown;
- no action;
- tracking gap;
- accountable executor;
- exact next step;
- review date;
- delivery/evidence proof.

Email is simple Ukrainian HTML + plain-text fallback. Business meaning first. No terms such as bounded session, trust gate, plugin payload, MCP status or internal route unless a developer-specific attachment is explicitly requested.

### 20.3. Historical weekly snapshot: 8–14 July 2026

| Metric | 8–14 Jul | 1–7 Jul |
|---|---:|---:|
| GSC clicks | 24 | 31 |
| GSC impressions | 413 | 540 |
| CTR | 5.81% | 5.74% |
| Average position | 10.0 | 8.0 |
| GA4 purchases | 20 | 28 |
| Revenue | 13,152 UAH | 16,704 UAH |
| Organic landing sessions | 70 | 80 |
| Organic landing conversions | 0 | 1 |

Product sales, 8–14 Jul: Solar 12 / 9,600 UAH; Money 6 / 2,664 UAH; Children 1 / 444 UAH; Relationship 1 / 444 UAH. Main WoW decline came from Money (16 -> 6 purchases), but available evidence did not prove an SEO cause.

Historical crawl 13 Jul: 233 pages; 216 HTML 2xx; 17 404; 2 internal 301; 209 indexable; 7 non-indexable.

### 20.4. Current technical SEO note

Developers later changed frontend/runtime metadata. Current spot checks show distinct page titles for `/relationships`, `/money`, `/children` and `/experts`, but sitemap still contains at least one 404 expert URL:

- `/experts/astrologiya/dar%D1%8Cya-t-1757667289145` -> 404 on 2026-08-05.

Other previously flagged normalized expert URLs for Olga and Liudmyla returned 200. New system should run a fresh full crawl, sitemap diff and metadata audit before closing historical AST-248/379/380/395 equivalents.

## 21. Scaled-content audit

Monthly deterministic candidate selection first:

- normalized title similarity;
- heading tree similarity;
- main-content semantic similarity;
- section-purpose sequence;
- repeated value generators;
- entity substitution pattern;
- unique content ratio after boilerplate removal.

Remove navigation/footer/legal text, CMS chrome, `Коротко`, CTA, related posts and decorative media before comparison.

LLM reviews only selected clusters. Outcomes: `keep`, `differentiate`, `consolidate`, `refresh`, `park`. Generation method alone is never a spam verdict.

## 22. Notifications and human communication

### 22.1. Email

Transport: Resend through a standalone email connector in the future system.

Use cases:

- weekly SEO/GEO report;
- owner action request in plain business language;
- developer handoff with exact URLs and acceptance checks;
- incident report;
- system-change report after backup and verification.

Requirements:

- explicit recipient emails; default `o.savitsky@gmail.com`;
- allowlist;
- idempotency key;
- HTML + plain text;
- real line breaks, never literal `\n\n`;
- delivery proof;
- no raw secrets or technical dumps.

### 22.2. Telegram

- proactive watches remain disabled;
- owner-facing only;
- technical stage errors do not go to Telegram;
- CMO sends final article message only after full draft delivery;
- article links are CMS admin edit URLs only;
- voice is gender-neutral;
- no public URL for an unpublished draft;
- if auth/provider outage stops all production, send one concise incident + email with recovery action, not one error per agent.

### 22.3. External ownership requests

Owner email must ask only for a decision the owner can actually make. A developer issue should explain:

- exact affected URLs;
- current behavior;
- required code/config change;
- verification commands/checks;
- rollback expectation;
- impact on business.

## 23. External integrations

| Integration | Purpose | Endpoint/source | New-system behavior |
|---|---|---|---|
| Payload CMS | inventory, media, draft create/update/readback | `https://cms.astrogen.com.ua/api` | optional connector, draft-only by policy |
| Semantic Core MCP | keywords, layers, reviews, trends, cost | `http://100.98.5.50:8001/mcp` | direct MCP client |
| SERP Winning Structure MCP | competitor/SERP structure lifecycle | `http://100.98.5.50:8000/mcp` | direct MCP client |
| GSC/GA4 MCP | search/analytics evidence | secret-backed private service | read-only collectors |
| CrawlObserver | rendered crawl/internal linking | tailnet host previously `100.102.131.83` | trusted full-session gate |
| OpenRouter image | one cover generation | API via secret | model/project settings, cost event |
| Claude CLI | article writing only | local authenticated CLI | isolated writer worker |
| OpenAI/Codex | bounded strategy/validation | API/CLI according to project | never scheduler/polling |
| Resend | HTML emails | API via secret | idempotent delivery |
| Telegram Bot API | final owner notifications/incidents | API via secret | no proactive watches |

## 24. Secret references

Store values only in the new service secret vault. Migrate by key name, never by printing values.

Required/likely:

- `astrogen_payload_cms_api_key`;
- `semantic-core-mcp-token`;
- `winning-structure-mcp-token`;
- `search-console-mcp-astrogen-token`;
- `crawlobserver-api-key`;
- `openrouter_api_key_4images`;
- `resend-api-key`;
- `telegram.bot_token.astrogen_ai_bot`;
- OpenAI credential;
- Claude CLI authenticated account/session handled outside project DB where possible.

Parked/not required for initial migration:

- DataForSEO direct credentials, because Semantic Core/Winning Structure own provider calls;
- Serper direct connector unless a non-Winning-Structure use case is approved;
- Exa;
- Bright Data;
- Collaborator/backlink provider;
- OpenRouter text key;
- Perfex.

## 25. Cost accounting

Every external call stores:

- tenant/project/job/stage;
- provider/model/tool;
- request count;
- input/output/cached tokens when available;
- provider-reported actual USD;
- estimated USD only when actual is absent;
- cache hit/miss;
- immutable provider event/reference;
- timestamp and idempotency key.

Rules:

- `null` cost means unknown, never zero;
- partial priced subtotal is a lower bound, not total;
- actual provider cost wins over estimate;
- one image generation normally;
- no repeated SERP/semantic provider call when a compatible cached/run artifact exists;
- all timers, leases, monitors, dedupe and routing are deterministic and token-free.

Historical evidence of architecture overhead: on 2026-05-21/22, 84 idle manager timer heartbeats consumed 26,543,631 input tokens and only 27,714 output tokens. This is why the new service must not model orchestration as repeated LLM conversations.

## 26. Фактичний CMS snapshot

Snapshot 2026-08-05:

- all CMS: 129 records;
- published: 101;
- drafts: 28;
- max ID: 144;
- IDs 71–144 period: 71 records, 48 published, 23 drafts;
- all 71 records have `coverImage == ogImage` and non-null media;
- all 71 have exactly 3 `relatedPosts` relations.

Наявність blocks/relations не гарантує substantive quality. IDs `137/138` мають known curriculum defects; `130` violates paused topic policy; older published articles may lack canonical `Коротко` title even if they contain an editorial callout.

### 26.1. Реєстр IDs 71–144

| ID | Status | Title | Slug |
|---:|---|---|---|
| 71 | published | Рак знак зодіаку: які риси приписують Раку і де загальний опис уже не працює | `rak-znak-zodiaku-yaki-rysy-prypysuiut-raku` |
| 72 | published | Скорпіон знак зодіаку: що зазвичай мають на увазі і де починаються перебільшення | `skorpion-znak-zodiaku-shcho-zazvychaino-maiut-na-uvazi` |
| 73 | draft | Діва знак зодіаку: дати, риси, сумісність і межі загального опису | `diva-znak-zodiaku-yaki-rysy-ii-prypysuiut` |
| 74 | published | Характери знаків зодіаку: як читати типові описи без шаблонних ярликів | `kharaktery-znakiv-zodiaku-yak-chytaty-typovi-opysy` |
| 75 | published | Символи знаків зодіаку: що означають позначки 12 знаків і як не плутати їх між собою | `symvoly-znakiv-zodiaku-shcho-oznachaiut-poznachky-12-znakiv` |
| 76 | published | Близнюк знак зодіаку: що ховається під маскою Близнюків? | `blyzniuk-znak-zodiaku-shcho-zazvychaino-maiut-na-uvazi` |
| 77 | published | Телець знак зодіаку: які риси приписують Тельцю і де починаються спрощення | `telets-znak-zodiaku-yaki-rysy-prypysuiut-teltsiu` |
| 78 | draft | Стрільці знак зодіаку: що зазвичай мають на увазі і де починаються узагальнення | `striltsi-znak-zodiaku-shcho-zazvychaino-maiut-na-uvazi` |
| 79 | draft | Водолій знак зодіаку: які риси йому приписують і де загальний опис уже не працює | `vodolii-znak-zodiaku-yaki-rysy-iomu-prypysuiut` |
| 80 | published | Козеріг знак зодіаку: які риси є притаманними саме цьому знаку? | `kozerih-znak-zodiaku-yaki-rysy-zazvychaino-shukaiut` |
| 81 | published | Сузір'я знаків зодіаку: чим вони відрізняються від астрологічних знаків і чому це плутають | `suziria-znakiv-zodiaku-chym-vony-vidrizniaiutsia-vid-astrolohichnykh-znakiv` |
| 82 | published | Вогняний знак зодіаку: що спільного в Овна, Лева і Стрільця та де загальні риси вже спрощують | `vohnianyi-znak-zodiaku-shcho-spilnoho-v-ovna-leva-i-striltsia` |
| 83 | published | Земні знаки зодіаку: що об'єднує Тельця, Діву і Козерога | `zemni-znaky-zodiaku-shcho-obiednuie-teltsia-divu-i-kozeroha` |
| 84 | published | Знак зодіаку Терези: які риси зазвичай шукають і де починаються спрощення | `znak-zodiaku-terezy-yaki-rysy-zazvychaino-shukaiut` |
| 85 | draft | Терези знак зодіаку жінка: які риси зазвичай шукають і де гендерні шаблони спотворюють опис | `terezy-znak-zodiaku-zhinka-yaki-rysy-zazvychaino-shukaiut` |
| 86 | published | Гороскоп лев: як читати прогнози для Лева без фатальних висновків | `horoskop-lev-yak-chytaty-prohnozy-dlia-leva` |
| 87 | published | Любовний гороскоп: бути разом чи розійтися? | `liubovnyi-horoskop-yak-chytaty-prohnozy-pro-stosunky` |
| 88 | published | Гороскоп рак: як читати прогнози для Рака без зайвої тривоги | `horoskop-rak-yak-chytaty-prohnozy-dlia-raka` |
| 89 | published | Гороскоп скорпіон: як читати прогнози для Скорпіона без фатальних висновків | `horoskop-skorpion-yak-chytaty-prohnozy-dlia-skorpiona` |
| 90 | published | Гороскоп телець: як читати прогнози для Тельця і не зводити все до одного знака | `horoskop-telets-yak-chytaty-prohnozy-dlia-teltsia` |
| 91 | published | Гороскоп овнів: як читати прогнози для Овнів і не плутати їх із персональним розбором | `horoskop-ovny-yak-chytaty-prohnozy-dlia-ovniv` |
| 92 | published | Гороскоп близнюки: як читати прогнози для Близнюків без зайвих ярликів | `horoskop-blyzniuky-yak-chytaty-prohnozy-dlia-blyzniukiv` |
| 93 | published | Гороскоп діви: як читати прогнози для Діви без перфекціоністських ярликів | `horoskop-divy-yak-chytaty-prohnozy-dlia-divy` |
| 94 | published | Гороскоп риби: як читати прогнози для Риб без зайвої тривоги | `horoskop-ryby-yak-chytaty-prohnozy-dlia-ryb` |
| 95 | published | Гороскоп терези: як читати прогнози для Терезів і не сприймати як вирок | `horoskop-terezy-yak-chytaty-prohnozy-dlia-tereziv` |
| 96 | published | Гороскоп стрілець: як читати прогнози для Стрільця без фатальних обіцянок | `horoskop-strilets-yak-chytaty-prohnozy-dlia-striltsia` |
| 97 | published | Квітень знак зодіаку: які знаки припадають на місяць і де проходить межа | `kviten-znak-zodiaku-yaki-znaky-prypadaiut-na-misiats` |
| 98 | published | Грудень знак зодіаку: які знаки припадають на місяць і де проходить межа | `hruden-znak-zodiaku-yaki-znaky-prypadaiut-na-misiats` |
| 99 | published | Жовтень: які знаки припадають на місяць і як читати межові дати | `zhovten-znak-zodiaku-yaki-znaky-prypadaiut-na-misiats` |
| 100 | published | Травень: які знаки припадають на цей місяць і що важливо на межі дат | `traven-znak-zodiaku-yaki-znaky-prypadaiut-na-misiats` |
| 101 | published | Березень: які знаки припадають на місяць і як не помилитися на межі | `berezen-znak-zodiaku-yaki-znaky-prypadaiut-na-misiats` |
| 102 | published | Гороскоп для всіх знаків зодіаку: як користуватися загальним прогнозом без фаталізму | `horoskop-dlia-vsikh-znakiv-zodiaku-bez-fatalizmu` |
| 103 | published | Знак зодіаку по роках: як швидко визначити свій східний знак і не змішати його із західним | `znak-zodiaku-po-rokakh-yak-shvydko-vyznachyty-svii-skhidnyi-znak` |
| 104 | published | Гороскоп близнюків на тиждень: чим загальний прогноз відрізняється від персонального тижневого гороскопу Astrogen | `horoskop-blyzniukiv-na-tyzhden-personalnyi-tyzhnevyi-horoskop` |
| 105 | draft | Як читати астрологічний розбір без самообману | `yak-chytaty-astrolohichnyi-rozbir-bez-samoobmanu` |
| 106 | published | Чому ви не можете прийняти рішення, навіть коли вже знаєте відповідь | `yak-zrozumity-shcho-vam-potribne-pidtverdzhennia-a-ne-shche-porady` |
| 107 | published | Не знаємо, на кого поступати: як батькам використовувати дитячу натальну карту для вступу до ВНЗ | `ne-znaiemo-na-koho-postupaty-dytiachyi-rozbir-bez-vyroku` |
| 108 | published | Листопад знак зодіаку: які знаки припадають на місяць і як читати межові дати | `lystopad-znak-zodiaku-yaki-znaky-prypadaiut-na-misiats` |
| 109 | published | Вирішили змінити роботу? Як використовувати фінансову натальну карту для звірки, а не для втечі від вибору | `finansova-natalna-karta-pered-rishennyam-pro-robotu-abo-groshi` |
| 110 | published | Коли хочеться звіритися з собою перед новим особистим роком: де соляр справді доречний | `solar-pered-dnem-narodzhennia-osobystyi-rik` |
| 111 | published | Як допоможе аналіз сумісності пари у зрілих стосунках? | `sumisnist-bez-iliuzii-koly-vy-vzhe-vse-rozumiiete` |
| 112 | published | Коли у дитини багато здібностей: які питання ставити перед вибором напрямку навчання | `koly-u-dytyny-bahato-zdibnostej` |
| 113 | published | Повітряні знаки зодіаку: які спільні риси Близнюків, Терезів і Водолія | `povitriani-znaky-zodiaku-yak-chytaty-spilni-rysy-blyzniukiv-tereziv-i-vodoliia` |
| 114 | published | 23 жовтня знак зодіаку: Терези чи Скорпіон і чому межова дата потребує обережності | `23-zhovtnia-znak-zodiaku-terezy-chy-skorpion` |
| 115 | published | Які риси притаманні жінкам зі знаком зодіаку Стрілець | `strilets-znak-zodiaku-zhinka-yaki-rysy-zazvychaino-shukaiut` |
| 116 | published | Нумерологія онлайн: що можна перевірити самостійно, а де потрібен фахівець | `numerologiya-online` |
| 117 | published | Я не знаю свій час народження — що робити? | `ne-znayu-chas-narodzhennya-shcho-robyty` |
| 118 | draft | Таролог чи астролог: у чому різниця і коли до кого звертатися | `tarolog-chy-astrolog-u-chomu-riznytsya-i-koly-do-koho-zvertatysya` |
| 119 | draft | Натальна карта сумісності: як краще зрозуміти стосунки | `natalna-karta-sumisnosti-yak-zrozumity-stosunky-bez-zavyshchenykh-ochikuvan` |
| 120 | draft | Дизайн людини онлайн: що це таке і як проходить консультація | `dyzayn-lyudyny-online` |
| 121 | draft | Матриця долі онлайн: що показує розрахунок і коли краще звернутися до експерта | `matrytsya-doli-online-rozrahunok-chy-ekspert` |
| 122 | draft | Родові практики: з якими запитами приходять і як зрозуміти, чи це ваш формат | `rodovi-praktyky-zapyty-pidhotovka-format` |
| 123 | draft | Кармологія: що це таке і коли консультація може бути доречною | `karmolohiya-shcho-tse-i-koly-dorechna-konsultatsiya` |
| 124 | draft | Перша консультація таролога: які питання підготувати і чого не очікувати | `persha-konsultatsiia-taroloha-iaki-pytannia-pidhotuvaty` |
| 125 | published | Нумерологія онлайн: коли достатньо розрахунку, а коли потрібен експерт | `numerologiya-online-koly-dostatno-rozrakhunku-a-koly-potriben-ekspert` |
| 126 | published | Тарологи онлайн: як обрати спеціаліста і сформулювати запит | `tarologists-online-how-to-choose-specialist` |
| 127 | draft | Матриця долі онлайн: що показує розрахунок і як не перебільшити значення | `matrytsia-doli-online` |
| 129 | draft | Натальна карта онлайн: що показує розрахунок і як читати його без перебільшень | `natalna-karta-online-shcho-pokazuye-rozrahunok-i-yak-chytaty-yogo-bez-perebilshen` |
| 130 | draft, exclude | Гороскоп Скорпіона на сьогодні: на що звернути увагу | `horoskop-skorpiona-na-sogodni` |
| 133 | published | Як обрати між залишитися за кордоном і повернутися в Україну | `yak-obraty-mizh-zalyshytysia-za-kordonom-i-povernutysia-v-ukrainu` |
| 134 | published | Як порівняти витрати на переїзд і нову роботу | `yak-porivnyaty-vytraty-na-pereyizd-i-novu-robotu` |
| 135 | published | Стосунки на відстані: як домовитися про зв'язок | `stosunky-na-vidstani-yak-domovytysia-pro-zviazok` |
| 136 | draft | Що означає сленг у переписці з хлопцем: як читати повідомлення без зайвих висновків | `shcho-oznachaie-slenh-u-perepystsi-z-khloptsem` |
| 137 | draft, rework | Аспекти в натальній карті: що означають зв'язки між планетами без фаталізму | `aspekty-v-natalnii-karti-shcho-oznachaiut` |
| 138 | draft, review | Будинки в натальній карті: що вони означають і як не перебільшувати висновки | `budynky-v-natalnii-karti-shcho-oznachaiut` |
| 139 | published | Рак і Скорпіон сумісність | `rak-i-skorpion-sumisnist` |
| 140 | draft | Що означає планета в натальній карті | `planeta-v-natalnii-karti-shcho-oznachaie` |
| 141 | draft | Що означає знак зодіаку в натальній карті | `znak-zodiaku-v-natalnii-karti-shcho-oznachaie` |
| 142 | draft | Телець і Скорпіон сумісність | `telec-i-skorpion-sumisnist` |
| 143 | draft | Риби сумісність з іншими знаками | `ryby-sumisnist-z-inshymy-znakamy` |
| 144 | draft | Рак сумісність з іншими знаками | `rak-sumisnist-z-inshymy-znakamy` |

- Шаблон URL опублікованої статті: `https://astrogen.com.ua/blog/{slug}`.
- Шаблон URL редагування чернетки: `https://cms.astrogen.com.ua/admin/collections/blogPosts/{id}`.

## 27. Continuation baseline для нової системи

Не імпортувати ці rows одразу як `ready`. Спочатку виконати full ownership scan. Рекомендований старт:

### 27.1. Імпорт і звірка

1. Імпортувати всі 129 CMS records із status, slug, canonical, SEO fields, content hash, headings, category, media, related posts.
2. Створити canonical ownership map.
3. Позначити date/today drafts як excluded.
4. Позначити curriculum overload drafts `137/138` на substantive review.
5. Позначити trend/product narrowing examples як invalid training evidence.
6. Імпортувати 164 accepted keywords, 47 review rows, clusters, parked і rejected ledgers.
7. Dedupe semantic rows into intent clusters.
8. Reconstruct plan matrix `12/5/3/3/2` only from uncovered/repairable evidence.

### 27.2. Перші контентні напрями

Curriculum:

- resolve owner for natal-chart pillar;
- validate drafts `140`, `141`, `138` in publication order;
- rework or replace `137` as one-concept article;
- prepare next prerequisite-ready node only.

Compatibility:

- resolve duplicate pillar ownership among IDs `45/61` and related pages;
- validate keyword packets for 12 sign hubs;
- validate drafts `142–144`;
- rank first 12–20 canonical pair pages by Ukraine demand;
- release at most one compatibility article per daily batch.

Audience-first:

- use published `133–135` and draft `136` as coverage/learning evidence;
- run a fresh trend report only after explicit provider enablement;
- avoid another cluster that is merely the same return-to-Ukraine theme in different words;
- maintain 2–4 audience-interest editorial articles per month.

Trust/method:

- check owner overlap across `116`, `118`, `120–127` and older catalog articles;
- route overlap to refresh/merge/internal-link;
- create new only for a distinct uncovered reader decision.

Commercial:

- select only accepted uncovered high-value clusters with real search demand;
- product page owner takes precedence unless an informational page has a distinct task;
- measure CTA transitions and sales, not only impressions.

## 28. Відомі помилки Paperclip, які не можна переносити

### 28.1. Orchestration by LLM conversation

Repeated full-context heartbeats consumed huge tokens and still stranded work. New system: deterministic scheduler/state machine; LLM only at bounded content/review stages.

### 28.2. Manager as executor

CEO/CMO іноді намагалися вирішувати specialist details або завершували parent після partial result. New system: managers select/route/verify; stage services execute.

### 28.3. Completion without proof

Layout-ready або child done помилково трактувалися як article done. New completion requires CMS draft readback + media + CTA + 3 related + delivery proof.

### 28.4. Permission-driven deadlocks

`pipelines:write` blockers, parent-child evidence visibility і exceptions створювали цикли. New system: один service-owned DB/state machine, stage-scoped permissions, explicit artifact references, no cross-agent hidden evidence.

### 28.5. Raw schema work by agents

Agents manually formed work-product/CMS schema and failed on `attachmentId`, aliases, 32K/48K limits. New system: SDK functions create artifacts/attachments/CMS payloads; LLM never writes transport envelopes.

### 28.6. Stale contracts

Live agent instructions drifted from manifests. New system: project policy version pinned to each job; JSON Schema/OpenAPI contract tests before activation.

### 28.7. Duplicate recovery chains

Retry created another issue/task instead of resuming same job. New system: stable job/stage idempotency keys, one retry state, one monitor, no duplicate parent.

### 28.8. Trend product narrowing

Audience signal був перетворений на product/modality article. New system: trend source fingerprint and title/query integrity gate.

### 28.9. Phrase-level topic duplication

One intent became several topics because `intentClusterKey` was empty. New system rejects planning rows without cluster fields and merges supporting queries before insert.

### 28.10. Provider spend leakage

Long instruction-like SERP queries caused roughly $15 unnecessary spend. New system enforces max 4 words for trend SERP queries before provider call, preflight cost caps, cache policy and explicit paid-operation authorization.

### 28.11. Image repetition and overgeneration

Similar laptop/table scenes and expensive model/retries. New system stores visual fingerprints, uses one configured model/generation, accepts dimensions within 20%, and retries only proven defects.

### 28.12. Owner-facing technical noise

Raw English protocol errors went to Telegram/email. New system separates operator logs, developer reports and owner business messages.

## 29. Архітектура нової системи

Рекомендований продукт: standalone **Content Production Service**, описаний у `.planning/agency-core/CONTENT_PRODUCTION_SERVICE_PRD.md`. Astrogen profile: `.planning/company/astrogen/CONTENT_PRODUCTION_SERVICE_PROJECT_PROFILE.md`.

### 29.1. Необхідні компоненти

- REST API;
- MCP server;
- Administrative GUI;
- PostgreSQL;
- deterministic scheduler/queue/worker;
- policy/version store;
- content-plan and ownership engine;
- Semantic Core client;
- SERP Winning Structure client;
- Claude writer worker;
- OpenAI validation workers;
- image worker;
- optional Payload connector;
- cost ledger;
- process logs with rotation and 7-day retention;
- Sentry backend/frontend integration;
- secret vault references;
- immutable audit/artifact store.

### 29.2. Основні сутності БД

- tenants/projects;
- project policy versions;
- audience segments;
- products/routes/categories;
- semantic keywords/clusters/lifecycle decisions;
- CMS page inventory and ownership map;
- trend reports/hypotheses;
- search-demand opportunities;
- content-plan topics/reservations;
- article jobs/stage runs;
- artifacts/attachments;
- SERP Winning Structure runs/decisions/results;
- visual fingerprints/media;
- CMS deliveries/readbacks;
- internal-link graph;
- measurements/actions;
- provider/token/cost events;
- notifications/delivery proofs;
- schedules/leases/retries;
- access tokens/secret bindings/audit log.

### 29.3. Межі сервісу

Ядро сервісу має бути незалежним від конкретної CMS і повертати Markdown + HTML + структурований content package. Доставка в Payload є опціональним connector profile. Це дає змогу повторно використовувати сервіс в інших компаніях, а Astrogen отримувати повністю перевірену CMS-чернетку.

Ядро не комунікує назовні безпосередньо, крім налаштованих API/MCP/connectors. Email/Telegram є опціональними delivery connectors і ніколи не вбудовуються жорстко в логіку статті.

## 30. Migration sequence

1. Create Astrogen project and versioned policy in the new service.
2. Add secret bindings by reference; smoke-test without logging values.
3. Import product routes, categories and audience segments.
4. Import full Payload inventory and build canonical ownership map.
5. Import Semantic Core outputs and lifecycle decisions.
6. Reconcile intent clusters and duplicate owners.
7. Import curriculum and compatibility graphs.
8. Reconstruct 25-topic rolling plan; no row ready before ownership gate.
9. Configure SERP Winning Structure modes and cost policy.
10. Configure Claude writer and OpenAI validators.
11. Configure image policy and seed visual history from CMS media.
12. Configure Payload draft connector and readback checks.
13. Configure daily/weekly/monthly schedules, initially disabled.
14. Run one new-article canary without publication.
15. Run one refresh canary preserving media and producing before/after diff.
16. Verify costs, retries, idempotency, independent blocker isolation and notifications.
17. Activate one daily slot, then three slots only after stable completion.

## 31. Критерії повної заміни Paperclip

Нова система замінює процеси Paperclip лише тоді, коли:

1. All project settings are editable through API/MCP/GUI.
2. Full CMS inventory and ownership map are current.
3. Semantic Core accepted/review/parked/rejected lifecycle is imported and refreshable.
4. Content plan is a real DB view with 25 eligible rows and `12/5/3/3/2` matrix or explicit deficient-lane evidence.
5. Duplicate/cannibalization gate chooses exactly one action.
6. Trend topics remain audience-first.
7. Curriculum enforces one concept per article.
8. SERP Winning Structure can be off/required/conditional/provided/on-demand.
9. One article completes end to end without manual intervention.
10. CMS draft contains accepted text, `Коротко/soft`, CTA, cover/OG and exactly 3 related posts.
11. No automatic publish occurs.
12. Refresh preserves valid media and produces before/after diff.
13. One blocked article does not stop another.
14. Provider retries are bounded and idempotent.
15. Trend SERP query >4 words is rejected before spend.
16. Actual/estimated costs and tokens are visible per job/stage/provider.
17. Weekly SEO report contains executable next actions in simple HTML email.
18. Technical logs do not leak into Telegram/owner email.
19. Logs rotate with 7-day retention and Sentry has scrubbed events.
20. No secret value appears in DB exports, logs, Sentry, Git or artifacts.

## 32. Історичні файли: використовувати обережно

- `.planning/company/astrogen/CONTENT_PLAN_AND_INTERNAL_LINKING_UA.md` — historical 26 Jun–9 Jul product-heavy plan, not current rolling plan.
- `.planning/company/astrogen/STATE.md` — valuable chronology but contains superseded writer/heartbeat decisions.
- `.planning/company/astrogen/EXECUTION_LOG.md` — detailed history and incident evidence.
- `.planning/company/astrogen/PAPERCLIP_ENTITY_MAP.md` — old company/entity IDs and obsolete SEO Performance Loop references.
- `ops/paperclip-astrogen-clean/manifests/` — best source for final Paperclip behavior, but translate into independent service contracts.
- `ops/paperclip-astrogen-clean/scripts/` — incident repair evidence, not reusable production architecture.

Plugin SEO Performance Loop був вимкнений і видалений. Не відновлювати його. Корисні принципи перенесені у native search-demand/weekly SEO process цього документа.

## 33. Фінальне правило продовження робіт

Не продовжувати з останньої Paperclip issue або chat comment. Продовжувати з:

1. live CMS inventory;
2. current Semantic Core lifecycle;
3. current product/routes snapshot;
4. versioned Astrogen policies;
5. reconstructed ownership map;
6. reconstructed rolling content plan;
7. deterministic stage state in the new service.

Це дозволяє зберегти бізнес-логіку і результати Astrogen, не переносячи Paperclip-specific issue graph, agent heartbeat overhead, permission deadlocks і runtime drift.
