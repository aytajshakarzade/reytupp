/* ============================================================
   location-battle.js — Location Comparison System
   ============================================================ */
'use strict';

(function () {
  const { api, requireLogin, toast, esc, fmtDate, getUser } = window.ReytUp;
  const t = (key) => window.i18n ? window.i18n.t(key) : key;

  function get(id) { return document.getElementById(id); }
  function businessLabel(type) {
    const map={cafe:'btype.cafe',restaurant:'btype.restaurant',fast_food:'btype.fastFood',retail:'btype.retail',beauty:'btype.beauty',medical:'btype.medical',clothing:'btype.clothing',pharmacy:'btype.pharmacy',supermarket:'btype.supermarket',fitness:'btype.fitness',electronics:'btype.electronics',bakery:'btype.bakery',other:'btype.other'};
    return t(map[type]||'btype.other');
  }
  function verdictLabel(r) {
    const score=r?.score||0, fin=!!r?.breakdown?.financeAvailable, provisional=!!r?.breakdown?.isProvisional;
    if(provisional) return t(score>=55?'an.recPromisingTitle':'an.recWeakTitle');
    if(!fin) return t(score>=62?'an.recPromisingTitle':score>=46?'an.recRiskyTitle':'an.recWeakTitle');
    return t(score>=78?'an.recStrongTitle':score>=62?'an.recPromisingTitle':score>=48?'an.recRiskyTitle':'an.recWeakTitle');
  }

  let selectedLocations = new Set();
  let analysisHistory = [];

  // Load analysis history
  async function loadHistory() {
    try {
      const user = await requireLogin();
      if (!user) return;

      const d = await api('/api/analyses');
      analysisHistory = d.items || [];

      // Check for pre-selected analyses from dashboard
      const preSelected = localStorage.getItem('selectedForComparison');
      if (preSelected) {
        const selectedIds = JSON.parse(preSelected);
        selectedIds.forEach(id => {
          if (analysisHistory.find(item => item.id === id)) {
            selectedLocations.add(id);
          }
        });
        localStorage.removeItem('selectedForComparison');
      }

      renderLocationCards();
      updateCompareButton();

      // Auto-compare if selections exist
      if (selectedLocations.size >= 2) {
        compareLocations();
      }
    } catch (err) {
      toast(err.message || t('dashboard.historyError'), 'error');
    }
  }

  // Render location selection cards
  function renderLocationCards() {
    const container = get('battle-locations');
    if (!container) return;

    if (!analysisHistory.length) {
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-3)">
          <div style="font-size:48px;margin-bottom:16px">📍</div>
          <div>${t('battle.noHistory')}</div>
          <div style="font-size:13px;margin-top:8px">${t('battle.analyzeFirst')}</div>
          <a href="analyze.html" class="btn btn-primary" style="margin-top:16px;display:inline-block">${t('cta.analyze')}</a>
        </div>
      `;
      return;
    }

    container.innerHTML = analysisHistory.map(item => {
      const isSelected = selectedLocations.has(item.id);
      const score = item.result?.score || 0;
      const verdict = verdictLabel(item.result);
      const address = item.address || `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`;

      return `
        <div class="battle-location-card ${isSelected ? 'selected' : ''}" data-id="${item.id}" onclick="toggleLocation(${item.id})">
          <div class="battle-location-name">${esc(businessLabel(item.businessType))}</div>
          <div class="battle-location-addr">${esc(address)}</div>
          <div class="battle-location-score">${score}/100</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:4px">${esc(verdict)}</div>
        </div>
      `;
    }).join('');
  }

  // Toggle location selection
  window.toggleLocation = function(id) {
    if (selectedLocations.has(id)) {
      selectedLocations.delete(id);
    } else {
      if (selectedLocations.size >= 5) {
        toast(t('battle.maxFive'), 'error');
        return;
      }
      selectedLocations.add(id);
    }

    renderLocationCards();
    updateCompareButton();
  };

  // Update compare button state
  function updateCompareButton() {
    const btn = get('compare-btn');
    if (!btn) return;

    btn.disabled = selectedLocations.size < 2;
    btn.textContent = selectedLocations.size >= 2
      ? `${selectedLocations.size} ${t('battle.compareSelected')}`
      : t('battle.minTwo');
  }

  // Perform comparison
  async function compareLocations() {
    if (selectedLocations.size < 2) {
      toast(t('battle.minTwo'), 'error');
      return;
    }

    const locations = analysisHistory.filter(item => selectedLocations.has(item.id));
    renderComparisonTable(locations);
    renderTradeoffs(locations);

    get('battle-results').classList.add('show');
    toast(`${locations.length} ${t('battle.compared')}`, 'success');
  }

  // Render comparison table
  function renderComparisonTable(locations) {
    const table = get('comparison-table');
    if (!table) return;

    const headers = [t('battle.metric'), ...locations.map((_, i) => `${t('battle.location')} ${i + 1}`)];

    const metrics = [
      { key: 'score', label: t('metric.totalScore'), max: 100 },
      { key: 'market', label: t('metric.marketSignal'), max: 25, path: 'breakdown.market' },
      { key: 'competition', label: t('metric.competition'), max: 20, path: 'breakdown.competition' },
      { key: 'access', label: t('metric.accessibility'), max: 15, path: 'breakdown.access' },
      { key: 'finance', label: t('metric.finance'), max: 20, path: 'breakdown.finance' },
      { key: 'physical', label: t('metric.physical'), max: 20, path: 'breakdown.physical' },
      { key: 'confidence', label: t('metric.dataConfidence'), max: 10, path: 'breakdown.confidence' },
      { key: 'competitorCount', label: t('metric.competitors'), max: null, path: 'breakdown.dataUsed.competitorCount' },
      { key: 'transportCount', label: t('metric.transport'), max: null, path: 'breakdown.dataUsed.transportCount' }
    ];

    let html = '<thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';

    metrics.forEach(metric => {
      html += '<tr>';
      html += `<td><strong>${metric.label}</strong></td>`;

      const values = locations.map(loc => {
        let value;
        if (metric.path) {
          const parts = metric.path.split('.');
          value = loc.result;
          for (const part of parts) {
            value = value?.[part];
          }
        } else {
          value = loc.result?.[metric.key];
        }

        if (value === null || value === undefined) {
          return '<span style="color:var(--text-3);font-size:11px">—</span>';
        }

        if (metric.max) {
          const pct = Math.round((value / metric.max) * 100);
          return `${value}/${metric.max} <span style="font-size:11px;color:var(--text-3)">(${pct}%)</span>`;
        }

        return value;
      });

      // Find best and worst values for highlighting
      const numericValues = values.map(v => {
        if (typeof v === 'string') {
          const match = v.match(/(\d+)/);
          return match ? parseInt(match[1]) : null;
        }
        return v;
      });

      const validValues = numericValues.filter(v => v !== null);
      if (validValues.length > 0) {
        const maxVal = Math.max(...validValues);
        const minVal = Math.min(...validValues);

        html += values.map((v, i) => {
          const numVal = numericValues[i];
          let cellClass = '';
          if (numVal !== null) {
            if (numVal === maxVal && metric.key !== 'competition') {
              cellClass = 'better';
            } else if (numVal === minVal && metric.key !== 'competition') {
              cellClass = 'worse';
            } else if (metric.key === 'competition' && numVal === minVal) {
              // Lower competition is better
              cellClass = 'better';
            } else if (metric.key === 'competition' && numVal === maxVal) {
              cellClass = 'worse';
            }
          }
          return `<td class="${cellClass}">${v}</td>`;
        }).join('');
      } else {
        html += values.map(v => `<td>${v}</td>`).join('');
      }

      html += '</tr>';
    });

    html += '</tbody>';
    table.innerHTML = html;
  }

  // Render trade-offs
  function renderTradeoffs(locations) {
    const container = get('tradeoff-text');
    if (!container) return;

    const tradeoffs = [];

    // Compare accessibility
    const accessValues = locations.map((loc, i) => ({
      id: i + 1,
      value: loc.result?.breakdown?.access
    })).filter(v => v.value !== null);

    if (accessValues.length >= 2) {
      const best = accessValues.reduce((a, b) => a.value > b.value ? a : b);
      const worst = accessValues.reduce((a, b) => a.value < b.value ? a : b);
      if (best.value !== worst.value) {
        tradeoffs.push(`${t('battle.location')} ${best.id}: ${t('battle.accessBetter')} (${best.value}/15). ${t('battle.location')} ${worst.id}: ${t('battle.accessLower')} (${worst.value}/15).`);
      }
    }

    // Compare competition
    const compValues = locations.map((loc, i) => ({
      id: i + 1,
      value: loc.result?.breakdown?.competition
    })).filter(v => v.value !== null);

    if (compValues.length >= 2) {
      const best = compValues.reduce((a, b) => a.value > b.value ? a : b); // Higher competition score = less competition
      const worst = compValues.reduce((a, b) => a.value < b.value ? a : b);
      if (best.value !== worst.value) {
        tradeoffs.push(`${t('battle.location')} ${best.id}: ${t('battle.lowerCompetition')} (${best.value}/20). ${t('battle.location')} ${worst.id}: ${t('battle.higherCompetition')} (${worst.value}/20).`);
      }
    }

    // Compare market signal
    const marketValues = locations.map((loc, i) => ({
      id: i + 1,
      value: loc.result?.breakdown?.market
    })).filter(v => v.value !== null);

    if (marketValues.length >= 2) {
      const best = marketValues.reduce((a, b) => a.value > b.value ? a : b);
      const worst = marketValues.reduce((a, b) => a.value < b.value ? a : b);
      if (best.value !== worst.value) {
        tradeoffs.push(`${t('battle.location')} ${best.id}: ${t('battle.marketStronger')} (${best.value}/25). ${t('battle.location')} ${worst.id}: ${t('battle.marketWeaker')} (${worst.value}/25).`);
      }
    }

    // Compare overall score
    const scoreValues = locations.map((loc, i) => ({
      id: i + 1,
      value: loc.result?.score
    }));

    const bestScore = scoreValues.reduce((a, b) => a.value > b.value ? a : b);
    const worstScore = scoreValues.reduce((a, b) => a.value < b.value ? a : b);
    if (bestScore.value !== worstScore.value) {
      tradeoffs.push(`${t('battle.location')} ${bestScore.id}: ${t('battle.scoreHigher')} (${bestScore.value}/100). ${t('battle.location')} ${worstScore.id}: ${t('battle.scoreLower')} (${worstScore.value}/100).`);
    }

    if (tradeoffs.length === 0) {
      container.textContent = window.i18n.t('battle.noSignificantDiff');
    } else {
      container.innerHTML = tradeoffs.map(t => `<p style="margin-bottom:8px">${t}</p>`).join('');
    }
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    get('compare-btn')?.addEventListener('click', compareLocations);
    loadHistory();
  });
})();
