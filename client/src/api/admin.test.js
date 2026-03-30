import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAdminUsers,
  getAdminTransfers,
  getAdminProducts,
  getAdminProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getAdminStats,
  getUnpaid,
  getCollectionStats,
  runAdminScheduler,
} from './admin';

vi.mock('../lib/supabase', () => {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };
  return {
    supabase: {
      rpc: vi.fn(),
      from: vi.fn(() => builder),
      functions: { invoke: vi.fn() },
    },
    _builder: builder,
  };
});

import { supabase, _builder as b } from '../lib/supabase';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAdminUsers', () => {
  it('get_admin_users RPC를 호출하고 data를 반환한다', async () => {
    const users = [{ id: 'u-1', nickname: '홍길동' }];
    supabase.rpc.mockResolvedValue({ data: users });

    const { data } = await getAdminUsers();
    expect(supabase.rpc).toHaveBeenCalledWith('get_admin_users');
    expect(data).toHaveLength(1);
  });
});

describe('getAdminTransfers', () => {
  it('get_admin_transfers RPC를 호출하고 data를 반환한다', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    const { data } = await getAdminTransfers();
    expect(supabase.rpc).toHaveBeenCalledWith('get_admin_transfers');
    expect(data).toEqual([]);
  });

  it('RPC 오류 시 throw한다', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: new Error('조회 실패') });

    await expect(getAdminTransfers()).rejects.toThrow('조회 실패');
  });
});

describe('getAdminProducts', () => {
  it('products 테이블을 조회하고 반환한다', async () => {
    const products = [{ id: 'p-1', name: '헬스 정기권' }];
    b.order.mockResolvedValueOnce({ data: products, error: null });

    const { data } = await getAdminProducts();
    expect(supabase.from).toHaveBeenCalledWith('products');
    expect(data).toHaveLength(1);
  });

  it('DB 오류 시 throw한다', async () => {
    b.order.mockResolvedValueOnce({ data: null, error: new Error('DB 오류') });

    await expect(getAdminProducts()).rejects.toThrow('DB 오류');
  });
});

describe('getAdminProduct', () => {
  it('id에 해당하는 상품을 반환한다', async () => {
    b.single.mockResolvedValue({ data: { id: 'p-1', name: '헬스 정기권' } });

    const { data } = await getAdminProduct('p-1');
    expect(b.eq).toHaveBeenCalledWith('id', 'p-1');
    expect(data.name).toBe('헬스 정기권');
  });
});

describe('createProduct', () => {
  it('상품 데이터를 insert하고 반환한다', async () => {
    const productData = { name: '독서실 이용권', amount: 30000, billing_day: 15 };
    b.single.mockResolvedValue({ data: { id: 'p-2', ...productData } });

    const { data } = await createProduct(productData);
    expect(b.insert).toHaveBeenCalledWith(productData);
    expect(data.id).toBe('p-2');
  });
});

describe('updateProduct', () => {
  it('id에 해당하는 상품을 수정하고 반환한다', async () => {
    const updates = { name: '헬스 프리미엄' };
    b.single.mockResolvedValue({ data: { id: 'p-1', name: '헬스 프리미엄' } });

    const { data } = await updateProduct('p-1', updates);
    expect(b.update).toHaveBeenCalledWith(updates);
    expect(b.eq).toHaveBeenCalledWith('id', 'p-1');
    expect(data.name).toBe('헬스 프리미엄');
  });
});

describe('deleteProduct', () => {
  it('id에 해당하는 상품을 삭제한다', async () => {
    b.eq.mockResolvedValueOnce({ data: null, error: null });

    await deleteProduct('p-1');
    expect(b.delete).toHaveBeenCalled();
    expect(b.eq).toHaveBeenCalledWith('id', 'p-1');
  });
});

describe('getAdminStats', () => {
  it('get_admin_stats RPC를 호출하고 data를 반환한다', async () => {
    const stats = { total_users: 100 };
    supabase.rpc.mockResolvedValue({ data: stats, error: null });

    const { data } = await getAdminStats();
    expect(supabase.rpc).toHaveBeenCalledWith('get_admin_stats');
    expect(data.total_users).toBe(100);
  });

  it('RPC 오류 시 throw한다', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: new Error('통계 오류') });

    await expect(getAdminStats()).rejects.toThrow('통계 오류');
  });
});

describe('getUnpaid', () => {
  it('get_unpaid_list RPC를 호출하고 data를 반환한다', async () => {
    const unpaid = [{ log_id: 'l-1', amount: 50000 }];
    supabase.rpc.mockResolvedValue({ data: unpaid });

    const { data } = await getUnpaid();
    expect(supabase.rpc).toHaveBeenCalledWith('get_unpaid_list');
    expect(data).toHaveLength(1);
  });
});

describe('getCollectionStats', () => {
  it('month 없이 호출하면 빈 params로 RPC를 호출한다', async () => {
    supabase.rpc.mockResolvedValue({ data: { total: 1000000 } });

    await getCollectionStats();
    expect(supabase.rpc).toHaveBeenCalledWith('get_collection_stats', {});
  });

  it('month를 전달하면 p_month 파라미터를 포함해 RPC를 호출한다', async () => {
    supabase.rpc.mockResolvedValue({ data: { total: 500000 } });

    await getCollectionStats('2025-03');
    expect(supabase.rpc).toHaveBeenCalledWith('get_collection_stats', { p_month: '2025-03' });
  });

  it('data를 반환한다', async () => {
    supabase.rpc.mockResolvedValue({ data: { total: 750000 } });

    const { data } = await getCollectionStats('2025-02');
    expect(data.total).toBe(750000);
  });
});

describe('runAdminScheduler', () => {
  it('auto-debit Edge Function을 targetDay로 호출한다', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { processed: 5 }, error: null });

    await runAdminScheduler(15);
    expect(supabase.functions.invoke).toHaveBeenCalledWith('auto-debit', {
      body: { targetDay: 15 },
    });
  });

  it('결과 data를 반환한다', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { processed: 3 }, error: null });

    const { data } = await runAdminScheduler(10);
    expect(data.processed).toBe(3);
  });

  it('오류 시 response.data.error 형식으로 throw한다', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: null, error: { message: '실행 실패' } });

    await expect(runAdminScheduler(10)).rejects.toMatchObject({
      response: { data: { error: '실행 실패' } },
    });
  });
});
