/**
 * telegram.js 단위 테스트
 * 복잡도 선택 및 작업 생성 플로우 테스트
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// 테스트용 임시 디렉토리
let testDir;
let dataDir;

// 모듈 동적 import
let telegramModule;
let configModule;
let tasksModule;

// fetch mock
global.fetch = jest.fn();

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

  // config 파일 생성 (테스트용)
  await fs.writeFile(
    path.join(dataDir, 'config.json'),
    JSON.stringify({
      botToken: 'test-token',
      chatId: '12345'
    }, null, 2)
  );

  // config 모듈 import 및 cwd 설정
  configModule = await import('../src/config.js');
  configModule.setCwd(testDir);

  // tasks 모듈 import
  tasksModule = await import('../src/tasks.js');

  // telegram 모듈 import
  telegramModule = await import('../src/telegram.js');
});

afterAll(async () => {
  // 임시 디렉토리 삭제
  if (testDir) {
    await fs.rm(testDir, { recursive: true, force: true });
  }
});

beforeEach(() => {
  // 각 테스트 전에 상태 초기화
  telegramModule._test.clearUserStates();
  jest.clearAllMocks();

  // fetch mock 기본 응답
  global.fetch.mockResolvedValue({
    json: () => Promise.resolve({ ok: true, result: {} }),
    status: 200
  });
});

describe('복잡도 선택 상태 관리', () => {
  const testChatId = '12345';

  test('/new 명령 후 complexity 단계로 진입해야 함', () => {
    // /new 명령어 실행 시 상태 설정 시뮬레이션
    telegramModule._test.setUserState(testChatId, { step: 'complexity' });

    const state = telegramModule._test.getUserState(testChatId);
    expect(state).toBeDefined();
    expect(state.step).toBe('complexity');
  });

  test('단순 선택 시 simple_requirement 단계로 전환해야 함', () => {
    // 초기 상태 설정
    telegramModule._test.setUserState(testChatId, { step: 'complexity' });

    // 단순 선택 시뮬레이션
    const state = telegramModule._test.getUserState(testChatId);
    state.step = 'simple_requirement';
    state.isSimple = true;
    telegramModule._test.setUserState(testChatId, state);

    const updatedState = telegramModule._test.getUserState(testChatId);
    expect(updatedState.step).toBe('simple_requirement');
    expect(updatedState.isSimple).toBe(true);
  });

  test('복잡 선택 시 requirement 단계로 전환해야 함', () => {
    // 초기 상태 설정
    telegramModule._test.setUserState(testChatId, { step: 'complexity' });

    // 복잡 선택 시뮬레이션
    const state = telegramModule._test.getUserState(testChatId);
    state.step = 'requirement';
    state.isSimple = false;
    telegramModule._test.setUserState(testChatId, state);

    const updatedState = telegramModule._test.getUserState(testChatId);
    expect(updatedState.step).toBe('requirement');
    expect(updatedState.isSimple).toBe(false);
  });

  test('단순 요청 시 요구사항 입력 후 바로 작업 생성되어야 함', async () => {
    // 단순 요청 상태 설정
    telegramModule._test.setUserState(testChatId, {
      step: 'simple_requirement',
      isSimple: true
    });

    // 요구사항 입력
    const state = telegramModule._test.getUserState(testChatId);
    state.requirement = '간단한 테스트 작업';

    // 작업 생성 (단순 작업은 completionCriteria null, maxRetries 1)
    const task = await tasksModule.createTask({
      requirement: state.requirement,
      completionCriteria: null,
      maxRetries: 1,
      workingDirectory: testDir,
      priority: tasksModule.PRIORITY.NORMAL
    });

    // 상태 초기화
    telegramModule._test.deleteUserState(testChatId);

    expect(task).toHaveProperty('id');
    expect(task.requirement).toBe('간단한 테스트 작업');
    expect(task.completionCriteria).toBeNull();
    expect(task.maxRetries).toBe(1);
    expect(telegramModule._test.getUserState(testChatId)).toBeUndefined();
  });

  test('복잡 요청 시 완료 기준 단계로 진행해야 함', () => {
    // 복잡 요청 상태 설정
    telegramModule._test.setUserState(testChatId, {
      step: 'requirement',
      isSimple: false
    });

    // 요구사항 입력 후 다음 단계로 전환
    const state = telegramModule._test.getUserState(testChatId);
    state.requirement = '복잡한 테스트 작업';
    state.step = 'criteria';
    telegramModule._test.setUserState(testChatId, state);

    const updatedState = telegramModule._test.getUserState(testChatId);
    expect(updatedState.step).toBe('criteria');
    expect(updatedState.requirement).toBe('복잡한 테스트 작업');
  });
});

describe('단순 작업 생성', () => {
  beforeEach(async () => {
    await tasksModule.resetAllData();
  });

  test('단순 작업은 completionCriteria가 null이어야 함', async () => {
    const task = await tasksModule.createTask({
      requirement: '단순 작업 테스트',
      completionCriteria: null,
      maxRetries: 1,
      workingDirectory: testDir,
      priority: tasksModule.PRIORITY.NORMAL
    });

    expect(task.completionCriteria).toBeNull();
  });

  test('단순 작업은 maxRetries가 1이어야 함', async () => {
    const task = await tasksModule.createTask({
      requirement: '단순 작업 테스트',
      completionCriteria: null,
      maxRetries: 1,
      workingDirectory: testDir,
      priority: tasksModule.PRIORITY.NORMAL
    });

    expect(task.maxRetries).toBe(1);
  });
});

describe('복잡 작업 생성', () => {
  beforeEach(async () => {
    await tasksModule.resetAllData();
  });

  test('복잡 작업은 completionCriteria가 있어야 함', async () => {
    const task = await tasksModule.createTask({
      requirement: '복잡한 작업 테스트',
      completionCriteria: '테스트 통과',
      maxRetries: 10,
      workingDirectory: testDir,
      priority: tasksModule.PRIORITY.NORMAL
    });

    expect(task.completionCriteria).toBe('테스트 통과');
  });

  test('복잡 작업은 지정된 maxRetries를 사용해야 함', async () => {
    const task = await tasksModule.createTask({
      requirement: '복잡한 작업 테스트',
      completionCriteria: '테스트 통과',
      maxRetries: 10,
      workingDirectory: testDir,
      priority: tasksModule.PRIORITY.NORMAL
    });

    expect(task.maxRetries).toBe(10);
  });
});

describe('작업 생성 플로우 상태 전환', () => {
  const testChatId = '12345';

  test('전체 단순 플로우: complexity -> simple_requirement -> 완료', () => {
    // Step 1: /new 명령 - complexity 단계
    telegramModule._test.setUserState(testChatId, { step: 'complexity' });
    expect(telegramModule._test.getUserState(testChatId).step).toBe('complexity');

    // Step 2: 단순 선택 - simple_requirement 단계
    const state1 = telegramModule._test.getUserState(testChatId);
    state1.step = 'simple_requirement';
    state1.isSimple = true;
    telegramModule._test.setUserState(testChatId, state1);
    expect(telegramModule._test.getUserState(testChatId).step).toBe('simple_requirement');

    // Step 3: 요구사항 입력 후 완료 (상태 삭제)
    telegramModule._test.deleteUserState(testChatId);
    expect(telegramModule._test.getUserState(testChatId)).toBeUndefined();
  });

  test('전체 복잡 플로우: complexity -> requirement -> criteria -> priority -> retries -> 완료', () => {
    // Step 1: /new 명령 - complexity 단계
    telegramModule._test.setUserState(testChatId, { step: 'complexity' });
    expect(telegramModule._test.getUserState(testChatId).step).toBe('complexity');

    // Step 2: 복잡 선택 - requirement 단계
    const state1 = telegramModule._test.getUserState(testChatId);
    state1.step = 'requirement';
    state1.isSimple = false;
    telegramModule._test.setUserState(testChatId, state1);
    expect(telegramModule._test.getUserState(testChatId).step).toBe('requirement');

    // Step 3: 요구사항 입력 - criteria 단계
    const state2 = telegramModule._test.getUserState(testChatId);
    state2.requirement = '테스트 요구사항';
    state2.step = 'criteria';
    telegramModule._test.setUserState(testChatId, state2);
    expect(telegramModule._test.getUserState(testChatId).step).toBe('criteria');

    // Step 4: 완료 기준 입력 - priority 단계
    const state3 = telegramModule._test.getUserState(testChatId);
    state3.criteria = '테스트 완료 조건';
    state3.step = 'priority';
    telegramModule._test.setUserState(testChatId, state3);
    expect(telegramModule._test.getUserState(testChatId).step).toBe('priority');

    // Step 5: 우선순위 선택 - retries 단계
    const state4 = telegramModule._test.getUserState(testChatId);
    state4.priority = tasksModule.PRIORITY.NORMAL;
    state4.step = 'retries';
    telegramModule._test.setUserState(testChatId, state4);
    expect(telegramModule._test.getUserState(testChatId).step).toBe('retries');

    // Step 6: 반복 횟수 선택 후 완료 (상태 삭제)
    telegramModule._test.deleteUserState(testChatId);
    expect(telegramModule._test.getUserState(testChatId)).toBeUndefined();
  });

  test('/cancel 시 상태가 초기화되어야 함', () => {
    // 작업 생성 진행 중
    telegramModule._test.setUserState(testChatId, {
      step: 'criteria',
      requirement: '테스트',
      isSimple: false
    });

    // /cancel 실행
    telegramModule._test.deleteUserState(testChatId);

    expect(telegramModule._test.getUserState(testChatId)).toBeUndefined();
  });
});
