ALTER TABLE public.whatsapp_broadcasts ADD COLUMN header_media_url text;
ALTER TABLE public.whatsapp_broadcasts ADD COLUMN header_media_type text;
COMMENT ON COLUMN public.whatsapp_broadcasts.header_media_url IS 'Immutable public poster URL used for the template header in queued sends';
COMMENT ON COLUMN public.whatsapp_broadcasts.header_media_type IS 'Media header kind for the selected approved template';