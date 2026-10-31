/* ============================================================
   ReytUp app.js — v5.0 Premium (i18n refactor)
   Unified nav, auth, dashboard, language, animations
   ============================================================ */
'use strict';

(function () {

  const TOKEN_KEY = 'reytup_token';
  const USER_KEY  = 'reytup_user';

  /* ── t() shorthand ──────────────────────────────────────── */
  function t(key) {
    return window.i18n ? window.i18n.t(key) : key;
  }

  /* ── Escape ─────────────────────────────────────────────── */
  function esc(v) {
    return String(v ?? '').replace(/[&<>'\"]/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":"&#39;",'"':'&quot;' }[c]));
  }

  /* ── Formatters ─────────────────────────────────────────── */
  function money(v) {
    if (v == null || v === '') return '—';
    return `${Number(v).toLocaleString('az-AZ')} ₼`;
  }
  function fmtDate(v) {
    const lang = window.i18n ? window.i18n.getLang() : 'az';
    const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-GB' : 'az-AZ';
    try { return new Intl.DateTimeFormat(locale, { dateStyle:'medium', timeStyle:'short' }).format(new Date(v)); }
    catch { return String(v); }
  }

  /* ── Auth helpers ───────────────────────────────────────── */
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  }
  function saveSession(data) {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }
  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  /* ── API helper ─────────────────────────────────────────── */
  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await fetch(path, { ...opts, headers });
    let data = null;
    try { data = await r.json(); } catch {}
    if (!r.ok) {
      const codeMap = {
        MAP_SERVICE_UNAVAILABLE: 'error.mapService',
        OVERPASS_UNAVAILABLE: 'error.overpassService',
        BILLING_NOT_CONFIGURED: 'error.billingNotConfigured',
        UNSUPPORTED_BUSINESS_TYPE: 'error.unsupportedBusinessType'
      };
      const msg = (data?.code && codeMap[data.code] ? t(codeMap[data.code]) : null)
        || data?.message
        || (r.status >= 500 ? t('error.server') : t('error.requestFailed'));
      const err = new Error(msg);
      err.status = r.status; err.data = data; throw err;
    }
    return data;
  }

  /* ── Require login ──────────────────────────────────────── */
  async function requireLogin() {
    const tk = localStorage.getItem(TOKEN_KEY);
    if (!tk) {
      const next = location.pathname.split('/').pop() || 'dashboard.html';
      location.href = 'login.html?next=' + encodeURIComponent(next);
      return null;
    }
    try {
      const d = await api('/api/auth/me');
      localStorage.setItem(USER_KEY, JSON.stringify(d.user));
      return d.user;
    } catch {
      logout();
      location.href = 'login.html';
      return null;
    }
  }

  /* ── Toast ──────────────────────────────────────────────── */
  function toast(msg, type = 'success') {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.className = `toast ${type} show`;
    el.textContent = msg;
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => el.classList.remove('show'), 4500);
  }

  /* ── Reveal animations ──────────────────────────────────── */
  function initReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.06 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  }

  /* ── Navbar scroll ──────────────────────────────────────── */
  function initNavbarScroll() {
    const navbar = document.querySelector('.site-nav-bar') || document.querySelector('.site-header');
    if (!navbar) return;
    const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Mobile drawer ───────────────────────────────────────── */
  function initHomeDrawer() {
    const btn = document.getElementById('hamburger');
    const drawer = document.getElementById('mobile-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (!btn || !drawer) return;

    function toggle(open) {
      drawer.classList.toggle('open', open);
      overlay?.classList.toggle('show', open);
      btn.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      drawer.setAttribute('aria-hidden', String(!open));
      document.body.style.overflow = open ? 'hidden' : '';
    }

    btn.addEventListener('click', e => { e.stopPropagation(); toggle(!drawer.classList.contains('open')); });
    overlay?.addEventListener('click', () => toggle(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') toggle(false); });
    drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => toggle(false)));

    // Update drawer auth CTA
    const user = getUser();
    const drawerCta = document.getElementById('drawer-cta');
    if (drawerCta && user) {
      drawerCta.href = 'dashboard.html';
      drawerCta.setAttribute('data-i18n', 'nav.goDashboard');
      drawerCta.textContent = t('nav.goDashboard');
    }
  }

  /* ── Auth state in header ───────────────────────────────── */
  function updateHeaderAuth() {
    const user = getUser();
    document.getElementById('header-login')?.classList.toggle('hidden', !!user);
    document.getElementById('header-dashboard')?.classList.toggle('hidden', !user);
    document.getElementById('header-logout')?.classList.toggle('hidden', !user);
  }

  /* ── Public stats ───────────────────────────────────────── */
  async function loadStats() {
    try {
      const d = await api('/api/stats/public');
      document.querySelectorAll('[data-stat="analyses"]').forEach(x =>
        x.textContent = Number(d.analyses).toLocaleString('az-AZ'));
      document.querySelectorAll('[data-stat="users"]').forEach(x =>
        x.textContent = Number(d.users).toLocaleString('az-AZ'));
    } catch { /* leave as-is */ }
  }

  /* ── Auth forms ─────────────────────────────────────────── */
  function initAuthForms() {
    const regForm = document.getElementById('register-form');
    if (regForm) {
      regForm.addEventListener('submit', async e => {
        e.preventDefault();
        const f = new FormData(e.target);
        const btn = e.target.querySelector('button[type=submit]');
        const orig = btn.textContent; btn.disabled = true; btn.textContent = '...';
        try {
          const d = await api('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name: f.get('name'), email: f.get('email'), password: f.get('password') })
          });
          saveSession(d);
          location.href = 'dashboard.html';
        } catch (err) {
          toast(err.message, 'error');
          btn.disabled = false; btn.textContent = orig;
        }
      });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async e => {
        e.preventDefault();
        const f = new FormData(e.target);
        const btn = e.target.querySelector('button[type=submit]');
        const orig = btn.textContent; btn.disabled = true; btn.textContent = '...';
        try {
          const d = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: f.get('email'), password: f.get('password') })
          });
          saveSession(d);
          const next = new URLSearchParams(location.search).get('next');
          location.href = next || 'dashboard.html';
        } catch (err) {
          toast(err.message, 'error');
          btn.disabled = false; btn.textContent = orig;
        }
      });
    }
  }

  /* ── Dashboard mobile navigation ─────────────────────────── */
  function initDashboardMobileNav() {
    const button = document.getElementById('dashboard-mobile-menu');
    const sidebar = document.getElementById('dashboard-sidebar');
    const overlay = document.getElementById('dashboard-sidebar-overlay');
    if (!button || !sidebar || !overlay) return;
    const close = () => {
      document.body.classList.remove('dashboard-nav-open');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'Naviqasiya menyusunu aç');
    };
    button.addEventListener('click', () => {
      const open = !document.body.classList.contains('dashboard-nav-open');
      document.body.classList.toggle('dashboard-nav-open', open);
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Naviqasiya menyusunu bağla' : 'Naviqasiya menyusunu aç');
    });
    overlay.addEventListener('click', close);
    sidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', close));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    window.addEventListener('resize', () => { if (window.innerWidth > 820) close(); });
  }

  /* ── Contact form ───────────────────────────────────────── */
  function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      const status = document.getElementById('contact-form-status');
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Göndərilir…';
      if (status) status.textContent = '';
      const payload = new FormData(form);
      try {
        await api('/api/contact', {
          method: 'POST',
          body: JSON.stringify({
            name: payload.get('name'), email: payload.get('email'),
            company: payload.get('company'), message: payload.get('message')
          })
        });
        form.reset();
        const success = document.getElementById('contact-success');
        if (success) {
          success.style.display = 'block';
          form.style.display = 'none';
        }
        if (status) status.textContent = 'Mesajınız uğurla göndərildi.';
        toast('Mesajınız uğurla göndərildi.', 'success');
      } catch (err) {
        const message = err.message || 'Mesaj göndərilmədi. Bir az sonra yenidən cəhd edin.';
        if (status) status.textContent = message;
        toast(message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  }

  /* ── Newsletter ─────────────────────────────────────────── */
  function initNewsletterForms() {
    document.querySelectorAll('[data-newsletter-form]').forEach(form => {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = form.querySelector('button[type=submit]');
        if (btn) btn.disabled = true;
        try {
          await api('/api/newsletter', { method: 'POST', body: JSON.stringify({ email: new FormData(form).get('email') }) });
          form.innerHTML = `<span style="font-size:13px;font-weight:700;color:var(--green);padding:8px 0;display:block">${t('footer.subscribed')}</span>`;
        } catch (err) {
          toast(err.message, 'error');
          if (btn) btn.disabled = false;
        }
      });
    });
  }

  /* ── Logout ─────────────────────────────────────────────── */
  function initLogoutButtons() {
    document.querySelectorAll('[data-logout]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        logout();
        location.href = 'index.html';
      });
    });
  }

  /* ── Dashboard ──────────────────────────────────────────── */
  async function initDashboard() {
    const histEl = document.getElementById('analysis-history');
    if (!histEl) return;
    let user = await requireLogin();
    if (!user) return;

    const checkoutParams = new URLSearchParams(location.search);
    const checkoutSessionId = checkoutParams.get('session_id');
    if (checkoutParams.get('checkout') === 'success' && checkoutSessionId) {
      let checkoutConfirmed = false;
      try {
        const confirmation = await api('/api/billing/confirm', { method: 'POST', body: JSON.stringify({ sessionId: checkoutSessionId }) });
        if (!confirmation?.user || !['pro','business'].includes(confirmation.user.plan)) {
          throw new Error('Stripe ödənişi alındı, lakin Professional/Business planı hələ təsdiqlənməyib. Səhifəni yeniləyərək yenidən yoxlayın.');
        }
        // Refresh from the authenticated account endpoint so the dashboard always renders the DB-backed tier.
        const refreshed = await api('/api/auth/me');
        user = refreshed.user;
        if (user.plan !== confirmation.user.plan) {
          throw new Error('Abunəlik təsdiqi ilə hesab planı uyğun gəlmədi. Səhifəni yeniləyin və billing statusunu yoxlayın.');
        }
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        checkoutConfirmed = true;
        toast(`${user.planInfo?.name || user.plan} planı aktivləşdirildi.`, 'success');
      } catch (error) {
        // If Stripe has already completed payment but the Checkout confirmation
        // write did not finish, try an authenticated recovery using the account email.
        try {
          const recovered = await api('/api/billing/recover', { method: 'POST', body: JSON.stringify({}) });
          if (recovered?.user && ['pro','business'].includes(recovered.user.plan)) {
            user = recovered.user;
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            checkoutConfirmed = true;
            toast(`${user.planInfo?.name || user.plan} planı mövcud Stripe abunəliyindən bərpa edildi.`, 'success');
          } else {
            toast(error.message || 'Ödəniş yoxlanılır. Təkrar ödəniş etməyin; planı bərpa etmə seçimini istifadə edin.', 'error');
          }
        } catch (recoveryError) {
          toast(error.message || recoveryError.message || 'Ödəniş yoxlanılır. Təkrar ödəniş etməyin; planı bərpa etmə seçimini istifadə edin.', 'error');
        }
      }
      // Keep the Checkout Session ID on failure so a refresh can safely retry confirmation.
      if (checkoutConfirmed) {
        checkoutParams.delete('session_id');
        checkoutParams.delete('checkout');
        const cleanUrl = `${location.pathname}${checkoutParams.toString() ? `?${checkoutParams}` : ''}${location.hash}`;
        history.replaceState({}, '', cleanUrl);
      }
    }

    // Greeting
    const hour = new Date().getHours();
    const greetKey = hour < 12 ? 'dashboard.greetMorning' : hour < 17 ? 'dashboard.greetAfternoon' : 'dashboard.greetEvening';
    const greetingEl = document.getElementById('dashboard-greeting');
    if (greetingEl) {
      greetingEl.setAttribute('data-i18n', greetKey);
      greetingEl.textContent = t(greetKey);
    }

    const nameEl = document.getElementById('dashboard-name');
    if (nameEl) nameEl.textContent = user.name?.split(' ')[0] || user.name || '—';
    const planEl = document.getElementById('dashboard-plan');
    if (planEl) planEl.textContent = user.planInfo?.name || user.plan || '—';
    ['sidebar-user-name'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=user.name || user.email || 'ReytUp'; });
    const planLabel=user.planInfo?.name || user.plan || 'Free';
    const sidebarPlan=document.getElementById('sidebar-user-plan'); if(sidebarPlan) sidebarPlan.textContent=planLabel+' plan';
    const initials=(user.name||user.email||'R').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
    ['sidebar-avatar','topbar-avatar'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=initials||'R';});
    const dateEl=document.getElementById('dashboard-date'); if(dateEl) dateEl.textContent=new Intl.DateTimeFormat(window.i18n?.getLang()==='en'?'en-GB':window.i18n?.getLang()==='ru'?'ru-RU':'az-AZ',{weekday:'short',day:'numeric',month:'short'}).format(new Date());
    const portalButton=document.getElementById('billing-portal-button'); if(portalButton && user.plan!=='free') portalButton.classList.remove('hidden');

    const planLimitEl = document.getElementById('dashboard-plan-limit');
    if (planLimitEl) {
      const limit = user.planInfo?.analyses;
      const unlimited = limit === null || limit === Infinity || !Number.isFinite(limit);
      const usage = user.usage;
      if (usage) {
        const analysisText = unlimited ? `${usage.analysesUsed} ${t('dashboard.perMonth')}` : `${usage.analysesUsed}/${limit} ${t('dashboard.perMonth')}`;
        const aiText = `${usage.aiUsedToday}/${usage.aiLimitPerDay} ${t('dashboard.aiPerDay')}`;
        planLimitEl.textContent = `${analysisText} · ${aiText}`;
      } else {
        planLimitEl.textContent = unlimited ? t('dashboard.unlimited') : `${limit} ${t('dashboard.perMonth')}`;
      }
    }

    const usage = user.usage || {};
    const usageRows = [
      { valueId: 'dashboard-usage-analyses-value', barId: 'dashboard-usage-analyses-bar', used: Number(usage.analysesUsed || 0), limit: Number(usage.analysesLimit), unlimited: usage.analysesLimit === null },
      { valueId: 'dashboard-usage-ai-value', barId: 'dashboard-usage-ai-bar', used: Number(usage.aiUsedToday || 0), limit: Number(usage.aiLimitPerDay), unlimited: false }
    ];
    usageRows.forEach(item => {
      const valueEl = document.getElementById(item.valueId);
      const barEl = document.getElementById(item.barId);
      const safeLimit = Number.isFinite(item.limit) && item.limit > 0 ? item.limit : 0;
      const percent = item.unlimited ? 0 : safeLimit ? Math.max(0, Math.min(100, item.used / safeLimit * 100)) : 0;
      if (valueEl) valueEl.textContent = item.unlimited ? `${item.used} · ${t('dashboard.unlimited')}` : `${item.used}/${safeLimit || '—'}`;
      if (barEl) barEl.style.width = `${percent}%`;
      if (barEl) barEl.setAttribute('aria-valuenow', String(Math.round(percent)));
    });

    const recoverBillingButton = document.getElementById('billing-recover-button');
    if (recoverBillingButton) {
      recoverBillingButton.classList.toggle('hidden', user.plan !== 'free');
      recoverBillingButton.addEventListener('click', async () => {
        if (recoverBillingButton.disabled) return;
        recoverBillingButton.disabled = true;
        const originalLabel = t('billing.recoverButton');
        recoverBillingButton.textContent = t('billing.recoverChecking');
        try {
          const recovered = await api('/api/billing/recover', { method: 'POST', body: JSON.stringify({}) });
          if (!recovered?.user || recovered.user.plan === 'free') throw new Error('Aktiv Professional/Business abunəliyi təsdiqlənmədi.');
          localStorage.setItem(USER_KEY, JSON.stringify(recovered.user));
          toast(`${recovered.user.planInfo?.name || recovered.user.plan} planı bərpa edildi.`, 'success');
          setTimeout(() => location.reload(), 650);
        } catch (error) {
          toast(error.message || 'Stripe abunəliyini bərpa etmək mümkün olmadı.', 'error');
          recoverBillingButton.disabled = false;
          recoverBillingButton.textContent = originalLabel;
        }
      });
    }

    // Keep the dashboard hero description bound to its current locale key.

    try {
      const d = await api('/api/analyses');
      const rows = d.items || [];
      const totalEl = document.getElementById('analysis-total');
      if (totalEl) totalEl.textContent = Number.isFinite(d.totalCount) ? d.totalCount : rows.length;
      const latest=rows[0];
      const latestScore=document.getElementById('dashboard-latest-score');
      const latestAddress=document.getElementById('dashboard-latest-address');
      if(latest){ if(latestScore) latestScore.textContent=latest.result?.score==null?'—':`${latest.result.score}/100`; if(latestAddress) latestAddress.textContent=latest.address || latest.result?.location?.label || '—'; }
      else { if(latestScore) latestScore.textContent='—'; if(latestAddress) latestAddress.textContent=t('dashboard.noRecent'); }

      const hasNumericScore = item => item?.result?.score !== null && item?.result?.score !== undefined && Number.isFinite(Number(item.result.score));
      const allScoreValues = rows.filter(hasNumericScore).map(item => Number(item.result.score));
      const scoredRows = rows.filter(hasNumericScore)
        .slice(0, 8).reverse();
      const scores = scoredRows.map(item => Number(item.result.score));
      const averageScore = allScoreValues.length ? Math.round(allScoreValues.reduce((sum, value) => sum + value, 0) / allScoreValues.length) : null;
      const strongCount = rows.filter(item => hasNumericScore(item) && Number(item.result.score) >= 70).length;
      const averageEl = document.getElementById('dashboard-average-score');
      const strongEl = document.getElementById('dashboard-strong-locations');
      if (averageEl) averageEl.textContent = averageScore === null ? '—' : `${averageScore}/100`;
      if (strongEl) strongEl.textContent = String(strongCount);

      const chartEl = document.getElementById('dashboard-score-chart');
      const chartCount = document.getElementById('dashboard-chart-count');
      const trendCaption = document.getElementById('dashboard-trend-caption');
      if (chartCount) chartCount.textContent = `${scores.length} / ${rows.length}`;
      if (chartEl) {
        if (!scoredRows.length) {
          chartEl.innerHTML = `<div class="dash-chart-empty">${t('dashboard.noScoreYet')}</div>`;
        } else {
          chartEl.innerHTML = `<div class="dash-chart-bars" role="img" aria-label="${esc(t('dashboard.scoreTrend'))}">${scoredRows.map((item, index) => {
            const value = Number(item.result.score);
            const date = fmtDate(item.createdAt);
            return `<div class="dash-chart-column" title="${value}/100 · ${esc(date)}"><div class="dash-chart-value">${value}</div><div class="dash-chart-bar" style="--score-height:${Math.max(3, Math.min(100, value))}%"><i></i></div><span>${esc(date)}</span></div>`;
          }).join('')}</div>`;
        }
      }
      if (trendCaption) {
        const newest = scores.length ? scores[scores.length - 1] : null;
        const previous = scores.length > 1 ? scores[scores.length - 2] : null;
        trendCaption.textContent = newest === null ? '—' : previous === null ? `${newest}/100` : `${newest >= previous ? '+' : ''}${newest - previous} · ${newest}/100`;
      }

      const sourceHealth = document.getElementById('dashboard-source-health');
      const sourceNote = document.getElementById('dashboard-source-note');
      const source = latest?.result?.source || {};
      const googleCount = source.googlePlacesCompetitorSampleCount ?? latest?.result?.breakdown?.dataUsed?.googleCompetitorCount;
      const sourceItems = [
        { key: 'osm', label: t('dashboard.sourceOsm'), ok: Boolean(source.overpassWorked), detail: source.overpassWorked ? t('dashboard.sourceOsmOk') : t('dashboard.sourceOsmDown') },
        { key: 'google', label: t('dashboard.sourceGoogle'), ok: Boolean(source.googlePlacesWorked), detail: source.googlePlacesWorked ? t('dashboard.sourceSampleCount').replace('{n}', String(Number(googleCount || 0))) : (source.googlePlacesConfigured ? t('dashboard.sourceGoogleDown') : t('dashboard.sourceKeyMissing')) },
        { key: 'geocoder', label: t('dashboard.sourceGeocoder'), ok: Boolean(source.geocoder), detail: source.geocoder ? String(source.geocoder) : t('dashboard.sourceGeocoderMissing') }
      ];
      const sourceCount = latest ? sourceItems.filter(item => item.ok).length : 0;
      if (sourceHealth) {
        if (!latest) {
          sourceHealth.innerHTML = `<div class="dash-chart-empty">${t('dashboard.noSourceYet')}</div>`;
        } else {
          sourceHealth.innerHTML = sourceItems.map(item => `<div class="dash-source-item"><span class="dash-source-status ${item.ok ? 'is-ok' : 'is-muted'}"></span><div><strong>${esc(item.label)}</strong><small>${esc(item.detail)}</small></div><b>${esc(item.ok ? t('dashboard.sourceAvailable') : t('dashboard.sourceUnavailable'))}</b></div>`).join('');
        }
      }
      if (sourceNote) sourceNote.textContent = latest?.result?.source?.note || t('dashboard.signalNote');

      // Decision Passport: an explainable, shareable brief built only from the saved analysis.
      const passportLocation = document.getElementById('passport-location');
      const passportScore = document.getElementById('passport-score');
      const passportVerdict = document.getElementById('passport-verdict');
      const passportSourceCount = document.getElementById('passport-source-count');
      const passportRiskCount = document.getElementById('passport-risk-count');
      const passportNextStep = document.getElementById('passport-next-step');
      const passportRing = document.getElementById('passport-score-ring');
      const passportRingLabel = document.getElementById('passport-score-ring-label');
      const passportOpen = document.getElementById('passport-open');
      const passportCopy = document.getElementById('passport-copy');
      const latestResult = latest?.result || {};
      const locationName = latest ? (latest.customName || latest.address || latestResult.location?.label || '—') : t('dashboard.passportEmpty');
      const scoreValue = Number.isFinite(Number(latestResult.score)) && latestResult.score !== null ? Number(latestResult.score) : null;
      const riskItems = Array.isArray(latestResult.negatives) ? latestResult.negatives : [];
      const hasFinance = Boolean(latestResult.finance?.available);
      const verdictText = latestResult.verdict?.label || t('dashboard.passportWaiting');
      let nextStep = t('dashboard.passportEmptyNext');
      if (latest) {
        if (sourceCount < 2) nextStep = t('dashboard.passportNoSource');
        else if (!hasFinance) nextStep = t('dashboard.passportAddFinance');
        else if ((scoreValue !== null && scoreValue < 62) || riskItems.length > 0) nextStep = t('dashboard.passportCompare');
        else nextStep = t('dashboard.passportVisit');
      }
      if (passportLocation) passportLocation.textContent = locationName;
      if (passportScore) passportScore.innerHTML = scoreValue === null ? '—<em>/100</em>' : `${scoreValue}<em>/100</em>`;
      if (passportVerdict) passportVerdict.textContent = verdictText;
      if (passportSourceCount) passportSourceCount.textContent = `${sourceCount}/3`;
      if (passportRiskCount) passportRiskCount.textContent = latest ? String(riskItems.length) : '—';
      if (passportNextStep) passportNextStep.textContent = nextStep;
      if (passportRingLabel) passportRingLabel.textContent = scoreValue === null ? '—' : String(scoreValue);
      if (passportRing) {
        const circumference = 2 * Math.PI * 29;
        passportRing.style.strokeDasharray = String(circumference);
        passportRing.style.strokeDashoffset = String(scoreValue === null ? circumference : circumference * (1 - Math.max(0, Math.min(100, scoreValue)) / 100));
      }
      if (passportOpen) passportOpen.href = latest?.id ? `analyze.html?history=${encodeURIComponent(latest.id)}` : 'analyze.html';
      if (passportCopy) passportCopy.disabled = !latest;
      const sourceSummary = sourceItems.map(item => `${item.label}: ${item.ok ? t('dashboard.sourceAvailable') : t('dashboard.sourceUnavailable')}`).join(' | ');
      const riskSummary = riskItems.length ? riskItems.slice(0, 4).map(item => String(item)).join('; ') : '—';
      const memo = latest ? [
        t('dashboard.passportMemoTitle'),
        `${t('dashboard.passportMemoLocation')}: ${locationName}`,
        `${t('dashboard.passportMemoBusiness')}: ${latest.businessType || '—'}`,
        `${t('dashboard.passportMemoScoreLine')}: ${scoreValue === null ? '—' : `${scoreValue}/100`}`,
        `${t('dashboard.passportMemoVerdict')}: ${verdictText}`,
        `${t('dashboard.passportMemoCoverage')}: ${sourceCount}/3 (${sourceSummary})`,
        `${t('dashboard.passportMemoRisks')}: ${riskSummary}`,
        `${t('dashboard.passportMemoNext')}: ${nextStep}`,
        t('dashboard.passportDisclaimer')
      ].join('\n') : '';
      window.__reytupDecisionMemo = memo;
      if (passportCopy && !passportCopy.dataset.bound) {
        passportCopy.dataset.bound = 'true';
        passportCopy.addEventListener('click', async () => {
          const text = window.__reytupDecisionMemo;
          if (!text) return;
          try {
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
            else {
              const field = document.createElement('textarea');
              field.value = text; field.setAttribute('readonly', ''); field.style.position = 'fixed'; field.style.opacity = '0';
              document.body.appendChild(field); field.select();
              const copied = document.execCommand('copy'); field.remove();
              if (!copied) throw new Error('Clipboard unavailable');
            }
            toast(t('dashboard.passportCopySuccess'), 'success');
          } catch {
            toast(t('dashboard.passportCopyError'), 'error');
          }
        });
      }

      if (!rows.length) {
        histEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📍</div>
            <div class="empty-title">${t('dashboard.noAnalyses')}</div>
            <div class="empty-desc">${t('dashboard.noAnalysesDesc')}</div>
            <a href="analyze.html" class="btn btn-primary">${t('dashboard.startAnalysis')}</a>
          </div>`;
      }

      function verdictBadge(r) {
        const tone = r?.verdict?.tone || 'warn';
        const label = r?.verdict?.label || '—';
        return `<span class="score-badge ${tone === 'good' ? 'good' : tone === 'bad' ? 'bad' : 'warn'}">${esc(label)}</span>`;
      }

      if (rows.length) histEl.innerHTML = `
        <div class="workspace-toolbar" style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost sm" onclick="window._dashToggleCompare()">${t('dashboard.compareMode')}</button>
          <button class="btn btn-ghost sm" onclick="window._dashToggleFavs()">${t('dashboard.favorites')}</button>
          <button class="btn btn-ghost sm" onclick="window._dashShowAll()">${t('dashboard.showAll')}</button>
        </div>
        <div class="history-table-wrap">
          <table class="history-table" aria-label="${t('dashboard.tableAria')}">
            <thead>
              <tr>
                <th><input type="checkbox" id="select-all" onchange="window._dashToggleSelectAll()"></th>
                <th>${t('dashboard.colId')}</th><th>${t('dashboard.colBtype')}</th><th>${t('dashboard.colLocation')}</th>
                <th>${t('dashboard.colScore')}</th><th>${t('dashboard.colVerdict')}</th>
                <th>${t('dashboard.colDate')}</th><th>${t('dashboard.colActions')}</th>
              </tr>
            </thead>
            <tbody id="history-table-body">
              ${rows.map(x => `
                <tr data-id="${x.id}" data-favorite="${x.isFavorite ? 'true' : 'false'}">
                  <td><input type="checkbox" class="analysis-checkbox" value="${x.id}"></td>
                  <td><code>#RU-${String(x.id).padStart(5,'0')}</code></td>
                  <td>${esc(x.businessType)}</td>
                  <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.customName || x.address || x.result?.location?.label || '—')}</td>
                  <td><span class="score-badge ${(x.result?.score||0)>=70?'good':(x.result?.score||0)>=50?'warn':'bad'}">${x.result?.score ?? '—'}/100</span></td>
                  <td>${verdictBadge(x.result)}</td>
                  <td style="white-space:nowrap;color:var(--text-3)">${fmtDate(x.createdAt)}</td>
                  <td>
                    <div style="display:flex;gap:4px">
                      <button class="btn btn-ghost sm" onclick="window._dashToggleFav(${x.id})" title="${t('dashboard.addFavorite')}">${x.isFavorite ? '⭐' : '☆'}</button>
                      <button class="btn btn-ghost sm" onclick="window._dashRename(${x.id})" title="${t('dashboard.rename')}">✎</button>
                      <button class="btn btn-ghost sm" onclick="window._dashDelete(${x.id})" title="${t('dashboard.delete')}">🗑</button>
                      <a class="btn btn-secondary sm" href="analyze.html?history=${x.id}">${t('dashboard.open')}</a>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div id="compare-actions" style="margin-top:16px;display:none">
          <button class="btn btn-primary" onclick="window._dashCompareSelected()">${t('dashboard.compareSelected')}</button>
          <button class="btn btn-ghost" onclick="window._dashClearSelection()">${t('dashboard.clearSelection')}</button>
        </div>`;
    } catch (err) {
      histEl.innerHTML = `<div class="empty-state"><div class="empty-title">${t('dashboard.historyError')}</div><div class="empty-desc">${esc(err.message)}</div></div>`;
    }
  }

  // Workspace functions exposed as globals
  let compareMode = false;
  let favoritesOnly = false;
  let selectedAnalyses = new Set();

  window._dashToggleCompare = function() {
    compareMode = !compareMode;
    document.querySelectorAll('.analysis-checkbox').forEach(cb => cb.style.display = compareMode ? 'block' : 'none');
    const sa = document.getElementById('select-all');
    if (sa) sa.style.display = compareMode ? 'block' : 'none';
    const ca = document.getElementById('compare-actions');
    if (ca) ca.style.display = compareMode ? 'block' : 'none';
  };

  window._dashToggleFavs = function() {
    favoritesOnly = !favoritesOnly;
    document.querySelectorAll('#history-table-body tr').forEach(row => {
      row.style.display = favoritesOnly && row.dataset.favorite !== 'true' ? 'none' : '';
    });
  };

  window._dashShowAll = function() {
    favoritesOnly = false; compareMode = false;
    document.querySelectorAll('#history-table-body tr').forEach(row => row.style.display = '');
    document.querySelectorAll('.analysis-checkbox').forEach(cb => cb.style.display = 'none');
    const sa = document.getElementById('select-all'); if (sa) sa.style.display = 'none';
    const ca = document.getElementById('compare-actions'); if (ca) ca.style.display = 'none';
  };

  window._dashToggleSelectAll = function() {
    const sa = document.getElementById('select-all');
    document.querySelectorAll('.analysis-checkbox').forEach(cb => cb.checked = sa.checked);
    _updateSelectedCount();
  };

  window._dashToggleFav = async function(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (row) {
      const isFav = row.dataset.favorite === 'true';
      try {
        await api(`/api/analyses/${id}`, { method: 'PATCH', body: JSON.stringify({ isFavorite: !isFav }) });
        row.dataset.favorite = isFav ? 'false' : 'true';
        const btn = row.querySelector('button[onclick*="_dashToggleFav"]');
        if (btn) btn.textContent = isFav ? '☆' : '⭐';
        toast(t(isFav ? 'dashboard.removedFav' : 'dashboard.addedFav'), 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  };

  window._dashRename = async function(id) {
    const newName = prompt(t('dashboard.renamePrompt'));
    if (newName && newName.trim()) {
      try {
        await api(`/api/analyses/${id}`, { method: 'PATCH', body: JSON.stringify({ customName: newName.trim() }) });
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) { row.cells[3].textContent = newName.trim(); toast(t('dashboard.renamed'), 'success'); }
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  };

  window._dashDelete = async function(id) {
    if (!confirm(t('dashboard.deleteConfirm'))) return;
    try {
      await api(`/api/analyses/${id}`, { method: 'DELETE' });
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) { row.remove(); toast(t('dashboard.deleted'), 'success'); }
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  function _updateSelectedCount() {
    const checkboxes = document.querySelectorAll('.analysis-checkbox:checked');
    selectedAnalyses = new Set(Array.from(checkboxes).map(cb => parseInt(cb.value)));
    const ca = document.getElementById('compare-actions');
    if (ca) ca.style.display = selectedAnalyses.size >= 2 ? 'block' : 'none';
  }

  window._dashClearSelection = function() {
    document.querySelectorAll('.analysis-checkbox').forEach(cb => cb.checked = false);
    selectedAnalyses.clear();
    const sa = document.getElementById('select-all'); if (sa) sa.checked = false;
    const ca = document.getElementById('compare-actions'); if (ca) ca.style.display = 'none';
  };

  window._dashCompareSelected = function() {
    if (selectedAnalyses.size < 2) { toast(t('dashboard.selectMin2'), 'error'); return; }
    localStorage.setItem('selectedForComparison', JSON.stringify(Array.from(selectedAnalyses)));
    location.href = 'location-battle.html';
  };

  document.addEventListener('change', function(e) {
    if (e.target.classList.contains('analysis-checkbox')) _updateSelectedCount();
  });

  // Keep backward-compat aliases
  window.toggleCompareMode = window._dashToggleCompare;
  window.toggleFavorites = window._dashToggleFavs;
  window.showAll = window._dashShowAll;
  window.toggleSelectAll = window._dashToggleSelectAll;
  window.toggleFavorite = window._dashToggleFav;
  window.renameAnalysis = window._dashRename;
  window.updateSelectedCount = _updateSelectedCount;
  window.clearSelection = window._dashClearSelection;
  window.compareSelected = window._dashCompareSelected;

  /* ── Stripe billing portal ──────────────────────────────── */
  function initBillingPortal() {
    const btn=document.getElementById('billing-portal-button');
    if(!btn) return;
    btn.addEventListener('click',async()=>{
      btn.disabled=true;
      try { const data=await api('/api/billing/portal',{method:'POST',body:JSON.stringify({})}); if(data?.url) location.href=data.url; }
      catch(err){ toast(err.message,'error'); btn.disabled=false; }
    });
  }

  /* ── Pricing ────────────────────────────────────────────── */
  function formatStripePrice(price) {
    if (!price || price.amount == null || !price.currency) return null;
    const amount = Number(price.amount) / 100;
    const currency = String(price.currency).toUpperCase();
    const lang = window.i18n?.getLang?.() || 'az';
    const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-GB' : 'az-AZ';
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); }
    catch { return `${amount.toFixed(2)} ${currency}`; }
  }

  async function initPricing() {
    if (!document.getElementById('billing-buttons') && !document.querySelector('[data-plan-button]')) return;
    let user = getUser();
    if (localStorage.getItem(TOKEN_KEY)) {
      try {
        const me = await api('/api/auth/me');
        user = me.user;
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        updateHeaderAuth();
      } catch { user = null; }
    }

    const labelEl = document.getElementById('current-plan-label');
    const planLabel = user ? (user.planInfo?.name || user.plan || 'Free') : t('pricing.signIn');
    if (labelEl) labelEl.textContent = planLabel;

    let billing = null;
    try { billing = await api('/api/billing/plans'); }
    catch (error) { console.warn('[pricing] plan catalog unavailable:', error.message); }

    const planData = billing?.plans || {};
    for (const key of ['free', 'pro', 'business']) {
      const card = document.querySelector(`[data-plan-card="${key}"]`);
      if (!card) continue;
      const plan = planData[key];
      const priceEl = card.querySelector(`[data-price-display="${key}"]`);
      const periodEl = card.querySelector(`[data-period-display="${key}"]`);
      const button = card.querySelector('[data-plan-button]');
      const current = Boolean(user && user.plan === key);
      const badge = card.querySelector('.pricing-current-badge');
      if (badge) badge.classList.toggle('hidden', !current);

      if (key === 'free') {
        if (priceEl) priceEl.innerHTML = '0 <small>₼</small>';
        if (periodEl) periodEl.textContent = 'aylıq';
      } else if (plan?.configured && plan.price) {
        if (priceEl) priceEl.textContent = formatStripePrice(plan.price) || '—';
        if (periodEl) {
          const interval = plan.price.interval;
          const count = Number(plan.price.intervalCount || 1);
          const suffix = interval === 'year' ? (count > 1 ? `${count} ildən bir` : 'illik') : interval === 'week' ? (count > 1 ? `${count} həftədən bir` : 'həftəlik') : interval === 'day' ? (count > 1 ? `${count} gündən bir` : 'gündəlik') : (count > 1 ? `${count} aydan bir` : 'aylıq');
          periodEl.textContent = suffix;
        }
      } else {
        if (priceEl) priceEl.textContent = '—';
        if (periodEl) periodEl.textContent = plan?.configurationError === 'BILLING_AUTH_FAILED' ? 'Stripe açarı qəbul edilmədi' : 'Stripe qiyməti mövcud deyil';
      }

      if (button) {
        if (!button.dataset.bound) {
          button.addEventListener('click', () => checkout(button.dataset.planButton));
          button.dataset.bound = '1';
        }
        if (current) {
          button.textContent = t('pricing.currentPlanBadge');
          button.disabled = true;
        } else if (key === 'free') {
          button.disabled = false;
          button.textContent = user && user.plan !== 'free' ? t('dashboard.manageBilling') : t('cta.startFree');
        } else {
          button.disabled = !plan?.configured || !billing?.checkoutConfigured;
          button.textContent = key === 'pro' ? t('cta.switchPro') : t('cta.switchBusiness');
          button.title = button.disabled ? 'Stripe qiyməti hazır deyil. Server konfiqurasiyasını yoxlayın.' : '';
        }
      }
    }

    document.querySelectorAll('[data-plan-button]').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.addEventListener('click', () => checkout(btn.dataset.planButton));
      btn.dataset.bound = '1';
    });

    const note = document.getElementById('billing-note-text');
    if (note) {
      note.textContent = !billing?.checkoutConfigured
        ? 'Stripe ödənişi hazır deyil: serverdə test/live secret key və plan qiymətləri yoxlanmalıdır.'
        : !billing.webhookConfigured
          ? 'Stripe Checkout aktivdir. Ödənişdən sonra plan hesabda təsdiqlənir; avtomatik yenilənmə statusu üçün webhook da quraşdırılmalıdır.'
          : 'Stripe Checkout və webhook konfiqurasiya olunub. Plan ödəniş təsdiqindən sonra avtomatik yenilənir.';
    }
  }

  async function checkout(plan) {
    if (plan === 'free') {
      const user = await requireLogin();
      if (!user) return;
      if (user.plan === 'free') { toast('Free plan artıq aktivdir.', 'success'); return; }
      try {
        const portal = await api('/api/billing/portal', { method: 'POST', body: JSON.stringify({}) });
        if (portal?.url) location.href = portal.url;
      } catch (err) { toast(err.message, 'error'); }
      return;
    }
    const user = await requireLogin();
    if (!user) return;
    if (user.plan !== 'free') {
      try {
        const portal = await api('/api/billing/portal', { method: 'POST', body: JSON.stringify({}) });
        if (portal?.url) location.href = portal.url;
      } catch (err) { toast(err.message, 'error'); }
      return;
    }
    try {
      const d = await api('/api/billing/checkout', { method:'POST', body:JSON.stringify({ plan }) });
      if (d?.url) location.href = d.url;
      else toast('Stripe Checkout linki qaytarılmadı.', 'error');
    } catch (err) {
      toast(err.message || 'Ödəniş sessiyası yaradıla bilmədi.', 'error');
    }
  }

  /* ── Admin ──────────────────────────────────────────────── */
  async function initAdmin() {
    const adminEl = document.getElementById('admin-messages');
    if (!adminEl) return;
    const user = await requireLogin();
    if (!user || user.role !== 'admin') {
      toast(t('error.adminRequired'), 'error');
      setTimeout(() => location.href = 'dashboard.html', 1200);
      return;
    }
    try {
      const d = await api('/api/admin/messages');
      if (!d.items.length) {
        adminEl.innerHTML = `<div class="empty-state"><div class="empty-title">${t('admin.noMessages')}</div></div>`;
        return;
      }
      adminEl.innerHTML = `
        <div class="result-table-wrap">
          <table class="admin-table" aria-label="${t('admin.tableAria')}">
            <thead><tr>
              <th>${t('admin.colDate')}</th><th>${t('admin.colPerson')}</th><th>${t('admin.colEmail')}</th>
              <th>${t('admin.colCompany')}</th><th>${t('admin.colMessage')}</th><th>${t('admin.colStatus')}</th>
            </tr></thead>
            <tbody>
              ${d.items.map(x => `<tr>
                <td style="white-space:nowrap">${fmtDate(x.createdAt)}</td>
                <td>${esc(x.name)}</td><td>${esc(x.email)}</td>
                <td>${esc(x.company||'—')}</td>
                <td class="msg-cell">${esc(x.message)}</td>
                <td><select class="select" data-status-id="${x.id}" style="font-size:12px">
                  <option ${x.status==='new'?'selected':''}>new</option>
                  <option ${x.status==='read'?'selected':''}>read</option>
                  <option ${x.status==='resolved'?'selected':''}>resolved</option>
                </select></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
      adminEl.querySelectorAll('[data-status-id]').forEach(sel => {
        sel.addEventListener('change', async () => {
          try {
            await api('/api/admin/messages/' + sel.dataset.statusId, { method:'PATCH', body:JSON.stringify({ status:sel.value }) });
            toast(t('admin.statusUpdated'));
          } catch {}
        });
      });
    } catch (err) { toast(err.message, 'error'); }
  }

  /* ── Page transition ────────────────────────────────────── */
  function initPageTransition() {
    let overlay = document.getElementById('page-transition');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'page-transition';
      overlay.innerHTML = '<span>Reyt<em>Up</em></span>';
      document.body.appendChild(overlay);
    }
    requestAnimationFrame(() => overlay.classList.remove('show'));

    document.addEventListener('click', e => {
      const a = e.target.closest('a');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
      // Workspace navigation is same-tab and visually persistent; do not show a page-opening transition.
      if (a.closest('.dashboard-sidebar, .workspace-topbar')) return;
      if (a.target === '_blank') return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
      try {
        const url = new URL(href, location.href);
        if (url.origin !== location.origin) return;
        if (url.pathname === location.pathname && url.hash) return;
      } catch { return; }
      e.preventDefault();
      window.ReytUpMenu?.open?.(false);
      overlay.classList.add('show');
      setTimeout(() => { location.href = a.href; }, 200);
    }, true);
  }

  /* ── Re-render dynamic content on lang change ───────────── */
  document.addEventListener('langchange', () => {
    // Re-render dashboard if present
    const histEl = document.getElementById('analysis-history');
    if (histEl && histEl.querySelector('.history-table')) {
      initDashboard();
    }
    // Update drawer CTA
    const drawerCta = document.getElementById('drawer-cta');
    const user = getUser();
    if (drawerCta && user) {
      drawerCta.textContent = t('nav.goDashboard');
    }
    // Update newsletter placeholders dynamically
    document.querySelectorAll('[data-newsletter-form] input[type="email"]').forEach(inp => {
      inp.placeholder = t('footer.emailPlaceholder');
    });
    // Update plan badge
    if (document.getElementById('billing-buttons')) initPricing();
  });

  /* ── Expose globals ─────────────────────────────────────── */
  window.ReytUp = { api, getUser, logout, saveSession, toast, requireLogin, esc, money, fmtDate, t };

  /* ── Boot ───────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    initNavbarScroll();
    initHomeDrawer();
    initReveal();
    initAuthForms();
    initDashboardMobileNav();
    initContactForm();
    initNewsletterForms();
    initLogoutButtons();
    updateHeaderAuth();
    initDashboard();
    initPricing();
    initBillingPortal();
    initAdmin();
    initPageTransition();
    if (document.querySelector('[data-stat]')) loadStats();
  });

})();
