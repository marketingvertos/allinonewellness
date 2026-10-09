CREATE POLICY "Authenticated users read promotion media"
ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'promotion-media');