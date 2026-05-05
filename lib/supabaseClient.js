import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://huwhxizgcgwpabmknmyx.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1d2h4aXpnY2d3cGFibWtubXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzMwMzAsImV4cCI6MjA4Mzk0OTAzMH0.-j3ScGHJC9si1z13ImtQ0VVGFqGnWFKg-JSH2molDd8";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});