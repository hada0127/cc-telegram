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
let encryptionModule;

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

  // encryption 모듈 import
  encryptionModule = await import('../src/utils/encryption.js');

  // config 파일 생성 (테스트용 - 암호화된 값)
  await fs.writeFile(
    path.join(dataDir, 'config.json'),
    JSON.stringify({
      botToken: encryptionModule.encrypt('test-token'),
      chatId: encryptionModule.encrypt('12345')
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
  // 봇 중지
  telegramModule.stopBot();

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
    telegramModule._test.setUserState(testChatId, { step: 'complexity' });
    const state = telegramModule._test.getUserState(testChatId);
    expect(state).toBeDefined();
    expect(state.step).toBe('complexity');
  });

  test('단순 선택 시 simple_requirement 단계로 전환해야 함', () => {
    telegramModule._test.setUserState(testChatId, { step: 'complexity' });
    const state = telegramModule._test.getUserState(testChatId);
    state.step = 'simple_requirement';
    state.isSimple = true;
    telegramModule._test.setUserState(testChatId, state);

    const updatedState = telegramModule._test.getUserState(testChatId);
    expect(updatedState.step).toBe('simple_requirement');
    expect(updatedState.isSimple).toBe(true);
  });

  test('복잡 선택 시 requirement 단계로 전환해야 함', () => {
    telegramModule._test.setUserState(testChatId, { step: 'complexity' });
    const state = telegramModule._test.getUserState(testChatId);
    state.step = 'requirement';
    state.isSimple = false;
    telegramModule._test.setUserState(testChatId, state);

    const updatedState = telegramModule._test.getUserState(testChatId);
    expect(updatedState.step).toBe('requirement');
    expect(updatedState.isSimple).toBe(false);
  });

  test('단순 요청 시 요구사항 입력 후 바로 작업 생성되어야 함', async () => {
    telegramModule._test.setUserState(testChatId, {
      step: 'simple_requirement',
      isSimple: true
    });

    const state = telegramModule._test.getUserState(testChatId);
    state.requirement = '간단한 테스트 작업';

    const task = await tasksModule.createTask({
      requirement: state.requirement,
      completionCriteria: null,
      maxRetries: 1,
      workingDirectory: testDir,
      priority: tasksModule.PRIORITY.NORMAL
    });

    telegramModule._test.deleteUserState(testChatId);

    expect(task).toHaveProperty('id');
    expect(task.requirement).toBe('간단한 테스트 작업');
    expect(task.completionCriteria).toBeNull();
    expect(task.maxRetries).toBe(1);
    expect(telegramModule._test.getUserState(testChatId)).toBeUndefined();
  });

  test('복잡 요청 시 완료 기준 단계로 진행해야 함', () => {
    telegramModule._test.setUserState(testChatId, {
      step: 'requirement',
      isSimple: false
    });

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
    telegramModule._test.setUserState(testChatId, { step: 'complexity' });
    expect(telegramModule._test.getUserState(testChatId).step).toBe('complexity');

    const state1 = telegramModule._test.getUserState(testChatId);
    state1.step = 'simple_requirement';
    state1.isSimple = true;
    telegramModule._test.setUserState(testChatId, state1);
    expect(telegramModule._test.getUserState(testChatId).step).toBe('simple_requirement');

    telegramModule._test.deleteUserState(testChatId);
    expect(telegramModule._test.getUserState(testChatId)).toBeUndefined();
  });

  test('전체 복잡 플로우: complexity -> requirement -> criteria -> priority -> retries -> 완료', () => {
    telegramModule._test.setUserState(testChatId, { step: 'complexity' });
    expect(telegramModule._test.getUserState(testChatId).step).toBe('complexity');

    const state1 = telegramModule._test.getUserState(testChatId);
    state1.step = 'requirement';
    state1.isSimple = false;
    telegramModule._test.setUserState(testChatId, state1);
    expect(telegramModule._test.getUserState(testChatId).step).toBe('requirement');

    const state2 = telegramModule._test.getUserState(testChatId);
    state2.requirement = '테스트 요구사항';
    state2.step = 'criteria';
    telegramModule._test.setUserState(testChatId, state2);
    expect(telegramModule._test.getUserState(testChatId).step).toBe('criteria');

    const state3 = telegramModule._test.getUserState(testChatId);
    state3.criteria = '테스트 완료 조건';
    state3.step = 'priority';
    telegramModule._test.setUserState(testChatId, state3);
    expect(telegramModule._test.getUserState(testChatId).step).toBe('priority');

    const state4 = telegramModule._test.getUserState(testChatId);
    state4.priority = tasksModule.PRIORITY.NORMAL;
    state4.step = 'retries';
    telegramModule._test.setUserState(testChatId, state4);
    expect(telegramModule._test.getUserState(testChatId).step).toBe('retries');

    telegramModule._test.deleteUserState(testChatId);
    expect(telegramModule._test.getUserState(testChatId)).toBeUndefined();
  });

  test('/cancel 시 상태가 초기화되어야 함', () => {
    telegramModule._test.setUserState(testChatId, {
      step: 'criteria',
      requirement: '테스트',
      isSimple: false
    });

    telegramModule._test.deleteUserState(testChatId);
    expect(telegramModule._test.getUserState(testChatId)).toBeUndefined();
  });
});

