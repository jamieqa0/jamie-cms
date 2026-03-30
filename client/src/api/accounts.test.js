import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAccounts, createAccount, getAccount, deposit, withdraw, deleteAccount } from './accounts';

vi.mock('../lib/supabase', () => {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn(),
    delete: vi.fn().mockReturnThis(),
  };
  return {
    supabase: {
      auth: { getUser: vi.fn() },
      from: vi.fn(() => builder),
      rpc: vi.fn(),
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

describe('getAccounts', () => {
  it('personal 타입 계좌 목록을 반환한다', async () => {
    const accounts = [{ id: 'acc-1', name: '주계좌', type: 'personal', balance: 100000 }];
    b.order.mockResolvedValueOnce({ data: accounts, error: null });

    const { data } = await getAccounts();
    expect(data).toHaveLength(1);
    expect(data[0].type).toBe('personal');
  });

  it('type=personal 필터를 적용한다', async () => {
    b.order.mockResolvedValueOnce({ data: [], error: null });

    await getAccounts();
    expect(b.eq).toHaveBeenCalledWith('type', 'personal');
  });

  it('user_id 필터를 적용한다', async () => {
    b.order.mockResolvedValueOnce({ data: [], error: null });

    await getAccounts();
    expect(b.eq).toHaveBeenCalledWith('user_id', USER_ID);
  });

  it('DB 오류 시 throw한다', async () => {
    b.order.mockResolvedValueOnce({ data: null, error: new Error('DB 오류') });

    await expect(getAccounts()).rejects.toThrow();
  });
});

describe('createAccount', () => {
  it('계좌명과 user_id로 insert를 호출한다', async () => {
    b.single.mockResolvedValue({ data: { id: 'acc-2', name: '저축계좌' }, error: null });

    await createAccount('저축계좌');
    expect(b.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: '저축계좌', user_id: USER_ID, type: 'personal' })
    );
  });

  it('생성된 계좌 data를 반환한다', async () => {
    b.single.mockResolvedValue({ data: { id: 'acc-2', name: '저축계좌' }, error: null });

    const { data } = await createAccount('저축계좌');
    expect(data.id).toBe('acc-2');
  });

  it('DB 오류 시 throw한다', async () => {
    b.single.mockResolvedValue({ data: null, error: new Error('중복 계좌') });

    await expect(createAccount('저축계좌')).rejects.toThrow('중복 계좌');
  });
});

describe('getAccount', () => {
  it('id에 해당하는 계좌를 반환한다', async () => {
    const account = { id: 'acc-1', name: '주계좌', transactions: [] };
    b.single.mockResolvedValue({ data: account, error: null });

    const { data } = await getAccount('acc-1');
    expect(data.id).toBe('acc-1');
  });

  it('eq를 id로 필터링한다', async () => {
    b.single.mockResolvedValue({ data: { id: 'acc-1' }, error: null });

    await getAccount('acc-1');
    expect(b.eq).toHaveBeenCalledWith('id', 'acc-1');
  });

  it('DB 오류 시 throw한다', async () => {
    b.single.mockResolvedValue({ data: null, error: new Error('계좌 없음') });

    await expect(getAccount('acc-999')).rejects.toThrow('계좌 없음');
  });
});

describe('deleteAccount', () => {
  it('id에 해당하는 계좌를 삭제한다', async () => {
    b.eq.mockResolvedValueOnce({ data: null, error: null });

    await deleteAccount('acc-1');
    expect(b.delete).toHaveBeenCalled();
    expect(b.eq).toHaveBeenCalledWith('id', 'acc-1');
  });

  it('DB 오류 시 throw한다', async () => {
    b.eq.mockResolvedValueOnce({ data: null, error: new Error('삭제 실패') });

    await expect(deleteAccount('acc-1')).rejects.toThrow('삭제 실패');
  });
});

describe('deposit', () => {
  it('account_deposit RPC를 올바른 인자로 호출한다', async () => {
    supabase.rpc.mockResolvedValue({ data: { balance: 150000 }, error: null });

    await deposit('acc-1', 50000);
    expect(supabase.rpc).toHaveBeenCalledWith('account_deposit', {
      account_id: 'acc-1',
      amount: 50000,
    });
  });

  it('문자열 금액을 숫자로 변환해 호출한다', async () => {
    supabase.rpc.mockResolvedValue({ data: {}, error: null });

    await deposit('acc-1', '30000');
    const callArgs = supabase.rpc.mock.calls[0][1];
    expect(typeof callArgs.amount).toBe('number');
    expect(callArgs.amount).toBe(30000);
  });

  it('RPC 오류 시 에러를 throw한다', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: '잔액 부족' } });

    await expect(deposit('acc-1', 50000)).rejects.toMatchObject({
      response: { data: { error: '잔액 부족' } },
    });
  });
});

describe('withdraw', () => {
  it('account_withdraw RPC를 올바른 인자로 호출한다', async () => {
    supabase.rpc.mockResolvedValue({ data: { balance: 50000 }, error: null });

    await withdraw('acc-1', 50000);
    expect(supabase.rpc).toHaveBeenCalledWith('account_withdraw', {
      account_id: 'acc-1',
      amount: 50000,
    });
  });

  it('RPC 오류 시 에러를 throw한다', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: '잔액 부족' } });

    await expect(withdraw('acc-1', 99999)).rejects.toMatchObject({
      response: { data: { error: '잔액 부족' } },
    });
  });
});
