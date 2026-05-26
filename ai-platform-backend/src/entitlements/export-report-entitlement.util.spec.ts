import { HttpException, HttpStatus } from '@nestjs/common';
import {
  PLAN_LIMIT_EXPORT_REPORTS_CODE,
  PLAN_LIMIT_EXPORT_REPORTS_MESSAGE,
  type PlanLimitExportReportsPayload,
} from './export-report-entitlement.util';

describe('export-report-entitlement.util', () => {
  it('exports stable plan limit constants', () => {
    expect(PLAN_LIMIT_EXPORT_REPORTS_CODE).toBe('plan_limit_export_reports');
    expect(PLAN_LIMIT_EXPORT_REPORTS_MESSAGE).toContain('Starter');
  });

  it('payload shape matches API contract', () => {
    const payload: PlanLimitExportReportsPayload = {
      message: PLAN_LIMIT_EXPORT_REPORTS_MESSAGE,
      errorCode: PLAN_LIMIT_EXPORT_REPORTS_CODE,
    };
    const err = new HttpException(payload, HttpStatus.FORBIDDEN);
    expect(err.getResponse()).toEqual(payload);
  });
});
