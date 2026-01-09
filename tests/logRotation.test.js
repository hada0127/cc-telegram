/**
 * logRotation.js 단위 테스트
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// 테스트용 임시 디렉토리
let testDir;
let logsDir;
let dataDir;

// 모듈 동적 import
let logRotationModule;

beforeAll(async () => {
  // 임시 디렉토리 생성
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-telegram-log-test-'));
  dataDir = path.join(testDir, '.cc-telegram');
  logsDir = path.join(dataDir, 'logs');

  // 디렉토리 구조 생성
  await fs.mkdir(logsDir, { recursive: true });
  await fs.mkdir(path.join(dataDir, 'completed'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'failed'), { recursive: true });

  // 초기 JSON 파일 생성
  await fs.writeFile(
    path.join(dataDir, 'completed.json'),
    JSON.stringify({ tasks: [] }, null, 2)
  );
  await fs.writeFile(
    path.join(dataDir, 'failed.json'),
    JSON.stringify({ tasks: [] }, null, 2)
  );

  // logRotation 모듈 import
  logRotationModule = await import('../src/utils/logRotation.js');
});

afterAll(async () => {
  // 임시 디렉토리 삭제
  if (testDir) {
    await fs.rm(testDir, { recursive: true, force: true });
  }
});

describe('cleanupOldLogs', () => {
  beforeEach(async () => {
    // logs 폴더 초기화
    const files = await fs.readdir(logsDir);
    for (const file of files) {
      await fs.unlink(path.join(logsDir, file));
    }
  });

  test('오래된 로그 파일을 삭제해야 함', async () => {
    // 10일 전 날짜로 로그 파일 생성
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    const oldDateStr = oldDate.toISOString().split('T')[0];
    const oldLogFile = path.join(logsDir, `${oldDateStr}.log`);
    await fs.writeFile(oldLogFile, '오래된 로그');

    // 오늘 날짜 로그 파일 생성
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLogFile = path.join(logsDir, `${todayStr}.log`);
    await fs.writeFile(todayLogFile, '오늘 로그');

    // 7일 보관 정책으로 cleanup 실행
    const result = await logRotationModule.cleanupOldLogs(logsDir, 7);

    expect(result.deleted).toBe(1);
    expect(result.errors).toHaveLength(0);

    // 파일 존재 확인
    const remainingFiles = await fs.readdir(logsDir);
    expect(remainingFiles).not.toContain(`${oldDateStr}.log`);
    expect(remainingFiles).toContain(`${todayStr}.log`);
  });

  test('최근 로그는 유지해야 함', async () => {
    // 3일 전 날짜로 로그 파일 생성
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 3);
    const recentDateStr = recentDate.toISOString().split('T')[0];
    const recentLogFile = path.join(logsDir, `${recentDateStr}.log`);
    await fs.writeFile(recentLogFile, '최근 로그');

    // 7일 보관 정책으로 cleanup 실행
    const result = await logRotationModule.cleanupOldLogs(logsDir, 7);

    expect(result.deleted).toBe(0);

    // 파일 존재 확인
    const remainingFiles = await fs.readdir(logsDir);
    expect(remainingFiles).toContain(`${recentDateStr}.log`);
  });

  test('잘못된 형식의 파일명은 무시해야 함', async () => {
    // 잘못된 형식의 로그 파일 생성
    await fs.writeFile(path.join(logsDir, 'invalid.log'), '잘못된 형식');
    await fs.writeFile(path.join(logsDir, '2024-13-45.log'), '잘못된 날짜');

    const result = await logRotationModule.cleanupOldLogs(logsDir, 7);

    expect(result.deleted).toBe(0);

    // 파일들이 그대로 있는지 확인
    const remainingFiles = await fs.readdir(logsDir);
    expect(remainingFiles).toContain('invalid.log');
    expect(remainingFiles).toContain('2024-13-45.log');
  });

  test('빈 디렉토리에서도 오류 없이 실행되어야 함', async () => {
    const result = await logRotationModule.cleanupOldLogs(logsDir, 7);

    expect(result.deleted).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  test('존재하지 않는 디렉토리에서도 오류 없이 실행되어야 함', async () => {
    const nonExistentDir = path.join(testDir, 'non-existent-logs');
    const result = await logRotationModule.cleanupOldLogs(nonExistentDir, 7);

    expect(result.deleted).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe('cleanupOldTaskFiles', () => {
  beforeEach(async () => {
    // 완료/실패 폴더 초기화
    const completedDir = path.join(dataDir, 'completed');
    const failedDir = path.join(dataDir, 'failed');

    for (const dir of [completedDir, failedDir]) {
      const files = await fs.readdir(dir);
      for (const file of files) {
        await fs.unlink(path.join(dir, file));
      }
    }

    // 인덱스 파일 초기화
    await fs.writeFile(
      path.join(dataDir, 'completed.json'),
      JSON.stringify({ tasks: [] }, null, 2)
    );
    await fs.writeFile(
      path.join(dataDir, 'failed.json'),
      JSON.stringify({ tasks: [] }, null, 2)
    );
  });

  test('오래된 완료 작업을 삭제해야 함', async () => {
    // 40일 전 완료된 작업 생성
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40);
    const oldTask = {
      id: 'old-task-1',
      requirement: '오래된 작업',
      completedAt: oldDate.toISOString()
    };

    await fs.writeFile(
      path.join(dataDir, 'completed', 'old-task-1.json'),
      JSON.stringify(oldTask)
    );

    // 인덱스 업데이트
    await fs.writeFile(
      path.join(dataDir, 'completed.json'),
      JSON.stringify({
        tasks: [{ id: 'old-task-1', file: 'completed/old-task-1.json' }]
      })
    );

    // 30일 보관 정책으로 cleanup 실행
    const result = await logRotationModule.cleanupOldTaskFiles(dataDir, 30);

    expect(result.completed).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  test('오래된 실패 작업을 삭제해야 함', async () => {
    // 40일 전 실패한 작업 생성
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40);
    const oldTask = {
      id: 'old-failed-1',
      requirement: '오래된 실패 작업',
      failedAt: oldDate.toISOString()
    };

    await fs.writeFile(
      path.join(dataDir, 'failed', 'old-failed-1.json'),
      JSON.stringify(oldTask)
    );

    // 인덱스 업데이트
    await fs.writeFile(
      path.join(dataDir, 'failed.json'),
      JSON.stringify({
        tasks: [{ id: 'old-failed-1', file: 'failed/old-failed-1.json' }]
      })
    );

    // 30일 보관 정책으로 cleanup 실행
    const result = await logRotationModule.cleanupOldTaskFiles(dataDir, 30);

    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  test('최근 작업은 유지해야 함', async () => {
    // 10일 전 완료된 작업 생성
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 10);
    const recentTask = {
      id: 'recent-task-1',
      requirement: '최근 작업',
      completedAt: recentDate.toISOString()
    };

    await fs.writeFile(
      path.join(dataDir, 'completed', 'recent-task-1.json'),
      JSON.stringify(recentTask)
    );

    // 인덱스 업데이트
    await fs.writeFile(
      path.join(dataDir, 'completed.json'),
      JSON.stringify({
        tasks: [{ id: 'recent-task-1', file: 'completed/recent-task-1.json' }]
      })
    );

    // 30일 보관 정책으로 cleanup 실행
    const result = await logRotationModule.cleanupOldTaskFiles(dataDir, 30);

    expect(result.completed).toBe(0);

    // 파일이 남아있는지 확인
    const completedFiles = await fs.readdir(path.join(dataDir, 'completed'));
    expect(completedFiles).toContain('recent-task-1.json');
  });
});

describe('runCleanup', () => {
  test('전체 정리를 실행해야 함', async () => {
    const result = await logRotationModule.runCleanup(dataDir, 7, 30);

    expect(result).toHaveProperty('logs');
    expect(result).toHaveProperty('tasks');
    expect(result.logs).toHaveProperty('deleted');
    expect(result.logs).toHaveProperty('errors');
    expect(result.tasks).toHaveProperty('completed');
    expect(result.tasks).toHaveProperty('failed');
    expect(result.tasks).toHaveProperty('errors');
  });
});
