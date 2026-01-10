/**
 * tasks.js 단위 테스트
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// 테스트용 임시 디렉토리
let testDir;
let dataDir;

// 모듈 동적 import (테스트 환경 설정 후)
let tasksModule;
let configModule;
let i18nModule;

beforeAll(async () => {
  // 임시 디렉토리 생성
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-telegram-test-'));
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

  // i18n 모듈 import
  i18nModule = await import('../src/i18n.js');

  // tasks 모듈 import
  tasksModule = await import('../src/tasks.js');
});

afterAll(async () => {
  // 임시 디렉토리 삭제
  if (testDir) {
    await fs.rm(testDir, { recursive: true, force: true });
  }
});

describe('PRIORITY 상수', () => {
  test('올바른 우선순위 값을 가져야 함', () => {
    expect(tasksModule.PRIORITY.LOW).toBe(1);
    expect(tasksModule.PRIORITY.NORMAL).toBe(2);
    expect(tasksModule.PRIORITY.HIGH).toBe(3);
    expect(tasksModule.PRIORITY.URGENT).toBe(4);
  });
});

describe('createTask', () => {
  test('기본 우선순위로 작업을 생성해야 함', async () => {
    const task = await tasksModule.createTask({
      requirement: '테스트 요구사항',
      completionCriteria: '테스트 완료 조건',
      maxRetries: 5,
      workingDirectory: testDir
    });

    expect(task).toHaveProperty('id');
    expect(task.requirement).toBe('테스트 요구사항');
    expect(task.completionCriteria).toBe('테스트 완료 조건');
    expect(task.maxRetries).toBe(5);
    expect(task.currentRetry).toBe(0);
    expect(task.status).toBe('ready');
    expect(task.priority).toBe(tasksModule.PRIORITY.NORMAL);
    expect(task.workingDirectory).toBe(testDir);
  });

  test('지정된 우선순위로 작업을 생성해야 함', async () => {
    const task = await tasksModule.createTask({
      requirement: '긴급 작업',
      completionCriteria: '완료 조건',
      maxRetries: 10,
      workingDirectory: testDir,
      priority: tasksModule.PRIORITY.URGENT
    });

    expect(task.priority).toBe(tasksModule.PRIORITY.URGENT);
  });

  test('작업 파일이 생성되어야 함', async () => {
    const task = await tasksModule.createTask({
      requirement: '파일 확인용 작업',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir
    });

    const taskFile = path.join(dataDir, 'tasks', `${task.id}.json`);
    const content = await fs.readFile(taskFile, 'utf8');
    const savedTask = JSON.parse(content);

    expect(savedTask.id).toBe(task.id);
    expect(savedTask.requirement).toBe('파일 확인용 작업');
  });
});

describe('getNextTask', () => {
  beforeEach(async () => {
    // 기존 작업 초기화
    await tasksModule.resetAllData();
  });

  test('대기 작업이 없으면 null을 반환해야 함', async () => {
    const next = await tasksModule.getNextTask();
    expect(next).toBeNull();
  });

  test('우선순위가 높은 작업을 먼저 반환해야 함', async () => {
    // 낮은 우선순위 작업 먼저 생성
    await tasksModule.createTask({
      requirement: '낮은 우선순위',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir,
      priority: tasksModule.PRIORITY.LOW
    });

    // 약간의 지연 후 높은 우선순위 작업 생성
    await new Promise(resolve => setTimeout(resolve, 10));

    const highPriorityTask = await tasksModule.createTask({
      requirement: '높은 우선순위',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir,
      priority: tasksModule.PRIORITY.HIGH
    });

    const next = await tasksModule.getNextTask();
    expect(next.id).toBe(highPriorityTask.id);
    expect(next.priority).toBe(tasksModule.PRIORITY.HIGH);
  });

  test('같은 우선순위면 오래된 작업을 먼저 반환해야 함', async () => {
    const firstTask = await tasksModule.createTask({
      requirement: '첫 번째 작업',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir,
      priority: tasksModule.PRIORITY.NORMAL
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    await tasksModule.createTask({
      requirement: '두 번째 작업',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir,
      priority: tasksModule.PRIORITY.NORMAL
    });

    const next = await tasksModule.getNextTask();
    expect(next.id).toBe(firstTask.id);
  });
});

describe('getNextTasks (병렬 실행)', () => {
  beforeEach(async () => {
    await tasksModule.resetAllData();
  });

  test('대기 작업이 없으면 빈 배열을 반환해야 함', async () => {
    const tasks = await tasksModule.getNextTasks(3);
    expect(tasks).toEqual([]);
  });

  test('요청한 개수만큼 작업을 반환해야 함', async () => {
    // 3개 작업 생성
    for (let i = 0; i < 3; i++) {
      await tasksModule.createTask({
        requirement: `작업 ${i + 1}`,
        completionCriteria: '완료',
        maxRetries: 1,
        workingDirectory: testDir
      });
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const tasks = await tasksModule.getNextTasks(2);
    expect(tasks).toHaveLength(2);
  });

  test('요청한 개수보다 작업이 적으면 있는 만큼만 반환해야 함', async () => {
    await tasksModule.createTask({
      requirement: '유일한 작업',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir
    });

    const tasks = await tasksModule.getNextTasks(5);
    expect(tasks).toHaveLength(1);
  });

  test('우선순위 순서대로 작업을 반환해야 함', async () => {
    // 낮은 우선순위 먼저
    const lowTask = await tasksModule.createTask({
      requirement: '낮은 우선순위',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir,
      priority: tasksModule.PRIORITY.LOW
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    // 높은 우선순위
    const highTask = await tasksModule.createTask({
      requirement: '높은 우선순위',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir,
      priority: tasksModule.PRIORITY.HIGH
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    // 일반 우선순위
    const normalTask = await tasksModule.createTask({
      requirement: '일반 우선순위',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir,
      priority: tasksModule.PRIORITY.NORMAL
    });

    const tasks = await tasksModule.getNextTasks(3);
    expect(tasks[0].id).toBe(highTask.id);
    expect(tasks[1].id).toBe(normalTask.id);
    expect(tasks[2].id).toBe(lowTask.id);
  });

  test('기본값은 1개 작업을 반환해야 함', async () => {
    await tasksModule.createTask({
      requirement: '작업 1',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir
    });

    await tasksModule.createTask({
      requirement: '작업 2',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir
    });

    const tasks = await tasksModule.getNextTasks();
    expect(tasks).toHaveLength(1);
  });
});

describe('startTask', () => {
  beforeEach(async () => {
    await tasksModule.resetAllData();
  });

  test('작업 상태를 inProgress로 변경해야 함', async () => {
    const task = await tasksModule.createTask({
      requirement: '상태 테스트',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir
    });

    const startedTask = await tasksModule.startTask(task.id);

    expect(startedTask.status).toBe('inProgress');
    expect(startedTask.startedAt).not.toBeNull();
  });
});

describe('incrementRetry', () => {
  beforeEach(async () => {
    await tasksModule.resetAllData();
  });

  test('재시도 가능 시 canRetry가 true여야 함', async () => {
    const task = await tasksModule.createTask({
      requirement: '재시도 테스트',
      completionCriteria: '완료',
      maxRetries: 3,
      workingDirectory: testDir
    });

    const { task: updatedTask, canRetry } = await tasksModule.incrementRetry(task.id);

    expect(canRetry).toBe(true);
    expect(updatedTask.currentRetry).toBe(1);
    expect(updatedTask.status).toBe('ready');
  });

  test('최대 재시도 도달 시 canRetry가 false여야 함', async () => {
    const task = await tasksModule.createTask({
      requirement: '재시도 한계 테스트',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir
    });

    const { canRetry } = await tasksModule.incrementRetry(task.id);

    expect(canRetry).toBe(false);
  });
});

describe('completeTask', () => {
  beforeEach(async () => {
    await tasksModule.resetAllData();
  });

  test('작업을 완료 상태로 이동해야 함', async () => {
    const task = await tasksModule.createTask({
      requirement: '완료 테스트',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir
    });

    await tasksModule.startTask(task.id);
    await tasksModule.completeTask(task.id, '성공적으로 완료됨');

    // tasks.json에서 제거되었는지 확인
    const tasksIndex = await tasksModule.loadTasksIndex();
    expect(tasksIndex.tasks.find(t => t.id === task.id)).toBeUndefined();

    // completed.json에 추가되었는지 확인
    const completedTasks = await tasksModule.getCompletedTasks();
    expect(completedTasks.find(t => t.id === task.id)).toBeDefined();
  });
});

describe('failTask', () => {
  beforeEach(async () => {
    await tasksModule.resetAllData();
  });

  test('작업을 실패 상태로 이동해야 함', async () => {
    const task = await tasksModule.createTask({
      requirement: '실패 테스트',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir
    });

    await tasksModule.startTask(task.id);
    await tasksModule.failTask(task.id, '테스트 실패 이유');

    // tasks.json에서 제거되었는지 확인
    const tasksIndex = await tasksModule.loadTasksIndex();
    expect(tasksIndex.tasks.find(t => t.id === task.id)).toBeUndefined();

    // failed.json에 추가되었는지 확인
    const failedTasks = await tasksModule.getFailedTasks();
    const failedTask = failedTasks.find(t => t.id === task.id);
    expect(failedTask).toBeDefined();
    expect(failedTask.summary).toBe('테스트 실패 이유');
  });
});

describe('cancelTask', () => {
  beforeEach(async () => {
    await tasksModule.resetAllData();
  });

  test('작업을 취소하고 실패 상태로 이동해야 함', async () => {
    const task = await tasksModule.createTask({
      requirement: '취소 테스트',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir
    });

    await tasksModule.cancelTask(task.id);

    const failedTasks = await tasksModule.getFailedTasks();
    const cancelledTask = failedTasks.find(t => t.id === task.id);
    expect(cancelledTask).toBeDefined();
    expect(cancelledTask.summary).toBe(i18nModule.t('tasks.cancelled_by_user'));
  });
});

describe('cleanupOrphanTasks', () => {
  beforeEach(async () => {
    await tasksModule.resetAllData();
  });

  test('inProgress 상태 작업을 ready로 리셋해야 함', async () => {
    const task = await tasksModule.createTask({
      requirement: 'orphan 테스트',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir
    });

    await tasksModule.startTask(task.id);

    // inProgress 상태 확인
    const beforeCleanup = await tasksModule.loadTask(task.id);
    expect(beforeCleanup.status).toBe('inProgress');

    // cleanup 실행
    const cleaned = await tasksModule.cleanupOrphanTasks();

    expect(cleaned).toBe(1);

    // ready 상태로 변경되었는지 확인
    const afterCleanup = await tasksModule.loadTask(task.id);
    expect(afterCleanup.status).toBe('ready');
    expect(afterCleanup.startedAt).toBeNull();
  });
});
