import { contentHash } from './canonical.js';

// The dispatch gate. A van does not roll until equipment, spare parts,
// Confluence Safety SOP sign-off, crew certification, and the autonomy
// policy all pass. Missing data blocks. There is no override in code.

export function evaluateDispatchGate(input) {
  const { incident, asset, sop, crew, policy, now } = input ?? {};
  if (!incident || !incident.issueKey) {
    throw new TypeError('evaluateDispatchGate requires incident.issueKey');
  }
  const checks = [];
  const add = (id, label, ok, detail) => checks.push({ id, label, ok: ok === true, detail });

  add('asset-linked', 'Equipment asset linked in JSM Assets', Boolean(asset && asset.assetKey),
    asset && asset.assetKey ? asset.assetKey + ' (' + (asset.name ?? 'unnamed') + ')' : 'No JSM Assets record linked to this incident.');

  const requiredParts = asset && Array.isArray(asset.requiredParts) ? asset.requiredParts : [];
  const vanParts = crew && Array.isArray(crew.vanParts) ? crew.vanParts : [];
  const missingParts = requiredParts.filter((part) => !vanParts.includes(part));
  add('spare-parts', 'Required spare parts on the crew van', Boolean(asset) && missingParts.length === 0,
    !asset ? 'Cannot verify parts without an asset record.'
      : missingParts.length === 0 ? 'All ' + requiredParts.length + ' required parts present.'
        : 'Missing: ' + missingParts.join(', ') + '.');

  const sopPresent = Boolean(sop && sop.pageId);
  add('sop-linked', 'Confluence Safety SOP linked', sopPresent,
    sopPresent ? (sop.title ?? sop.pageId) : 'No Confluence Safety SOP linked to this asset.');

  const sopSigned = Boolean(sop && sop.signedByAccountId && sop.signedAt);
  const sopExpired = Boolean(sop && sop.validUntil && now && sop.validUntil < now);
  add('sop-signed', 'Safety SOP signed and current', sopSigned && !sopExpired,
    !sopPresent ? 'No SOP to verify.'
      : sopExpired ? 'SOP sign-off expired at ' + sop.validUntil + '.'
        : sopSigned ? 'Signed by ' + sop.signedByAccountId + ' at ' + sop.signedAt + '.'
          : 'SOP has no recorded safety sign-off.');

  const hazardClass = incident.hazardClass ?? 'unknown';
  const certifications = crew && Array.isArray(crew.certifications) ? crew.certifications : [];
  add('crew-certified', 'Crew certified for the hazard class', certifications.includes(hazardClass),
    certifications.includes(hazardClass)
      ? 'Crew holds "' + hazardClass + '" certification.'
      : 'Crew certifications [' + certifications.join(', ') + '] do not cover "' + hazardClass + '".');

  const autoAllowed = Boolean(policy && policy.autoDispatch === true && hazardClass !== 'high-voltage' && hazardClass !== 'fire');
  const commanderApproved = Boolean(policy && policy.commanderApproved === true);
  add('autonomy-policy', 'Autonomy policy satisfied', autoAllowed || commanderApproved,
    autoAllowed ? 'Low-hazard auto-dispatch enabled by policy.'
      : commanderApproved ? 'Human commander approved this dispatch.'
        : 'Commander approval required for hazard class "' + hazardClass + '".');

  const blockedReasons = checks.filter((check) => !check.ok).map((check) => check.label + ': ' + check.detail);
  const allowed = blockedReasons.length === 0;
  // The hash covers the plan, not the clock. A commander approves this
  // exact hash; re-evaluation seconds later must reproduce it byte for
  // byte, or approval binding breaks. Time stays outside the hash.
  const receiptBody = {
    issueKey: incident.issueKey,
    hazardClass,
    assetKey: asset ? asset.assetKey ?? null : null,
    sopPageId: sop ? sop.pageId ?? null : null,
    crewId: crew ? crew.crewId ?? null : null,
    allowed,
    blockedReasons,
  };
  return {
    allowed,
    blockedReasons,
    checks,
    receiptHash: contentHash(receiptBody),
    receipt: receiptBody,
    evaluatedAt: now ?? null,
  };
}
