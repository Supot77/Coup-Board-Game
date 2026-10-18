const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const hash = data => createHash('sha256').update(data).digest('hex');

(async () => {
  const files = ['index.html', ...fs.readdirSync('dist/assets').filter(file => /\.(js|css)$/.test(file)).map(file => `assets/${file}`),
    ...['duke', 'assassin', 'captain', 'ambassador', 'contessa'].map(role => `assets/secret-council/action-${role}-v1.webp`),
    ...['council-candle-room-v1.webp', 'council-long-table.png', 'avatar-male.png', 'avatar-female.png'].map(file => `assets/secret-council/${file}`)];
  const resources = [];
  for (const file of files) {
    const response = await fetch(`https://coup-49ffc.web.app/${file}`, { cache: 'no-store' });
    assert.equal(response.status, 200, file);
    const live = Buffer.from(await response.arrayBuffer());
    const expected = hash(fs.readFileSync(path.join('dist', file)));
    assert.equal(hash(live), expected, `live/local mismatch: ${file}`);
    resources.push({ path: file, status: response.status, bytes: live.length, sha256: expected });
  }
  fs.writeFileSync(path.join(__dirname, 'asset-manifest.json'), JSON.stringify({ checkedAt: new Date().toISOString(), site: 'https://coup-49ffc.web.app', resources }, null, 2) + '\n');
  console.log(`PASS ${resources.length} live resources match local build by SHA-256, including candlelit room, table and avatars`);
})().catch(error => { console.error(error); process.exitCode = 1; });
