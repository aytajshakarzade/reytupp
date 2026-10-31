# ReytUp — Location Intelligence Platform

**Buraxılış:** 4.2 Elite Edition · **Məkan:** Bakı, Azərbaycan
**İşləmə mühiti:** Node.js 22.16+ · Supabase PostgreSQL (DATABASE_URL) / SQLite local fallback · Vanilla HTML/CSS/JavaScript

ReytUp kafe, restoran, mağaza, aptek, gözəllik salonu, tibb mərkəzi və digər bizneslər üçün lokasiya kəşfiyyatı platformasıdır. İstifadəçi ünvanı və biznes kateqoriyasını seçir; ReytUp xəritə mənbələrindən yaxın obyektləri toplayır, rəqabət və əlçatanlıq siqnallarını qiymətləndirir, daxil edilən maliyyə rəqəmləri ilə ayrıca ssenari qurur.

## 4.2 Elite Edition yenilikləri

- Yeni Elite visual layer: yenilənmiş tipografiya, naviqasiya, dashboard kartları, analiz formaları, xəritə çərçivələri və mobil uyğunlaşma.
- Bu şəxsi paketdə mövcud `.env` və `data/.jwt-secret` faylları dəyişdirilmədən saxlanılıb. ZIP-i ictimai paylaşmayın və Git-ə yükləməyin.

## 4.2 funksional yenilikləri

- Signal Studio estetikasına uyğun yenilənmiş tünd interfeys, lime vurğuları, Space Grotesk / DM Mono tipoqrafiyası və mobil uyğunlaşma.
- Yeni dashboard: analiz tarixçəsi, son skor, plan məlumatı, hesab profili və ödəniş portalı.
- Bütün əsas səhifələrdə sağ-alt ReytUp AI köməkçisi; cavablar yalnız daxil olmuş istifadəçinin analiz kontekstinə bağlanır.
- Groq Chat Completions API ilə AI köməkçisi və Pro/Business üçün analiz izahı; gündəlik sorğu kvotası serverdə atomik saxlanılır.
- GOOGLE_PLACES_API_KEY mövcud olduqda Google Places API (New) ilə ünvan axtarışı; Google cavab vermədikdə Nominatim ehtiyat geocoder kimi istifadə olunur. Yaxın obyektlər üçün Overpass və istəyə bağlı Google Places aqreqat siqnalları.
- Analiz radiusu 300–5000 m aralığında seçilir; standart 1200 m.
- Məlumat mənbələri və skor əhatəsi göstərilir. Çatışmayan göstəricilər sıfır kimi hesablanmır.
- Stripe Checkout, Billing Portal və abunəlik webhook hadisələrinin emalı.
- Email təsdiqi və şifrə sıfırlama tokenləri mövcuddur; hazırkı buraxılış SMTP ilə email göndərmir, development rejimində token-i API cavabında qaytarır.
- Supabase PostgreSQL runtime dəstəyi (`DATABASE_URL` qoşulduqda); lokal fallback SQLite-dir.
- API validation və genişləndirilmiş error handling.
- Render Blueprint, persistent disk parametrləri, health check, `.env.example` və smoke-testlər.

## Vacib: ReytUp nəyi ölçür, nəyi ölçmür?

ReytUp xəritədə qeydiyyatda olan obyektlərdən lokasiya siqnalları çıxarır. **Bu platforma piyada axınını, real ziyarətçi sayını, alıcılıq qabiliyyətini, demoqrafiyanı, rəqib satışlarını və ya gələcək dövriyyəni ölçmür.** Skor uğur ehtimalı və ya biznesin gəlirliliyinə zəmanət deyil.

- **Google Places API (New):** API açarı və billing aktiv olduqda ünvan axtarışı (Text Search) və yaxın biznes/nəqliyyat sayları. Google nəticələri tam biznes reyestri deyil.
- **OpenStreetMap / Nominatim / Overpass:** Google geocoding nəticəsi olmadıqda ünvan-koordinat ehtiyat çevrilməsi və xəritədəki açıq POI/nəqliyyat obyektləri. Xəritə məlumatları natamam və ya köhnə ola bilər.
- **Google Places API (New), istəyə bağlı:** kateqoriyaya uyğun Nearby Search sorğuları; sorğu hərəsi maksimum 20 nəticə ilə məhdudlaşır. Bu tam biznes reyestri deyil. Google Places sayı aqreqat siqnal kimi istifadə olunur; Google-dan gələn obyekt adları/koordinatları OSM siyahısına əlavə edilmir.
- **Skor əhatəsi:** hesablamaya daxil edilmiş model çəkisinin faizidir. Məsələn, maliyyə məlumatı verilməyibsə, həmin 20 balın çəkisi məxrəcə daxil edilmir; skorun yanında əhatə faizi göstərilir.
- **Maliyyə ssenarisi:** icarə, gəlir və investisiya rəqəmləri istifadəçi tərəfindən daxil edilir. Digər əməliyyat xərcləri `OTHER_OPERATING_COSTS_PCT` parametrinə əsasən fərz edilir (standart 45%). Bu fərziyyə real mühasibat məlumatı deyil.
- **Saatlıq profil:** biznes kateqoriyasının daxili çəkilərindən yaranan model ssenarisidir; faktiki saatlıq ziyarətçi statistikası deyil.

