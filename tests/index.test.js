/**
 * index.js 단위 테스트
 * 모듈 export 테스트
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// 테스트용 임시 디렉토리
let testDir;
let dataDir;

// 모듈 동적 import
let indexModule;
let configModule;

beforeAll(async () => {
  // 임시 디렉토리 생성
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-telegram-index-test-'));
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

  // config 파일 생성
  const encryptionModule = await import('../src/utils/encryption.js');
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

  // index 모듈 import
  indexModule = await import('../src/index.js');
});

afterAll(async () => {
  // 임시 디렉토리 삭제
  if (testDir) {
    await fs.rm(testDir, { recursive: true, force: true });
  }
});

describe('index.js exports', () => {
  describe('telegram exports', () => {
    test('startBot이 함수로 export되어야 함', () => {
      expect(typeof indexModule.startBot).toBe('function');
    });

    test('stopBot이 함수로 export되어야 함', () => {
      expect(typeof indexModule.stopBot).toBe('function');
    });

    test('sendMessage가 함수로 export되어야 함', () => {
      expect(typeof indexModule.sendMessage).toBe('function');
    });
  });

  describe('executor exports', () => {
    test('startExecutor가 함수로 export되어야 함', () => {
      expect(typeof indexModule.startExecutor).toBe('function');
    });

    test('stopExecutor가 함수로 export되어야 함', () => {
      expect(typeof indexModule.stopExecutor).toBe('function');
    });
  });

  describe('tasks exports', () => {
    test('createTask가 함수로 export되어야 함', () => {
      expect(typeof indexModule.createTask).toBe('function');
    });

    test('getAllPendingTasks가 함수로 export되어야 함', () => {
      expect(typeof indexModule.getAllPendingTasks).toBe('function');
    });

    test('getCompletedTasks가 함수로 export되어야 함', () => {
      expect(typeof indexModule.getCompletedTasks).toBe('function');
    });

    test('getFailedTasks가 함수로 export되어야 함', () => {
      expect(typeof indexModule.getFailedTasks).toBe('function');
    });
  });

  describe('config exports', () => {
    test('loadConfig가 함수로 export되어야 함', () => {
      expect(typeof indexModule.loadConfig).toBe('function');
    });

    test('saveConfig가 함수로 export되어야 함', () => {
      expect(typeof indexModule.saveConfig).toBe('function');
    });

    test('configExists가 함수로 export되어야 함', () => {
      expect(typeof indexModule.configExists).toBe('function');
    });
  });

  describe('init exports', () => {
    test('initialize가 함수로 export되어야 함', () => {
      expect(typeof indexModule.initialize).toBe('function');
    });
  });
});

describe('export된 함수들의 동작', () => {
  test('configExists가 올바르게 동작해야 함', async () => {
    const exists = await indexModule.configExists();
    expect(exists).toBe(true);
  });

  test('loadConfig가 올바르게 동작해야 함', async () => {
    configModule.clearConfigCache();
    const config = await indexModule.loadConfig();
    expect(config).toHaveProperty('botToken');
    expect(config).toHaveProperty('chatId');
    expect(config.botToken).toBe('test-token');
    expect(config.chatId).toBe('12345');
  });

  test('getAllPendingTasks가 올바르게 동작해야 함', async () => {
    const tasks = await indexModule.getAllPendingTasks();
    expect(Array.isArray(tasks)).toBe(true);
  });

  test('getCompletedTasks가 올바르게 동작해야 함', async () => {
    const tasks = await indexModule.getCompletedTasks();
    expect(Array.isArray(tasks)).toBe(true);
  });

  test('getFailedTasks가 올바르게 동작해야 함', async () => {
    const tasks = await indexModule.getFailedTasks();
    expect(Array.isArray(tasks)).toBe(true);
  });

  test('createTask가 올바르게 동작해야 함', async () => {
    const task = await indexModule.createTask({
      requirement: 'export 테스트',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir
    });

    expect(task).toHaveProperty('id');
    expect(task.requirement).toBe('export 테스트');
  });
});

describe('모듈 재export 일관성', () => {
  test('telegram.js의 함수들이 올바르게 재export되어야 함', async () => {
    const telegramModule = await import('../src/telegram.js');
    expect(indexModule.startBot).toBe(telegramModule.startBot);
    expect(indexModule.stopBot).toBe(telegramModule.stopBot);
    expect(indexModule.sendMessage).toBe(telegramModule.sendMessage);
  });

  test('executor.js의 함수들이 올바르게 재export되어야 함', async () => {
    const executorModule = await import('../src/executor.js');
    expect(indexModule.startExecutor).toBe(executorModule.startExecutor);
    expect(indexModule.stopExecutor).toBe(executorModule.stopExecutor);
  });

  test('tasks.js의 함수들이 올바르게 재export되어야 함', async () => {
    const tasksModule = await import('../src/tasks.js');
    expect(indexModule.createTask).toBe(tasksModule.createTask);
    expect(indexModule.getAllPendingTasks).toBe(tasksModule.getAllPendingTasks);
    expect(indexModule.getCompletedTasks).toBe(tasksModule.getCompletedTasks);
    expect(indexModule.getFailedTasks).toBe(tasksModule.getFailedTasks);
  });

  test('config.js의 함수들이 올바르게 재export되어야 함', async () => {
    expect(indexModule.loadConfig).toBe(configModule.loadConfig);
    expect(indexModule.saveConfig).toBe(configModule.saveConfig);
    expect(indexModule.configExists).toBe(configModule.configExists);
  });

  test('init.js의 함수들이 올바르게 재export되어야 함', async () => {
    const initModule = await import('../src/init.js');
    expect(indexModule.initialize).toBe(initModule.initialize);
  });
});
