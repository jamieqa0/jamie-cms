import { supabase } from '../lib/supabase';

// ── Products ──────────────────────────────────────────────

export const getCompanyProducts = async (companyId) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const getCompanyProduct = async (id) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
};

export const createCompanyProduct = async (companyId, productData) => {
  const { data, error } = await supabase
    .from('products')
    .insert({ ...productData, company_id: companyId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateCompanyProduct = async (id, productData) => {
  const { data, error } = await supabase
    .from('products')
    .update(productData)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteCompanyProduct = async (id) => {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
};

// ── Customers (consent requests) ─────────────────────────

export const getCompanyCustomers = async (companyId) => {
  const { data, error } = await supabase
    .from('consent_requests')
    .select('*, products(name, amount), subscriptions(id)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const createConsentRequest = async ({ companyId, productId, customerName, customerContact }) => {
  const { data, error } = await supabase
    .from('consent_requests')
    .insert({
      company_id: companyId,
      product_id: productId,
      customer_name: customerName,
      customer_contact: customerContact,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ── Stats / Transfers / Unpaid ────────────────────────────

export const getCompanyStats = async (companyId) => {
  const { data, error } = await supabase.rpc('get_company_stats', { p_company_id: companyId });
  if (error) throw error;
  return data;
};

export const getCompanyTransfers = async (companyId) => {
  const { data, error } = await supabase.rpc('get_company_transfers', { p_company_id: companyId });
  if (error) throw error;
  return data;
};

export const getCompanyUnpaid = async (companyId) => {
  const { data, error } = await supabase.rpc('get_company_unpaid', { p_company_id: companyId });
  if (error) throw error;
  return data;
};

// ── Company Account ───────────────────────────────────────

export const getCompanyAccount = async (companyId) => {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, balance')
    .eq('user_id', companyId)
    .eq('type', 'company')
    .single();
  if (error) throw error;
  return data;
};

// ── Consent acceptance ────────────────────────────────────

export const getConsentRequest = async (token) => {
  const { data, error } = await supabase
    .from('consent_requests')
    .select('*, products(name, amount, billing_day, invoice_day), users!company_id(nickname)')
    .eq('invite_token', token)
    .single();
  if (error) throw error;
  return data;
};

export const acceptConsent = async (token, accountId) => {
  const { data, error } = await supabase.rpc('accept_consent', {
    p_token: token,
    p_account_id: accountId,
  });
  if (error) throw error;
  return data;
};

// ── Invoices ──────────────────────────────────────────────

export const getCompanyInvoices = async (companyId) => {
  const { data, error } = await supabase.rpc('get_company_invoices', { p_company_id: companyId });
  if (error) throw error;
  return data;
};

export const createManualInvoice = async (subscriptionId) => {
  const { data, error } = await supabase.rpc('create_invoice_manual', { p_subscription_id: subscriptionId });
  if (error) throw error;
  return data;
};

export const getMyCompany = async (userId) => {
  const { data, error } = await supabase
    .from('companies')
    .select('industry, commission_rate')
    .eq('user_id', userId)
    .single();
  if (error) throw { response: { data: { error: error.message } } };
  return data;
};
