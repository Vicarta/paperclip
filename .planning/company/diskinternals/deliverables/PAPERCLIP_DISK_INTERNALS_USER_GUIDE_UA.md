# Гайд Користувача Paperclip Для DiskInternals

## Для Чого DiskInternals Використовує Paperclip

Paperclip налаштований як операційна система росту для DiskInternals. Його задача не в тому, щоб просто створювати багато текстів або постійно запускати агентів. Його задача - перетворювати бізнес-цілі на контрольовану роботу, яка може покращувати органічний трафік, trial downloads, переходи на сторінки замовлення, покупки ліцензій, ефективність продуктових сторінок і перспективи локалізації.

Практична логіка така: людина описує бізнес-проблему або можливість, Paperclip маршрутизує її до потрібного рівня керівництва і спеціалістів, агенти готують результат на основі даних, валідатори перевіряють якість, а затверджені задачі для сайту передаються людям через Perfex CRM.

Основні робочі цикли:

- знаходити продукти і сторінки з найбільшим потенціалом росту;
- розуміти, які пошукові наміри і кластери важливі для продуктів;
- готувати implementation-ready briefs, а не загальні поради;
- передавати зміни сайту людям через Perfex CRM;
- перевіряти, чи зміни вплинули на кліки, покази, позиції, завантаження, переходи на order page і покупки.

## Як Думати Про Paperclip

Paperclip краще сприймати не як чат з окремим агентом, а як систему запуску бізнес-процесів.

Починати потрібно з бізнес-питання:

- Який продукт має отримати пріоритет?
- Яку сторінку потрібно оновити?
- Який пошуковий кластер потребує сторінки, статті або внутрішніх посилань?
- На якому етапі воронки користувачі губляться?
- Чи є достатній сигнал для локалізації?
- Яку завершену зміну потрібно проіндексувати і виміряти?

Після цього Paperclip перетворює питання на workflow. Користувачеві не потрібно вручну обирати всіх агентів. Достатньо описати бізнес-ціль, контекст, обмеження і очікуваний результат. Manager agents відповідають за маршрутизацію.

## Рівні Керівництва

### CEO

CEO використовується для стратегічних пріоритетів і бізнес-ризиків. Це рівень, на якому вирішуються питання напряму, пріоритетів і схвалення ризикових дій.

Типові задачі для CEO:

- визначити, які продуктові напрями важливіші зараз;
- оцінити, чи варто фокусуватись на трафіку, завантаженнях, покупках або launch readiness;
- прийняти рішення, якщо робота потребує зміни пріоритету або бізнес-стратегії;
- переглянути, чи завершені зміни дали достатній результат, щоб продовжувати напрям.

CEO не повинен займатися деталями семантичного ядра або тексту сторінки. Його роль - стратегічне рішення і контроль бізнес-ефекту.

### CMO

CMO виконує роль Growth PM. Це головна точка входу для більшості growth-задач. CMO перетворює бізнес-ціль на backlog, визначає правильний workflow і делегує роботу спеціалістам.

Типові задачі для CMO:

- зібрати семантичне ядро для продукту або нового ринку;
- визначити, які сторінки оновлювати першими;
- сформувати backlog для VMFS, RAID, Linux Reader, Linux Writer, checkout або локалізації;
- маршрутизувати задачу до SEO, CRO, localization, internal linking або Perfex handoff;
- прийняти або відхилити результат спеціаліста;
- вирішити, чи потрібно створювати implementation task для людини.

Якщо користувач не впевнений, кому ставити growth-задачу, найчастіше її потрібно ставити CMO.

### CTO

CTO відповідає за технічну надійність системи росту. Це не роль для написання маркетингового тексту. CTO має стежити, щоб дані, плагіни, MCP adapters, BigQuery exports, crawler logic і Paperclip runtime працювали коректно.

Типові задачі для CTO:

- перевірити доступність або якість BigQuery data;
- виправити plugin або MCP runtime проблему;
- розібратись, чому агент або workflow застряг;
- проконтролювати crawler rate limits і URL inventory;
- перевірити якість analytics events і attribution;
- виконати deployment або server health verification.

### OPS І Human Interaction

OPS і Human Interaction потрібні, щоб задачі не зависали мовчки. Вони допомагають із human decisions, блокерами, ескалаціями, нагадуваннями і перевіркою handoff між parent і child issues.

Типові ситуації:

- задача перейшла в `blocked` і потрібно чітко вказати, хто має її розблокувати;
- child issue виконаний, але parent issue ще потребує рішення;
- агент чекає рішення людини;
- workflow зупинився без зрозумілої причини;
- потрібна перевірка, чи задача має наступний owner.

## Групи Агентів

### SEO

