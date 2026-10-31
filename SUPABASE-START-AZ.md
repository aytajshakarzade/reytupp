REYTUP 4.2 — SUPABASE START (WINDOWS)

Bu şəxsi Elite Edition paketində mövcud `.env` və `data/.jwt-secret` faylları saxlanılıb. Dəyişən adları və dəyərləri redaktə edilməyib. SMTP və əlavə API açarı əlavə olunmayıb.

İŞƏ SALMAQ
1. ZIP-i yeni layihə qovluğuna bütöv çıxarın.
2. `.env` faylının package.json və server.js ilə eyni qovluqda olduğunu yoxlayın.
3. PowerShell-də layihə qovluğuna keçin və `npm start` yazın.
4. Server başladısa http://localhost:4173/api/health ünvanında `database` sahəsinin `postgres` olduğunu yoxlayın.

Windows-da `npm start` hər dəfə Supabase bağlantısı aşkar etdikdə Database Password-u gizli şəkildə yenidən soruşur. Beləliklə, `.env` daxilində əvvəlki və ya etibarsız parol qalsa belə, düzgün cari parolu yalnız həmin server prosesi üçün istifadə etmək mümkündür. `.env` faylı redaktə edilmir və parol heç bir fayla yazılmır.

DÜZGÜN SUPABASE SESSION POOLER MƏLUMATLARI
Project ref: weodeywbbvehgpigneto
Host: aws-0-eu-west-1.pooler.supabase.com
Port: 5432
User: postgres.weodeywbbvehgpigneto
Database: postgres

NİYƏ npm start?
package.json start əmri start.js-ə yönləndirilir. start.js Supabase URL aşkar etdikdə (boş/nümunə URL olduqda da) Windows PowerShell skriptini avtomatik başladır. Skript real Session Pooler URI-ni yalnız proses yaddaşında yaradır və server.js-i işə salır; `.env` yazılmır.

ƏGƏR PASSWORD AUTHENTICATION FAILED QALIRSA
Supabase Project Settings → Database bölməsində Database Password-u yoxlayın. Köhnə parol etibarsızdırsa, Supabase-də yenisini təyin etməlisiniz. Bu əməliyyat `.env`-dəki URI-ni yeniləməyi tələb edə bilər; əvvəlcə ayrıca ehtiyat nüsxə saxlayın. Parolu heç kimə göndərməyin.

Əgər server `postgres` göstərirsə, Supabase bağlantısı qurulub. Hər `npm start` zamanı cari Database Password-u gizli daxil etmək tələb olunur; bu, `.env`-də saxlanan köhnə parolu əvəz etmir. Köhnə SQLite məlumatları avtomatik köçürülmür.
