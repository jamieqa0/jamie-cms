import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retryBilling, retryBillingBulk } from './admin';

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: { getUser: vi.fn() },
    functions: { invoke: vi.fn() },
  },
}));

import { supabase } from '../lib/supabase';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('retryBilling', () => {
  it('retry_billing RPC를 log_id로 호출한다', async () => {
    supabase.rpc.mockResolvedValue({ data: { success: true }, error: null });

    await retryBilling('log-001');
    expect(supabase.rpc).toHaveBeenCalledWith('retry_billing', { log_id: 'log-001' });
  });

  it('성공 시 data를 반환한다', async () => {
    supabase.rpc.mockResolvedValue({ data: { success: true }, error: null });

    const { data } = await retryBilling('log-001');
    expect(data.success).toBe(true);
  });

  it('RPC 오류 시 response.data.error 형식으로 throw한다', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: '잔액 부족' } });

    await expect(retryBilling('log-001')).rejects.toMatchObject({
      response: { data: { error: '잔액 부족' } },
    });
  });
});

describe('retryBillingBulk', () => {
  it('retry_billing_bulk RPC를 log_ids 배열로 호출한다', async () => {
    supabase.rpc.mockResolvedValue({ data: { success: 2, failed: 0, failures: [] }, error: null });

    await retryBillingBulk(['log-001', 'log-002']);
    expect(supabase.rpc).toHaveBeenCalledWith('retry_billing_bulk', {
      log_ids: ['log-001', 'log-002'],
    });
  });

  it('빈 배열을 전달해도 RPC를 호출한다', async () => {
    supabase.rpc.mockResolvedValue({ data: { success: 0, failed: 0, failures: [] }, error: null });

    await retryBillingBulk([]);
    expect(supabase.rpc).toHaveBeenCalledWith('retry_billing_bulk', { log_ids: [] });
  });

  it('RPC 오류 시 response.data.error 형식으로 throw한다', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: '일괄 재청구 실패' } });

    await expect(retryBillingBulk(['log-001'])).rejects.toMatchObject({
      response: { data: { error: '일괄 재청구 실패' } },
    });
  });
});
