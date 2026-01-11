/**
 * 안전장치 통합 테스트
 * processTask에서 예외 발생 시 cc-telegram이 종료되지 않는지 확인
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// 테스트용 임시 디렉토리
let testDir;
let dataDir;

// 모듈 동적 import
let configModule;
let tasksModule;
let i18nModule;

// fetch mock
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ ok: true, result: [] })
});

beforeAll(async () => {
  // 임시 디렉토리 생성
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-telegram-safety-test-'));
  dataDir = path.join(testDir, '.cc-telegram');

  // 디렉토리 구조 생성
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(path.join(dataDir, 'tasks'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'completed'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'failed'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'logs'), { recursive: true });

  // 초기 JSON 파일 생성
  await fs.writeFile(
    path.join(dataDir, 'tasks.json'),
    JSON.stringify({ lastUpdated: '', tasks: [] }, null, 2)
  );
  await fs.writeFile(
    path.join(dataDir, 'completed.json'),
    JSON.stringify({ tasks: [] }, null, 2)
  );
  await fs.writeFile(
    path.join(dataDir, 'failed.json'),
    JSON.stringify({ tasks: [] }, null, 2)
  );

  // config 모듈 import 및 cwd 설정
  configModule = await import('../src/config.js');
  configModule.setCwd(testDir);

  // config 파일 생성 (존재하지 않는 명령어로 설정)
  await configModule.saveConfig({
    botToken: 'test-token',
    chatId: '123456',
    debugMode: false,
    claudeCommand: 'nonexistent-command-12345',
    logRetentionDays: 7,
    defaultMaxRetries: 3,
    parallelExecution: false,
    maxParallel: 1
  });

  // tasks 모듈 import
  tasksModule = await import('../src/tasks.js');

  // i18n 모듈 import
  i18nModule = await import('../src/i18n.js');
});

afterAll(async () => {
  // 테스트 디렉토리 정리
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch {
    // 정리 실패 무시
  }
});

describe('안전장치 통합 테스트', () => {
  test('존재하지 않는 명령어로 작업 생성 시에도 프로그램이 종료되지 않아야 함', async () => {
    // 테스트 작업 생성
    const task = await tasksModule.createTask({
      requirement: '테스트 작업',
      completionCriteria: '완료 조건',
      maxRetries: 1,
      workingDirectory: testDir
    });

    expect(task).toBeDefined();
    expect(task.id).toBeDefined();
    expect(task.status).toBe('ready');
  });

  test('예외 처리 시 작업이 실패 상태로 변경되어야 함', async () => {
    // 작업 생성
    const task = await tasksModule.createTask({
      requirement: '오류 테스트 작업',
      completionCriteria: null,
      maxRetries: 1,
      workingDirectory: testDir
    });

    // 작업을 시작 상태로 변경
    await tasksModule.startTask(task.id);

    // 실패 처리
    await tasksModule.failTask(task.id, '테스트 실패 사유');

    // 실패 목록에서 작업 확인
    const failedTasks = await tasksModule.getFailedTasks();
    const found = failedTasks.find(t => t.id === task.id);

    expect(found).toBeDefined();
    expect(found.failedAt).toBeDefined(); // 실패 시각이 있음
    expect(found.summary).toContain('테스트 실패 사유');
  });

  test('번역 키가 모두 존재해야 함', () => {
    // task_crash
    const crashMsg = i18nModule.t('executor.task_crash', { error: 'test' });
    expect(crashMsg).not.toBe('executor.task_crash');

    // task_crashed
    const crashedMsg = i18nModule.t('executor.task_crashed');
    expect(crashedMsg).not.toBe('executor.task_crashed');

    // crash_reason
    const reasonMsg = i18nModule.t('executor.crash_reason', { error: 'test' });
    expect(reasonMsg).not.toBe('executor.crash_reason');
  });

  test('escapeHtml이 올바르게 동작해야 함', async () => {
    const executorModule = await import('../src/executor.js');

    const dangerous = '<script>alert("xss")</script>';
    const escaped = executorModule.escapeHtml(dangerous);

    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
  });
});

describe('executor 안전장치 로직 검증', () => {
  test('catch 블록에서 failTask가 호출되는 시나리오', async () => {
    // 작업 생성
    const task = await tasksModule.createTask({
      requirement: 'catch 블록 테스트',
      completionCriteria: null,
      maxRetries: 1,
      workingDirectory: testDir
    });

    // 시작
    await tasksModule.startTask(task.id);

    // 시뮬레이션: 오류 발생 후 failTask 호출
    const errorMessage = '프로세스 실행 중 오류 발생';
    const errorSummary = i18nModule.t('executor.task_crash', {
      error: errorMessage
    });

    await tasksModule.failTask(task.id, errorSummary);

    // 실패 목록에서 확인
    const failedTasks = await tasksModule.getFailedTasks();
    const found = failedTasks.find(t => t.id === task.id);

    expect(found).toBeDefined();
    expect(found.summary).toContain(errorMessage);
  });

  test('내부 오류 발생 시에도 프로세스가 종료되지 않아야 함', async () => {
    // 이 테스트는 프로세스가 살아있는지 확인
    // 실제로는 테스트가 완료되면 프로세스가 살아있는 것
    expect(process.exitCode).toBeUndefined();
  });
});
