/* ============================================================
   find-my-place.js — Opportunity Discovery System
   ============================================================ */
'use strict';

(function () {
  const { api, requireLogin, toast, esc, money, fmtDate, getUser } = window.ReytUp;
  const t = (key) => window.i18n ? window.i18n.t(key) : key;

  function get(id) { return document.getElementById(id); }

  // Update DNA summary
  function updateDNASummary() {
    const city = get('dna-city').value;
    const businessType = get('dna-business-type').value;
    const budget = get('dna-budget').value;
    const targetAudience = get('dna-target-audience').value;
    const environment = get('dna-environment').value;
    const competitionTolerance = get('dna-competition-tolerance').value;
    const accessibilityImportance = get('dna-accessibility-importance').value;
    const expectedRevenue = get('dna-expected-revenue').value;

    if (!businessType) {
      get('dna-summary').style.display = 'none';
      return;
    }

    const summaryEl = get('dna-summary');
    const summaryText = get('dna-summary-text');

    const typeLabels = {
      cafe: t('btype.cafe'), restaurant: t('btype.restaurant'), retail: t('btype.retail'),
      beauty: t('btype.beauty'), fitness: t('type.fitness'), pharmacy: t('btype.pharmacy'),
      bakery: t('btype.bakery'), supermarket: t('btype.supermarket'), electronics: t('btype.electronics'),
      clothing: t('btype.clothing'), other: t('btype.other')
    };

    const audienceLabels = {
      general: t('audience.general'), families: t('audience.families'), students: t('audience.students'),
      professionals: t('audience.professionals'), tourists: t('audience.tourists')
    };

    const envLabels = {
      urban: t('env.urban'), residential: t('env.residential'),
      commercial: t('env.commercial'), suburban: t('env.suburban')
    };

    let tags = [];
    if (city) tags.push(city);
    tags.push(typeLabels[businessType]);
    if (targetAudience !== 'general') tags.push(audienceLabels[targetAudience]);
    if (environment !== 'urban') tags.push(envLabels[environment]);
    if (budget) tags.push(`${t('analyze.budgetLabel')}: ${budget} AZN`);

    const toleranceLabel = competitionTolerance <= 2 ? t('competition.tolerant') : competitionTolerance >= 4 ? t('competition.low') : t('competition.moderate');
    tags.push(toleranceLabel);

    const accessLabel = accessibilityImportance >= 4 ? t('accessibility.important') : t('accessibility.normal');
    tags.push(accessLabel);

    summaryText.innerHTML = tags.map(t => `<span class="dna-tag">${esc(t)}</span>`).join('');
    summaryEl.style.display = 'block';
  }

  // Render opportunity results from backend API
  function renderOpportunities(opportunities) {
    const tbody = get('opportunities-list');
    tbody.innerHTML = opportunities.map((opp, i) => {
      const score = opp.score; // Number or null
      const scoreDisplay = opp.scoreDisplay || (score === null ? 'N/A' : `${score}/100`);
      const scoreClass = score !== null && score >= 70 ? 'good' : score !== null && score >= 50 ? 'warn' : score !== null ? 'bad' : 'bad';
      const confClass = opp.confidence === 'HIGH' ? 'conf-high' : opp.confidence === 'MEDIUM' ? 'conf-medium' : 'conf-low';
      const confLabel = opp.confidence === 'HIGH' ? t('analyze.confidenceHigh') : opp.confidence === 'MEDIUM' ? t('analyze.confidenceMedium') : t('analyze.confidenceLow');

      // Handle null values (unavailable data)
      const competitionDisplay = opp.competition !== null ? `${opp.competition}/20` : `<span style="color:var(--text-3);font-size:11px">${t('an.dataNotReceived')}</span>`;
      const accessDisplay = opp.access !== null ? `${opp.access}/15` : `<span style="color:var(--text-3);font-size:11px">${t('an.dataNotReceived')}</span>`;
      const financeDisplay = opp.finance !== null ? `${opp.finance}/20` : `<span style="color:var(--text-3);font-size:11px">${t('an.dataNotReceived')}</span>`;

      return `
        <tr>
          <td>
            <div style="font-weight:600;color:var(--text-1)">${esc(opp.name)}</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:2px">
              ${opp.lat.toFixed(4)}, ${opp.lng.toFixed(4)}
            </div>
            ${opp.isProvisional ? `<div style="font-size:10px;color:var(--amber);margin-top:2px">${t('analyze.apiDataUnavailable')}</div>` : ''}
          </td>
          <td>
            <span class="score-badge ${scoreClass}">${scoreDisplay}</span>
          </td>
          <td>${opp.market !== null ? opp.market : '—'}/25</td>
          <td>${competitionDisplay}</td>
          <td>${accessDisplay}</td>
          <td>${financeDisplay}</td>
          <td>
            <span class="breakdown-conf-badge ${confClass}">${confLabel}</span>
          </td>
          <td>
            <button class="btn btn-primary sm" onclick="window.location.href='analyze.html?lat=${opp.lat}&lng=${opp.lng}'" style="padding:6px 12px;font-size:12px">
              ${t('cta.analyze')}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    get('opportunity-results').style.display = 'block';
  }

  // Handle form submission
  async function handleDNASubmit(e) {
    e.preventDefault();

    const user = await requireLogin();
    if (!user) return;

    const businessType = get('dna-business-type').value;
    const city = get('dna-city').value;
    if (!businessType) {
      toast(t('error.selectBusinessType'), 'error');
      return;
    }
    if (!city) {
      toast(t('error.enterCity'), 'error');
      return;
    }

    const dna = {
      businessType: businessType,
      city: city,
      budget: get('dna-budget').value,
      targetAudience: get('dna-target-audience').value,
      environment: get('dna-environment').value,
      competitionTolerance: parseInt(get('dna-competition-tolerance').value),
      accessibilityImportance: parseInt(get('dna-accessibility-importance').value),
      expectedRevenue: get('dna-expected-revenue').value
    };

    // Show loading
    get('loading-card').classList.add('show');
    get('opportunity-results').style.display = 'none';

    try {
      const d = await api('/api/find-opportunities', {
        method: 'POST',
        body: JSON.stringify(dna)
      });

      // Hide loading
      get('loading-card').classList.remove('show');

      // Render results
      renderOpportunities(d.opportunities);

      toast(`${d.opportunities.length} ${t('find.opportunitiesFound')}`, 'success');
    } catch (err) {
      get('loading-card').classList.remove('show');
      toast(err.message || t('error.opportunitySearch'), 'error');
    }
  }

  // Reset form
  function resetDNA() {
    get('business-dna-form').reset();
    get('dna-summary').style.display = 'none';
    get('opportunity-results').style.display = 'none';
  }

  // New search
  function newSearch() {
    get('opportunity-results').style.display = 'none';
    get('business-dna-form').reset();
    get('dna-summary').style.display = 'none';
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    const form = get('business-dna-form');
    if (form) {
      form.addEventListener('submit', handleDNASubmit);
    }

    get('dna-city')?.addEventListener('input', updateDNASummary);
    get('dna-business-type')?.addEventListener('change', updateDNASummary);
    get('dna-budget')?.addEventListener('input', updateDNASummary);
    get('dna-target-audience')?.addEventListener('change', updateDNASummary);
    get('dna-environment')?.addEventListener('change', updateDNASummary);
    get('dna-competition-tolerance')?.addEventListener('input', updateDNASummary);
    get('dna-accessibility-importance')?.addEventListener('input', updateDNASummary);
    get('dna-expected-revenue')?.addEventListener('input', updateDNASummary);

    get('reset-dna')?.addEventListener('click', resetDNA);
    get('new-search')?.addEventListener('click', newSearch);
  });
})();
