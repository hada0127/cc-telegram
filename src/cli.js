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
import path from 'path';

/**
 * 종료 핸들러
 */
function setupExitHandlers() {
  const cleanup = async () => {
    console.log('\n종료 중...');
    stopBot();
    stopExecutor();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

/**
 * 메인 함수
 */
async function main() {
  const cwd = process.cwd();
  setCwd(cwd);

  console.log('🤖 cc-telegram - 텔레그램을 통한 원격 Claude Code 실행\n');

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
    info(`${cleaned}개의 orphan 작업 정리됨`);
  }

  // 로그 로테이션 실행
  const config = await loadConfig();
  const dataDir = getDataDir();
  const cleanupResult = await runCleanup(dataDir, config.logRetentionDays, 30);

  if (cleanupResult.logs.deleted > 0) {
    info(`${cleanupResult.logs.deleted}개의 오래된 로그 파일 삭제됨`);
  }
  if (cleanupResult.tasks.completed > 0 || cleanupResult.tasks.failed > 0) {
    info(`오래된 작업 파일 삭제: 완료 ${cleanupResult.tasks.completed}개, 실패 ${cleanupResult.tasks.failed}개`);
  }

  // 봇 및 실행기 시작
  try {
    await startBot();
    await startExecutor();

    console.log('✅ 봇이 실행중입니다. Ctrl+C로 종료할 수 있습니다.\n');
    info('cc-telegram 시작');

    // 무한 대기 (봇과 실행기가 백그라운드에서 동작)
    await new Promise(() => {});
  } catch (err) {
    error('시작 실패', err.message);
    console.error('❌ 시작 실패:', err.message);
    process.exit(1);
  }
}

// 실행
main().catch(err => {
  console.error('❌ 오류:', err.message);
  process.exit(1);
});
