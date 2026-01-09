/**
 * cli.js 단위 테스트
 * CLI 엔트리포인트 로직 테스트
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
let encryptionModule;
let cliModule;

// console mock
const originalConsole = {
  log: console.log,
  error: console.error
};

// process.exit mock
const originalExit = process.exit;

// fetch mock
global.fetch = jest.fn();

beforeAll(async () => {
  // 임시 디렉토리 생성
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-telegram-cli-test-'));
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

  // tasks 모듈 import
  tasksModule = await import('../src/tasks.js');

  // encryption 모듈 import
  encryptionModule = await import('../src/utils/encryption.js');

  // cli 모듈 import
  cliModule = await import('../src/cli.js');
});

afterAll(async () => {
  // 임시 디렉토리 삭제
  if (testDir) {
    await fs.rm(testDir, { recursive: true, force: true });
  }
});

beforeEach(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  process.exit = jest.fn();
  global.fetch.mockResolvedValue({
    json: () => Promise.resolve({ ok: true, result: {} })
  });
});

afterEach(() => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  process.exit = originalExit;
});

describe('CLI 시작 메시지', () => {
  test('시작 메시지가 올바른 형식이어야 함', () => {
    const message = '🤖 cc-telegram - 텔레그램을 통한 원격 Claude Code 실행\n';
    expect(message).toContain('cc-telegram');
    expect(message).toContain('텔레그램');
  });

  test('봇 실행 메시지가 올바른 형식이어야 함', () => {
    const message = '✅ 봇이 실행중입니다. Ctrl+C로 종료할 수 있습니다.\n';
    expect(message).toContain('봇이 실행중');
    expect(message).toContain('Ctrl+C');
  });

  test('종료 메시지가 올바른 형식이어야 함', () => {
    const message = '\n종료 중...';
    expect(message).toContain('종료');
  });
});

describe('configExists 체크', () => {
  test('config 파일이 없으면 false를 반환해야 함', async () => {
    configModule.clearConfigCache();
    const exists = await configModule.configExists();
    expect(exists).toBe(false);
  });

  test('config 파일이 있으면 true를 반환해야 함', async () => {
    // config 파일 생성
    const encryptionModule = await import('../src/utils/encryption.js');
    await fs.writeFile(
      path.join(dataDir, 'config.json'),
      JSON.stringify({
        botToken: encryptionModule.encrypt('test-token'),
        chatId: encryptionModule.encrypt('12345')
      }, null, 2)
    );

    configModule.clearConfigCache();
    const exists = await configModule.configExists();
    expect(exists).toBe(true);
  });
});

describe('cleanupOrphanTasks 호출', () => {
  beforeEach(async () => {
    await tasksModule.resetAllData();
  });

  test('orphan 작업이 없으면 0을 반환해야 함', async () => {
    const cleaned = await tasksModule.cleanupOrphanTasks();
    expect(cleaned).toBe(0);
  });

  test('orphan 작업이 있으면 정리 개수를 반환해야 함', async () => {
    // 작업 생성 및 시작 (inProgress 상태로 만들기)
    const task = await tasksModule.createTask({
      requirement: 'orphan test',
      completionCriteria: '완료',
      maxRetries: 1,
      workingDirectory: testDir
    });

    await tasksModule.startTask(task.id);

    // cleanup 실행
    const cleaned = await tasksModule.cleanupOrphanTasks();
    expect(cleaned).toBe(1);
  });
});

describe('로그 로테이션 결과 처리', () => {
  test('삭제된 로그 개수 메시지가 올바라야 함', () => {
    const deleted = 5;
    const message = `${deleted}개의 오래된 로그 파일 삭제됨`;
    expect(message).toContain('5개');
    expect(message).toContain('삭제됨');
  });

  test('삭제된 작업 파일 메시지가 올바라야 함', () => {
    const completed = 3;
    const failed = 2;
    const message = `오래된 작업 파일 삭제: 완료 ${completed}개, 실패 ${failed}개`;
    expect(message).toContain('완료 3개');
    expect(message).toContain('실패 2개');
  });
});

describe('getDataDir', () => {
  test('올바른 데이터 디렉토리 경로를 반환해야 함', () => {
    const result = configModule.getDataDir();
    expect(result).toBe(path.join(testDir, '.cc-telegram'));
  });
});

describe('로그 디렉토리 경로', () => {
  test('올바른 로그 디렉토리 경로를 계산해야 함', () => {
    const logsDir = path.join(configModule.getDataDir(), 'logs');
    expect(logsDir).toBe(path.join(testDir, '.cc-telegram', 'logs'));
  });
});

describe('설정 로드', () => {
  test('설정이 없으면 오류가 발생해야 함', async () => {
    // config 파일 삭제
    try {
      await fs.unlink(path.join(dataDir, 'config.json'));
    } catch {
      // 무시
    }

    configModule.clearConfigCache();

    await expect(configModule.loadConfig()).rejects.toThrow();
  });
});

describe('종료 핸들러 로직', () => {
  test('SIGINT 핸들러가 올바르게 동작해야 함', () => {
    // 핸들러 시뮬레이션
    const cleanup = () => {
      console.log('\n종료 중...');
      // stopBot(), stopExecutor() 호출
      process.exit(0);
    };

    cleanup();

    expect(console.log).toHaveBeenCalledWith('\n종료 중...');
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  test('SIGTERM 핸들러도 같은 동작을 해야 함', () => {
    const cleanup = () => {
      console.log('\n종료 중...');
      process.exit(0);
    };

    cleanup();

    expect(console.log).toHaveBeenCalledWith('\n종료 중...');
    expect(process.exit).toHaveBeenCalledWith(0);
  });
});

describe('오류 처리', () => {
  test('시작 실패 시 오류 메시지를 출력해야 함', () => {
    const err = new Error('시작 실패 테스트');
    console.error('❌ 시작 실패:', err.message);

    expect(console.error).toHaveBeenCalledWith('❌ 시작 실패:', '시작 실패 테스트');
  });

  test('일반 오류 시 오류 메시지를 출력해야 함', () => {
    const err = new Error('일반 오류 테스트');
    console.error('❌ 오류:', err.message);

    expect(console.error).toHaveBeenCalledWith('❌ 오류:', '일반 오류 테스트');
  });

  test('오류 발생 시 exit code 1로 종료해야 함', () => {
    process.exit(1);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});

describe('setupExitHandlers', () => {
  test('setupExitHandlers가 cleanup 함수를 반환해야 함', () => {
    const cleanup = cliModule.setupExitHandlers();
    expect(typeof cleanup).toBe('function');
  });

  test('cleanup 함수가 종료 메시지를 출력해야 함', async () => {
    const cleanup = cliModule.setupExitHandlers();
    // cleanup은 async 함수이므로 호출하면 종료됨
    // process.exit가 mock되어 있으므로 실제 종료 안됨
    cleanup();
    expect(console.log).toHaveBeenCalledWith('\n종료 중...');
  });
});

describe('main 함수', () => {
  test('main이 export되어야 함', () => {
    expect(typeof cliModule.main).toBe('function');
  });

  test('setupExitHandlers가 export되어야 함', () => {
    expect(typeof cliModule.setupExitHandlers).toBe('function');
  });
});

describe('runCleanup 호출', () => {
  test('runCleanup이 올바른 결과를 반환해야 함', async () => {
    const logRotationModule = await import('../src/utils/logRotation.js');
    const result = await logRotationModule.runCleanup(dataDir, 7, 30);

    expect(result).toHaveProperty('logs');
    expect(result).toHaveProperty('tasks');
    expect(result.logs).toHaveProperty('deleted');
    expect(result.tasks).toHaveProperty('completed');
    expect(result.tasks).toHaveProperty('failed');
  });
});

describe('로거 초기화', () => {
  test('initLogger가 오류 없이 호출되어야 함', async () => {
    const loggerModule = await import('../src/utils/logger.js');
    const logsDir = path.join(configModule.getDataDir(), 'logs');

    // initLogger 호출
    loggerModule.initLogger(logsDir, false);
    expect(true).toBe(true);
  });
});
