import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase 환경변수가 설정되지 않았습니다.\n' +
    '.env 파일에 REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY를 입력해주세요.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
