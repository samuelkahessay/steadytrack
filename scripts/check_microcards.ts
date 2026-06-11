import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

const { data, error, count } = await supabase
  .from('content_microcards')
  .select('outcome_code, summary, quick_check', { count: 'exact' })
  .eq('subject', 'Math 30-1')
  .order('outcome_code')
  .limit(2);

if (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

console.log(`✅ Found ${count} microcards for Math 30-1 in database!\n`);
console.log('📝 Sample microcard #1:');
console.log(`   Outcome: ${data[0].outcome_code}`);
console.log(`   Summary: ${data[0].summary.substring(0, 100)}...`);
console.log(`   Quick Check: ${data[0].quick_check.question.substring(0, 80)}...`);
