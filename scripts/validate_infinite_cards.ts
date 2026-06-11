#!/usr/bin/env tsx
/**
 * Validation script for infinite learning mode cards
 *
 * Checks:
 * 1. Each subject has minimum card count (default 10)
 * 2. Subject names match between UI and database
 * 3. All quick_check.answer values exist in quick_check.choices
 * 4. All cards have required fields
 *
 * Usage:
 *   tsx scripts/validate_infinite_cards.ts
 *   tsx scripts/validate_infinite_cards.ts --min-cards 20
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const MIN_CARDS = parseInt(process.argv.find(arg => arg.startsWith('--min-cards='))?.split('=')[1] || '10', 10);

// Load environment variables
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// UI subject names (what users see)
const UI_SUBJECTS = [
  'Math 30-1',
  'Math 20-1',
  'Biology 30',
  'Biology 20',
  'Chemistry 30',
  'Chemistry 20',
  'Physics 30',
  'Physics 20',
  'English Language Arts 30-1',
  'English Language Arts 20-1',
  'Social Studies 30-1',
  'Social Studies 20-1'
];

// Subject name normalization (UI → Database)
const SUBJECT_ALIASES: Record<string, string> = {
  'Math 20-1': 'Mathematics 20-1',
};

function normalizeSubjectName(subject: string): string {
  return SUBJECT_ALIASES[subject] || subject;
}

interface ValidationIssue {
  severity: 'error' | 'warning';
  category: string;
  subject?: string;
  cardId?: string;
  message: string;
}

async function main() {
  console.log('🔍 Validating Infinite Learning Cards...\n');

  const issues: ValidationIssue[] = [];

  // Fetch all active, high-quality cards
  const { data: cards, error } = await supabase
    .from('content_microcards')
    .select('*')
    .eq('status', 'active')
    .gte('quality_score', 70);

  if (error) {
    console.error('❌ Failed to fetch cards:', error.message);
    process.exit(1);
  }

  if (!cards || cards.length === 0) {
    console.error('❌ No cards found in database');
    process.exit(1);
  }

  console.log(`✅ Found ${cards.length} total cards\n`);

  // Group cards by subject
  const cardsBySubject: Record<string, any[]> = {};
  for (const card of cards) {
    const subject = card.subject;
    if (!cardsBySubject[subject]) {
      cardsBySubject[subject] = [];
    }
    cardsBySubject[subject].push(card);
  }

  // Check 1: Subject card counts
  console.log('📊 Checking card counts per subject...');
  const dbSubjects = Object.keys(cardsBySubject).sort();

  for (const dbSubject of dbSubjects) {
    const count = cardsBySubject[dbSubject].length;
    console.log(`  ${dbSubject}: ${count} cards`);

    if (count < MIN_CARDS) {
      issues.push({
        severity: 'warning',
        category: 'Card Count',
        subject: dbSubject,
        message: `Only ${count} cards (minimum recommended: ${MIN_CARDS})`
      });
    }
  }

  console.log();

  // Check 2: Subject name mapping
  console.log('🔤 Checking subject name mapping...');
  const normalizedUISubjects = UI_SUBJECTS.map(s => normalizeSubjectName(s));

  for (const uiSubject of UI_SUBJECTS) {
    const normalized = normalizeSubjectName(uiSubject);
    if (!dbSubjects.includes(normalized)) {
      issues.push({
        severity: 'error',
        category: 'Subject Mapping',
        subject: uiSubject,
        message: `UI subject "${uiSubject}" (normalized: "${normalized}") has no cards in database`
      });
    }
  }

  for (const dbSubject of dbSubjects) {
    if (!normalizedUISubjects.includes(dbSubject)) {
      issues.push({
        severity: 'warning',
        category: 'Subject Mapping',
        subject: dbSubject,
        message: `Database subject "${dbSubject}" has no UI mapping (not shown to users)`
      });
    }
  }

  console.log();

  // Check 3: Quick check answer validation
  console.log('✓ Validating quick check answers...');
  let answerIssues = 0;

  for (const card of cards) {
    const quickCheck = card.quick_check;
    if (!quickCheck || !Array.isArray(quickCheck.choices) || !quickCheck.answer) {
      issues.push({
        severity: 'error',
        category: 'Data Quality',
        subject: card.subject,
        cardId: card.id,
        message: 'Missing or invalid quick_check data'
      });
      answerIssues++;
      continue;
    }

    const answer = quickCheck.answer.trim();
    const choices = quickCheck.choices.map((c: string) => c.trim());

    if (!choices.includes(answer)) {
      // Try case-insensitive match
      const normalizedAnswer = answer.toLowerCase();
      const normalizedChoices = choices.map((c: string) => c.toLowerCase());

      if (!normalizedChoices.includes(normalizedAnswer)) {
        issues.push({
          severity: 'error',
          category: 'Data Quality',
          subject: card.subject,
          cardId: card.id,
          message: `Answer "${answer}" not found in choices: [${choices.join(', ')}]`
        });
        answerIssues++;
      }
    }
  }

  console.log(`  Checked ${cards.length} cards, found ${answerIssues} answer validation issues\n`);

  // Print summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('                   VALIDATION REPORT                    ');
  console.log('═══════════════════════════════════════════════════════\n');

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All validation checks passed!');
    console.log('\n📈 Summary:');
    console.log(`  • Total cards: ${cards.length}`);
    console.log(`  • Subjects: ${dbSubjects.length}`);
    console.log(`  • All subjects have ≥ ${MIN_CARDS} cards`);
    console.log(`  • All quick check answers are valid`);
    process.exit(0);
  }

  if (errors.length > 0) {
    console.log(`❌ ERRORS (${errors.length}):\n`);
    for (const issue of errors) {
      console.log(`  [${issue.category}] ${issue.subject || 'General'}`);
      console.log(`    ${issue.message}`);
      if (issue.cardId) console.log(`    Card ID: ${issue.cardId}`);
      console.log();
    }
  }

  if (warnings.length > 0) {
    console.log(`⚠️  WARNINGS (${warnings.length}):\n`);
    for (const issue of warnings) {
      console.log(`  [${issue.category}] ${issue.subject || 'General'}`);
      console.log(`    ${issue.message}`);
      console.log();
    }
  }

  console.log('═══════════════════════════════════════════════════════\n');

  if (errors.length > 0) {
    console.error('❌ Validation failed with errors');
    process.exit(1);
  } else {
    console.log('⚠️  Validation completed with warnings');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('❌ Validation script error:', error);
  process.exit(1);
});
