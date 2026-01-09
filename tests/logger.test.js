/**
 * logger.js 단위 테스트
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// 테스트용 임시 디렉토리
let testDir;
let logsDir;

// 모듈 동적 import
let loggerModule;

// console mock
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error
};

beforeAll(async () => {
  // 임시 디렉토리 생성
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-telegram-logger-test-'));
  logsDir = path.join(testDir, 'logs');
  await fs.mkdir(logsDir, { recursive: true });

  // logger 모듈 import
  loggerModule = await import('../src/utils/logger.js');
});

afterAll(async () => {
  // 임시 디렉토리 삭제
  if (testDir) {
    await fs.rm(testDir, { recursive: true, force: true });
  }
});

beforeEach(async () => {
  // console mock 설정
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();

  // 로그 파일 초기화
  const files = await fs.readdir(logsDir);
  for (const file of files) {
    await fs.unlink(path.join(logsDir, file));
  }
});

afterEach(() => {
  // console 복원
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

describe('initLogger', () => {
  test('로거를 초기화해야 함', () => {
    // initLogger 호출해도 오류 없어야 함
    expect(() => {
      loggerModule.initLogger(logsDir, false);
    }).not.toThrow();
  });

  test('디버그 모드로 초기화해야 함', () => {
    expect(() => {
      loggerModule.initLogger(logsDir, true);
    }).not.toThrow();
  });
});

describe('log', () => {
  beforeEach(() => {
    loggerModule.initLogger(logsDir, true);
  });

  test('info 레벨 로그를 출력해야 함', async () => {
    await loggerModule.log('info', '정보 메시지');

    expect(console.log).toHaveBeenCalled();
    const call = console.log.mock.calls[0][0];
    expect(call).toContain('[INFO]');
    expect(call).toContain('정보 메시지');
  });

  test('warn 레벨 로그를 출력해야 함', async () => {
    await loggerModule.log('warn', '경고 메시지');

    expect(console.warn).toHaveBeenCalled();
    const call = console.warn.mock.calls[0][0];
    expect(call).toContain('[WARN]');
    expect(call).toContain('경고 메시지');
  });

  test('error 레벨 로그를 출력해야 함', async () => {
    await loggerModule.log('error', '오류 메시지');

    expect(console.error).toHaveBeenCalled();
    const call = console.error.mock.calls[0][0];
    expect(call).toContain('[ERROR]');
    expect(call).toContain('오류 메시지');
  });

  test('debug 레벨 로그를 출력해야 함 (디버그 모드)', async () => {
    loggerModule.initLogger(logsDir, true);
    await loggerModule.log('debug', '디버그 메시지');

    expect(console.log).toHaveBeenCalled();
    const call = console.log.mock.calls[0][0];
    expect(call).toContain('[DEBUG]');
    expect(call).toContain('디버그 메시지');
  });

  test('debug 레벨 로그가 디버그 모드 꺼지면 출력 안됨', async () => {
    loggerModule.initLogger(logsDir, false);
    await loggerModule.log('debug', '디버그 메시지');

    // debug 메시지가 출력되지 않아야 함
    const calls = console.log.mock.calls.filter(c =>
      c[0] && c[0].includes && c[0].includes('[DEBUG]')
    );
    expect(calls).toHaveLength(0);
  });

  test('추가 데이터와 함께 로그를 출력해야 함', async () => {
    const data = { key: 'value', num: 123 };
    await loggerModule.log('info', '데이터 메시지', data);

    expect(console.log).toHaveBeenCalled();
    const calls = console.log.mock.calls[0];
    expect(calls[1]).toEqual(data);
  });

  test('로그 파일에 저장해야 함', async () => {
    await loggerModule.log('info', '파일 저장 테스트');

    // 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 100));

    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logsDir, `${today}.log`);

    const content = await fs.readFile(logFile, 'utf8');
    expect(content).toContain('[INFO]');
    expect(content).toContain('파일 저장 테스트');
  });

  test('추가 데이터도 파일에 저장해야 함', async () => {
    const data = { taskId: 'test-123' };
    await loggerModule.log('info', '데이터 저장 테스트', data);

    // 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 100));

    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logsDir, `${today}.log`);

    const content = await fs.readFile(logFile, 'utf8');
    expect(content).toContain('taskId');
    expect(content).toContain('test-123');
  });
});

describe('info', () => {
  beforeEach(() => {
    loggerModule.initLogger(logsDir, false);
  });

  test('info 로그를 출력해야 함', async () => {
    await loggerModule.info('info 테스트');

    expect(console.log).toHaveBeenCalled();
    expect(console.log.mock.calls[0][0]).toContain('[INFO]');
  });

  test('추가 데이터와 함께 info 로그를 출력해야 함', async () => {
    await loggerModule.info('info 데이터', { id: 1 });

    expect(console.log).toHaveBeenCalled();
    expect(console.log.mock.calls[0][1]).toEqual({ id: 1 });
  });
});

describe('warn', () => {
  beforeEach(() => {
    loggerModule.initLogger(logsDir, false);
  });

  test('warn 로그를 출력해야 함', async () => {
    await loggerModule.warn('warn 테스트');

    expect(console.warn).toHaveBeenCalled();
    expect(console.warn.mock.calls[0][0]).toContain('[WARN]');
  });

  test('추가 데이터와 함께 warn 로그를 출력해야 함', async () => {
    await loggerModule.warn('warn 데이터', { warning: true });

    expect(console.warn).toHaveBeenCalled();
    expect(console.warn.mock.calls[0][1]).toEqual({ warning: true });
  });
});

describe('error', () => {
  beforeEach(() => {
    loggerModule.initLogger(logsDir, false);
  });

  test('error 로그를 출력해야 함', async () => {
    await loggerModule.error('error 테스트');

    expect(console.error).toHaveBeenCalled();
    expect(console.error.mock.calls[0][0]).toContain('[ERROR]');
  });

  test('추가 데이터와 함께 error 로그를 출력해야 함', async () => {
    await loggerModule.error('error 데이터', { err: 'message' });

    expect(console.error).toHaveBeenCalled();
    expect(console.error.mock.calls[0][1]).toEqual({ err: 'message' });
  });
});

describe('debug', () => {
  test('디버그 모드일 때 debug 로그를 출력해야 함', async () => {
    loggerModule.initLogger(logsDir, true);
    await loggerModule.debug('debug 테스트');

    expect(console.log).toHaveBeenCalled();
    expect(console.log.mock.calls[0][0]).toContain('[DEBUG]');
  });

  test('디버그 모드가 아닐 때 debug 로그가 출력되지 않아야 함', async () => {
    loggerModule.initLogger(logsDir, false);
    await loggerModule.debug('debug 테스트');

    // DEBUG 로그가 없어야 함
    const debugCalls = console.log.mock.calls.filter(c =>
      c[0] && c[0].includes && c[0].includes('[DEBUG]')
    );
    expect(debugCalls).toHaveLength(0);
  });
});

describe('로그 디렉토리 없이 동작', () => {
  test('로그 디렉토리 없이도 콘솔 출력되어야 함', async () => {
    loggerModule.initLogger(null, false);
    await loggerModule.info('디렉토리 없이 테스트');

    expect(console.log).toHaveBeenCalled();
    expect(console.log.mock.calls[0][0]).toContain('디렉토리 없이 테스트');
  });
});
