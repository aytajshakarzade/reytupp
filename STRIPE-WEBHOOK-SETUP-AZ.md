# ReytUp 4.2 — Stripe abunəlik quraşdırılması

## Hazırkı layihə konfiqurasiyası

Layihədə `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` və bu ZIP-də `STRIPE_WEBHOOK_SECRET` `.env`-dən oxunur. `.env` faylı bu yeniləmə zamanı dəyişdirilməyib. Yerli Stripe CLI hər `listen` sessiyası üçün signing secret göstərir; həmin dəyər `.env`-dəki dəyərlə eyni olmalıdır. Fərqlidirsə, yalnız serveri başladan PowerShell pəncərəsində `$env:STRIPE_WEBHOOK_SECRET` dəyişəni ilə cari CLI secret-ini override edin. Secret-i heç kimə göndərməyin.

Stripe Checkout-un qiyməti yalnız Stripe API-dən oxunur. Qiymət ID-si mövcud deyilsə, deaktivdirsə və ya açarla eyni rejimdə deyilsə, Professional və Business düymələri deaktiv qalır. Tətbiq saxta qiymət və ya əlaqə formasına yönləndirmə göstərmir.

## Yerli test (Windows PowerShell)

1. Stripe Dashboard-da **Test mode**-u aktiv edin.
2. Developers → Webhooks → Add endpoint açın.
3. Endpoint URL: `https://SIZIN-PUBLIC-DOMEN/api/billing/webhook`.
4. Bu event-ləri seçin:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Stripe CLI ilə yerli test üçün bir PowerShell pəncərəsində başladın. Bəzi CLI versiyalarında `--events` məcburidir:

```powershell
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed --forward-to http://localhost:4173/api/billing/webhook
```

6. Stripe Dashboard → Settings → Billing → Customer portal bölməsində portalı aktiv edin. Plan dəyişmə funksiyasından istifadə ediləcəksə, Professional və Business məhsullarını subscription update üçün icazəli qiymətlərə əlavə edin.
7. CLI-nin göstərdiyi `whsec_...` signing secret dəyərini `.env`-dəki `STRIPE_WEBHOOK_SECRET` ilə müqayisə edin. Yalnız fərqlidirsə, başqa PowerShell pəncərəsində, serveri başladan eyni pəncərədə təyin edin:

```powershell
$env:STRIPE_WEBHOOK_SECRET = 'whsec_...'
npm start
```

Bu mühit dəyişəni həmin PowerShell pəncərəsi və onun başladacağı proseslər üçün keçərlidir və `.env` dəyərini üstələyir. `.env` faylına yazılmır və növbəti pəncərəyə avtomatik ötürülmür. Əgər CLI secret-i `.env`-dəki dəyərlə eynidirsə, bu addımı buraxın.

> ReytUp Supabase üçün ayrıca gizli Database Password soruşarsa, onu yalnız həmin prompt-a daxil edin. Stripe signing secret və Supabase Database Password fərqli məlumatlardır.

## Production

Render və ya digər hosting panelində `STRIPE_WEBHOOK_SECRET` adlı Environment Variable yaradın və Stripe Dashboard-dan alınmış `whsec_...` dəyərini ora əlavə edin. `.env` faylını dəyişməyin.

Production ödənişləri üçün `sk_live_...` secret key və həmin live rejimində yaradılmış Professional/Business recurring Price ID-lərindən istifadə edilməlidir. Test key/price ilə canlı müştəridən real ödəniş alınmır. Test və Live Price ID-ləri qarışdırmayın.

## Ödənişin təsdiqi

Checkout uğurla bitdikdən sonra Stripe session ID ReytUp-a qayıdır. ReytUp serveri həmin session-u Stripe-dan yenidən oxuyur, session-un cari hesaba aid olduğunu və payment status-un uğurlu olduğunu yoxlayır, sonra planı aktivləşdirir. Bu confirm addımı boş webhook signing secret ilə ilkin checkout-un saxta şəkildə Professional aktivləşdirməsinin qarşısını alır.

Webhook isə yenilənmə, ləğv və ödəniş xətalarının hesabda vaxtında sinxronlaşması üçün vacibdir. Təsdiqlənmiş Checkout köhnə Stripe müştəri ID-sini yenidən bağlaya bilir; adi abunəlik sinxronizasiyası isə başqa hesabın müştəri bağlantısını əvəz edə bilməz.

## Plan limitləri

| Plan | Analiz / ay | AI / gün | Maks. radius | Müqayisə / sorğu | Tarixçə | PDF |
|---|---:|---:|---:|---:|---:|---|
| Free | 3 | 5 | 500 m | 2 | 7 gün | Xeyr |
| Professional | 50 | 30 | 1.2 km | 6 | 90 gün | Bəli |
| Business | 200 | 100 | 3 km | 9 | Limitsiz | Bəli |

Limitlər server tərəfində də yoxlanılır; frontend-dəki qiymət kartları yalnız məlumat göstərmək üçündür.
