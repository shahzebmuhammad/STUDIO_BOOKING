-- Keep client photo references in the existing bucket:path format while matching
-- the object key inside Storage. This is a narrow, safe follow-up migration.
begin;

drop policy if exists "members read organization files" on storage.objects;

create policy "members read organization files" on storage.objects for select to authenticated
  using (
    (
      bucket_id = 'client-media'
      and (
        public.has_org_role((storage.foldername(storage.objects.name))[1]::uuid, array['owner','admin','reception','studio_manager','editor','finance']::public.organization_role[])
        or exists (
        select 1 from public.clients c
        where c.organization_id = (storage.foldername(storage.objects.name))[1]::uuid
          and c.photo_path = 'client-media:' || storage.objects.name
          and c.portal_user_id = (select auth.uid())
        )
      )
    )
    or (
      bucket_id = 'equipment-media'
      and public.has_org_role((storage.foldername(storage.objects.name))[1]::uuid, array['owner','admin','reception','studio_manager','editor']::public.organization_role[])
    )
    or (
      bucket_id = 'payment-receipts'
      and (
        public.has_org_role((storage.foldername(storage.objects.name))[1]::uuid, array['owner','admin','finance','reception']::public.organization_role[])
        or exists (
        select 1 from public.payments p
        join public.clients c on c.organization_id = p.organization_id and c.id = p.client_id
        where p.organization_id = (storage.foldername(storage.objects.name))[1]::uuid
          and p.receipt_path = storage.objects.name
          and c.portal_user_id = (select auth.uid())
        )
      )
    )
  );

commit;