Biznes qərarından əvvəl ərazidə yerində müşahidə, piyada sayımı, rəqib yoxlaması, real icarə təklifi, müştəri müsahibəsi və maliyyə modeli ilə təsdiq aparılmalıdır.

## Sürətli başlama

### Tələblər

- Node.js **22.16 və ya daha yeni** (built-in `node:sqlite` istifadə olunur).
- Nominatim və Overpass sorğuları üçün internet bağlantısı.
- Paket meneceri ilə əlavə runtime asılılığı tələb olunmur.

### Windows PowerShell

Mövcud `.env` faylınızı olduğu kimi saxlayın. Supabase bağlantısı üçün sadəcə:

```powershell
npm start
```

`npm start` Windows-da Supabase URL aşkar etdikdə `Start-ReytUp-Supabase.ps1` skriptini açır, Database Password-u hər dəfə gizli soruşur və bağlantını yalnız server prosesi üçün qurur. Bu, `.env`-də köhnə parol qalsa belə yeni parolu faylı dəyişmədən istifadə etməyə imkan verir. Ətraflı məlumat: `SUPABASE-START-AZ.md`.

### macOS / Linux

Bu şəxsi ZIP-də `.env` artıq mövcuddur. Onu `.env.example` ilə əvəz etməyin. Layihəni yeni mühitə köçürərkən həmin konfiqurasiya faylını və `data/.jwt-secret` faylını qoruyun. Sonra:

```bash
npm install
npm run check
npm test
npm start
```

Sonra `http://localhost:4173` ünvanını açın. Bu paketdə `data/.jwt-secret` artıq qorunub. Faylı silməyin və başqa qovluqdan gələn `.env` ilə əvəz etməyin; mövcud istifadəçi sessiyalarının sabit qalması üçün konfiqurasiya fayllarını birlikdə saxlayın.

## Environment dəyişənləri

Bu şəxsi Elite Edition paketində `.env` mövcud konfiqurasiya ilə daxil edilib və dəyişdirilməyib. `.env.example` yalnız yeni, boş quraşdırma yaratmaq üçündür. Bu ZIP-i və `.env` faylını ictimai paylaşmayın, Git-ə yükləməyin və frontend JavaScript-ə açar yerləşdirməyin.

