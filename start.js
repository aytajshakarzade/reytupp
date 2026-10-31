'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');

function isPlaceholderDatabaseUrl(value) {
  if (!value || !String(value).trim()) return false;
  return /(?:REGION|PROJECT_REF|YOUR[_-]?PASSWORD|user:password|@host(?::|\/))/i.test(value);
}

function isSupabaseDatabaseUrl(value) {
  if (!value || !String(value).trim()) return false;
  try {
    const hostname = new URL(String(value).trim()).hostname.toLowerCase();
    return hostname.endsWith('.pooler.supabase.com') || hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

function loadLocalEnvironment() {
  // Load local environment without editing .env. Existing process variables win.
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(path.join(__dirname, '.env'));
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`[config] .env oxunmadı: ${error.message}`);
    }
  }
}

function run(command, args, label) {
  const child = spawn(command, args, { cwd: __dirname, env: process.env, stdio: 'inherit' });
  child.on('error', error => {
    console.error(`[start] ${label} başlatılmadı: ${error.message}`);
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
}

function main() {
  loadLocalEnvironment();

  const databaseUrl = process.env.DATABASE_URL || '';
  const needsSupabasePasswordPrompt = !databaseUrl.trim() || isPlaceholderDatabaseUrl(databaseUrl);
  // A previously saved Supabase URI may contain an expired/incorrect DB password.
  // On Windows, request the current password securely every launch and build the
  // DATABASE_URL in the child process only. The .env file remains byte-for-byte intact.
  const useSecureSupabaseLauncher = process.platform === 'win32' &&
    (needsSupabasePasswordPrompt || isSupabaseDatabaseUrl(databaseUrl));

  if (useSecureSupabaseLauncher) {
    const scriptPath = path.join(__dirname, 'Start-ReytUp-Supabase.ps1');
    run('powershell.exe', [
      '-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath
    ], 'Supabase quraşdırma skripti');
  } else if (needsSupabasePasswordPrompt) {
    console.error('[config] DATABASE_URL nümunə dəyəridir. Supabase Connect-dən real URI təyin edin. .env faylı dəyişdirilməyib.');
    process.exitCode = 1;
  } else {
    run(process.execPath, [path.join(__dirname, 'server.js')], 'ReytUp serveri');
  }
}

if (require.main === module) main();

module.exports = { isPlaceholderDatabaseUrl, isSupabaseDatabaseUrl };
