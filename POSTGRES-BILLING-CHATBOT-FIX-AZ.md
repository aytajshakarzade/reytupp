# ReytUp 4.2 — PostgreSQL, Stripe və AI düzəlişi

## Dəyişdirilən problemlər

1. `column reference "request_count" is ambiguous`
   - PostgreSQL AI usage upsert sorğusu `assistant_usage AS au` aliasından istifadə edir.
   - `SET`, `WHERE` və `RETURNING` sahələri artıq `au.request_count` ilə dəqiqləşdirilir.

2. `column "id" does not exist`
   - PostgreSQL adapteri bütün INSERT sorğularına kor-koranə `RETURNING id` əlavə etmirdi.
   - `assistant_usage`, `analysis_usage` və `user_preferences` cədvəllərində `id` yoxdur; adapter bu cədvəllərə `RETURNING id` əlavə etmir.
   - `users`, `analyses` və digər ID-li cədvəllər üçün avtomatik ID qaytarılması saxlanılıb.

3. Professional plan Free kimi görünməsi
   - Checkout sessiyası istifadəçiyə aid olmalıdır.
   - Sessiyanın tipi, istifadəçiyə aid olması, ödəniş statusu və Checkout line item-lərindəki faktiki Stripe Price ID ayrıca yoxlanılır. Plan adı metadata-dan götürülmür; konfiqurasiya olunmuş Price ID əsas mənbədir.
   - Stripe subscription `active` və ya `trialing` olmadıqda Professional/Business hüququ verilmir.
   - Təsdiqdən sonra dashboard `/api/auth/me` endpoint-indən hesabı yenidən oxuyur.
   - Təsdiq uğursuz olsa, Checkout Session ID URL-dən silinmir; səhifə yenilənəndə yoxlama təkrar edilə bilər.
   - Əvvəlki Checkout-dan qayıdan istifadəçilər üçün dashboard-da **“Ödəniş etmisiniz? Planı bərpa et”** düyməsi var. Bu, istifadəçinin email-i ilə Stripe müştərilərini tapır və yalnız konfiqurasiya edilmiş Professional/Business Price ID-lərinə uyğun aktiv abunəliyi bərpa edir.
- Stripe abunəlik dövrünün bitmə tarixi həm yeni item-level, həm də köhnə subscription-level API cavabından oxunur.
   - Mövcud Stripe Customer ID olan istifadəçi yeni Checkout başladanda yeni customer yaratmaq əvəzinə həmin customer istifadə olunur.

4. AI chatbot
   - İstifadəçinin logunda görünən PostgreSQL usage-counter xətası düzəldilib.
   - AI sorğu sayı rezervasiya olunmadıqda provayder çağırışı başlamır; uğursuz cavab üçün limit rezervasiyası geri qaytarılır.
   - Groq provayder xətaları əvvəlki kimi konkret kod və izahla qaytarılır.

5. Xəritə və rəqib məlumatları
   - Overpass üçün ardıcıl 3 ictimai instans yoxlanılır; 403/406/429 və müvəqqəti gateway/network xətası növbəti instansa keçməyə mane olmur. Sorğular cache və interval məhdudiyyəti ilə göndərilir.
   - Google Places Nearby Search rəqib və ictimai nəqliyyat sorğularını ayrı nəticələndirir. Rəqib sorğusu uğurlu olduqda koordinatı olan obyektlərin adı, ünvanı, kateqoriyası, məsafəsi və mənbəsi “Yaxın rəqiblər” siyahısında göstərilir.
   - Google Places hər sorğu üçün maksimum 20 nəticə qaytardığına görə bu nümunə tam və təsdiqlənmiş rəqib sayı kimi təqdim edilmir; Google nümunəsi ayrıca siqnal kimi göstərilir. Rəqabət balı Google-un kəsilmiş nümunəsini tam say kimi istifadə etmir.
   - Overpass əlçatan olmayanda rəqabət göstəricisi etibarlı OSM sayına əsaslana bilmədiyi üçün “mövcud deyil / ilkin nəticə” statusunda qalır; sistem çatışmayan məlumatı uydurmur.

6. Dashboard
   - Premium responsive dashboard: əsas göstəricilər, son analiz ballarının qrafiki, plan istifadəsi, mənbə statusları, sürətli keçidlər və analiz tarixçəsi.
   - Boş tarixçə olduqda digər panellər gizlənmir; mənbə statusu və plan kvotaları yenə görünür.

## Quraşdırma — Windows

1. Hazırda işləyən serveri `Ctrl+C` ilə dayandırın.
2. ZIP-i yeni qovluğa çıxarın, məsələn `D:\ReytUp-4.2-Postgres-Fix`.
3. Öz kompüterinizdəki cari layihədən `.env` və `data\\.jwt-secret` fayllarını yeni qovluğa kopyalayın. Windows overwrite soruşsa, köhnə qovluqdakı şəxsi faylların yeni qovluğa kopyalanmasına razı olun. Faylların məzmununu redaktə etməyin.
4. Yeni qovluqda PowerShell açın və `npm start` icra edin.
5. Supabase Database Password soruşulanda cari parolu gizli daxil edin.
6. Dashboard-da plan hələ Free görünürsə, **“Ödəniş etmisiniz? Planı bərpa et”** düyməsini bir dəfə basın.
7. Sonra chatbotu və yeni analizi yoxlayın.

## Abunəlik bərpası nəticəsi

Əgər bərpa düyməsi aktiv abunəlik tapmadığını bildirirsə, bunları yoxlayın:
- Stripe hesabında həmin email ilə aktiv Professional/Business subscription var.
- `.env`-dəki `STRIPE_SECRET_KEY` və `STRIPE_PRICE_PRO` / `STRIPE_PRICE_BUSINESS` eyni Stripe rejiminə (Test və ya Live) aiddir.
- Checkout zamanı istifadə olunan email ReytUp hesabının email-i ilə eynidir.
- Stripe abunəliyinin statusu `active` və ya `trialing`-dir.

`.env` və `data/.jwt-secret` bu paket hazırlanarkən dəyişdirilməyib. Canlı Stripe və Supabase hesabına giriş olmadan real hesab üzrə abunəlik və ödəniş statusunu bu mühitdə təsdiqləmək mümkün deyil.