| Dəyişən | Məqsəd | Qeyd |
|---|---|---|
| `PORT` | HTTP portu | Lokal default `4173`; Render öz portunu verir |
| `HOST` | Bind ünvanı | Lokal və Render üçün `0.0.0.0` |
| `APP_ORIGIN` | Checkout redirect origin | Render-də `RENDER_EXTERNAL_URL` fallback-i var |
| `JWT_SECRET` | JWT imzası | Production-da unikal, uzun random secret |
| `ADMIN_EMAIL` | Admin rolu veriləcək hesab | Qeydiyyat email-i ilə dəqiq uyğun olmalıdır |
| `DB_FILE` | Lokal SQLite faylı | Yalnız `DATABASE_URL` boş olduqda istifadə edilir |
| `DATABASE_URL` | Supabase PostgreSQL bağlantısı | Supabase Connect-dən alınan tam PostgreSQL connection string; server tərəfində saxlanılır |
| `ANALYSIS_RADIUS_METERS` | Standart radius | 300–5000 m, default 1200 |
| `NOMINATIM_COUNTRY_CODES` | Geocoding ölkə filtri | Azərbaycan üçün `az` |
| `NOMINATIM_USER_AGENT` | Nominatim identifikasiyası | Öz əlaqə email/veb ünvanınızı yazın |
| `OTHER_OPERATING_COSTS_PCT` | Digər xərclər fərziyyəsi | 0–95%, default 45 |
| `GROQ_API_KEY` | Groq AI köməkçisi və analiz izahı | İstəyə bağlı; açarı yalnız serverdə saxlayın |
| `GROQ_MODEL` | Groq model ID-si | Dəstəklənən model; dayandırılmış köhnə ID-lər serverdə avtomatik əvəz olunur; GPT-OSS 120B default |
| `GOOGLE_PLACES_API_KEY` | Google Places geocoding və əlavə mənbə | İstəyə bağlı; billing və Places API (New) aktiv olmalıdır |
| `STRIPE_SECRET_KEY` | Stripe server açarı | Test üçün `sk_test_...`, live üçün `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook imza yoxlaması | Stripe endpoint-dən alınan `whsec_...` |
| `STRIPE_PRICE_PRO` | Professional recurring Price ID | `price_...` |
| `STRIPE_PRICE_BUSINESS` | Business recurring Price ID | `price_...` |

### Supabase PostgreSQL

1. Supabase layihəsində **Connect → Session pooler** bölməsindən bağlantı məlumatlarını yoxlayın. Bu layihə üçün skript `aws-0-eu-west-1.pooler.supabase.com:5432` ünvanından istifadə edir.
2. Windows-da `npm start` yazın. `DATABASE_URL` nümunə dəyəridirsə, yeni Database Password gizli soruşulacaq. `.env`-i əl ilə dəyişmək lazım deyil.
3. Render-də `DATABASE_URL`-i Render Environment bölməsində ayrıca təyin edin.
4. Server ilk start zamanı `migrations/002_supabase_runtime.sql` miqrasiyasını tətbiq edir və health endpoint `database: "postgres"` göstərir.
5. Əgər daha əvvəl köhnə `001_initial.sql` UUID sxemini tətbiq etmisinizsə, bu runtime sxemi onu avtomatik çevirmir. Məlumatları qorumaq üçün əvvəlcə ayrıca backup və planlı data migration lazımdır; boş yeni schema/project istifadə etmək daha təhlükəsizdir.

**Qeyd:** Supabase `anon` və `service_role` API key-ləri `DATABASE_URL` əvəzi deyil. Server PostgreSQL bağlantı string-indən istifadə edir. RLS aktivdir; tətbiq DB-yə yalnız server tərəfdən qoşulur. `DATABASE_URL` düzgün qurulmayıbsa, server SQLite-ə səssiz fallback etmir.

### İnteqrasiyaların qoşulma ardıcıllığı

**Groq AI**

1. Groq Console-da API key yaradın: https://console.groq.com/keys. Əvvəlki `llama-3.3-70b-versatile` ID-si Groq tərəfindən dayandırılıb; `.env`-i dəyişmədən server onu `openai/gpt-oss-120b` modelinə keçirir.
2. Açarı yalnız serverdəki `.env` faylında `GROQ_API_KEY` olaraq saxlayın.
3. İstifadə limitlərini Groq hesabında da ayrıca izləyin. ReytUp-ın daxili gündəlik limitləri provayder billing limitini əvəz etmir.

**Google Places API (New)**

1. Google Cloud layihəsində Places API (New) və Billing aktiv edin.
2. API açarını serverdə `GOOGLE_PLACES_API_KEY`-ə yerləşdirin.
3. Açarı API restriction ilə yalnız Places API-yə məhdudlaşdırın; brauzerə ötürməyin.
4. Places nəticələri maksimum 20 obyektlik nümunədir; OpenStreetMap əsas mənbə olaraq qalır.

**Stripe abunəlikləri**

1. Stripe Dashboard-da Professional və Business üçün aylıq recurring Price yaradın və Price ID-ləri mövcud `STRIPE_PRICE_PRO` / `STRIPE_PRICE_BUSINESS` dəyişənlərinə uyğun saxlayın.
2. Hazırkı arxivdəki `STRIPE_SECRET_KEY` test rejimindədirsə, checkout yalnız Stripe test mühitində işləyir. Real pul qəbul etmək üçün Stripe Live mode açarları və Live Price ID-lər ayrıca host environment-də konfiqurasiya edilməlidir.
3. ReytUp qiymətləri Stripe API-dən dinamik oxuyur; qiymət aktiv və recurring deyilsə, checkout düyməsi aktivləşdirilmir.
4. Checkout uğurla bitdikdə dashboard sessiyanı Stripe API ilə təsdiqləyir. Plan yalnız cari hesaba aid, ödənişi tamamlanmış subscription olduqda aktivləşdirilir.
5. Ləğv, yenilənmə və payment-failed hadisələrinin avtomatik sinxronlaşması üçün webhook lazımdır. Mövcud `.env`-də `STRIPE_WEBHOOK_SECRET` boşdursa, onu `.env`-ə yazmadan PowerShell proses environment-i və ya Render Environment ilə verin.
6. Dəqiq webhook endpoint, PowerShell və Stripe CLI addımları üçün `STRIPE-WEBHOOK-SETUP-AZ.md` faylına baxın. Billing Portal Stripe Dashboard-da aktiv olmalıdır.

**Qeyd:** Test açarı ilə real müştəridən pul tutulmur. Live rejimə keçid ayrıca Stripe Live secret, Live Price ID-lər, webhook endpoint və Billing Portal konfiqurasiyası tələb edir. Bu arxivdəki `.env` dəyişdirilməyib.

## Render deploy

Layihədə `render.yaml` Blueprint mövcuddur:

1. Git repository-ni Render-ə qoşun və Blueprint deploy başladın.
2. `ADMIN_EMAIL` və `NOMINATIM_USER_AGENT` üçün öz dəyərlərinizi verin.
3. Groq, Google Places və Stripe istifadə edəcəksinizsə, müvafiq secret/environment dəyərlərini Render Dashboard-da əlavə edin.
4. Render-in yaratdığı `JWT_SECRET`-i saxlayın; yenidən yaratmaq mövcud login sessiyalarını etibarsız edər.
5. Deploy-dan sonra `https://SENIN-DOMENIN/api/health` cavabında `status: ok` yoxlayın.

