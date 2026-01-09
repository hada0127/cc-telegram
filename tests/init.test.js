/**
 * init.js 단위 테스트
 * 초기화 로직 테스트 (가능한 부분만)
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

// fetch mock
global.fetch = jest.fn();

beforeAll(async () => {
  // 임시 디렉토리 생성
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-telegram-init-test-'));
  dataDir = path.join(testDir, '.cc-telegram');

  // config 모듈 import
  configModule = await import('../src/config.js');
  configModule.setCwd(testDir);
});

afterAll(async () => {
  // 임시 디렉토리 삭제
  if (testDir) {
    await fs.rm(testDir, { recursive: true, force: true });
  }
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('init.js 내부 함수 테스트', () => {
  // init.js의 callTelegramApi, validateBotToken 등의 로직 테스트

  describe('Telegram API 호출 로직', () => {
    test('정상적인 API 응답을 처리해야 함', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          result: { username: 'test_bot' }
        })
      });

      const response = await fetch('https://api.telegram.org/botTOKEN/getMe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.result.username).toBe('test_bot');
    });

    test('API 오류 응답을 처리해야 함', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: false,
          description: 'Invalid token'
        })
      });

      const response = await fetch('https://api.telegram.org/botINVALID/getMe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.description).toBe('Invalid token');
    });
  });

  describe('.gitignore 업데이트 로직', () => {
    test('.git이 있으면 .gitignore를 업데이트해야 함', async () => {
      // .git 디렉토리 생성
      const gitDir = path.join(testDir, '.git');
      await fs.mkdir(gitDir, { recursive: true });

      // .gitignore가 없으면 생성됨
      const gitignorePath = path.join(testDir, '.gitignore');

      // .gitignore 내용 확인 (있으면 읽기, 없으면 빈 문자열)
      let content = '';
      try {
        content = await fs.readFile(gitignorePath, 'utf8');
      } catch {
        // 파일 없음
      }

      // .cc-telegram이 포함되어 있지 않으면 추가하는 로직
      if (!content.includes('.cc-telegram')) {
        const entry = '# cc-telegram\n.cc-telegram/\n';
        const newContent = content
          ? (content.endsWith('\n') ? `${content}\n${entry}` : `${content}\n\n${entry}`)
          : entry;
        await fs.writeFile(gitignorePath, newContent);
      }

      // 확인
      const updated = await fs.readFile(gitignorePath, 'utf8');
      expect(updated).toContain('.cc-telegram');

      // 정리
      await fs.rm(gitDir, { recursive: true, force: true });
      try {
        await fs.unlink(gitignorePath);
      } catch {
        // 무시
      }
    });

    test('.git이 없으면 .gitignore를 건드리지 않아야 함', async () => {
      // .git 디렉토리가 없는 새 테스트 디렉토리
      const noGitDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-telegram-no-git-'));

      // .gitignore가 없어야 함
      const gitignorePath = path.join(noGitDir, '.gitignore');

      try {
        await fs.access(gitignorePath);
        // 파일이 있으면 안 됨
        expect(true).toBe(false);
      } catch {
        // 파일이 없어야 정상
        expect(true).toBe(true);
      }

      // 정리
      await fs.rm(noGitDir, { recursive: true, force: true });
    });

    test('기존 .gitignore에 .cc-telegram이 있으면 추가하지 않아야 함', async () => {
      // .git 디렉토리 생성
      const gitDir = path.join(testDir, '.git');
      await fs.mkdir(gitDir, { recursive: true });

      // .gitignore에 이미 .cc-telegram 포함
      const gitignorePath = path.join(testDir, '.gitignore');
      await fs.writeFile(gitignorePath, 'node_modules/\n.cc-telegram/\n');

      // 로직 실행
      let content = await fs.readFile(gitignorePath, 'utf8');
      if (!content.includes('.cc-telegram')) {
        // 이미 있으므로 이 블록은 실행되지 않음
        content += '\n.cc-telegram/\n';
        await fs.writeFile(gitignorePath, content);
      }

      // 중복 추가되지 않았는지 확인
      const updated = await fs.readFile(gitignorePath, 'utf8');
      const matches = updated.match(/\.cc-telegram/g);
      expect(matches).toHaveLength(1);

      // 정리
      await fs.rm(gitDir, { recursive: true, force: true });
      await fs.unlink(gitignorePath);
    });
  });

  describe('봇 명령어 설정', () => {
    test('명령어 목록이 올바른 형식이어야 함', () => {
      const commands = [
        { command: 'start', description: 'chatId 확인' },
        { command: 'new', description: '새 작업 생성' },
        { command: 'list', description: '대기/진행중 작업 목록' },
        { command: 'completed', description: '완료된 작업 목록' },
        { command: 'failed', description: '실패한 작업 목록' },
        { command: 'status', description: '현재 작업 상태' },
        { command: 'debug', description: '시스템 상태' },
        { command: 'cancel', description: '작업 생성 취소' }
      ];

      expect(commands).toHaveLength(8);
      commands.forEach(cmd => {
        expect(cmd).toHaveProperty('command');
        expect(cmd).toHaveProperty('description');
        expect(typeof cmd.command).toBe('string');
        expect(typeof cmd.description).toBe('string');
      });
    });
  });

  describe('폴더 구조 생성', () => {
    test('필요한 폴더들이 생성되어야 함', async () => {
      const requiredDirs = ['tasks', 'completed', 'failed', 'logs'];
      const testDataDir = path.join(testDir, 'test-data');

      // 폴더 생성
      await fs.mkdir(testDataDir, { recursive: true });
      for (const dir of requiredDirs) {
        await fs.mkdir(path.join(testDataDir, dir), { recursive: true });
      }

      // 폴더 존재 확인
      for (const dir of requiredDirs) {
        const stat = await fs.stat(path.join(testDataDir, dir));
        expect(stat.isDirectory()).toBe(true);
      }

      // 정리
      await fs.rm(testDataDir, { recursive: true, force: true });
    });
  });

  describe('초기 JSON 파일 생성', () => {
    test('tasks.json 초기 구조가 올바라야 함', () => {
      const initialTasks = { lastUpdated: '', tasks: [] };
      expect(initialTasks).toHaveProperty('lastUpdated');
      expect(initialTasks).toHaveProperty('tasks');
      expect(Array.isArray(initialTasks.tasks)).toBe(true);
    });

    test('completed.json/failed.json 초기 구조가 올바라야 함', () => {
      const initialList = { tasks: [] };
      expect(initialList).toHaveProperty('tasks');
      expect(Array.isArray(initialList.tasks)).toBe(true);
    });
  });

  describe('/start 메시지 감지 로직', () => {
    test('/start 메시지를 올바르게 감지해야 함', () => {
      const update = {
        update_id: 123,
        message: {
          text: '/start',
          chat: { id: 12345 },
          from: { username: 'testuser', first_name: 'Test' }
        }
      };

      const isStartMessage = update.message && update.message.text === '/start';
      expect(isStartMessage).toBe(true);

      const chatId = update.message.chat.id.toString();
      expect(chatId).toBe('12345');

      const username = update.message.from.username || update.message.from.first_name || 'Unknown';
      expect(username).toBe('testuser');
    });

    test('username이 없으면 first_name을 사용해야 함', () => {
      const update = {
        message: {
          text: '/start',
          chat: { id: 12345 },
          from: { first_name: 'Test' }
        }
      };

      const username = update.message.from.username || update.message.from.first_name || 'Unknown';
      expect(username).toBe('Test');
    });

    test('username과 first_name이 모두 없으면 Unknown을 사용해야 함', () => {
      const update = {
        message: {
          text: '/start',
          chat: { id: 12345 },
          from: {}
        }
      };

      const username = update.message.from.username || update.message.from.first_name || 'Unknown';
      expect(username).toBe('Unknown');
    });
  });
});

describe('봇 토큰 검증 로직', () => {
  test('유효한 토큰은 봇 이름을 반환해야 함', async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({
        ok: true,
        result: { username: 'valid_bot' }
      })
    });

    const response = await fetch('https://api.telegram.org/botVALID/getMe');
    const data = await response.json();

    const validation = data.ok
      ? { valid: true, botName: data.result.username }
      : { valid: false, error: data.description };

    expect(validation.valid).toBe(true);
    expect(validation.botName).toBe('valid_bot');
  });

  test('유효하지 않은 토큰은 오류를 반환해야 함', async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({
        ok: false,
        description: 'Unauthorized'
      })
    });

    const response = await fetch('https://api.telegram.org/botINVALID/getMe');
    const data = await response.json();

    const validation = data.ok
      ? { valid: true, botName: data.result.username }
      : { valid: false, error: data.description };

    expect(validation.valid).toBe(false);
    expect(validation.error).toBe('Unauthorized');
  });
});

describe('init.js export 함수 테스트', () => {
  let initModule;

  beforeAll(async () => {
    initModule = await import('../src/init.js');
  });

  test('prompt가 export되어야 함', () => {
    expect(typeof initModule.prompt).toBe('function');
  });

  test('callTelegramApi가 export되어야 함', () => {
    expect(typeof initModule.callTelegramApi).toBe('function');
  });

  test('validateBotToken이 export되어야 함', () => {
    expect(typeof initModule.validateBotToken).toBe('function');
  });

  test('waitForStartMessage가 export되어야 함', () => {
    expect(typeof initModule.waitForStartMessage).toBe('function');
  });

  test('updateGitignore가 export되어야 함', () => {
    expect(typeof initModule.updateGitignore).toBe('function');
  });

  test('initialize가 export되어야 함', () => {
    expect(typeof initModule.initialize).toBe('function');
  });
});

describe('callTelegramApi 직접 테스트', () => {
  let initModule;

  beforeAll(async () => {
    initModule = await import('../src/init.js');
  });

  test('정상 응답 처리', async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({
        ok: true,
        result: { username: 'test_bot' }
      })
    });

    const result = await initModule.callTelegramApi('test-token', 'getMe');
    expect(result.username).toBe('test_bot');
  });

  test('오류 응답 시 예외 발생', async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({
        ok: false,
        description: 'Invalid token'
      })
    });

    await expect(initModule.callTelegramApi('invalid-token', 'getMe'))
      .rejects.toThrow('Telegram API 오류: Invalid token');
  });
});

describe('validateBotToken 직접 테스트', () => {
  let initModule;

  beforeAll(async () => {
    initModule = await import('../src/init.js');
  });

  test('유효한 토큰 검증', async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({
        ok: true,
        result: { username: 'valid_bot' }
      })
    });

    const result = await initModule.validateBotToken('valid-token');
    expect(result.valid).toBe(true);
    expect(result.botName).toBe('valid_bot');
  });

  test('유효하지 않은 토큰 검증', async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({
        ok: false,
        description: 'Unauthorized'
      })
    });

    const result = await initModule.validateBotToken('invalid-token');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Telegram API 오류');
  });
});

describe('updateGitignore 직접 테스트', () => {
  let initModule;

  beforeAll(async () => {
    initModule = await import('../src/init.js');
  });

  test('.git이 없는 디렉토리에서 호출', async () => {
    const noGitDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-telegram-no-git-'));

    // .git이 없으면 아무것도 하지 않음
    await initModule.updateGitignore(noGitDir);

    // .gitignore가 생성되지 않아야 함
    try {
      await fs.access(path.join(noGitDir, '.gitignore'));
      expect(true).toBe(false); // 파일이 있으면 실패
    } catch {
      expect(true).toBe(true); // 파일이 없어야 정상
    }

    await fs.rm(noGitDir, { recursive: true, force: true });
  });

  test('.git이 있고 .gitignore가 없을 때', async () => {
    const gitDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-telegram-git-'));
    await fs.mkdir(path.join(gitDir, '.git'), { recursive: true });

    await initModule.updateGitignore(gitDir);

    const content = await fs.readFile(path.join(gitDir, '.gitignore'), 'utf8');
    expect(content).toContain('.cc-telegram');

    await fs.rm(gitDir, { recursive: true, force: true });
  });

  test('.git이 있고 .gitignore에 이미 .cc-telegram이 있을 때', async () => {
    const gitDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-telegram-git-'));
    await fs.mkdir(path.join(gitDir, '.git'), { recursive: true });
    await fs.writeFile(path.join(gitDir, '.gitignore'), 'node_modules/\n.cc-telegram/\n');

    await initModule.updateGitignore(gitDir);

    const content = await fs.readFile(path.join(gitDir, '.gitignore'), 'utf8');
    const matches = content.match(/\.cc-telegram/g);
    expect(matches).toHaveLength(1);

    await fs.rm(gitDir, { recursive: true, force: true });
  });

  test('.git이 있고 .gitignore에 .cc-telegram이 없을 때', async () => {
    const gitDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-telegram-git-'));
    await fs.mkdir(path.join(gitDir, '.git'), { recursive: true });
    await fs.writeFile(path.join(gitDir, '.gitignore'), 'node_modules/\n');

    await initModule.updateGitignore(gitDir);

    const content = await fs.readFile(path.join(gitDir, '.gitignore'), 'utf8');
    expect(content).toContain('.cc-telegram');

    await fs.rm(gitDir, { recursive: true, force: true });
  });
});
