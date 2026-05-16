/**
 * Lead completeness rules for GET …/analytics/leads (Mongo-friendly + testable TS mirror).
 * Required-field completion uses **current active** bot fields only (enabled capture, not disabled).
 * Values in capturedLeadData may include historical keys; completeness checks only reference configured keys.
 */

export type LeadCompletenessConfig = {
  /** Active required field keys (capture on, not disabled, required !== false). */
  requiredKeys: string[];
  /** Active keys treated as email contact fields. */
  emailKeys: string[];
  /** Active keys treated as phone contact fields. */
  phoneKeys: string[];
};

export function parseLeadCompletenessConfigFromBot(bot: Record<string, unknown> | null | undefined): LeadCompletenessConfig {
  const lc = bot?.leadCapture as {
    enabled?: boolean;
    fields?: Array<{ key?: string; type?: string; disabled?: boolean; required?: boolean }>;
  } | undefined;
  const fields = Array.isArray(lc?.fields) ? lc.fields : [];
  const captureGloballyOn =
    typeof lc?.enabled === 'boolean' ? lc.enabled : fields.length > 0;
  if (!captureGloballyOn) {
    return { requiredKeys: [], emailKeys: [], phoneKeys: [] };
  }

  const requiredKeys: string[] = [];
  const emailKeys: string[] = [];
  const phoneKeys: string[] = [];

  for (const f of fields) {
    if (!f || f.disabled === true) continue;
    const k = String(f.key ?? '').trim();
    if (!k) continue;
    if (f.required !== false) requiredKeys.push(k);

    const t = String(f.type ?? 'text').toLowerCase();
    const kl = k.toLowerCase();
    if (t === 'email' || kl === 'email') emailKeys.push(k);
    if (t === 'phone' || kl === 'phone' || kl === 'mobile' || kl === 'tel') phoneKeys.push(k);
  }

  return { requiredKeys, emailKeys, phoneKeys };
}

function nonEmptyCapturedValueExpr(): Record<string, unknown> {
  return {
    $gt: [{ $strLenCP: { $toString: { $ifNull: ['$$pair.v', ''] } } }, 0],
  };
}

/** True when capturedLeadData[fieldKey] is a non-empty string-like value. */
export function mongoCapturedKeyNonEmptyExpr(fieldKey: string): Record<string, unknown> {
  return {
    $gt: [
      {
        $size: {
          $filter: {
            input: { $objectToArray: { $ifNull: ['$capturedLeadData', {}] } },
            as: 'pair',
            cond: {
              $and: [{ $eq: ['$$pair.k', fieldKey] }, nonEmptyCapturedValueExpr()],
            },
          },
        },
      },
      0,
    ],
  };
}

function mongoAnyConfiguredKeysHaveValuesExpr(keys: readonly string[]): Record<string, unknown> {
  if (keys.length === 0) return { $literal: false };
  return {
    $gt: [
      {
        $size: {
          $filter: {
            input: { $objectToArray: { $ifNull: ['$capturedLeadData', {}] } },
            as: 'pair',
            cond: {
              $and: [{ $in: ['$$pair.k', [...keys]] }, nonEmptyCapturedValueExpr()],
            },
          },
        },
      },
      0,
    ],
  };
}

export function mongoNonEmptyCapturedFieldCountExpr(): Record<string, unknown> {
  return {
    $size: {
      $filter: {
        input: { $objectToArray: { $ifNull: ['$capturedLeadData', {}] } },
        as: 'pair',
        cond: nonEmptyCapturedValueExpr(),
      },
    },
  };
}

/**
 * Boolean aggregation expression: whether this conversation's capturedLeadData qualifies as “complete”.
 */
export function mongoLeadCompleteExpr(cfg: LeadCompletenessConfig): Record<string, unknown> {
  if (cfg.requiredKeys.length > 0) {
    return { $and: cfg.requiredKeys.map((k) => mongoCapturedKeyNonEmptyExpr(k)) };
  }

  if (cfg.emailKeys.length > 0 || cfg.phoneKeys.length > 0) {
    const parts: Record<string, unknown>[] = [];
    if (cfg.emailKeys.length > 0) parts.push(mongoAnyConfiguredKeysHaveValuesExpr(cfg.emailKeys));
    if (cfg.phoneKeys.length > 0) parts.push(mongoAnyConfiguredKeysHaveValuesExpr(cfg.phoneKeys));
    return parts.length === 1 ? parts[0]! : { $or: parts };
  }

  return { $gte: [mongoNonEmptyCapturedFieldCountExpr(), 2] };
}

function nonEmptyLocal(val: unknown): boolean {
  if (val == null) return false;
  return String(val).trim().length > 0;
}

/** Mirrors {@link mongoLeadCompleteExpr} semantics for unit tests (no Mongo). */
export function evaluateLeadCompleteFromCapturedData(
  data: Record<string, unknown> | null | undefined,
  cfg: LeadCompletenessConfig,
): boolean {
  const d = data && typeof data === 'object' && !Array.isArray(data) ? data : {};

  if (cfg.requiredKeys.length > 0) {
    return cfg.requiredKeys.every((k) => nonEmptyLocal(d[k]));
  }

  if (cfg.emailKeys.length > 0 || cfg.phoneKeys.length > 0) {
    const emailOk =
      cfg.emailKeys.length > 0 && cfg.emailKeys.some((k) => nonEmptyLocal(d[k]));
    const phoneOk =
      cfg.phoneKeys.length > 0 && cfg.phoneKeys.some((k) => nonEmptyLocal(d[k]));
    return Boolean(emailOk || phoneOk);
  }

  let n = 0;
  for (const v of Object.values(d)) {
    if (nonEmptyLocal(v)) n++;
  }
  return n >= 2;
}