Blueprint `DATABASE_URL` dəyişənini tələb edir. Supabase PostgreSQL connection string-ini Render Environment bölməsinə əlavə edin. Deploy-dan sonra `/api/health` cavabında `database: "postgres"` göründüyünü yoxlayın. `database: "sqlite"` görsənirsə, `DATABASE_URL` Render servisində qurulmayıb.

## Planlar və limitlər

Limitlər yalnız UI-da göstərilmir; server endpoint-lərində auth edilmiş istifadəçinin aktiv abunəliyinə görə yoxlanır. Paid plan yalnız Stripe statusu `active` və ya `trialing` olduqda verilir; `past_due`, `canceled`, vaxtı bitmiş və tanınmayan Price ID Free hüquqlarına qaytarılır.

| Plan | Analiz / ay | AI sorğusu / gün | Maks. radius | Müqayisə / sorğu | Tarixçə | PDF |
|---|---:|---:|---:|---:|---:|---|
| Free | 3 | 5 | 500 m | 2 | 7 gün | Xeyr |
| Professional | 50 | 30 | 1.2 km | 6 | 90 gün | Bəli |
| Business | 200 | 100 | 3 km | 9 | Limitsiz | Bəli |

Professional və Business qiymətləri `STRIPE_PRICE_PRO` və `STRIPE_PRICE_BUSINESS` Price ID-lərindən Stripe API vasitəsilə dinamik oxunur; burada statik qiymət fərz edilmir. Müqayisə limiti lokasiya axtarışı modulunun hazırkı maksimum 9 namizəd həcminə uyğundur. AI sorğuları UTC gününə, analiz sayı UTC ayının başlanğıcına görə hesablanır.

## Səhifələr

- `/` — Marketinq landing page
- `/analyze.html` — Lokasiya analiz laboratoriyası
- `/dashboard.html` — Analiz tarixçəsi, metriklər və hesab paneli
- `/find-my-place.html` — Potensial lokasiya axtarışı
- `/location-battle.html` — İki lokasiyanın müqayisəsi
- `/pricing.html` — Planlar və checkout
- `/login.html`, `/register.html` — Giriş və qeydiyyat
- `/admin.html` — Admin mesaj paneli (`ADMIN_EMAIL` ilə)
- `/about.html`, `/contact.html`, `/privacy.html`, `/terms.html` — Məlumat səhifələri

## API əsas marşrutları

