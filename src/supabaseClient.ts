import { createClient } from '@supabase/supabase-js';

// Supabase credentials - the anon key is safe to expose (security comes from RLS)
// Env vars are used for local dev, hardcoded values for production
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hmauyaletsnukwcgpbbb.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYXV5YWxldHNudWt3Y2dwYmJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MjAyNTIsImV4cCI6MjA4MjM5NjI1Mn0.Geqf8Rjc_FOmlCL6BtxnuLuyi1MIqvxPyje1XMHGnqk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);