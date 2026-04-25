#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const FILES = {
    tauriConf: 'apps/desktop/src-tauri/tauri.conf.json',
    pkgJson: 'apps/desktop/package.json',
    cargoToml: 'apps/desktop/src-tauri/Cargo.toml',
    cargoLock: 'apps/desktop/src-tauri/Cargo.lock',
};

function readCurrentVersion() {
    const p = resolve(ROOT, FILES.tauriConf);
    const json = JSON.parse(readFileSync(p, 'utf8'));
    return json.version;
}

function parseSemver(v) {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
    if (!m) throw new Error(`Invalid semver: ${v}`);
    return { major: +m[1], minor: +m[2], patch: +m[3] };
}

function bump(current, kind) {
    const v = parseSemver(current);
    if (kind === 'patch') return `${v.major}.${v.minor}.${v.patch + 1}`;
    if (kind === 'minor') return `${v.major}.${v.minor + 1}.0`;
    if (kind === 'major') return `${v.major + 1}.0.0`;
    if (/^\d+\.\d+\.\d+$/.test(kind)) return kind;
    throw new Error(`Unknown bump type: ${kind} (use patch | minor | major | x.y.z)`);
}

function updateJson(file, version) {
    const p = resolve(ROOT, file);
    const json = JSON.parse(readFileSync(p, 'utf8'));
    json.version = version;
    writeFileSync(p, JSON.stringify(json, null, 2) + '\n', 'utf8');
}

function updateCargoToml(version) {
    const p = resolve(ROOT, FILES.cargoToml);
    let content = readFileSync(p, 'utf8');
    content = content.replace(
        /^(\[package\][\s\S]*?\nversion\s*=\s*)"[^"]+"/m,
        `$1"${version}"`
    );
    writeFileSync(p, content, 'utf8');
}

function updateCargoLock(version) {
    const p = resolve(ROOT, FILES.cargoLock);
    let content = readFileSync(p, 'utf8');
    content = content.replace(
        /(\[\[package\]\]\nname = "desktop"\nversion = )"[^"]+"/,
        `$1"${version}"`
    );
    writeFileSync(p, content, 'utf8');
}

function run(cmd) {
    console.log(`$ ${cmd}`);
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

function checkClean() {
    const out = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
    if (out.trim()) {
        console.error('Working tree is not clean. Commit or stash changes first:');
        console.error(out);
        process.exit(1);
    }
}

let _rl = null;
function getRl() {
    if (!_rl) _rl = readline.createInterface({ input, output });
    return _rl;
}
async function ask(q) {
    const answer = await getRl().question(q);
    return answer.trim().toLowerCase();
}
function closeRl() {
    if (_rl) _rl.close();
}

async function main() {
    const arg = process.argv[2];
    if (!arg) {
        console.error('Usage: pnpm release <patch|minor|major|x.y.z>');
        console.error('Example: pnpm release patch');
        console.error('Example: pnpm release 0.2.0');
        process.exit(1);
    }

    checkClean();

    const current = readCurrentVersion();
    const next = bump(current, arg);
    const tag = `v${next}`;

    console.log(`\n📦 Version bump: ${current} → ${next} (tag: ${tag})\n`);

    const confirm = await ask(`Proceed? [y/N] `);
    if (confirm !== 'y' && confirm !== 'yes') {
        console.log('Aborted.');
        process.exit(0);
    }

    updateJson(FILES.tauriConf, next);
    updateJson(FILES.pkgJson, next);
    updateCargoToml(next);
    updateCargoLock(next);

    console.log('\n✅ Version files updated.\n');

    run('git add ' + Object.values(FILES).join(' '));
    run(`git commit -m "chore: bump version to ${next}"`);
    run(`git tag ${tag}`);

    console.log(`\n🏷  Tag ${tag} created locally.\n`);

    const push = await ask(`Push to origin and trigger build? [y/N] `);
    if (push === 'y' || push === 'yes') {
        run('git push');
        run(`git push origin ${tag}`);
        console.log(`\n🚀 Pushed. GitHub Actions will build and create the release.\n`);
        console.log(`   Watch: https://github.com/neod00/carbonmate-desktop/actions\n`);
    } else {
        console.log(`\nTo push later:\n  git push && git push origin ${tag}\n`);
    }
    closeRl();
}

main().catch(e => {
    console.error('Error:', e.message);
    closeRl();
    process.exit(1);
});
