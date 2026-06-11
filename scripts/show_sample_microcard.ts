import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

function loadEnvFiles(files: string[]) {
  for (const f of files) {
    try {
      if (!fs.existsSync(f)) continue;
      const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        const key = m[1];
        let val = m[2];
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    } catch {}
  }
}

loadEnvFiles([path.join(process.cwd(), '.env.local'), path.join(process.cwd(), '.env')]);

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Missing env vars');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from('content_microcards')
    .select('*')
    .eq('subject', 'Biology 30')
    .limit(1)
    .single();
  
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('📝 Sample Microcard (Biology 30)\n');
  console.log('Outcome Code:', data.outcome_code);
  console.log('Unit:', data.unit_id);
  console.log('\n📖 Summary:');
  console.log(data.summary);
  console.log('\n🪜 Steps:');
  data.steps.forEach((step: string, i: number) => console.log(`  ${i + 1}. ${step}`));
  if (data.pitfall) {
    console.log('\n⚠️  Common Pitfall:');
    console.log(`  ${data.pitfall}`);
  }
  console.log('\n❓ Quick Check Question:');
  console.log(`  Q: ${data.quick_check.question}`);
  console.log('  Choices:');
  data.quick_check.choices.forEach((choice: string, i: number) => 
    console.log(`    ${String.fromCharCode(65 + i)}. ${choice}`)
  );
  console.log(`  ✓ Answer: ${data.quick_check.answer}`);
  console.log(`  Explanation: ${data.quick_check.explanation}`);
}

main().catch(console.error);
