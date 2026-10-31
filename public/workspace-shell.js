/* Shared ReytUp workspace shell. Keeps the Signal-style sidebar fixed on every workspace page. */
(function () {
  'use strict';
  const page = (location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
  const routes = {
    'dashboard.html': { title: 'İcmal', key: 'dashboard.overview', icon: '⌂' },
    'analyze.html': { title: 'Analiz laboratoriyası', key: 'nav.analysis', icon: '⌖' },
    'find-my-place.html': { title: 'Məkanımı tap', key: 'nav.findMyPlace', icon: '◎' },
    'location-battle.html': { title: 'Lokasiya müqayisəsi', key: 'nav.locationBattle', icon: '⇄' },
    'pricing.html': { title: 'Plan və ödəniş', key: 'nav.pricing', icon: '◇' },
    'about.html': { title: 'Haqqımızda', key: 'nav.about', icon: '⌘' },
    'contact.html': { title: 'Əlaqə', key: 'nav.contact', icon: '✉' },
    'privacy.html': { title: 'Məxfilik', key: 'footer.privacy', icon: '◈' },
    'terms.html': { title: 'Şərtlər', key: 'footer.terms', icon: '≋' }
  };
  if (!routes[page] || page === 'dashboard.html' || document.querySelector('.dashboard-sidebar')) return;
  const current = routes[page];
  document.body.classList.add('workspace-page');
  document.body.insertAdjacentHTML('afterbegin', `
    <aside class="dashboard-sidebar workspace-sidebar" aria-label="ReytUp iş sahəsi naviqasiyası">
      <a class="dashboard-brand" href="dashboard.html"><span class="brand-mark">R</span><span>reyt<span class="brand-lime">up</span><small>LOCATION INTELLIGENCE</small></span></a>
      <div class="sidebar-group-label" data-i18n="dashboard.groupWorkspace">İŞ MƏKANI</div>
      <nav class="dashboard-nav">
        <a class="dashboard-nav-link ${page==='dashboard.html'?'active':''}" href="dashboard.html"><span class="nav-icon">⌂</span><span data-i18n="dashboard.overview">İcmal</span><i></i></a>
        <a class="dashboard-nav-link ${page==='analyze.html'?'active':''}" href="analyze.html"><span class="nav-icon">⌖</span><span data-i18n="nav.analysis">Analiz laboratoriyası</span><i></i></a>
        <a class="dashboard-nav-link ${page==='find-my-place.html'?'active':''}" href="find-my-place.html"><span class="nav-icon">◎</span><span data-i18n="nav.findMyPlace">Məkanımı tap</span><i></i></a>
        <a class="dashboard-nav-link ${page==='location-battle.html'?'active':''}" href="location-battle.html"><span class="nav-icon">⇄</span><span data-i18n="nav.locationBattle">Lokasiya müqayisəsi</span><i></i></a>
      </nav>
      <div class="sidebar-group-label" data-i18n="dashboard.groupManage">İDARƏETMƏ</div>
      <nav class="dashboard-nav">
        <a class="dashboard-nav-link ${page==='pricing.html'?'active':''}" href="pricing.html"><span class="nav-icon">◇</span><span data-i18n="nav.pricing">Plan və ödəniş</span><i></i></a>
        <a class="dashboard-nav-link ${page==='about.html'?'active':''}" href="about.html"><span class="nav-icon">⌘</span><span data-i18n="nav.about">Haqqımızda</span><i></i></a>
        <a class="dashboard-nav-link ${page==='contact.html'?'active':''}" href="contact.html"><span class="nav-icon">✉</span><span data-i18n="nav.contact">Əlaqə</span><i></i></a>
      </nav>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-help-card"><span class="help-orb">✳</span><strong data-i18n="dashboard.needHelp">Kömək lazımdır?</strong><p data-i18n="dashboard.helpDesc">ReytUp köməkçisi analizini izah edə bilər.</p><button type="button" data-open-assistant data-i18n="dashboard.askAssistant">Köməkçiyə sual ver ↗</button></div>
      <div class="sidebar-profile"><div class="profile-avatar" id="workspace-sidebar-avatar">R</div><div class="profile-meta"><strong id="workspace-sidebar-name">ReytUp hesabı</strong><span id="workspace-sidebar-plan">Free plan</span></div><button class="profile-logout" data-logout type="button" aria-label="Hesabdan çıxış"><span aria-hidden="true">↪</span><span class="logout-label">Çıxış</span></button></div>
    </aside>
    <header class="workspace-topbar">
      <div><div class="topbar-breadcrumb"><a href="dashboard.html">ReytUp</a><span>/</span><b data-i18n="${current.key}">${current.title}</b></div><div class="topbar-status"><span class="online-dot"></span><span data-i18n="dashboard.systemLive">Analiz sistemi aktivdir</span></div></div>
      <div class="topbar-actions"><div class="dash-lang-switch"><button type="button" data-lang="az">AZ</button><button type="button" data-lang="en">EN</button><button type="button" data-lang="ru">RU</button></div><a class="btn btn-primary dashboard-create-btn" href="analyze.html">＋ <span data-i18n="cta.newAnalysis">Yeni analiz</span></a><div class="topbar-avatar" id="workspace-topbar-avatar">R</div></div>
    </header>
  `);
  // Replace the old marketing navbar on signed-in workspace pages with one stable app shell.
  document.querySelectorAll('.site-nav-bar, .nav-drawer, .nav-overlay').forEach(el => el.remove());
  const title = document.querySelector('.page-hero h1, .page-title, main h1');
  if (title) title.dataset.workspacePageTitle = 'true';
  try {
    const user = JSON.parse(localStorage.getItem('reytup_user') || 'null');
    if (user) {
      const initials = (user.name || user.email || 'R').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'R';
      document.getElementById('workspace-sidebar-name').textContent = user.name || user.email || 'ReytUp hesabı';
      document.getElementById('workspace-sidebar-plan').textContent = `${user.planInfo?.name || user.plan || 'Free'} plan`;
      document.getElementById('workspace-sidebar-avatar').textContent = initials;
      document.getElementById('workspace-topbar-avatar').textContent = initials;
    }
  } catch (_) {}

})();
