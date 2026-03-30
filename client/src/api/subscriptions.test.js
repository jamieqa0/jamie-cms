import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSubscriptions, createSubscription, updateSubscription, cancelSubscription } from './subscriptions';

vi.mock('../lib/supabase', () => {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn(),
    delete: vi.fn().mockReturnThis(),
  };
  return {
    supabase: {
      auth: { getUser: vi.fn() },
      from: vi.fn(() => builder),
    },
    _builder: builder,
  };
});

import { supabase, _builder as b } from '../lib/supabase';

const USER_ID = 'user-001';

beforeEach(() => {
  vi.clearAllMocks();
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
});

describe('getSubscriptions', () => {
  it('현재 로그인 유저의 구독 목록을 반환한다', async () => {
    const raw = [
      {
        id: 'sub-1',
        status: 'active',
        products: { name: '헬스장', amount: 50000, billing_day: 10, users: { nickname: 'FitCo' } },
      },
    ];
    b.order.mockResolvedValue({ data: raw });

    const { data } = await getSubscriptions();

    expect(data).toHaveLength(1);
    expect(data[0].product_name).toBe('헬스장');
    expect(data[0].amount).toBe(50000);
    expect(data[0].company_name).toBe('FitCo');
  });

  it('products가 null이어도 플랫하게 처리된다', async () => {
    b.order.mockResolvedValue({ data: [{ id: 'sub-2', status: 'cancelled', products: null }] });

    const { data } = await getSubscriptions();
    expect(data[0].product_name).toBeUndefined();
    expect(data[0].amount).toBeUndefined();
  });

  it('결과가 없으면 빈 배열을 반환한다', async () => {
    b.order.mockResolvedValue({ data: null });

    const { data } = await getSubscriptions();
    expect(data).toEqual([]);
  });
});

describe('createSubscription', () => {
  it('구독을 생성하고 data를 반환한다', async () => {
    const newSub = { id: 'sub-3', product_id: 'prod-1', account_id: 'acc-1', status: 'active' };
    b.single.mockResolvedValue({ data: newSub, error: null });

    const { data } = await createSubscription({ productId: 'prod-1', accountId: 'acc-1' });
    expect(data.id).toBe('sub-3');
  });

  it('user_id, product_id, account_id를 포함해 insert를 호출한다', async () => {
    b.single.mockResolvedValue({ data: { id: 'sub-3' }, error: null });

    await createSubscription({ productId: 'prod-1', accountId: 'acc-1' });
    expect(b.insert).toHaveBeenCalledWith(
      expect.objectContaining({ product_id: 'prod-1', account_id: 'acc-1', user_id: USER_ID })
    );
  });

  it('payment_method 기본값은 account이다', async () => {
    b.single.mockResolvedValue({ data: { id: 'sub-3' }, error: null });

    await createSubscription({ productId: 'prod-1', accountId: 'acc-1' });
    expect(b.insert).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: 'account' })
    );
  });

  it('DB 오류 시 response.data.error 형식으로 throw한다', async () => {
    b.single.mockResolvedValue({ data: null, error: { message: '구독 생성 실패' } });

    await expect(createSubscription({ productId: 'prod-1', accountId: 'acc-1' })).rejects.toMatchObject({
      response: { data: { error: '구독 생성 실패' } },
    });
  });
});

describe('updateSubscription', () => {
  it('지정한 id의 구독 상태를 paused로 변경한다', async () => {
    b.single.mockResolvedValue({ data: { id: 'sub-1', status: 'paused' }, error: null });

    const { data } = await updateSubscription('sub-1', 'paused');
    expect(data.status).toBe('paused');
    expect(b.update).toHaveBeenCalledWith({ status: 'paused' });
    expect(b.eq).toHaveBeenCalledWith('id', 'sub-1');
  });

  it('DB 오류 시 에러를 throw한다', async () => {
    b.single.mockResolvedValue({ data: null, error: { message: '업데이트 실패' } });

    await expect(updateSubscription('sub-1', 'paused')).rejects.toMatchObject({
      response: { data: { error: '업데이트 실패' } },
    });
  });
});

describe('cancelSubscription', () => {
  it('상태를 cancelled로 업데이트한다', async () => {
    b.single.mockResolvedValue({ data: { id: 'sub-1', status: 'cancelled' }, error: null });

    await cancelSubscription('sub-1');
    expect(b.update).toHaveBeenCalledWith({ status: 'cancelled' });
  });

  it('cancelled 외 다른 값으로 업데이트하지 않는다', async () => {
    b.single.mockResolvedValue({ data: { id: 'sub-1', status: 'cancelled' }, error: null });

    await cancelSubscription('sub-1');
    const callArg = b.update.mock.calls[0][0];
    expect(callArg.status).toBe('cancelled');
    expect(Object.keys(callArg)).toEqual(['status']);
  });
});
