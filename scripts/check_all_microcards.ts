import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// Load .env files (same as generate_microcards.ts)
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

const ROOT = process.cwd();
loadEnvFiles([path.join(ROOT, '.env.local'), path.join(ROOT, '.env')]);

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const subjects = [
    'Math 30-1',
    'Mathematics 20-1',
    'English Language Arts 20-1',
    'English Language Arts 30-1',
    'Social Studies 20-1',
    'Social Studies 30-1',
    'Biology 20',
    'Biology 30',
    'Chemistry 20',
    'Chemistry 30',
    'Physics 20',
    'Physics 30'
  ];

  console.log('📊 Microcard Coverage Report\n');
  console.log('Subject'.padEnd(35) + 'Count');
  console.log('─'.repeat(45));

  let total = 0;
  for (const subject of subjects) {
    const { count, error } = await supabase
      .from('content_microcards')
      .select('*', { count: 'exact', head: true })
      .eq('subject', subject);
    
    if (error) {
      console.log(subject.padEnd(35) + '❌ Error');
    } else {
      const countStr = count === 0 ? '❌ 0' : `✅ ${count}`;
      console.log(subject.padEnd(35) + countStr);
      total += count || 0;
    }
  }
  
  console.log('─'.repeat(45));
  console.log(`\nTotal: ${total} microcards across all subjects`);
}

main().catch(console.error);
