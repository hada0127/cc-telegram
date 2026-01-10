#!/usr/bin/env node

/**
 * cc-telegram CLI
 * 텔레그램을 통한 원격 Claude Code 실행
 */

import { setCwd, configExists, getDataDir, loadConfig } from './config.js';
import { initialize } from './init.js';
import { cleanupOrphanTasks } from './tasks.js';
import { startBot, stopBot } from './telegram.js';
import { startExecutor, stopExecutor } from './executor.js';
import { initLogger, info, error } from './utils/logger.js';
import { runCleanup } from './utils/logRotation.js';
import { t } from './i18n.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/**
 * 종료 핸들러
 */
export function setupExitHandlers() {
  const cleanup = async () => {
    console.log(`\n${t('app.shutting_down')}`);
    stopBot();
    stopExecutor();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  return cleanup;
}

/**
 * 메인 함수
 */
/* istanbul ignore next */
export async function main() {
  const cwd = process.cwd();
  setCwd(cwd);

  console.log(`🤖 ${t('app.name')} - ${t('app.description')}\n`);

  // 설정 파일 확인
  const hasConfig = await configExists();

  if (!hasConfig) {
    // 초기화 필요
    await initialize(cwd);
    return;
  }

  // 로거 초기화
  const logsDir = path.join(getDataDir(), 'logs');
  initLogger(logsDir, false);

  // 종료 핸들러 설정
  setupExitHandlers();

  // orphan 작업 정리
  const cleaned = await cleanupOrphanTasks();
  if (cleaned > 0) {
    info(t('cli.orphan_tasks_cleaned', { count: cleaned }));
  }

  // 로그 로테이션 실행
  const config = await loadConfig();
  const dataDir = getDataDir();
  const cleanupResult = await runCleanup(dataDir, config.logRetentionDays, 30);

  if (cleanupResult.logs.deleted > 0) {
    info(t('cli.old_logs_deleted', { count: cleanupResult.logs.deleted }));
  }
  if (cleanupResult.tasks.completed > 0 || cleanupResult.tasks.failed > 0) {
    info(t('cli.old_tasks_deleted', { completed: cleanupResult.tasks.completed, failed: cleanupResult.tasks.failed }));
  }

  // 봇 및 실행기 시작
  try {
    await startBot();
    await startExecutor();

    console.log(`✅ ${t('cli.bot_running')}\n`);
    info(t('cli.started'));

    // 무한 대기 (봇과 실행기가 백그라운드에서 동작)
    /* istanbul ignore next */
    await new Promise(() => {});
  } catch (err) {
    error(t('app.start_failed'), err.message);
    console.error(`❌ ${t('app.start_failed')}:`, err.message);
    process.exit(1);
  }
}

/* istanbul ignore next */
// 직접 실행시에만 main 호출 (symlink 대응)
const isMainModule = (() => {
  if (!process.argv[1]) return false;
  try {
    const currentFile = fileURLToPath(import.meta.url);
    const argvFile = path.resolve(process.argv[1]);

    // 실제 경로로 비교 (symlink 해결)
    const currentReal = fs.existsSync(currentFile) ? fs.realpathSync(currentFile) : currentFile;
    const argvReal = fs.existsSync(argvFile) ? fs.realpathSync(argvFile) : argvFile;

    return currentReal === argvReal;
  } catch {
    // realpathSync 실패 시 기존 방식으로 폴백
    return fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
  }
})();
/* istanbul ignore if */
if (isMainModule) {
  main().catch(err => {
    // t() 함수도 실패할 수 있으므로 안전하게 처리
    try {
      console.error(`❌ ${t('app.error')}:`, err.message);
    } catch {
      console.error('❌ Error:', err.message);
    }
    process.exit(1);
  });
}