SEO відповідає за органічний пошуковий ріст. Саме SEO має володіти семантичними ядрами, blog strategy, article briefs, article writing, article validation, search performance, internal linking, indexation і page refresh recommendations.

Типові результати SEO:

- semantic core з accepted, review, parked і rejected keywords;
- keyword clusters і SERP segments;
- рекомендації page-to-keyword targeting;
- blog brief або article draft;
- validation report;
- internal linking plan;
- indexing або monitoring queue.

Важливе правило: робота над блогом належить SEO.

### MKT

MKT відповідає за ринок, аудиторію, продукт, offer і funnel context. MKT корисний перед SEO або паралельно з SEO, якщо не до кінця зрозуміло, для кого продукт, які use cases важливі, яка бізнес-пропозиція або які objections має закрити сторінка.

Типові результати MKT:

- product discovery;
- audience і use-case analysis;
- offer і funnel strategy;
- conversion brief;
- campaign або landing-page positioning.

MKT не повинен володіти blog production. Він допомагає пояснити, кому і навіщо потрібна сторінка.

### DATA

DATA працює з BigQuery-backed GA4/GSC exports, product/page scoring, URL inventory і opportunity reports. Його роль - перетворити сирі дані на пріоритети для роботи.

Типові результати DATA:

- Product Proxy Score;
- Page Action Score;
- GSC opportunity report;
- GA4 funnel report;
- URL inventory і normalization checks;
- data quality warnings.

Для DiskInternals BigQuery є операційним джерелом правди для GA4/GSC-derived data.

### CRO

CRO відповідає за conversion experiments. Це робота з download clicks, order-page visits, checkout flow, CTA, popup scenarios і uncertainty reduction.

Типові результати CRO:

- experiment hypothesis;
- target URLs і target segment;
- запропонована зміна copy, CTA, popup або layout;
- success metric і guardrail metric;
- measurement window;
- rollback rule.

CRO може працювати паралельно з SEO, якщо сторінка має достатньо трафіку або бізнес-цінності.

### Localization

Localization не запускається просто тому, що є країна або мова. Потрібен сигнал: country demand, GSC signal, product priority, funnel signal і прийнятна вартість впровадження.

Типові результати:

- localization candidate queue;
- market-specific page або content brief;
- risk notes для перекладу, product fit, support і compliance;
- follow-up metrics після публікації.

### QA

QA захищає DiskInternals від ризикового або неякісного output.

QA має відхиляти:

- необґрунтовані гарантії recovery;
- неправильні compatibility claims;
- неправильну маршрутизацію продукту;
- price або discount claims без джерела;
- cannibalization між сторінками;
- briefs без affected URLs, acceptance criteria або measurement logic.

### ADS

ADS відповідає за paid search і paid campaign work. Його потрібно використовувати для рекламних запитів, paid keywords, ad copy і paid landing-page feedback. ADS не є власником organic semantic core або blog work.

### SOC

SOC - це логічний напрям для social content planning і social publishing calendar. SOC відокремлений від SEO blog work і MKT funnel strategy. Якщо запускається social content, його потрібно маршрутизувати в SOC, а не змішувати з blog або market research ролями.

## Основні Бізнес-Процеси

### 1. Product Opportunity Workflow

Бізнес-задача: визначити, який продукт має отримати growth work наступним.

Процес:

1. CMO отримує бізнес-ціль.
2. DATA підтягує BigQuery-backed product і URL signals.
3. MKT уточнює product, audience і use cases, якщо контекст неповний.
4. CMO формує prioritized backlog.
5. Спеціалісти отримують child issues для SEO, CRO, localization, internal linking або Perfex handoff.
6. CEO отримує business-level summary, якщо рішення впливає на пріоритет.

Очікуваний результат: список product/page opportunities з бізнес-логікою, affected URLs, очікуваними метриками і наступним owner.

### 2. Semantic Core Workflow

Бізнес-задача: зрозуміти search demand для продукту, групи сторінок або нового ринку.

Процес:

1. CMO перевіряє, чи вже є product discovery.
2. Якщо product context неповний, MKT Product Discovery виконується першим.
3. SEO Semantic Core Strategist використовує Semantic Core MCP plugin.
4. Semantic run має покривати релевантні layers:
   - `core_product_intent`
   - `adjacent_use_case_intent`
   - `audience_need_intent`
   - `audience_interest_intent`
5. SEO переглядає accepted, review, parked і rejected keywords.
6. Validation перевіряє relevance, volume fields, clusters, SERP segments і page targeting.
7. CMO вирішує, що робити далі: page briefs, article briefs, internal links або monitoring targets.

Очікуваний результат: semantic core artifact з geo і global volume, keyword clusters, SERP segments, review queue і proposed page targets.

