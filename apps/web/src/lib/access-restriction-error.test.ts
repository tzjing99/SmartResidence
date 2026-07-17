import { ApiError } from '@smartresidence/api-client';
import { ACCESS_RESTRICTION_ERROR_CODE } from '@smartresidence/shared-types';
import { describe, expect, it } from 'vitest';
import { getApiErrorMessage, isArrearsAccessError } from './access-restriction-error';

describe('isArrearsAccessError', () => {
  it('detects ApiError with code in body', () => {
    const err = new ApiError(
      403,
      { code: ACCESS_RESTRICTION_ERROR_CODE, message: 'blocked' },
      `${ACCESS_RESTRICTION_ERROR_CODE}: blocked`,
    );
    expect(isArrearsAccessError(err)).toBe(true);
  });

  it('detects message prefix', () => {
    expect(isArrearsAccessError(new Error(`${ACCESS_RESTRICTION_ERROR_CODE}: unpaid`))).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isArrearsAccessError(new Error('Slot unavailable'))).toBe(false);
  });
});

describe('getApiErrorMessage', () => {
  it('reads Error.message', () => {
    expect(getApiErrorMessage(new Error('boom'))).toBe('boom');
  });
});