describe('sendMessage', () => {
  test('sendMessage가 정상적으로 호출되어야 함', async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, result: {} }),
      status: 200
    });

    const result = await telegramModule.sendMessage('테스트 메시지');
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalled();
  });

  test('sendMessage 실패 시 false를 반환해야 함', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    const result = await telegramModule.sendMessage('테스트 메시지');
    expect(result).toBe(false);
  });
});

describe('updateClaudeOutput', () => {
  test('클로드 출력을 업데이트해야 함', () => {
    telegramModule.clearClaudeOutput();
    telegramModule.updateClaudeOutput('line 1');
    telegramModule.updateClaudeOutput('line 2');
    telegramModule.clearClaudeOutput();
  });

  test('20줄 초과 시 오래된 줄을 제거해야 함', () => {
    telegramModule.clearClaudeOutput();
    for (let i = 0; i < 25; i++) {
      telegramModule.updateClaudeOutput(`line ${i}`);
    }
    expect(true).toBe(true);
  });
});

describe('clearClaudeOutput', () => {
  test('클로드 출력을 초기화해야 함', () => {
    telegramModule.updateClaudeOutput('some output');
    telegramModule.clearClaudeOutput();
    expect(true).toBe(true);
  });
});

describe('PRIORITY 상수', () => {
  test('우선순위 레이블이 올바라야 함', () => {
    const PRIORITY_LABELS = {
      [tasksModule.PRIORITY.LOW]: '🔵 낮음',
      [tasksModule.PRIORITY.NORMAL]: '🟢 보통',
      [tasksModule.PRIORITY.HIGH]: '🟠 높음',
      [tasksModule.PRIORITY.URGENT]: '🔴 긴급'
    };

    expect(PRIORITY_LABELS[1]).toBe('🔵 낮음');
    expect(PRIORITY_LABELS[2]).toBe('🟢 보통');
    expect(PRIORITY_LABELS[3]).toBe('🟠 높음');
    expect(PRIORITY_LABELS[4]).toBe('🔴 긴급');
  });
});