### 3. Existing Page Refresh Workflow

Бізнес-задача: покращити існуючу сторінку, яка має traffic, impressions, rankings або conversion potential.

Процес:

1. DATA знаходить URL через BigQuery reports, sitemap inventory, GSC queries або Page Action Score.
2. CMO маршрутизує opportunity до SEO, CRO, internal linking, localization або QA.
3. SEO готує search-intent і content recommendations.
4. CRO додає conversion recommendations, якщо сторінка має funnel value.
5. QA перевіряє claims, product routing і implementation clarity.
6. Perfex preview готується для людського впровадження.
7. Після human verification запускається indexing і follow-up measurement.

Очікуваний результат: implementation-ready brief з exact URL, requested changes, rationale, acceptance criteria і measurement plan.

### 4. New Page Or Article Workflow

Бізнес-задача: створити нову сторінку або статтю, якщо наявні сторінки не закривають цінний intent.

Процес:

1. CMO визначає, що потрібно: product page, hub page, support page, article або localization.
2. SEO використовує semantic-core evidence і SERP analysis.
3. MKT уточнює product positioning, якщо offer або audience незрозумілі.
4. SEO готує brief або draft.
5. SEO validator і QA перевіряють результат.
6. CMO вирішує, чи результат переходить у Perfex implementation task.

Очікуваний результат: validated brief або draft з target keyword cluster, user intent, page purpose, content structure, claims checklist і follow-up metric.

### 5. CRO Experiment Workflow

Бізнес-задача: покращити downloads, order-page visits, checkout progress або purchase intent.

Процес:

1. DATA знаходить funnel issue через BigQuery.
2. CMO маршрутизує задачу до CRO.
3. CRO пропонує experiment з target pages і measurable hypothesis.
4. QA перевіряє, що experiment не створює misleading claims.
5. Perfex handoff готує human implementation task.
6. Follow-up порівнює визначені metric windows після впровадження.

Очікуваний результат: контрольований experiment proposal, а не загальна design-задача.

### 6. Localization Workflow

Бізнес-задача: вирішити, чи потрібно локалізувати сторінку або контент для конкретного ринку.

Процес:

1. DATA перевіряє country, query, page і funnel signal.
2. Localization agent оцінює business fit і product priority.
3. SEO перевіряє search intent і page type для мови.
4. CMO approve, park або route to implementation.
5. Perfex handoff використовується тільки коли задача готова до впровадження.

Очікуваний результат: localization candidate з evidence, target URLs, target language/market, page type, risk notes і follow-up metric.

### 7. Human Implementation Handoff

Бізнес-задача: перетворити затверджену Paperclip recommendation на задачу для людини, яка змінює сайт.

Процес:

1. Агент готує Perfex-ready payload.
2. Payload містить affected URLs, exact requested changes, source evidence, QA checklist, acceptance criteria і related Paperclip issue.
3. У setup mode Perfex writes вимкнені, тому зазвичай готується preview.
4. Реальне створення задачі виконується тільки після human approval і коли writes увімкнені.
5. Perfex status і comments читаються назад.
6. Тільки verified completed work з changed URLs переходить до indexing і follow-up measurement.

Очікуваний результат: зрозуміла задача для людини, а не розмита рекомендація агента.

## Плагіни І Їх Бізнес-Роль

### BigQuery Growth Data

Використовується для GA4/GSC-derived reports, URL inventory, product/page scoring, sitemap data, crawl state і opportunity routing. Це основний data path для growth decisions.

### Semantic Core MCP

Використовується для генерації semantic core across product, adjacent use case, audience need і audience interest layers. Повертає keyword volumes, clusters, SERP segments, review queues, costs і Paperclip import payloads.

### Winning Structure MCP

Використовується для аналізу SERP structure і рекомендацій щодо структури сторінки або контенту. Його output потребує review перед implementation task.

### Perfex CRM

Використовується для human website implementation handoff. Має створювати або preview implementation tasks з affected URLs, exact changes, QA checklist і Paperclip references. Реальні writes залишаються approval-gated.

### SEO Performance Loop

Використовується для post-publication і search-performance follow-up. Допомагає пов'язувати completed changes з подальшою видимістю і performance checks.

### Exa, Serper, DataForSEO, Bright Data

Використовуються для research, SERP, keyword, volume і external data needs. Bright Data може швидко створювати реальні provider costs, тому великі scraping tasks потребують explicit approval.

### Telegram

Використовується для human notifications, approvals, errors і completion summaries. Completion messages мають пояснювати людською мовою, що зроблено, а повні деталі залишаються в Paperclip.

### File Browser

Використовується для перегляду файлів і artifacts у Paperclip interface.

## Як Людині Ставити Хорошу Задачу