| Method | Path | Təsvir |
|---|---|---|
| GET | `/api/health` | Health check və inteqrasiya statusları |
| POST | `/api/auth/register` | İstifadəçi qeydiyyatı |
| POST | `/api/auth/login` | Giriş |
| GET | `/api/auth/me` | Cari hesab |
| POST | `/api/auth/send-verification` | Development rejimində email təsdiq token-i yaradır; real email çatdırılması SMTP olmadan aktiv deyil |
| POST | `/api/auth/verify-email` | Email-i token ilə təsdiqlə |
| POST | `/api/auth/request-password-reset` | Şifrə sıfırlama linki istə |
| POST | `/api/auth/reset-password` | Token ilə şifrəni sıfırla |
| GET | `/api/geocode?q=...` | Ünvanı koordinata çevirir |
| POST | `/api/analyze` | Yeni lokasiya analizi |
| GET | `/api/analyses` | Cari istifadəçinin analizləri |
| GET | `/api/analyses/:id` | Cari istifadəçinin tək analizi |
| GET | `/api/assistant/status` | Groq API key/model əlçatanlığını yoxlayır (açarı heç vaxt qaytarmır) |
| GET | `/api/assistant/context` | Son analiz konteksti |
| POST | `/api/assistant/chat` | AI köməkçisi söhbəti və günlük limit |
| GET | `/api/billing/plans` | Stripe-dən canlı recurring qiymətləri və limitləri oxuyur |
| POST | `/api/billing/checkout` | Stripe Checkout sessiyası |
| POST | `/api/billing/confirm` | Checkout sessiyasını Stripe API ilə təsdiqləyir və planı sinxronlaşdırır |
| POST | `/api/billing/portal` | Stripe Billing Portal sessiyası |
| POST | `/api/billing/webhook` | İmzalanmış Stripe hadisələri |
| POST | `/api/contact` | Əlaqə forması |
| POST | `/api/newsletter` | Newsletter qeydiyyatı |
| GET | `/api/admin/messages` | Admin mesajları |

Protected endpoint-lər `Authorization: Bearer <JWT>` tələb edir.

## Test və keyfiyyət yoxlaması

```bash
npm run check
npm test
```

Smoke-test ayrıca müvəqqəti SQLite bazası və test portu açır; real Supabase və ya lokal məlumat bazasına toxunmur. Testlər auth, limitlər, Free PDF bloklaması, Stripe imza yoxlaması/idempotency/aktivləşmə/ləğv, Groq konfiqurasiya cavabı və model-ID əvəzlənməsini yoxlayır.

## Texniki quruluş

- **Server:** Node.js `http`, `node:sqlite`, `crypto`, `fetch`.
- **Database:** `DATABASE_URL` olduqda Supabase PostgreSQL; dəyişən boş olduqda lokal SQLite (`data/` altında).
- **Auth:** HMAC-SHA256 imzalı JWT, PBKDF2-SHA256 password hash.
- **Frontend:** Vanilla HTML/CSS/JS; responsive dashboard; Leaflet xəritəsi.
- **Map data:** Nominatim + Overpass / OpenStreetMap.
- **Optional enrichment:** Google Places API (New).
- **AI:** Groq Chat Completions API.
- **Billing:** Stripe Checkout, Billing Portal, webhook signature verification.
- **Deploy:** Render Blueprint + persistent disk.

## Təhlükəsizlik və istehsal qeydləri

- `.env`, SQLite DB, WAL/SHM və JWT secret Git repository-yə commit edilməməlidir. Mövcud `.env` faylını heç bir paylaşım və ya public repoya əlavə etməyin.
- Bu ZIP-də real API açarları, şəxsi DB və runtime secret yoxdur.
- Production-da `JWT_SECRET`-i güclü və sabit saxlayın; dəyişməsi bütün sessiyaları bağlayır.
- `ADMIN_EMAIL` yalnız öz nəzarətinizdə olan email üçün təyin olunmalıdır. Server startında uyğun istifadəçi admin roluna keçirilir; mövcud token rolunu yeniləmək üçün yenidən login etmək lazımdır.
- Nominatim üçün düzgün User-Agent və sorğu tezliyinə riayət olunur; ünvan nəticələri qısa müddət cache edilir.
- Supabase PostgreSQL production üçün əsas verilənlər bazasıdır; SQLite yalnız lokal development/test fallback kimi saxlanılır.
- Email təsdiqi və şifrə sıfırlama sistemi SMTP inteqrasiyası tələb edir. SMTP konfiqurasiya edilməyibsə, development rejimində token-lər cavabda qaytarılır. Production-da SMTP server (Gmail, SendGrid, AWS SES və s.) qurulmalıdır.
- Supabase runtime sxemi `migrations/002_supabase_runtime.sql` faylı ilə ilk server başlanğıcında avtomatik yaradılır; köhnə `001_initial.sql` faylı tarixi/deprecated fayldır və tətbiq edilməməlidir.


## Windows Supabase start

Windows-da `npm start` `start.js` vasitəsilə işləyir. Supabase URL olduqda Supabase Database Password hər start zamanı təhlükəsiz prompt ilə soruşulur; parol proses mühitində qalır və `.env` dəyişdirilmir. Tam addımlar `SUPABASE-START-AZ.md` faylındadır.