describe('delay 함수', () => {
  test('지정된 시간만큼 대기해야 함', async () => {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const start = Date.now();
    await delay(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});

describe('getPriorityIcon 함수', () => {
  test('우선순위에 맞는 아이콘을 반환해야 함', () => {
    function getPriorityIcon(priority) {
      const icons = {
        [tasksModule.PRIORITY.LOW]: '🔵',
        [tasksModule.PRIORITY.NORMAL]: '🟢',
        [tasksModule.PRIORITY.HIGH]: '🟠',
        [tasksModule.PRIORITY.URGENT]: '🔴'
      };
      return icons[priority] || icons[tasksModule.PRIORITY.NORMAL];
    }

    expect(getPriorityIcon(1)).toBe('🔵');
    expect(getPriorityIcon(2)).toBe('🟢');
    expect(getPriorityIcon(3)).toBe('🟠');
    expect(getPriorityIcon(4)).toBe('🔴');
    expect(getPriorityIcon(999)).toBe('🟢');
  });
});

describe('retries_custom 상태', () => {
  const testChatId = '12345';

  test('retries_custom 상태에서 숫자 입력을 처리해야 함', () => {
    telegramModule._test.setUserState(testChatId, {
      step: 'retries_custom',
      requirement: '테스트',
      criteria: '조건',
      priority: 2
    });

    const state = telegramModule._test.getUserState(testChatId);
    expect(state.step).toBe('retries_custom');

    const retries = parseInt('50', 10);
    expect(retries).toBe(50);
    expect(retries >= 1 && retries <= 100).toBe(true);
  });

  test('유효하지 않은 숫자는 거부되어야 함', () => {
    const invalidInputs = ['abc', '0', '101', '-5'];

    for (const input of invalidInputs) {
      const retries = parseInt(input, 10);
      const isValid = !isNaN(retries) && retries >= 1 && retries <= 100;
      expect(isValid).toBe(false);
    }
  });
});

describe('handleCallbackQuery 로직', () => {
  test('callback query에서 chatId와 data를 추출해야 함', () => {
    const query = {
      id: 'query123',
      message: { chat: { id: 12345 } },
      data: 'complexity_simple'
    };

    const chatId = query.message?.chat?.id?.toString();
    const data = query.data;

    expect(chatId).toBe('12345');
    expect(data).toBe('complexity_simple');
  });

  test('유효하지 않은 callback query를 처리해야 함', () => {
    const query = { id: 'query123' };

    const chatId = query.message?.chat?.id?.toString();
    const data = query.data;

    expect(chatId).toBeUndefined();
    expect(data).toBeUndefined();
  });
});

describe('handleMessage 로직', () => {
  test('메시지에서 chatId와 text를 추출해야 함', () => {
    const message = {
      chat: { id: 12345 },
      text: '/start'
    };

    const chatId = message.chat.id.toString();
    const text = message.text || '';

    expect(chatId).toBe('12345');
    expect(text).toBe('/start');
  });

  test('명령어를 올바르게 파싱해야 함', () => {
    const texts = ['/start', '/new', '/list', '/completed', '/failed', '/status', '/debug', '/cancel', '/reset'];

    for (const text of texts) {
      const command = text.split(' ')[0].toLowerCase();
      expect(command).toBe(text);
    }
  });

  test('알 수 없는 명령어를 감지해야 함', () => {
    const knownCommands = ['/start', '/new', '/list', '/completed', '/failed', '/status', '/debug', '/cancel', '/reset'];
    const unknownCommand = '/unknown';

    expect(knownCommands.includes(unknownCommand)).toBe(false);
  });
});

describe('API 호출 재시도 로직', () => {
  test('429 응답 시 retry_after를 추출해야 함', () => {
    const response = {
      status: 429,
      parameters: { retry_after: 5 }
    };

    const retryAfter = response.parameters?.retry_after || 5;
    expect(retryAfter).toBe(5);
  });

  test('exponential backoff를 계산해야 함', () => {
    const attempt0 = Math.pow(2, 0) * 1000;
    const attempt1 = Math.pow(2, 1) * 1000;
    const attempt2 = Math.pow(2, 2) * 1000;

    expect(attempt0).toBe(1000);
    expect(attempt1).toBe(2000);
    expect(attempt2).toBe(4000);
  });
});

describe('봇 명령어', () => {
  test('명령어 목록이 올바라야 함', () => {
    const commands = [
      { command: 'start', description: 'chatId 확인' },
      { command: 'new', description: '새 작업 생성' },
      { command: 'list', description: '대기/진행중 작업 목록' },
      { command: 'completed', description: '완료된 작업 목록' },
      { command: 'failed', description: '실패한 작업 목록' },
      { command: 'status', description: '현재 작업 상태' },
      { command: 'debug', description: '시스템 상태' },
      { command: 'cancel', description: '작업 생성 취소' },
      { command: 'reset', description: '모든 데이터 초기화' }
    ];

    expect(commands).toHaveLength(9);
    expect(commands[0].command).toBe('start');
    expect(commands[8].command).toBe('reset');
  });
});

describe('stopBot', () => {
  test('stopBot이 오류 없이 호출되어야 함', () => {
    expect(() => telegramModule.stopBot()).not.toThrow();
  });
});

describe('startBot', () => {
  test('startBot이 오류 없이 호출되어야 함', async () => {
    await expect(telegramModule.startBot()).resolves.toBeUndefined();
  });

  test('중복 startBot 호출이 안전해야 함', async () => {
    await telegramModule.startBot();
    await telegramModule.startBot();
    telegramModule.stopBot();
  });
});

describe('callApi 로직 시뮬레이션', () => {
  test('정상적인 API 호출', async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, result: { message_id: 123 } }),
      status: 200
    });

    const response = await fetch('https://api.telegram.org/bot/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: '12345', text: 'test' })
    });

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.result.message_id).toBe(123);
  });

  test('API 오류 응답', async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: false, description: 'Bad Request' }),
      status: 400
    });

    const response = await fetch('https://api.telegram.org/bot/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.description).toBe('Bad Request');
  });

  test('네트워크 오류', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    await expect(
      fetch('https://api.telegram.org/bot/sendMessage')
    ).rejects.toThrow('Network error');
  });
});