Хороша задача починається з бізнес-причини, а не з назви агента.

Рекомендований шаблон:

```md
Бізнес-ціль:
Який результат має покращитись?

Scope:
Який продукт, URL, ринок, мова або етап funnel стосується задачі?

Вхідні дані:
Наявні keywords, analytics observations, product notes, comments або constraints.

Очікуваний результат:
Semantic core, page brief, CRO experiment, localization candidate, Perfex preview, validation або monitoring report.

Рішення, яке потрібно прийняти:
Що має вирішити manager після завершення роботи агента?
```

Хороші приклади:

- "Знайди найкращі page opportunities для VMFS Recovery, де GSC impressions високі, але clicks слабкі, і запропонуй refresh tasks."
- "Збери semantic core для VMFS Recovery for Mac users і розбий його на page targets."
- "Перевір, чи Linux Writer потребує product page, comparison page або support article на основі search demand."
- "Підготуй CRO experiment для сторінок, де download clicks сильні, але order-page visits слабкі."
- "Підготуй Perfex preview для затвердженого RAID Recovery page refresh."

Слабкі приклади:

- "Зроби SEO."
- "Покращи сторінку."
- "Попроси агента дослідити."
- "Створи контент."

## Що Має Бути В Завершеній Задачі

Завершена задача має чітко показувати наступний крок.

Вона має відповідати на питання:

- Що знайдено?
- Чому це важливо для DiskInternals?
- Який продукт або URL зачіпається?
- Яка дія рекомендована?
- Хто має зробити наступний крок?
- Що потребує approval?
- Як буде вимірюватись успіх?

Якщо completion message у Telegram надто короткий, потрібно відкрити Paperclip issue і подивитись latest comment або artifact. Telegram має передавати людську суть, але Paperclip залишається джерелом повних деталей.

## Approval Gates

Human approval потрібен перед:

- публікацією або зміною website content;
- створенням реальних Perfex tasks, якщо write mode ще вимкнений;
- дорогим або великим scraping;
- змінами tracking;
- запуском production experiments;
- claims щодо recovery success, compatibility, pricing або discounts;
- перетворенням localization або new page recommendation на implementation.

## Як Читати Статуси

- `todo`: задача готова, щоб її взяв агент або manager.
- `in_progress`: робота активна або очікується agent run.
- `blocked`: робота не може продовжуватись без конкретного unblock condition.
- `in_review`: результат потребує validation або decision.
- `done`: задача завершена, але parent coordination може ще потребувати окремого рішення.

Parent і child tasks - це різні задачі. Якщо child task виконаний, це не означає, що весь бізнес-процес завершений.

## Практичні Приклади

### VMFS Recovery For Mac Semantic Core

Бізнес-ціль: підготувати search demand і page structure для Mac-focused VMFS/VMDK recovery product path.

Очікувана маршрутизація:

1. CMO отримує задачу.
2. CMO перевіряє existing product discovery і seed keywords.
3. MKT закриває product або audience gaps, якщо потрібно.
4. SEO Semantic Core Strategist запускає всі semantic layers через plugin.
5. SEO validation перевіряє clusters, volumes, rejected/parked keywords і page targets.
6. CMO вирішує, які page briefs або implementation tasks потрібно створити.

### Existing Product Page Refresh

Бізнес-ціль: покращити product page, яка має search visibility, але слабку conversion.

Очікувана маршрутизація:

1. DATA підтверджує URL і funnel signal.
2. SEO перевіряє keyword і SERP fit.
3. CRO перевіряє CTA, download, order і popup opportunity.
4. QA перевіряє claims і product routing.
5. Perfex preview готується для людського впровадження.
6. Після human verification запускається indexing і follow-up monitoring.

### Localization Candidate

Бізнес-ціль: вирішити, чи є достатній сигнал для localized work.

Очікувана маршрутизація:

1. DATA перевіряє country і query signals.
2. Localization agent перевіряє business fit.
3. SEO перевіряє search intent і page type.
4. CMO approve, park або route to implementation.

## Операторський Checklist

Перед створенням задачі:

- назвіть продукт, URL, ринок або funnel step;
- сформулюйте бізнес-результат;
- додайте known input або constraints;
- попросіть конкретний output;
- вкажіть режим: decision-only, preview-only або implementation allowed.

Перед approval implementation:

- перевірте affected URLs;
- перевірте exact requested changes;
- перевірте QA notes;
- перевірте expected metrics;
- перевірте rollback або follow-up plan;
- підтвердьте, чи задача має йти в Perfex.

Після implementation:

- переконайтесь, що human implementer позначив роботу як verified;
- перевірте changed URLs;
- запускайте indexing тільки для meaningful high-value changes;
- вимірюйте follow-up windows через BigQuery-backed reports.
