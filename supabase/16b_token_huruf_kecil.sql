-- 16b. Samakan token link bayar jadi huruf kecil (link tetap jalan walau huruf besar berubah jadi kecil)
update public.applications set pay_token = lower(pay_token) where pay_token is not null and pay_token <> lower(pay_token);
update public.group_invoices set token = lower(token) where token <> lower(token);
notify pgrst, 'reload schema';