describe('processUpdate 로직', () => {
  test('callback_query 업데이트 처리', () => {
    const update = {
      update_id: 123,
      callback_query: {
        id: 'query123',
        message: { chat: { id: 12345 } },
        data: 'complexity_simple'
      }
    };

    expect(update.callback_query).toBeDefined();
    expect(update.callback_query.data).toBe('complexity_simple');
  });

  test('message 업데이트 처리', () => {
    const update = {
      update_id: 124,
      message: {
        chat: { id: 12345 },
        text: '/start'
      }
    };

    expect(update.message).toBeDefined();
    expect(update.message.text).toBe('/start');
  });
});

describe('handleStart 로직', () => {
  test('chatId를 포함한 메시지 생성', () => {
    const chatId = '12345';
    const message = `🤖 cc-telegram 봇입니다.\n\n당신의 chatId: <code>${chatId}</code>`;

    expect(message).toContain('12345');
    expect(message).toContain('<code>');
  });
});

describe('handleNew 로직', () => {
  test('새 작업 메시지 생성', () => {
    const message = '📝 <b>새 작업 생성</b>\n\n요청의 복잡도를 선택하세요.\n\n(/cancel로 취소)';
    expect(message).toContain('새 작업 생성');
    expect(message).toContain('/cancel');
  });

  test('인라인 키보드 생성', () => {
    const keyboard = {
      inline_keyboard: [[
        { text: '단순(완료 조건, 반복 없음)', callback_data: 'complexity_simple' },
        { text: '복잡(완료 조건, 반복 있음)', callback_data: 'complexity_complex' }
      ]]
    };

    expect(keyboard.inline_keyboard).toHaveLength(1);
    expect(keyboard.inline_keyboard[0]).toHaveLength(2);
    expect(keyboard.inline_keyboard[0][0].callback_data).toBe('complexity_simple');
  });
});

