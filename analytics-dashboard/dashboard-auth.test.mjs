import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');

assert.match(html, /@supabase\/supabase-js@2\.117\.2\/dist\/umd\/supabase\.min\.js/);
assert.match(html, /supabaseLibrarySources\s*=\s*\[/);
assert.match(html, /Google sign-in is temporarily unavailable\. Check your connection and try again\./);
assert.match(html, /authClient\s*=\s*authClient\s*\|\|\s*await initialiseAuthClient\(\)/);
assert.match(html, /if \(!authClient\) throw new Error\('Enter the Supabase project URL and publishable key to continue\.'/);
assert.match(html, /signInWithOAuth\(\{[\s\S]*provider:\s*'google'/);

console.log('dashboard auth loading and Google sign-in checks passed');
