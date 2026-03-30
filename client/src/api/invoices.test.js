import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserInvoices, getInvoiceById } from './invoices';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
  },
}));

import { supabase } from '../lib/supabase';

const USER_ID = 'user-001';
const INVOICES = [
  { id: 'inv-1', product_name: '헬스장', amount: 50000, status: 'paid' },
  { id: 'inv-2', product_name: '독서실', amount: 30000, status: 'issued' },
];

beforeEach(() => {
  vi.clearAllMocks();
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
});

describe('getUserInvoices', () => {
  it('get_user_invoices RPC를 userId로 호출한다', async () => {
    supabase.rpc.mockResolvedValue({ data: INVOICES, error: null });

    await getUserInvoices(USER_ID);
    expect(supabase.rpc).toHaveBeenCalledWith('get_user_invoices', { p_user_id: USER_ID });
  });

  it('청구서 배열을 반환한다', async () => {
    supabase.rpc.mockResolvedValue({ data: INVOICES, error: null });

    const result = await getUserInvoices(USER_ID);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('inv-1');
  });

  it('RPC 오류 시 throw한다', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: new Error('RPC 오류') });

    await expect(getUserInvoices(USER_ID)).rejects.toThrow();
  });
});

describe('getInvoiceById', () => {
  it('id에 해당하는 청구서를 반환한다', async () => {
    supabase.rpc.mockResolvedValue({ data: INVOICES, error: null });

    const inv = await getInvoiceById('inv-2');
    expect(inv.id).toBe('inv-2');
    expect(inv.product_name).toBe('독서실');
  });

  it('존재하지 않는 id면 에러를 throw한다', async () => {
    supabase.rpc.mockResolvedValue({ data: INVOICES, error: null });

    await expect(getInvoiceById('inv-999')).rejects.toThrow('청구서를 찾을 수 없습니다.');
  });

  it('목록이 비어있으면 에러를 throw한다', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    await expect(getInvoiceById('inv-1')).rejects.toThrow();
  });
});