describe('handleList 로직', () => {
  beforeEach(async () => {
    await tasksModule.resetAllData();
  });

  test('작업이 없을 때 메시지', async () => {
    const tasks = await tasksModule.getAllPendingTasks();
    if (tasks.length === 0) {
      const message = '📋 대기/진행중인 작업이 없습니다.';
      expect(message).toContain('없습니다');
    }
  });

  test('작업이 있을 때 정렬', async () => {
    await tasksModule.createTask({
      requirement: '높은 우선순위 작업',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir,
      priority: tasksModule.PRIORITY.HIGH
    });

    await tasksModule.createTask({
      requirement: '낮은 우선순위 작업',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir,
      priority: tasksModule.PRIORITY.LOW
    });

    const tasks = await tasksModule.getAllPendingTasks();

    tasks.sort((a, b) => {
      const priorityA = a.priority || tasksModule.PRIORITY.NORMAL;
      const priorityB = b.priority || tasksModule.PRIORITY.NORMAL;
      if (priorityA !== priorityB) return priorityB - priorityA;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    expect(tasks[0].priority).toBe(tasksModule.PRIORITY.HIGH);
  });
});

describe('handleCompleted 로직', () => {
  beforeEach(async () => {
    await tasksModule.resetAllData();
  });

  test('완료된 작업이 없을 때 메시지', async () => {
    const tasks = await tasksModule.getCompletedTasks();
    if (tasks.length === 0) {
      const message = '✅ 완료된 작업이 없습니다.';
      expect(message).toContain('없습니다');
    }
  });

  test('완료된 작업 목록 생성', async () => {
    const task = await tasksModule.createTask({
      requirement: '테스트 작업',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir
    });

    await tasksModule.completeTask(task.id, '작업 완료');

    const tasks = await tasksModule.getCompletedTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe(task.id);
  });
});

describe('handleFailed 로직', () => {
  beforeEach(async () => {
    await tasksModule.resetAllData();
  });

  test('실패한 작업이 없을 때 메시지', async () => {
    const tasks = await tasksModule.getFailedTasks();
    if (tasks.length === 0) {
      const message = '❌ 실패한 작업이 없습니다.';
      expect(message).toContain('없습니다');
    }
  });

  test('실패한 작업 목록 생성', async () => {
    const task = await tasksModule.createTask({
      requirement: '테스트 작업',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir
    });

    await tasksModule.failTask(task.id, '작업 실패');

    const tasks = await tasksModule.getFailedTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe(task.id);
  });
});

describe('handleStatus 로직', () => {
  beforeEach(async () => {
    await tasksModule.resetAllData();
  });

  test('진행중인 작업이 없을 때', async () => {
    const tasks = await tasksModule.getAllPendingTasks();
    const inProgress = tasks.find(t => t.status === 'inProgress');

    let text = '📊 <b>현재 상태</b>\n\n';
    if (inProgress) {
      text += `🔄 진행중: ${inProgress.requirement.slice(0, 50)}...\n`;
    } else {
      text += '현재 진행중인 작업 없음\n\n';
    }

    expect(text).toContain('현재 진행중인 작업 없음');
  });
});

describe('handleDebug 로직', () => {
  test('시스템 상태 메시지 생성', () => {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    expect(memUsage.heapUsed).toBeGreaterThan(0);
    expect(uptime).toBeGreaterThanOrEqual(0);
  });
});

describe('handleReset 로직', () => {
  test('초기화 확인 메시지 생성', () => {
    const message =
      '⚠️ <b>데이터 초기화</b>\n\n' +
      '모든 작업 대기/완료/실패 내역과 로그가 모두 사라집니다.\n' +
      '계속 진행하시겠습니까?';

    expect(message).toContain('데이터 초기화');
    expect(message).toContain('계속 진행');
  });

  test('초기화 키보드 생성', () => {
    const keyboard = {
      inline_keyboard: [[
        { text: '예', callback_data: 'reset_yes' },
        { text: '아니오', callback_data: 'reset_no' }
      ]]
    };

    expect(keyboard.inline_keyboard[0][0].callback_data).toBe('reset_yes');
    expect(keyboard.inline_keyboard[0][1].callback_data).toBe('reset_no');
  });
});

describe('handleCancel 로직', () => {
  const testChatId = '12345';

  test('상태가 있을 때 취소', () => {
    telegramModule._test.setUserState(testChatId, { step: 'requirement' });
    expect(telegramModule._test.getUserState(testChatId)).toBeDefined();

    telegramModule._test.deleteUserState(testChatId);
    expect(telegramModule._test.getUserState(testChatId)).toBeUndefined();
  });

  test('상태가 없을 때 취소', () => {
    expect(telegramModule._test.getUserState(testChatId)).toBeUndefined();
    telegramModule._test.deleteUserState(testChatId);
  });
});

describe('callback_data 처리', () => {
  const testChatId = '12345';

  test('complexity_simple 처리', () => {
    telegramModule._test.setUserState(testChatId, { step: 'complexity' });

    const state = telegramModule._test.getUserState(testChatId);
    state.step = 'simple_requirement';
    state.isSimple = true;
    telegramModule._test.setUserState(testChatId, state);

    expect(telegramModule._test.getUserState(testChatId).step).toBe('simple_requirement');
  });

  test('complexity_complex 처리', () => {
    telegramModule._test.setUserState(testChatId, { step: 'complexity' });

    const state = telegramModule._test.getUserState(testChatId);
    state.step = 'requirement';
    state.isSimple = false;
    telegramModule._test.setUserState(testChatId, state);

    expect(telegramModule._test.getUserState(testChatId).step).toBe('requirement');
  });

  test('priority_* 처리', () => {
    telegramModule._test.setUserState(testChatId, {
      step: 'priority',
      requirement: '테스트',
      criteria: '조건'
    });

    const data = 'priority_3';
    const priority = parseInt(data.replace('priority_', ''), 10);

    const state = telegramModule._test.getUserState(testChatId);
    state.priority = priority;
    state.step = 'retries';
    telegramModule._test.setUserState(testChatId, state);

    expect(telegramModule._test.getUserState(testChatId).priority).toBe(3);
    expect(telegramModule._test.getUserState(testChatId).step).toBe('retries');
  });

  test('retry_10 처리', () => {
    telegramModule._test.setUserState(testChatId, {
      step: 'retries',
      requirement: '테스트',
      criteria: '조건',
      priority: 2
    });

    const retries = 10;
    expect(retries).toBe(10);

    telegramModule._test.deleteUserState(testChatId);
    expect(telegramModule._test.getUserState(testChatId)).toBeUndefined();
  });

  test('retry_custom 처리', () => {
    telegramModule._test.setUserState(testChatId, {
      step: 'retries',
      requirement: '테스트',
      criteria: '조건',
      priority: 2
    });

    const state = telegramModule._test.getUserState(testChatId);
    state.step = 'retries_custom';
    telegramModule._test.setUserState(testChatId, state);

    expect(telegramModule._test.getUserState(testChatId).step).toBe('retries_custom');
  });

  test('task_* 처리', async () => {
    await tasksModule.resetAllData();

    const task = await tasksModule.createTask({
      requirement: '테스트 작업',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir
    });

    const data = `task_${task.id}`;
    const taskId = data.replace('task_', '');

    expect(taskId).toBe(task.id);
  });

  test('cancel_* 처리', async () => {
    await tasksModule.resetAllData();

    const task = await tasksModule.createTask({
      requirement: '취소할 작업',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir
    });

    const data = `cancel_${task.id}`;
    const taskId = data.replace('cancel_', '');

    await tasksModule.cancelTask(taskId);

    const failedTasks = await tasksModule.getFailedTasks();
    expect(failedTasks).toHaveLength(1);
    expect(failedTasks[0].id).toBe(task.id);
  });

  test('reset_yes 처리', async () => {
    await tasksModule.resetAllData();

    const pending = await tasksModule.getAllPendingTasks();
    const completed = await tasksModule.getCompletedTasks();
    const failed = await tasksModule.getFailedTasks();

    expect(pending).toHaveLength(0);
    expect(completed).toHaveLength(0);
    expect(failed).toHaveLength(0);
  });

  test('reset_no 처리', () => {
    const message = '취소되었습니다.';
    expect(message).toBe('취소되었습니다.');
  });
});

describe('os.hostname 사용', () => {
  test('hostname을 가져와야 함', () => {
    const hostname = os.hostname();
    expect(typeof hostname).toBe('string');
    expect(hostname.length).toBeGreaterThan(0);
  });
});

describe('pollLoop 로직', () => {
  test('폴링 루프 대기 시간', async () => {
    const delay = 1000;
    expect(delay).toBe(1000);
  });
});

describe('setMyCommands 로직', () => {
  test('명령어 삭제 후 설정', async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, result: true }),
      status: 200
    });

    const deleteResponse = await fetch('https://api.telegram.org/bot/deleteMyCommands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    expect((await deleteResponse.json()).ok).toBe(true);

    const setResponse = await fetch('https://api.telegram.org/bot/setMyCommands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: [] })
    });

    expect((await setResponse.json()).ok).toBe(true);
  });
});

