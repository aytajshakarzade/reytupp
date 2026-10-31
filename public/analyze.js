/* ============================================================
   analyze.js — ReytUp v3.0 — Full Product Logic
   Fixes: PDF, score model, map 0,0, competitor empty state,
          confidence per metric, data transparency
   ============================================================ */
'use strict';

(function () {
  const { api, requireLogin, toast, esc, money, fmtDate, getUser } = window.ReytUp;
  function t(key) { return window.i18n ? window.i18n.t(key) : key; }
  function pt(key, vars={}) { return Object.keys(vars).reduce((v,k)=>v.replaceAll(`{${k}}`, String(vars[k])), t(key)); }

  let leafletMap = null;
  let previewMap = null;

  /* ---- Helpers ------------------------------------------- */
  function get(id) { return document.getElementById(id); }
  function setText(id, text) { const el = get(id); if (el) el.textContent = text; }

  /* ---- DNA Summary Update -------------------------------- */
  function updateDNASummary() {
    const businessType = get('dna-business-type')?.value;
    const budget = get('dna-budget')?.value;
    const targetAudience = get('dna-target-audience')?.value;
    const environment = get('dna-environment')?.value;
    const competitionTolerance = get('dna-competition-tolerance')?.value;
    const accessibilityImportance = get('dna-accessibility-importance')?.value;

    if (!businessType) {
      get('dna-summary')?.classList.remove('show');
      return;
    }

    const summaryEl = get('dna-summary');
    const summaryText = get('dna-summary-text');

    const typeLabels = {
      cafe: t('btype.cafe'), restaurant: t('btype.restaurant'), retail: t('btype.retail'),
      beauty: t('btype.beauty'), fitness: t('btype.fitness'), pharmacy: t('btype.pharmacy'),
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

    let tags = [typeLabels[businessType]];
    if (targetAudience !== 'general') tags.push(audienceLabels[targetAudience]);
    if (environment !== 'urban') tags.push(envLabels[environment]);
    if (budget) tags.push(`${t('analyze.budgetLabel')}: ${budget} AZN`);

    const toleranceLabel = competitionTolerance <= 2 ? t('competition.low') : competitionTolerance >= 4 ? t('competition.tolerant') : t('competition.moderate');
    tags.push(toleranceLabel);

    const accessLabel = accessibilityImportance >= 4 ? t('accessibility.important') : t('accessibility.normal');
    tags.push(accessLabel);

    summaryText.innerHTML = tags.map(t => `<span class="dna-tag">${esc(t)}</span>`).join('');
    summaryEl?.classList.add('show');
  }

  /* ---- Stepper ------------------------------------------- */
  function setStep(n) {
    document.querySelectorAll('.astep').forEach(el => {
      const s = Number(el.dataset.step);
      el.classList.toggle('active', s === n);
      el.classList.toggle('done', s < n);
      el.setAttribute('aria-selected', String(s === n));
    });
    document.querySelectorAll('.astep-line').forEach((line, i) => {
      line.classList.toggle('done', i + 1 < n);
    });
    document.querySelectorAll('.form-step-panel').forEach(panel => {
      const p = Number(panel.dataset.panel);
      panel.classList.toggle('active', p === n);
    });
  }

  /* ---- Map helpers --------------------------------------- */
  function ensureLeaflet() { return typeof window.L !== 'undefined'; }

  function osmFallback(containerId, lat, lng, label) {
    const el = get(containerId);
    if (!el) return;
    const delta = 0.012;
    const bbox = `${lng-delta},${lat-delta},${lng+delta},${lat+delta}`;
    const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;
    el.innerHTML = `<div class="map-fallback"><iframe title="${esc(label||t('map.locationFallback'))}" src="${esc(src)}" style="width:100%;height:100%;border:none;display:block" loading="eager" referrerpolicy="no-referrer"></iframe><div class="map-fallback-label">${esc(label||t('map.fallbackLabel'))}</div></div>`;
  }

  function renderLeafletMap(r) {
    const containerId = 'map-leaflet';
    const container = get(containerId);
    if (!container) return;
    const lat = Number(r?.location?.lat), lng = Number(r?.location?.lng);

    // CRITICAL: never show 0,0 map
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      container.innerHTML = `<div class="map-invalid-state">
        <div class="map-invalid-icon">📍</div>
        <div class="map-invalid-title">${pt('an.mapInvalidTitle')}</div>
        <div class="map-invalid-hint">${pt('an.mapInvalidHint')}</div>
      </div>`;
      return;
    }

    // First render OSM iframe as reliable fallback
    osmFallback(containerId, lat, lng, r?.location?.label);

    if (!ensureLeaflet()) return;

    // Then try Leaflet on top
    if (leafletMap) { try { leafletMap.remove(); } catch {} leafletMap = null; }
    container.innerHTML = '';
    try {
      leafletMap = L.map(container, { zoomControl: true }).setView([lat, lng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        maxZoom: 19,
        crossOrigin: true
      }).addTo(leafletMap);

      // Force size fix after DOM settles
      setTimeout(() => { try { leafletMap.invalidateSize(true); } catch {} }, 300);
      setTimeout(() => { try { leafletMap.invalidateSize(true); } catch {} }, 800);

      // Create layer groups
      const competitorLayer = L.layerGroup();
      const transportLayer = L.layerGroup();
      const marketLayer = L.layerGroup();
      const opportunityLayer = L.layerGroup();
      const riskLayer = L.layerGroup();

      // Main location marker (green) - always visible
      const mainIcon = L.divIcon({
        html: `<div style="width:18px;height:18px;border-radius:50%;background:#1a8c5a;border:3px solid white;box-shadow:0 2px 12px rgba(0,0,0,.5)"></div>`,
        className: '', iconSize: [18,18], iconAnchor: [9,9]
      });
      L.marker([lat, lng], { icon: mainIcon }).addTo(leafletMap)
        .bindPopup(`<strong>${esc(r.location.label||t('map.yourLocation'))}</strong><br><small>ReytUp Score: ${r.score}/100</small><br><small style="color:#888">${t('map.source')}</small>`)
        .openPopup();

      // Competitor markers (orange/red)
      const compIcon = L.divIcon({
        html: `<div style="width:10px;height:10px;border-radius:50%;background:#e05a2b;border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,.35)"></div>`,
        className: '', iconSize: [10,10], iconAnchor: [5,5]
      });
      (r.competitors||[]).slice(0,15).forEach(c => {
        if (c.lat && c.lng && c.lat !== 0 && c.lng !== 0) {
          const marker = L.marker([c.lat, c.lng], { icon: compIcon })
            .bindPopup(`<strong>${esc(c.name)}</strong><br><small>${c.distanceKm} km · ${esc(c.category)}</small>${c.address ? `<br><small style="color:#888">${esc(c.address)}</small>` : ''}<br><small style="color:#aaa">${pt('an.sourceShort')} ${esc(c.source||'OSM')}</small>`);
          marker.addTo(competitorLayer);
          marker.addTo(leafletMap); // Add to map by default
        }
      });

      // Transport places are displayed as a verified aggregate count only.
      // The public datasets do not expose coordinates for every matched record here,
      // so do not fabricate map markers.
      const bd = r.breakdown || {};
      const dataUsed = bd.dataUsed || {};

      // Market signal layer (yellow/green circles) - based on POI density
      const poiTotal = dataUsed.poiTotal || 0;
      if (poiTotal > 0) {
        const marketRadius = Math.min(800, poiTotal * 50); // Scale radius by POI count
        const marketCircle = L.circle([lat, lng], {
          radius: marketRadius,
          color: '#f1c40f',
          fillColor: '#f1c40f',
          fillOpacity: 0.15,
          weight: 2
        });
        const aggregateOnly = Boolean(r.source?.googlePlacesWorked && !r.source?.overpassWorked);
        const marketSourceLabel = aggregateOnly ? 'Google Places · maksimum 20 nəticəlik nümunə' : 'OpenStreetMap / Google Places';
        marketCircle.bindPopup(`<strong>${pt('an.marketZone')}</strong><br><small>${pt('an.radius')}: ~${Math.round(marketRadius)}m</small><br><small>${pt('an.poiCount')}: ${poiTotal}</small><br><small style="color:#aaa">${esc(marketSourceLabel)}</small>`);
        marketCircle.addTo(marketLayer);
      }

      // Opportunity layer (green gradient) - based on overall score
      const opportunityRadius = r.score == null ? 0 : Math.min(600, r.score * 6);
      const opportunityCircle = L.circle([lat, lng], {
        radius: opportunityRadius,
        color: '#1a8c5a',
        fillColor: '#1a8c5a',
        fillOpacity: 0.1,
        weight: 2
      });
      opportunityCircle.bindPopup(`<strong>${pt('an.opportunityZone')}</strong><br><small>${pt('an.score')}: ${r.score}/100</small><br><small>${pt('an.radius')}: ~${Math.round(opportunityRadius)}m</small><br><small style="color:#aaa">${pt('an.model')}</small>`);
      if (r.score != null) opportunityCircle.addTo(opportunityLayer);

      // Risk layer (red) - based on competition and data confidence
      const competitionCount = Number.isFinite(dataUsed.competitorCount) ? dataUsed.competitorCount : null;
      if ((competitionCount !== null && competitionCount > 5) || (bd.isProvisional && (r.source?.overpassWorked || r.source?.googlePlacesWorked))) {
        const riskRadius = competitionCount !== null && competitionCount > 10 ? 500 : 300;
        const riskCircle = L.circle([lat, lng], {
          radius: riskRadius,
          color: '#e74c3c',
          fillColor: '#e74c3c',
          fillOpacity: 0.1,
          weight: 2,
          dashArray: '5, 10'
        });
        const riskReasons = [];
        if (competitionCount !== null && competitionCount > 10) riskReasons.push(t('metric.highCompetition'));
        if (bd.isProvisional) riskReasons.push(t('metric.provisionalData'));
        riskCircle.bindPopup(`<strong>${esc(t('metric.riskZone'))}</strong><br><small>${riskReasons.join(', ')}</small><br><small style="color:#aaa">ReytUp model</small>`);
        riskCircle.addTo(riskLayer);
      }

      // Add layer control
      const overlayMaps = {
        [t('metric.competitors')]: competitorLayer,
        [t('metric.transport')]: transportLayer,
        [t('metric.marketSignal')]: marketLayer,
        [t('metric.opportunity')]: opportunityLayer,
        [t('metric.risk')]: riskLayer
      };

      // Only show layers that have content
      const activeOverlays = {};
      if ((r.competitors||[]).length > 0) activeOverlays[t('metric.competitors')] = competitorLayer;
      if (dataUsed.transportCount > 0) activeOverlays[t('metric.transport')] = transportLayer;
      if (poiTotal > 0) activeOverlays[t('metric.marketSignal')] = marketLayer;
      if (r.score != null) activeOverlays[t('metric.opportunity')] = opportunityLayer;
      if (competitionCount > 5 || bd.isProvisional) activeOverlays[t('metric.risk')] = riskLayer;

      if (Object.keys(activeOverlays).length > 0) {
        L.control.layers(null, activeOverlays, { position: 'topright' }).addTo(leafletMap);
      }

    } catch(err) {
      console.warn('Leaflet init error:', err);
      // Fallback already rendered above
      osmFallback(containerId, lat, lng, r?.location?.label);
    }
  }

  function initPreviewMap(lat, lng) {
    const wrap = get('preview-map-wrap');
    const containerId = 'map-preview';
    const container = get(containerId);
    const coordsEl = get('map-preview-coords');
    if (!container || !wrap) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = 'block';
    if (coordsEl) coordsEl.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if (!ensureLeaflet()) { osmFallback(containerId, lat, lng, t('map.coordLocation')); return; }
    if (previewMap) {
      try { previewMap.setView([lat, lng], 15); previewMap.invalidateSize(); } catch {}
      return;
    }
    try {
      previewMap = L.map(container, { zoomControl: false }).setView([lat, lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a>', maxZoom: 19
      }).addTo(previewMap);
      const icon = L.divIcon({
        html: `<div style="width:12px;height:12px;border-radius:50%;background:#1a8c5a;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
        className: '', iconSize: [12,12], iconAnchor: [6,6]
      });
      L.marker([lat, lng], { icon }).addTo(previewMap);
      setTimeout(() => { try { previewMap.invalidateSize(); } catch {} }, 200);
    } catch {}
  }

  /* ---- Confidence level display helpers ------------------ */
  function confClass(level) {
    return level === 'HIGH' ? 'conf-high' : level === 'MEDIUM' ? 'conf-medium' : level === 'UNAVAILABLE' ? 'conf-unavailable' : 'conf-low';
  }
  function confLabel(level) {
    return level === 'HIGH' ? t('analyze.confidenceHigh') : level === 'MEDIUM' ? t('analyze.confidenceMedium') : level === 'UNAVAILABLE' ? t('analyze.confidenceUnavailable') : t('analyze.confidenceLow');
  }

  /* ---- Score info tooltips (expanded) -------------------- */
  // Keyed by stable metric id (not translated label) so lookups work regardless of language.
  const SCORE_INFO_BY_ID = {
    market: {
      labelKey: 'metric.marketSignal',
      what: 'metric.market.what',
      how: 'metric.market.how',
      source: 'metric.market.source',
      type: 'metric.market.type'
    },
    competition: {
      labelKey: 'metric.competition',
      what: 'metric.competition.what',
      how: 'metric.competition.how',
      source: 'metric.competition.source',
      type: 'metric.competition.type'
    },
    physical: {
      labelKey: 'metric.physical',
      what: 'metric.physical.what',
      how: 'metric.physical.how',
      source: 'metric.physical.source',
      type: 'metric.physical.type'
    },
    accessibility: {
      labelKey: 'metric.transit',
      what: 'metric.transit.what',
      how: 'metric.transit.how',
      source: 'metric.transit.source',
      type: 'metric.transit.type'
    },
    finance: {
      labelKey: 'metric.finance',
      what: 'metric.financeScenario.what',
      how: 'metric.financeScenario.how',
      source: 'metric.financeScenario.source',
      type: 'metric.financeScenario.type'
    },
    confidence: {
      labelKey: 'metric.dataConfidence',
      what: 'metric.dataConf.what',
      how: 'metric.dataConf.how',
      source: 'metric.dataConf.source',
      type: 'metric.dataConf.type'
    }
  };

  function scoreInfoFor(id, result = null) {
    const entry = SCORE_INFO_BY_ID[id];
    if (!entry) return {};
    const aggregateOnly = result?.source?.googlePlacesWorked && !result?.source?.overpassWorked;
    const info = { what: t(entry.what), how: t(entry.how), source: t(entry.source), type: t(entry.type) };
    if (aggregateOnly && id === 'competition') {
      const lang = window.i18n?.getLang?.() || 'az';
      const notes = {
        az: ['Google Places API · maksimum 20 nəticəlik nümunə', 'Rəqabət balı müşahidə olunan nümunədən hesablanmış ilkin göstəricidir. 20 nəticə qaytarılıbsa, say ən azı 20 kimi qəbul edilir; daha az nəticə tam siyahı demək deyil. Əminlik aşağıdır.'],
        en: ['Google Places API · sample capped at 20 results', 'The competition score is a provisional signal from observed results. Twenty results indicate at least 20; fewer results do not prove the list is complete. Confidence is low.'],
        ru: ['Google Places API · выборка до 20 результатов', 'Оценка конкуренции — предварительный сигнал по наблюдаемой выборке. 20 результатов означает не менее 20; меньшее число не подтверждает полноту списка. Уверенность низкая.']
      }[lang] || ['Google Places API · sample capped at 20 results', 'Provisional score from observed sample; low confidence.'];
      info.source = notes[0]; info.type = notes[1];
    } else if (aggregateOnly && id === 'accessibility' && result?.breakdown?.access == null) {
      const lang = window.i18n?.getLang?.() || 'az';
      const notes = {
        az: ['Nəqliyyat məlumatı alınmadı', 'Google Places rəqib nümunəsi nəqliyyat göstəricisini əvəz etmir.'],
        en: ['Transport data unavailable', 'The Google Places competitor sample does not replace the transport metric.'],
        ru: ['Данные о транспорте недоступны', 'Выборка конкурентов Google Places не заменяет транспортный показатель.']
      }[lang] || ['Transport data unavailable', 'The Google Places competitor sample does not replace the transport metric.'];
      info.source = notes[0]; info.type = notes[1];
    } else if (aggregateOnly && ['market','competition','accessibility','confidence'].includes(id)) {
      const lang = window.i18n?.getLang?.() || 'az';
      const notes = {
        az: ['Google Places API · 20 nəticəyədək aqreqat nümunə', 'Aqreqat model siqnalı — unikal obyekt sayı və tam coğrafi əhatə deyil.'],
        en: ['Google Places API · aggregate sample capped at 20 results', 'Aggregate model signal — not a unique-place count or complete geographic coverage.'],
        ru: ['Google Places API · агрегированная выборка до 20 результатов', 'Агрегированный сигнал модели — не число уникальных объектов и не полный географический охват.']
      }[lang] || ['Google Places API · aggregate sample capped at 20 results', 'Aggregate model signal — not a unique-place count or complete geographic coverage.'];
      info.source = notes[0]; info.type = notes[1];
    }
    return info;
  }

  /* ---- Render Result ------------------------------------- */
  function renderResult(r, id) {
    // Header
    if (get('result-id')) get('result-id').textContent = `${t('analyze.resultIdPrefix')} #RU-${String(id).padStart(5,'0')}`;
    if (get('result-date')) get('result-date').textContent = fmtDate(r.analyzedAt);
    if (get('result-location-tag')) get('result-location-tag').textContent = r.location?.label || '—';

    // Score ring
    const circ = 2 * Math.PI * 50;
    const ring = get('score-ring-fg');
    const score = r.score == null ? 0 : Number(r.score);
    if (ring) {
      const offset = circ - (circ * score / 100);
      ring.setAttribute('stroke-dasharray', circ);
      ring.setAttribute('stroke-dashoffset', String(offset));
      const ringColor = r.score == null ? 'var(--muted)' : score >= 70 ? 'var(--green)' : score >= 50 ? '#e8a02a' : 'var(--red)';
      ring.style.stroke = ringColor;
    }
    setText('score-val', r.score == null ? '—' : score);
    setText('bt-total', r.score == null ? '—' : score);
    const coverageEl=get('score-coverage-note');
    if(coverageEl){
      const pct=Number(r.breakdown?.scoreCoveragePct||0);
      coverageEl.style.display='block';
      const sourceNames = [r.source?.overpassWorked ? 'OpenStreetMap' : null, r.source?.googlePlacesWorked ? 'Google Places' : null].filter(Boolean);
      const sourceLabel = sourceNames.length ? sourceNames.join(' + ') : 'Məlumat məhduddur';
      coverageEl.textContent=`Skor komponentlərinin əhatəsi: ${pct}% · Mənbə keyfiyyəti ayrıca göstəricidir və 100 ballıq skora daxil deyil · ${sourceLabel}${r.source?.googlePlacesWorked?' · Google nəticələri 20 obyektədək aqreqat nümunədir':''}`;
    }
    const sourceTag=get('result-source-tag');
    if(sourceTag) sourceTag.textContent=[r.source?.overpassWorked?'OpenStreetMap':null,r.source?.googlePlacesWorked?'Google Places':null].filter(Boolean).join(' + ') || 'Məkan mənbələri';

    // Finance availability note in score
    if (!r.breakdown?.financeAvailable) {
      const noteEl = get('score-finance-note');
      if (noteEl) {
        noteEl.textContent = t('analyze.financeNotProvided');
        noteEl.style.display = 'block';
      }
    }

    // Verdict
    const tone = r.verdict?.tone || 'warn';
    const verdEl = get('verdict');
    if (verdEl) { verdEl.textContent = r.verdict?.label || '—'; verdEl.className = `verdict-pill ${tone}`; }

    // Confidence-aware sub-label
    const overallConf = r.breakdown?.perMetricConfidence?.overall || 'MEDIUM';
    const subEl = get('verdict-sub');
    if (subEl) {
      subEl.textContent = overallConf === 'LOW'
        ? t('analyze.analysisCompleteLow')
        : overallConf === 'HIGH'
        ? t('analyze.analysisCompleteHigh')
        : 'Analiz tamamlandı · Məlumat əminliyi: Orta';
    }

    buildRecommendation(r);
    buildWhyRisks(r);
    buildBreakdown(r);
    buildEvidenceContext(r);
    buildFinance(r);

    // Map
    const openMap = get('open-map-link');
    const lat = Number(r.location?.lat), lng = Number(r.location?.lng);
    if (openMap && Number.isFinite(lat) && lat !== 0) {
      openMap.href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
    }
    const resolvedAddress = get('resolved-address');
    if (resolvedAddress) {
      resolvedAddress.textContent = r.location?.label ? `${pt('an.confirmed')} ${r.location.label}` : '';
    }
    setTimeout(() => renderLeafletMap(r), 200);

    buildCompetitors(r);
    buildLocationDNA(r);
    initWhatIf(r);

    // Decision note
    const dn = get('decision-note');
    if (dn) {
      if (r.aiExplanation) {
        dn.innerHTML = `<div class="ai-label">${pt('an.aiLabel')}</div><p>${esc(r.aiExplanation)}</p>`;
        setText('decision-source-label', t('an.aiAnalysis'));
      } else {
        setText('decision-source-label', t('analyze.decisionModelNote'));
        dn.innerHTML = `<p>${esc(r.summary||'')}</p>`;
      }
    }

    // Store result for PDF generation
    window._lastAnalysisResult = r;
    window._lastAnalysisId = id;
  }

  function buildRecommendation(r) {
    const score = r.score == null ? null : Number(r.score);
    const tone = r.verdict?.tone || 'warn';
    const finAvail = r.breakdown?.financeAvailable;
    const isProvisional = Boolean(r.breakdown?.isProvisional);
    const recCard = get('rec-card');
    if (recCard) recCard.className = `rec-card ${tone}`;

    let recTitle, recIcon, recDesc;
    if (score === null) {
      recTitle = t('an.recWeakTitle'); recIcon = '⚠'; recDesc = 'Xəritə məlumatı kifayət etmədiyi üçün etibarlı skor hesablamaq mümkün olmadı.';
    } else if (score >= 78) {
      recTitle = t('an.recStrongTitle'); recIcon = '✓'; recDesc = t('an.recStrongDesc');
    } else if (score >= 62) {
      recTitle = t('an.recPromisingTitle'); recIcon = '↗'; recDesc = t('an.recPromisingDesc');
    } else if (score >= 48) {
      recTitle = t('an.recRiskyTitle'); recIcon = '⚠'; recDesc = t('an.recRiskyDesc');
    } else {
      recTitle = t('an.recWeakTitle'); recIcon = '✕'; recDesc = t('an.recWeakDesc');
    }

    if (isProvisional) recDesc += ` ${t('an.recProvisional')}`;
    else if (!finAvail) recDesc += ` (${t('an.recNoFinance')})`;

    setText('rec-label', t('analyze.recommendationLabel'));
    setText('rec-title', recTitle);
    setText('rec-desc', recDesc);
    const iconEl = get('rec-icon');
    if (iconEl) iconEl.textContent = recIcon;
  }

  function buildWhyRisks(r) {
    const whyEl = get('why-list');
    const riskEl = get('risk-list');
    const positives = r.positives || [];
    const negatives = r.negatives || [];

    if (whyEl) {
      whyEl.innerHTML = positives.length
        ? positives.map(x => `<div class="why-item"><span class="why-item-icon">✓</span><span>${esc(x)}</span></div>`).join('')
        : `<div class="why-item"><span class="why-item-icon">—</span><span>${pt('an.noStrength')}</span></div>`;
    }

    if (riskEl) {
      riskEl.innerHTML = negatives.length
        ? negatives.map(x => `<div class="risk-item"><span class="risk-item-icon">⚠</span><span>${esc(x)}</span></div>`).join('')
        : `<div class="risk-item"><span class="risk-item-icon" style="color:var(--green)">✓</span><span>${pt('an.noRisk')}</span></div>`;
    }

    // Overall confidence badge
    const overallConf = r.breakdown?.perMetricConfidence?.overall || 'MEDIUM';
    const confBadge = get('confidence-badge');
    if (confBadge) {
      confBadge.className = `data-confidence-badge ${confClass(overallConf)}`;
      const lang = window.i18n?.getLang?.() || 'az';
      const coverageCopy = { az: ['Mənbə əhatəsi yaxşıdır','Mənbə əhatəsi qisməndir','Mənbə əhatəsi məhduddur'], en: ['Good source coverage','Partial source coverage','Limited source coverage'], ru: ['Хорошее покрытие источниками','Частичное покрытие источниками','Ограниченное покрытие источниками'] }[lang] || ['Good source coverage','Partial source coverage','Limited source coverage'];
      const coverageLabel = overallConf === 'HIGH' ? coverageCopy[0] : overallConf === 'MEDIUM' ? coverageCopy[1] : coverageCopy[2];
      confBadge.innerHTML = `<span class="conf-dot"></span><span class="conf-label">${coverageLabel}</span>`;
    }
  }

  function buildBreakdown(r) {
    const bd = r.breakdown || {};
    const pmc = bd.perMetricConfidence || {};
    const finAvail = bd.financeAvailable;

    // null = no verified value in the available source set, not 0
    const mapAvailable = Boolean(r.source?.overpassWorked || r.source?.googlePlacesWorked);
    const compUnavail = bd.competition === null || bd.competition === undefined;
    const accessUnavail = bd.access === null || bd.access === undefined;
    const marketUnavail = bd.market === null || bd.market === undefined;
    const physicalUnavail = bd.physical === null || bd.physical === undefined;
    const pairs = [
      ['market', marketUnavail ? null : bd.market, 25, marketUnavail ? 'UNAVAILABLE' : (pmc.market || 'MEDIUM'), false, marketUnavail],
      ['competition', compUnavail ? null : bd.competition, 20, compUnavail ? 'UNAVAILABLE' : (pmc.competition || 'MEDIUM'), false, compUnavail],
      ['accessibility', accessUnavail ? null : bd.access, 15, accessUnavail ? 'UNAVAILABLE' : (pmc.access || 'MEDIUM'), false, accessUnavail],
      ['physical', physicalUnavail ? null : bd.physical, 20, physicalUnavail ? 'UNAVAILABLE' : (pmc.physical || 'USER_INPUT'), false, physicalUnavail],
      ['finance', bd.finance, 20, pmc.finance || 'UNAVAILABLE', !finAvail],
    ];
    const el = get('breakdowns');
    if (!el) return;
    el.innerHTML = pairs.map(([id, val, max, conf, unavailable, apiUnavailable]) => {
      // apiUnavailable = the requested metric has no verified source value; unavailable = user didn't provide financial data
      const isUnavail = unavailable || apiUnavailable;
      const pct = isUnavail ? 0 : Math.round(((val||0)/max)*100);
      const fillCls = isUnavail ? 'unavailable' : pct >= 70 ? 'high' : pct >= 40 ? 'mid' : 'low';
      const label = t(SCORE_INFO_BY_ID[id].labelKey);
      const info = scoreInfoFor(id, r);
      const displayVal = isUnavail ? '—' : val;
      const googleOnly = Boolean(r.source?.googlePlacesWorked && !r.source?.overpassWorked);
      const displayNote = apiUnavailable
        ? (googleOnly && id === 'competition' ? t('analyze.googleCompetitionUnavailable')
          : googleOnly && id === 'accessibility' ? t('analyze.googleTransportUnavailable')
          : t('analyze.apiDataUnavailable'))
        : (googleOnly && id === 'competition' ? t('analyze.googleCompetitionSample')
          : unavailable ? t('analyze.dataNotProvided') : '');

      return `<div class="breakdown-row">
        <div class="breakdown-meta">
          <div class="breakdown-name">
            ${esc(label)}
            <span class="why-badge" onclick="showWhyEngine('${id}', ${val}, ${max}, '${conf}', ${apiUnavailable}, ${unavailable})">${esc(t('analyze.whyLabel'))}</span>
            <span class="bd-tooltip-wrap" tabindex="0" aria-label="${esc(t('analyze.aboutMetricAria').replace('{label}', label))}">
              <span class="bd-tooltip-icon">ⓘ</span>
              <div class="bd-info-popup">
                <div class="bdp-header">${esc(label)}</div>
                <div class="bdp-section"><strong>${esc(t('analyze.whatItMeasures'))}:</strong><br>${esc(info.what||'')}</div>
                <div class="bdp-section"><strong>${esc(t('analyze.howCalculated'))}:</strong><br>${esc(info.how||'')}</div>
                <div class="bdp-section"><strong>${esc(t('analyze.sourceLabel'))}:</strong><br>${esc(info.source||'')}</div>
                <div class="bdp-type">${esc(info.type||'')}</div>
              </div>
            </span>
            ${apiUnavailable ? `<span class="bd-unavailable-tag api-unavail">${esc(t('analyze.apiDataMissingTag'))}</span>` : unavailable ? `<span class="bd-unavailable-tag">${esc(t('analyze.notProvidedTag'))}</span>` : ''}
          </div>
          <div class="breakdown-scores">
            <span class="breakdown-val ${isUnavail ? 'text-muted' : ''}">${displayVal}</span>
            <span class="breakdown-max">/${max}</span>
            ${!isUnavail ? `<span class="breakdown-pct">(${pct}%)</span>` : ''}
          </div>
        </div>
        ${displayNote ? `<div class="bd-unavail-note ${apiUnavailable ? 'api-note' : ''}">${esc(displayNote)}</div>` : ''}
        <div class="breakdown-track">
          <div class="breakdown-fill ${fillCls}" style="width:${pct}%"></div>
        </div>
      </div>`;
    }).join('');
  }

  function langFinanceAssumption(r) {
    const lang=window.i18n?.getLang?.()||'az';
    const pct=Number(r?.finance?.otherCostsAssumptionPct ?? 45);
    return ({
      az:`Model fərziyyəsi: digər əməliyyat xərcləri gəlirin ${pct}%-i götürülür. Bu rəqəm istifadəçi tərəfindən daxil edilməyib və real xərc məlumatı deyil.`,
      en:`Model assumption: other operating costs are set to ${pct}% of revenue. This is not user-entered or verified expense data.`,
      ru:`Допущение модели: прочие операционные расходы приняты равными ${pct}% выручки. Это не введённые пользователем и не подтверждённые фактические расходы.`
    })[lang]||'Model assumption: other operating costs are set to 45% of revenue.';
  }

  function buildEvidenceContext(r) {
    const grid = get('demand-context-grid');
    const note = get('demand-context-note');
    const physicalEl = get('physical-inputs-result');
    const demand = r.demandContext;
    const lang = window.i18n?.getLang?.() || 'az';
    const labels = {
      az: ['Təhsil obyektləri','Ofis qeydləri','Yaşayış qeydləri','Piyada infrastrukturu'],
      en: ['Education places','Office records','Residential records','Pedestrian infrastructure'],
      ru: ['Учебные объекты','Офисные записи','Жилые объекты','Пешеходная инфраструктура']
    }[lang] || ['Education places','Office records','Residential records','Pedestrian infrastructure'];
    const values = demand ? [demand.educationCount,demand.officeCount,demand.residentialCount,demand.pedestrianInfrastructureCount] : [null,null,null,null];
    if (grid) grid.innerHTML = labels.map((label,index) => `<div class="demand-context-item"><span>${esc(label)}</span><strong>${values[index] == null ? '—' : Number(values[index]).toLocaleString()}</strong></div>`).join('');
    if (note) note.textContent = demand
      ? t('analyze.demandProxyDisclaimer')
      : t('analyze.demandSourceUnavailable');
    if (physicalEl) {
      const p = r.physical || {};
      const fields = [
        [t('analyze.physicalArea'), p.areaSqm ? `${p.areaSqm} m²` : null],
        [t('analyze.physicalFloor'), p.floorLevel !== null && p.floorLevel !== undefined && p.floorLevel !== '' ? String(p.floorLevel) : null],
        [t('analyze.physicalWindow'), p.displayWindow ? t(`analyze.window${({large:'Large',standard:'Standard',limited:'Limited',none:'None'})[p.displayWindow]}`) : null],
        [t('analyze.physicalEntrance'), p.entranceType ? t(`analyze.entrance${({street:'Street',mall:'Mall',shared:'Shared',upper:'Upper',basement:'Basement'})[p.entranceType]}`) : null],
        [t('analyze.physicalVentilation'), p.ventilation ? t(`analyze.ventilation${({good:'Good',limited:'Limited',none:'None'})[p.ventilation]}`) : null]
      ].filter(item => item[1] !== null);
      physicalEl.innerHTML = fields.length
        ? `<div class="physical-inputs-title">${esc(t('analyze.physicalCaptured'))}</div><div class="physical-inputs-chips">${fields.map(([label,value]) => `<span><b>${esc(label)}:</b> ${esc(value)}</span>`).join('')}</div>`
        : `<div class="physical-inputs-title">${esc(t('analyze.physicalNotProvided'))}</div>`;
    }
  }

  function buildFinance(r) {
    const f = r.finance || {};
    const el = get('finance-metrics');
    if (!el) return;

    // If no finance data was provided
    if (!f.available) {
      const budgetCheck = f.rentBudget != null || f.rent != null
        ? `<div class="rent-budget-check"><span>${esc(t('analyze.rentBudgetCheck'))}</span><strong>${f.rent != null ? esc(money(f.rent)) : '—'} / ${f.rentBudget != null ? esc(money(f.rentBudget)) : '—'}</strong><em class="${f.rentWithinBudget === false ? 'over-budget' : f.rentWithinBudget === true ? 'within-budget' : ''}">${f.rentWithinBudget === null || f.rentWithinBudget === undefined ? esc(t('analyze.rentBudgetUnknown')) : f.rentWithinBudget ? esc(t('analyze.withinBudget')) : esc(t('analyze.overBudget'))}</em></div>`
        : '';
      el.innerHTML = `${budgetCheck}<div class="finance-unavailable">
        <div class="finance-unavailable-icon">📊</div>
        <div class="finance-unavailable-title">${pt('an.financeTitle')}</div>
        <div class="finance-unavailable-desc">${pt('an.financeDesc')}</div>
        <div class="finance-unavailable-fields">${pt('an.financeFields')} <strong>${pt('an.rent')} · ${pt('an.plannedRevenue')} · ${pt('an.investment')}</strong></div>
      </div>`;
      return;
    }

    function metricItem(label, val, note='', cls='') {
      return `<div class="fm-item">
        <div class="fm-label">${esc(label)}</div>
        <div class="fm-val ${cls}">${esc(String(val||'—'))}</div>
        ${note ? `<div class="fm-note">${esc(note)}</div>` : ''}
      </div>`;
    }

    const ratioNum = f.ratio;
    const ratioCls = ratioNum == null ? '' : ratioNum <= 15 ? 'good' : ratioNum <= 25 ? 'warn' : 'bad';

    el.innerHTML = [
      f.rentBudget != null ? metricItem(t('analyze.rentBudgetCheck'), money(f.rentBudget), f.rentWithinBudget === null ? t('analyze.rentBudgetUnknown') : f.rentWithinBudget ? t('analyze.withinBudget') : t('analyze.overBudget'), f.rentWithinBudget === false ? 'bad' : f.rentWithinBudget === true ? 'good' : '') : '',
      metricItem(pt('an.rent'), money(f.rent), t('analyze.userInput')),
      metricItem(pt('an.plannedRevenue'), money(f.revenue), t('analyze.financeModelNote')),
      metricItem(t('analyze.rentRevenueRatio'), ratioNum != null ? `${ratioNum}%` : '—', ratioNum != null ? (ratioNum<=15?t('analyze.healthyRange'):t('analyze.highLoad')) : t('analyze.dataNeeded'), ratioCls),
      metricItem(pt('an.investment'), money(f.investment), f.investment ? t('analyze.userInput') : t('analyze.notProvidedTag')),
      metricItem(t('analyze.whatIfBreakeven'), f.breakEven != null ? `${f.breakEven} ay` : '—', f.breakEven ? t('analyze.investmentPaybackModel') : t('analyze.investmentDataNeeded')),
      metricItem(t('analyze.whatIfProfit'),
        f.monthlyProfitScenario != null ? money(f.monthlyProfitScenario) : '—',
        f.monthlyProfitScenario != null
          ? (f.monthlyProfitScenario >= 0 ? t('analyze.positiveModelScenario') : t('analyze.negativeModelScenario'))
          : t('analyze.dataNeeded'),
        f.monthlyProfitScenario != null ? (f.monthlyProfitScenario > 0 ? 'good' : 'bad') : ''),
      `<div class="finance-assumption-note">${langFinanceAssumption(r)}</div>`,
    ].join('');
  }

  function buildCompetitors(r) {
    const comps = Array.isArray(r.competitors) ? r.competitors : [];
    const wrap = get('competitors-wrap');
    const badge = get('competitor-count-badge');
    const overpassWorked = Boolean(r.source?.overpassWorked);
    const googleWorked = Boolean(r.source?.googlePlacesWorked);
    const mapAvailable = overpassWorked || googleWorked;
    const conf = r.breakdown?.perMetricConfidence;
    const osmCount = r.breakdown?.dataUsed?.osmCompetitorCount;
    const googleSampleCount = r.source?.googlePlacesCompetitorSampleCount ?? r.breakdown?.dataUsed?.googleCompetitorCount;
    const totalCompetitors = overpassWorked && Number.isFinite(Number(osmCount))
      ? Number(osmCount)
      : (Number.isFinite(Number(googleSampleCount)) ? Number(googleSampleCount) : comps.length);
    const googleOnly = googleWorked && !overpassWorked;

    if (badge) {
      badge.textContent = !mapAvailable ? '—'
        : googleOnly ? `~${totalCompetitors} Google`
        : `${pt('an.compsFound', { n: totalCompetitors })}`;
    }
    if (!wrap) return;

    if (!mapAvailable) {
      wrap.innerHTML = `<div class="comp-data-warning">
        <span class="comp-warn-icon">⚠</span>
        <div><strong>${t('analyze.apiDataMissingTag')}</strong><br><span>${t('analyze.apiDataUnavailable')}</span></div>
      </div>`;
      return;
    }

    if (!comps.length) {
      const compConf = conf?.competition || 'UNAVAILABLE';
      const title = googleOnly && Number.isFinite(Number(googleSampleCount))
        ? `Google Places: ${Number(googleSampleCount)} obyektədək nümunə`
        : 'Bu radiusda göstərilə bilən obyekt tapılmadı';
      const transitOnly = Boolean(r.source?.googlePlacesTransportWorked && !googleWorked && !overpassWorked);
      const note = googleOnly
        ? 'Google Places sorğusu obyekt sayı qaytardı, lakin xəritə koordinatları olmayan qeydlər siyahıda göstərilmir. Bu say tam və təsdiqlənmiş rəqib sayı deyil.'
        : transitOnly
          ? 'Google Places yalnız ictimai nəqliyyat sorğusuna cavab verdi. Rəqiblərin siyahısı üçün ayrıca obyekt məlumatı yoxdur.'
          : 'Bu nəticə ərazidə rəqib olmadığına zəmanət vermir. Mənbənin xəritə əhatəsi və sahə müşahidəsi nəzərə alınmalıdır.';
      wrap.innerHTML = `<div class="comp-zero-state"><div class="comp-zero-icon">◉</div><div class="comp-zero-title">${esc(title)}</div><div class="comp-zero-note">${esc(note)}</div></div>`;
      return;
    }

    const near = comps.filter(c => Number(c.distanceKm) < 0.3);
    const mid = comps.filter(c => Number(c.distanceKm) >= 0.3 && Number(c.distanceKm) < 0.7);
    const far = comps.filter(c => Number(c.distanceKm) >= 0.7);

    function compRows(list, distCls) {
      return list.map(c => `<div class="comp-row">
        <span class="comp-dist-badge ${distCls}">${Number(c.distanceKm).toFixed(2)} km</span>
        <div class="comp-info">
          <div class="comp-name">${esc(c.name || 'Ad göstərilməyib')}</div>
          <div class="comp-cat">${esc(c.category || 'Obyekt')}${c.address ? ' · ' + esc(c.address) : ''}</div>
        </div>
        <div class="comp-source-tag">${esc(c.source || 'Xəritə mənbəyi')}</div>
      </div>`).join('');
    }

    const sourceNote = googleOnly
      ? `Google Places: ${Number.isFinite(Number(googleSampleCount)) ? Number(googleSampleCount) : comps.length} yaxın obyekt müşahidə nümunəsi (sorğu üzrə maksimum 20). Bu, tam ərazi siyahısı və təsdiqlənmiş unikal rəqib sayı deyil.`
      : 'Siyahıda koordinatı olan OpenStreetMap və Google Places obyektləri göstərilir. Google nəticələri hər sorğu üzrə maksimum 20 obyektlik nümunədir; mənbələr arasında təkrarlanan qeydlər mümkün qədər birləşdirilir.';
    let html = `<div class="comp-data-note">${esc(sourceNote)}</div>`;
    if (near.length) html += `<div class="comp-group-label">Çox yaxın (300m daxilində)</div>${compRows(near, 'near')}`;
    if (mid.length) html += `<div class="comp-group-label">Orta məsafə (300m – 700m)</div>${compRows(mid, 'mid')}`;
    if (far.length) html += `<div class="comp-group-label">Uzaq (700m+)</div>${compRows(far, 'far')}`;
    wrap.innerHTML = html;
  }

  /* ---- Why Engine ------------------------------------------ */
  window.showWhyEngine = function(id, value, max, conf, apiUnavailable, unavailable) {
    const modal = get('why-modal');
    const title = get('why-modal-title');
    const body = get('why-modal-body');

    if (!modal || !title || !body) return;

    const label = t((SCORE_INFO_BY_ID[id] || {}).labelKey || id);
    title.textContent = `${label} — ${t('analyze.whyLabel')}`;

    const info = scoreInfoFor(id);
    const isUnavail = unavailable || apiUnavailable;

    let items = [];

    // What changed the score
    if (!isUnavail && value !== null) {
      const pct = Math.round((value / max) * 100);
      items.push({
        label: t('analyze.scoreValue'),
        value: `${value}/${max} (${pct}%)`,
        data: t('analyze.scoreValueData').replace('{max}', max).replace('{value}', value)
      });
    }

    // Which data contributed
    if (info.what) {
      items.push({
        label: t('analyze.measuredIndicator'),
        value: info.what,
        data: t('analyze.measuredIndicatorData')
      });
    }

    if (info.how) {
      items.push({
        label: t('analyze.calcMethod'),
        value: info.how,
        data: t('analyze.calcMethodData')
      });
    }

    // Source
    let sourceType = 'MODEL';
    let sourceLabel = t('analyze.modelSignal');

    if (id === 'competition' || id === 'accessibility') {
      const aggregateOnly = Boolean(result?.source?.googlePlacesWorked && !result?.source?.overpassWorked);
      sourceType = aggregateOnly ? 'AGGREGATE SAMPLE' : apiUnavailable ? 'UNAVAILABLE' : 'REAL DATA';
      sourceLabel = aggregateOnly ? (id === 'competition' ? 'Google Places · müşahidə nümunəsi üzrə rəqabət indeksi' : 'Google Places · yaxın obyekt nümunəsi') : apiUnavailable ? t('analyze.dataNotReceived') : 'OpenStreetMap';
    } else if (id === 'finance') {
      sourceType = unavailable ? 'UNAVAILABLE' : 'USER INPUT';
      sourceLabel = unavailable ? t('analyze.userDataNotProvided') : t('analyze.userProvided');
    }

    items.push({
      label: t('analyze.sourceLabel'),
      value: sourceLabel,
      data: info.source || t('analyze.modelOrUserData')
    });

    // Confidence
    items.push({
      label: t('analyze.confidenceLabel'),
      value: confLabel(conf),
      data: conf === 'HIGH' ? t('analyze.confidenceHigh') : conf === 'MEDIUM' ? t('analyze.confidenceMedium') : t('analyze.confidenceLow')
    });

    // What is uncertain
    if (apiUnavailable) {
      items.push({
        label: t('analyze.unknownLabel'),
        value: t('analyze.apiDataValue'),
        data: t('analyze.apiUnavailableData')
      });
    }

    if (unavailable) {
      items.push({
        label: t('analyze.unknownLabel'),
        value: t('analyze.userDataValue'),
        data: t('analyze.financeNotEnteredData')
      });
    }

    body.innerHTML = items.map(item => `
      <div class="why-item">
        <div class="why-item-label">${esc(item.label)}</div>
        <div class="why-item-value">${esc(item.value)}</div>
        <div class="why-item-data">${esc(item.data)}</div>
        <span class="why-source ${sourceType.toLowerCase()}">${sourceType}</span>
      </div>
    `).join('');

    modal.classList.add('show');
  }

  /* ---- Location DNA --------------------------------------- */
  function buildLocationDNA(r) {
    const bd = r.breakdown || {};
    const dataUsed = bd.dataUsed || {};
    const dnaSection = get('location-dna-section');
    const dimensionsEl = get('dna-dimensions');
    const summaryEl = get('dna-profile-summary-text');

    if (!dnaSection) return;

    // Build dimensions
    const googleOnly = Boolean(r.source?.googlePlacesWorked && !r.source?.overpassWorked);
    const dimensions = [
      { label: 'Bazar konteksti', value: bd.market, max: 25, source: bd.market == null ? 'UNAVAILABLE' : 'OSM CONTEXT PROXIES' },
      { label: 'Rəqabət', value: bd.competition, max: 20, source: googleOnly ? 'GOOGLE SAMPLE' : bd.competition == null ? 'UNAVAILABLE' : 'OPENSTREETMAP DATA' },
      { label: 'Əlçatanlıq', value: bd.access, max: 15, source: bd.access == null ? 'UNAVAILABLE' : googleOnly ? 'AGGREGATE SAMPLE' : 'REAL DATA' },
      { label: 'Fiziki uyğunluq', value: bd.physical, max: 20, source: bd.physical == null ? 'NOT ENOUGH INPUTS' : 'USER INPUT' },
      { label: 'Maliyyə', value: bd.finance, max: 20, source: bd.finance == null ? 'UNAVAILABLE' : 'USER INPUT' }
    ];

    if (dimensionsEl) {
      dimensionsEl.innerHTML = dimensions.map(d => {
        const pct = d.value !== null ? Math.round((d.value / d.max) * 100) : 0;
        const displayValue = d.value !== null ? d.value : '—';
        return `
          <div class="dna-dimension">
            <div class="dna-dimension-label">${d.label}</div>
            <div class="dna-dimension-value">${displayValue}</div>
            <div class="dna-dimension-bar">
              <div class="dna-dimension-fill" style="width: ${pct}%"></div>
            </div>
            <div style="font-size:10px;color:var(--text-3);margin-top:4px">${d.source}</div>
          </div>
        `;
      }).join('');
    }

    // Build summary based on actual data
    if (summaryEl) {
      const traits = [];

      const aggregateOnly = Boolean(r.source?.googlePlacesWorked && !r.source?.overpassWorked);
      if (dataUsed.transportCount > 0) {
        traits.push(aggregateOnly ? `Google Places-dən ${dataUsed.transportCount} nəqliyyat nəticəsi (aqreqat nümunə)` : `${dataUsed.transportCount} ictimai nəqliyyat obyekt qeydi`);
      }
      if (aggregateOnly && Number(dataUsed.googleCompetitorCount) > 0) {
        traits.push(`${Number(dataUsed.googleCompetitorCount)}-dək Google Places yaxın obyekt nümunəsi (tam və unikal rəqib sayı deyil)`);
      } else if (dataUsed.competitorCount > 0) {
        traits.push(`${dataUsed.competitorCount} eyni kateqoriyalı OSM obyekt qeydi`);
      }
      if (!aggregateOnly && dataUsed.poiTotal > 5) {
        traits.push('yüksək biznes aktivliyi');
      } else if (!aggregateOnly && dataUsed.poiTotal > 0) {
        traits.push('mülayam biznes aktivliyi');
      }

      if (bd.competition !== null && bd.competition >= 20) {
        traits.push('aşağı rəqabət');
      } else if (bd.competition !== null && bd.competition <= 10) {
        traits.push('yüksək rəqabət');
      }

      if (bd.access !== null && bd.access >= 15) {
        traits.push('güclü əlçatanlıq');
      } else if (bd.access !== null && bd.access <= 10) {
        traits.push('məhdud əlçatanlıq');
      }

      if (bd.physical != null) traits.push(`obyektin fiziki uyğunluğu ${bd.physical}/20`);
      const demand = dataUsed.demandContext;
      if (demand && dataUsed.demandContextAvailable) traits.push(`ətrafda ${demand.educationCount} təhsil obyekti, ${demand.officeCount} ofis, ${demand.residentialCount} yaşayış xəritə qeydi və ${demand.pedestrianInfrastructureCount} piyada infrastrukturu qeydi`);
      if (bd.financeAvailable) {
        traits.push('maliyyə ssenarisi daxil edilib');
      }

      if (bd.isProvisional) {
        traits.push('bəzi məlumatlar müvəqqətidir');
      }

      const summary = traits.length > 0
        ? traits.join(', ').charAt(0).toUpperCase() + traits.join(', ').slice(1) + '.'
        : 'Məlumat məhdudiyyəti səbəbindən profil yaradıla bilmədi.';

      summaryEl.textContent = summary;

      // Store in result for report generation
      if (window._lastAnalysisResult) {
        window._lastAnalysisResult.locationDNA = {
          summary: summary,
          dimensions: dimensions
        };
      }
    }
  }

  /* ---- AI Location Analyst ---------------------------------- */
  let currentAnalysisId = null;

  window.askAI = async function(question) {
    if (!currentAnalysisId) {
      toast(t('error.analysisIdNotFound'), 'error');
      return;
    }

    const answerEl = get('ai-answer');
    const answerTextEl = get('ai-answer-text');

    if (answerEl) answerEl.style.display = 'block';
    if (answerTextEl) answerTextEl.innerHTML = '<span style="color:var(--text-3)">AI cavabı gözlənilir...</span>';

    try {
      const d = await api('/api/ai-question', {
        method: 'POST',
        body: JSON.stringify({
          analysisId: currentAnalysisId,
          question: question,
          language: window.i18n ? window.i18n.getLang() : 'az'
        })
      });

      if (answerTextEl) {
        // Format the answer with proper line breaks
        const formatted = d.answer
          .replace(/\n\n/g, '</p><p>')
          .replace(/\n/g, '<br>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>');

        answerTextEl.innerHTML = `<p>${formatted}</p>`;
      }

      toast(t('toast.aiAnswer'), 'success');
    } catch (err) {
      if (answerTextEl) answerTextEl.innerHTML = `<span style="color:var(--red)">Xəta: ${err.message || 'AI cavabı alınmadı'}</span>`;
      toast(err.message || 'AI cavabı alınmadı', 'error');
    }
  };

  window.askCustomAI = async function() {
    const input = get('ai-question-input');
    const question = input?.value?.trim();

    if (!question) {
      toast(t('error.enterQuestion'), 'error');
      return;
    }

    await askAI(question);
    if (input) input.value = '';
  };

  /* ---- What-If Simulator ----------------------------------- */
  let originalAnalysis = null;
  let currentScenario = 'current';

  function initWhatIf(r) {
    originalAnalysis = r;
    const bd = r.breakdown || {};
    const f = r.finance || {};

    // Set initial values
    const rentInput = get('whatif-rent');
    const revenueInput = get('whatif-revenue');
    const investmentInput = get('whatif-investment');

    if (rentInput) rentInput.value = f.rent || '';
    if (revenueInput) revenueInput.value = f.revenue || '';
    if (investmentInput) investmentInput.value = f.investment || '';

    // Initialize scenario buttons
    document.querySelectorAll('.whatif-scenario-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.whatif-scenario-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentScenario = btn.dataset.scenario;
        applyScenario(currentScenario);
      });
    });

    // Initialize input listeners
    [rentInput, revenueInput, investmentInput].forEach(input => {
      if (input) {
        input.addEventListener('input', () => {
          currentScenario = 'custom';
          document.querySelectorAll('.whatif-scenario-btn').forEach(b => b.classList.remove('active'));
          calculateWhatIf();
        });
      }
    });

    // Initial calculation
    calculateWhatIf();
  }

  function applyScenario(scenario) {
    const f = originalAnalysis.finance || {};
    const rentInput = get('whatif-rent');
    const revenueInput = get('whatif-revenue');
    const investmentInput = get('whatif-investment');

    if (!rentInput || !revenueInput || !investmentInput) return;

    switch (scenario) {
      case 'current':
        rentInput.value = f.rent || '';
        revenueInput.value = f.revenue || '';
        investmentInput.value = f.investment || '';
        break;
      case 'conservative':
        rentInput.value = f.rent ? Math.round(f.rent * 1.2) : '';
        revenueInput.value = f.revenue ? Math.round(f.revenue * 0.8) : '';
        investmentInput.value = f.investment ? Math.round(f.investment * 1.1) : '';
        break;
      case 'optimistic':
        rentInput.value = f.rent ? Math.round(f.rent * 0.8) : '';
        revenueInput.value = f.revenue ? Math.round(f.revenue * 1.2) : '';
        investmentInput.value = f.investment ? Math.round(f.investment * 0.9) : '';
        break;
    }

    calculateWhatIf();
  }

  function calculateWhatIf() {
    const rent = parseFloat(get('whatif-rent')?.value) || 0;
    const revenue = parseFloat(get('whatif-revenue')?.value) || 0;
    const investment = parseFloat(get('whatif-investment')?.value) || 0;

    const bd = originalAnalysis.breakdown || {};
    const originalScore = originalAnalysis.score || 0;

    // Calculate new financial score
    let newFinanceScore = 0;
    if (revenue > 0) {
      newFinanceScore = Math.round(Math.max(0, Math.min(20, 20 - (rent / revenue) * 35)));
    }

    // Calculate new total score (replace finance component)
    const oldFinance = bd.finance || 0;
    const newTotal = Math.max(0, Math.min(100, originalScore - oldFinance + newFinanceScore));

    // Calculate break-even
    const otherCosts = revenue ? revenue * 0.45 : 0;
    const monthlyProfit = revenue > 0 ? Math.round(revenue - rent - otherCosts) : 0;
    const breakEven = investment > 0 && monthlyProfit > 0 ? Number((investment / monthlyProfit).toFixed(1)) : null;

    // Update UI
    const financeScoreEl = get('whatif-finance-score');
    const totalScoreEl = get('whatif-total-score');
    const totalDiffEl = get('whatif-total-diff');
    const breakEvenEl = get('whatif-breakeven');
    const profitEl = get('whatif-profit');

    if (financeScoreEl) financeScoreEl.textContent = `${newFinanceScore}/20`;
    if (totalScoreEl) totalScoreEl.textContent = `${newTotal}/100`;

    if (totalDiffEl) {
      const diff = newTotal - originalScore;
      if (diff > 0) {
        totalDiffEl.textContent = `+${diff}`;
        totalDiffEl.className = 'whatif-result-diff positive';
      } else if (diff < 0) {
        totalDiffEl.textContent = diff;
        totalDiffEl.className = 'whatif-result-diff negative';
      } else {
        totalDiffEl.textContent = '';
      }
    }

    if (breakEvenEl) {
      breakEvenEl.textContent = breakEven ? `${breakEven} ay` : '—';
    }

    if (profitEl) {
      profitEl.textContent = monthlyProfit > 0 ? `${monthlyProfit} AZN` : monthlyProfit < 0 ? `${monthlyProfit} AZN` : '—';
    }
  }

  /* ---- PDF / Print --------------------------------------- */
  async function generatePDF() {
    const r = window._lastAnalysisResult;
    if (!r) { toast(t('error.analysisNotFound'), 'error'); return; }
    const user = await requireLogin();
    if (!user) return;
    if (!user.planInfo?.pdfExport) {
      toast('PDF ixracı Professional və Business planlarında mövcuddur. Planınızı yüksəldin.', 'error');
      return;
    }
    // Browser print dialog lets the user save the report as a PDF file.
    window.print();
  }

  /* ---- History Item ------------------------------------- */
  async function loadHistoryItem(id) {
    const user = await requireLogin();
    if (!user) return;
    get('form-section')?.classList.add('hidden');
    try {
      const d = await api('/api/analyses/' + encodeURIComponent(id));
      get('result-section')?.classList.remove('hidden');
      renderResult(d.result, d.id);
      setStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast(err.message, 'error');
      get('form-section')?.classList.remove('hidden');
    }
  }

  /* ---- Address verify ------------------------------------ */
  async function verifyAddress() {
    const addressInput = get('address');
    const addressStatus = get('address-status');
    const verifyAddressBtn = get('verify-address');
    const q = addressInput?.value?.trim();
    if (!q || q.length < 3) { toast(t('error.moreSpecificAddress'), 'error'); return; }
    if (verifyAddressBtn) verifyAddressBtn.disabled = true;
    if (addressStatus) {
      addressStatus.textContent = t('map.searchingAddress');
      addressStatus.style.color = 'var(--text-3)';
    }

    const user = getUser();
    if (!user) {
      if (addressStatus) {
        addressStatus.textContent = t('map.loginToVerify');
        addressStatus.style.color = 'var(--red)';
      }
      if (verifyAddressBtn) verifyAddressBtn.disabled = false;
      return;
    }

    try {
      const d = await api('/api/geocode?q=' + encodeURIComponent(q));
      const loc = d.location;
      // Reject 0,0 coordinates from server
      if (!loc || loc.lat === 0 || loc.lng === 0) {
        throw new Error('Ünvan doğrulanmadı. Daha dəqiq ünvan yazın.');
      }
      const latInput = get('latitude');
      const lngInput = get('longitude');
      if (latInput) latInput.value = loc.lat;
      if (lngInput) lngInput.value = loc.lng;
      addressInput.value = loc.displayName || q;
      if (addressStatus) {
        addressStatus.innerHTML = `<span style="color:var(--green)">✓ Tapıldı</span> · ${esc(loc.displayName||'')}`;
      }
      initPreviewMap(Number(loc.lat), Number(loc.lng));
    } catch (err) {
      if (addressStatus) {
        addressStatus.innerHTML = `<span style="color:var(--red)">✗</span> ${esc(err.message || 'Ünvan tapılmadı.')}`;
        addressStatus.style.color = '';
      }
      // Give suggestions
      toast(t('toast.addressNotFound'), 'error');
    } finally {
      if (verifyAddressBtn) verifyAddressBtn.disabled = false;
    }
  }

  /* ---- Validate steps ------------------------------------ */
  function validateStep1() {
    const selected = get('dna-business-type')?.value;
    const errEl = get('btype-error');
    if (!selected) { errEl?.classList.remove('hidden'); return false; }
    errEl?.classList.add('hidden');
    return true;
  }

  function validateStep2() {
    const url = get('listingUrl')?.value?.trim();
    const addr = get('address')?.value?.trim();
    const lat = get('latitude')?.value?.trim();
    const lng = get('longitude')?.value?.trim();
    const errEl = get('location-error');
    if (!url && !addr && !(lat && lng)) {
      errEl?.classList.remove('hidden');
      return false;
    }
    errEl?.classList.add('hidden');
    return true;
  }

  /* ---- Handle Submit ------------------------------------- */
  async function handleAnalyze(e) {
    e.preventDefault();
    const user = await requireLogin();
    if (!user) return;

    const f = new FormData(e.target);
    const submitBtn = get('analyze-submit');
    const loadingCard = get('loading-card');
    const formSection = get('form-section');
    const resultSection = get('result-section');

    if (!f.get('businessType')) { toast(t('error.selectBusinessType'), 'error'); setStep(1); return; }
    if (!f.get('listingUrl') && !f.get('address') && !(f.get('latitude') && f.get('longitude'))) {
      toast(t('error.enterLocation'), 'error'); setStep(2); return;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (loadingCard) loadingCard.classList.add('show');
    if (formSection) formSection.classList.add('hidden');
    if (resultSection) resultSection.classList.add('hidden');

    setStep(4);
    const steps = ['step-1','step-2','step-3'];
    steps.forEach((sid, i) => {
      const el = get(sid);
      if (!el) return;
      el.classList.toggle('active', i === 0);
      el.classList.remove('done');
    });
    let ticker = 0;
    const interval = setInterval(() => {
      ticker++;
      if (ticker <= 2) {
        get(steps[ticker-1])?.classList.replace('active','done');
        get(steps[ticker])?.classList.add('active');
      }
    }, 1400);

    try {
      const d = await api('/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          businessType:      f.get('businessType'),
          listingUrl:        f.get('listingUrl'),
          address:           f.get('address'),
          latitude:          f.get('latitude'),
          longitude:         f.get('longitude'),
          radiusMeters:      f.get('radiusMeters') || 1200,
          rentBudget:        f.get('rentBudget'),
          monthlyRent:       f.get('monthlyRent'),
          monthlyRevenue:    f.get('monthlyRevenue'),
          initialInvestment: f.get('initialInvestment'),
          // DNA fields
          targetAudience:    f.get('targetAudience'),
          environment:       f.get('environment'),
          competitionTolerance: f.get('competitionTolerance'),
          accessibilityImportance: f.get('accessibilityImportance'),
          physical: {
            areaSqm: f.get('physicalArea'),
            floorLevel: f.get('physicalFloor'),
            displayWindow: f.get('physicalWindow'),
            entranceType: f.get('physicalEntrance'),
            ventilation: f.get('physicalVentilation')
          },
          language: window.i18n ? window.i18n.getLang() : 'az'
        })
      });

      clearInterval(interval);
      steps.forEach(sid => {
        get(sid)?.classList.remove('active');
        get(sid)?.classList.add('done');
      });
      if (loadingCard) loadingCard.classList.remove('show');
      if (resultSection) resultSection.classList.remove('hidden');
      currentAnalysisId = d.analysisId;
      renderResult(d.result, d.analysisId);
      const top = (resultSection?.offsetTop ?? 0) - 80;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });

    } catch (err) {
      clearInterval(interval);
      if (loadingCard) loadingCard.classList.remove('show');
      if (formSection) formSection.classList.remove('hidden');
      toast(err.message || 'Analiz xətası. Zəhmət olmasa yenidən cəhd edin.', 'error');
      setStep(1);
      if (err.data?.code === 'PLAN_LIMIT') {
        setTimeout(() => location.href = 'pricing.html', 1800);
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  /* ---- Init --------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    const form = get('analyze-form');
    if (!form) return;

    // History load
    const histId = new URLSearchParams(location.search).get('history');
    if (histId) { loadHistoryItem(histId); return; }

    // Step navigation
    document.querySelectorAll('.step-next').forEach(btn => {
      btn.addEventListener('click', () => {
        const next = Number(btn.dataset.next);
        if (next === 2 && !validateStep1()) return;
        if (next === 3 && !validateStep2()) return;
        setStep(next);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    document.querySelectorAll('.step-back').forEach(btn => {
      btn.addEventListener('click', () => {
        setStep(Number(btn.dataset.back));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // Business type error clear
    document.querySelectorAll('input[name="businessType"]').forEach(radio => {
      radio.addEventListener('change', () => get('btype-error')?.classList.add('hidden'));
    });

    // Address verify
    const verifyBtn = get('verify-address');
    const addressInput = get('address');
    if (verifyBtn) verifyBtn.addEventListener('click', verifyAddress);
    if (addressInput) {
      addressInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); verifyAddress(); } });
    }

    // Coordinate preview map
    const latInput = get('latitude');
    const lngInput = get('longitude');
    function tryPreviewFromCoords() {
      const lat = parseFloat(latInput?.value);
      const lng = parseFloat(lngInput?.value);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat)<=90 && Math.abs(lng)<=180 && !(lat===0 && lng===0)) {
        initPreviewMap(lat, lng);
      }
    }
    latInput?.addEventListener('change', tryPreviewFromCoords);
    lngInput?.addEventListener('change', tryPreviewFromCoords);

    // PDF button
    const pdfBtn = get('pdf-btn');
    if (pdfBtn) pdfBtn.addEventListener('click', generatePDF);

    // Print button (fallback — just calls print)
    const printBtn = get('print-btn');
    if (printBtn) printBtn.addEventListener('click', generatePDF);

    // Reset
    const resetBtn = get('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        get('result-section')?.classList.add('hidden');
        get('form-section')?.classList.remove('hidden');
        form.reset();
        document.querySelectorAll('input[name="businessType"]').forEach(r => r.checked = false);
        if (get('preview-map-wrap')) get('preview-map-wrap').style.display = 'none';
        if (get('address-status')) get('address-status').textContent = '';
        setStep(1);
        if (leafletMap) { try { leafletMap.remove(); } catch {} leafletMap = null; }
        previewMap = null;
        window._lastAnalysisResult = null;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Score info tooltips — keyboard accessible
    document.addEventListener('click', e => {
      const wrap = e.target.closest('.bd-tooltip-wrap');
      if (wrap) {
        document.querySelectorAll('.bd-tooltip-wrap.open').forEach(el => {
          if (el !== wrap) el.classList.remove('open');
        });
        wrap.classList.toggle('open');
        e.stopPropagation();
      } else {
        document.querySelectorAll('.bd-tooltip-wrap.open').forEach(el => el.classList.remove('open'));
      }
    });

    // DNA field listeners
    get('dna-business-type')?.addEventListener('change', updateDNASummary);
    get('dna-budget')?.addEventListener('input', updateDNASummary);
    get('dna-target-audience')?.addEventListener('change', updateDNASummary);
    get('dna-environment')?.addEventListener('change', updateDNASummary);
    get('dna-competition-tolerance')?.addEventListener('input', updateDNASummary);
    get('dna-accessibility-importance')?.addEventListener('input', updateDNASummary);

    form.addEventListener('submit', handleAnalyze);
    setStep(1);
  });

  // Re-localize dynamic analyze content on language change
  document.addEventListener('langchange', function() {
    // Re-run DNA summary with new lang
    if (typeof updateDNASummary === 'function') updateDNASummary();
    // Update select option placeholders
    const sel = document.getElementById('dna-business-type');
    if (sel && sel.options[0]) sel.options[0].text = t('analyze.selectPlaceholder');
    // Update loading steps if visible
    const ls1 = document.querySelector('#step-1 span'); if (ls1 && ls1.dataset.i18n) ls1.textContent = t('analyze.loadStep1');
    const ls2 = document.querySelector('#step-2 span'); if (ls2 && ls2.dataset.i18n) ls2.textContent = t('analyze.loadStep2');
    const ls3 = document.querySelector('#step-3 span'); if (ls3 && ls3.dataset.i18n) ls3.textContent = t('analyze.loadStep3');
  });

})();
