import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';

export function mapBuildEnvironment(directory, environment = process.env, withoutMap = false) {
  const files = {};
  for (const name of ['.env', '.env.production']) {
    const file = resolve(directory, name);
    if (existsSync(file)) Object.assign(files, parseEnv(readFileSync(file, 'utf8')));
  }
  const values = { ...files, ...environment };
  const key = withoutMap ? '' : (values.PUBLIC_AMAP_KEY ?? '').trim();
  const securityCode = withoutMap ? '' : (values.PUBLIC_AMAP_SECURITY_CODE ?? '').trim();
  if (!withoutMap && (!key || !securityCode)) {
    throw new Error('缺少高德配置：请在本地 .env、.env.production 或环境变量中填写 PUBLIC_AMAP_KEY 和 PUBLIC_AMAP_SECURITY_CODE。若明确只需要导航提示卡，请加 --without-map。');
  }
  // Pass only these two browser SDK values from env files to Docker build args.
  return { ...environment, PUBLIC_AMAP_KEY: key, PUBLIC_AMAP_SECURITY_CODE: securityCode };
}

export function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({ args, options: {
    platform: { type: 'string', default: 'linux/amd64' },
    tag: { type: 'string', default: 'shining-star:latest' },
    'without-map': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  } });
  if (!['linux/amd64', 'linux/arm64'].includes(values.platform)) throw new Error('platform 只支持 linux/amd64 或 linux/arm64');
  const directory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const environment = mapBuildEnvironment(directory, process.env, values['without-map']);
  const command = ['buildx', 'build', '--platform', values.platform, '--load', '--progress=plain',
    '--build-arg', 'PUBLIC_AMAP_KEY', '--build-arg', 'PUBLIC_AMAP_SECURITY_CODE',
    '--build-arg', `DISABLE_EMBEDDED_MAP=${values['without-map'] ? '1' : '0'}`, '-t', values.tag, '.'];
  console.log(`构建 ${values.tag}（${values.platform}）`);
  console.log(values['without-map'] ? '地图：已明确关闭内嵌地图，仅保留导航提示卡。' : '地图：已读取 Key 与安全校验配置，将在构建时注入。');
  if (values['dry-run']) { console.log('dry-run 完成，未执行 Docker 构建。'); return 0; }
  const result = spawnSync('docker', command, { cwd: directory, env: environment, stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