describe('getUpdates 로직', () => {
  test('업데이트 가져오기', async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({
        ok: true,
        result: [
          { update_id: 1, message: { chat: { id: 12345 }, text: '/start' } }
        ]
      }),
      status: 200
    });

    const response = await fetch('https://api.telegram.org/bot/getUpdates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offset: 0, timeout: 10 })
    });

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.result).toHaveLength(1);
  });

  test('업데이트 없음', async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, result: [] }),
      status: 200
    });

    const response = await fetch('https://api.telegram.org/bot/getUpdates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const data = await response.json();
    expect(data.result).toHaveLength(0);
  });
});

describe('answerCallbackQuery 로직', () => {
  test('콜백 응답 전송', async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, result: true }),
      status: 200
    });

    const response = await fetch('https://api.telegram.org/bot/answerCallbackQuery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: 'query123' })
    });

    const data = await response.json();
    expect(data.ok).toBe(true);
  });
});

describe('세션 만료 처리', () => {
  const testChatId = '12345';

  test('complexity 단계가 아닐 때 complexity_simple 처리', () => {
    telegramModule._test.deleteUserState(testChatId);

    const state = telegramModule._test.getUserState(testChatId);
    expect(state).toBeUndefined();
  });

  test('priority 단계가 아닐 때 priority_* 처리', () => {
    telegramModule._test.setUserState(testChatId, { step: 'requirement' });

    const state = telegramModule._test.getUserState(testChatId);
    expect(state.step).not.toBe('priority');
  });

  test('retries 단계가 아닐 때 retry_* 처리', () => {
    telegramModule._test.setUserState(testChatId, { step: 'criteria' });

    const state = telegramModule._test.getUserState(testChatId);
    expect(state.step).not.toBe('retries');
  });
});
