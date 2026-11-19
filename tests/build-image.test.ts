import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mapBuildEnvironment } from '../scripts/build-image.mjs';

test('Docker build reads map configuration with explicit environment overrides and without leaking server values', () => {
  const directory = mkdtempSync(join(tmpdir(), 'shining-star-build-env-'));
  try {
    writeFileSync(join(directory, '.env'), 'PUBLIC_AMAP_KEY=local-key\nPUBLIC_AMAP_SECURITY_CODE=local-code\nDATABASE_PATH=private.db\n');
    writeFileSync(join(directory, '.env.production'), 'PUBLIC_AMAP_KEY=production-key\n');
    const env = mapBuildEnvironment(directory, { PUBLIC_AMAP_SECURITY_CODE: 'environment-code' });
    assert.equal(env.PUBLIC_AMAP_KEY, 'production-key');
    assert.equal(env.PUBLIC_AMAP_SECURITY_CODE, 'environment-code');
    assert.equal(env.DATABASE_PATH, undefined);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('Docker build refuses missing map values unless map is explicitly disabled', () => {
  const directory = mkdtempSync(join(tmpdir(), 'shining-star-build-env-'));
  try {
    assert.throws(() => mapBuildEnvironment(directory, {}), /缺少高德配置/);
    writeFileSync(join(directory, '.env'), 'PUBLIC_AMAP_KEY=only-key\n');
    assert.throws(() => mapBuildEnvironment(directory, {}), /缺少高德配置/);
    const env = mapBuildEnvironment(directory, {}, true);
    assert.equal(env.PUBLIC_AMAP_KEY, ''); assert.equal(env.PUBLIC_AMAP_SECURITY_CODE, '');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
