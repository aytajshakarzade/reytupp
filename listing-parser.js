'use strict';

function parseAmount(raw) {
  if (!raw) return null;
  const normalized = String(raw).replace(/[\s,]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '');
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 50 && value <= 500_000 ? value : null;
}

/** Extract rent only when the listing explicitly identifies it as monthly rent. */
function parseListing(text) {
  const t = String(text || '').replace(/\s+/g, ' ');
  const rentPatterns = [
    /(?:aylıq\s+(?:icarə|kirayə)(?:\s+(?:haqqı|qiyməti))?|(?:icarə|kirayə)\s+(?:haqqı|qiyməti)\s*(?:aylıq)?|monthly\s+rent|rent\s+per\s+month)[^\d]{0,60}([\d][\d\s.,]{0,12})/i,
    /([\d][\d\s.,]{0,12})\s*(?:AZN|AZƏN|₼)?\s*(?:\/\s*(?:ay|month)|per\s+month|monthly|aylıq)/i
  ];
  let monthlyRent = null;
  for (const pattern of rentPatterns) {
    const match = t.match(pattern);
    if (match) {
      monthlyRent = parseAmount(match[1]);
      if (monthlyRent !== null) break;
    }
  }
  const address = (t.match(/(?:ünvan|address|adres)[\s:–-]{0,4}([^|.;]{10,120})/i) || [])[1] || '';
  return { monthlyRent, address: String(address).trim().slice(0, 300) };
}

module.exports = { parseListing };
