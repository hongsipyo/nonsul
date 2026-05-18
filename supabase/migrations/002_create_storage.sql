-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('exam-pdfs', 'exam-pdfs', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('answer-images', 'answer-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('corrected-files', 'corrected-files', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', true);

-- Storage policies: authenticated users can upload/read
CREATE POLICY "Authenticated upload exam-pdfs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'exam-pdfs');
CREATE POLICY "Public read exam-pdfs" ON storage.objects FOR SELECT USING (bucket_id = 'exam-pdfs');
CREATE POLICY "Authenticated upload answer-images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'answer-images');
CREATE POLICY "Public read answer-images" ON storage.objects FOR SELECT USING (bucket_id = 'answer-images');
CREATE POLICY "Authenticated upload corrected-files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'corrected-files');
CREATE POLICY "Public read corrected-files" ON storage.objects FOR SELECT USING (bucket_id = 'corrected-files');
CREATE POLICY "Authenticated upload materials" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'materials');
CREATE POLICY "Public read materials" ON storage.objects FOR SELECT USING (bucket_id = 'materials');
