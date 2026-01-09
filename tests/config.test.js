/**
 * config.js 단위 테스트
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
let encryptionModule;

beforeAll(async () => {
  // 임시 디렉토리 생성
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-telegram-config-test-'));
  dataDir = path.join(testDir, '.cc-telegram');

  // 디렉토리 구조 생성
  await fs.mkdir(dataDir, { recursive: true });

  // encryption 모듈 import
  encryptionModule = await import('../src/utils/encryption.js');

  // config 모듈 import 및 cwd 설정
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
  // 캐시 초기화
  configModule.clearConfigCache();
});

describe('setCwd', () => {
  test('cwd를 설정해야 함', () => {
    const originalCwd = testDir;
    const newCwd = path.join(testDir, 'new-path');

    configModule.setCwd(newCwd);
    expect(configModule.getDataDir()).toBe(path.join(newCwd, '.cc-telegram'));

    // 원래대로 복원
    configModule.setCwd(originalCwd);
  });

  test('setCwd 호출 시 캐시가 초기화되어야 함', async () => {
    // config 파일 생성
    const config = {
      botToken: encryptionModule.encrypt('test-token'),
      chatId: encryptionModule.encrypt('12345'),
      debugMode: false
    };
    await fs.writeFile(
      path.join(dataDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    // 첫 번째 로드
    await configModule.loadConfig();

    // setCwd로 다른 경로 설정 (캐시 초기화)
    const anotherDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-telegram-another-'));
    configModule.setCwd(anotherDir);

    // 원래대로 복원
    configModule.setCwd(testDir);

    // 정리
    await fs.rm(anotherDir, { recursive: true, force: true });
  });
});

describe('getDataDir', () => {
  test('.cc-telegram 경로를 반환해야 함', () => {
    const dataDir = configModule.getDataDir();
    expect(dataDir).toBe(path.join(testDir, '.cc-telegram'));
  });
});

describe('getConfigPath', () => {
  test('config.json 경로를 반환해야 함', () => {
    const configPath = configModule.getConfigPath();
    expect(configPath).toBe(path.join(testDir, '.cc-telegram', 'config.json'));
  });
});

describe('configExists', () => {
  test('config 파일이 있으면 true를 반환해야 함', async () => {
    // config 파일 생성
    const config = {
      botToken: encryptionModule.encrypt('test-token'),
      chatId: encryptionModule.encrypt('12345'),
      debugMode: false
    };
    await fs.writeFile(
      path.join(dataDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    const exists = await configModule.configExists();
    expect(exists).toBe(true);
  });

  test('config 파일이 없으면 false를 반환해야 함', async () => {
    // config 파일 삭제
    try {
      await fs.unlink(path.join(dataDir, 'config.json'));
    } catch {
      // 파일이 없으면 무시
    }

    const exists = await configModule.configExists();
    expect(exists).toBe(false);
  });
});

describe('loadConfig', () => {
  test('config 파일을 로드해야 함', async () => {
    const config = {
      botToken: encryptionModule.encrypt('my-bot-token'),
      chatId: encryptionModule.encrypt('67890'),
      debugMode: true,
      claudeCommand: 'npx claude',
      logRetentionDays: 14
    };
    await fs.writeFile(
      path.join(dataDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    configModule.clearConfigCache();
    const loaded = await configModule.loadConfig();

    expect(loaded.botToken).toBe('my-bot-token');
    expect(loaded.chatId).toBe('67890');
    expect(loaded.debugMode).toBe(true);
    expect(loaded.claudeCommand).toBe('npx claude');
    expect(loaded.logRetentionDays).toBe(14);
  });

  test('기본값으로 설정되어야 함', async () => {
    const config = {
      botToken: encryptionModule.encrypt('token'),
      chatId: encryptionModule.encrypt('123')
      // debugMode, claudeCommand, logRetentionDays 없음
    };
    await fs.writeFile(
      path.join(dataDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    configModule.clearConfigCache();
    const loaded = await configModule.loadConfig();

    expect(loaded.debugMode).toBe(false);
    expect(loaded.claudeCommand).toBeNull();
    expect(loaded.logRetentionDays).toBe(7);
  });

  test('캐시된 설정을 반환해야 함', async () => {
    const config = {
      botToken: encryptionModule.encrypt('cached-token'),
      chatId: encryptionModule.encrypt('11111'),
      debugMode: false
    };
    await fs.writeFile(
      path.join(dataDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    configModule.clearConfigCache();
    const first = await configModule.loadConfig();
    const second = await configModule.loadConfig();

    expect(first).toBe(second); // 같은 객체 참조
  });
});

describe('saveConfig', () => {
  test('config 파일을 저장해야 함', async () => {
    await configModule.saveConfig({
      botToken: 'new-token',
      chatId: '99999',
      debugMode: true,
      claudeCommand: '/usr/bin/claude',
      logRetentionDays: 30
    });

    // 파일 읽기
    const content = await fs.readFile(path.join(dataDir, 'config.json'), 'utf8');
    const saved = JSON.parse(content);

    // 암호화된 값 복호화
    expect(encryptionModule.decrypt(saved.botToken)).toBe('new-token');
    expect(encryptionModule.decrypt(saved.chatId)).toBe('99999');
    expect(saved.debugMode).toBe(true);
    expect(saved.claudeCommand).toBe('/usr/bin/claude');
    expect(saved.logRetentionDays).toBe(30);
  });

  test('기본값으로 저장해야 함', async () => {
    await configModule.saveConfig({
      botToken: 'default-test',
      chatId: '88888'
    });

    const content = await fs.readFile(path.join(dataDir, 'config.json'), 'utf8');
    const saved = JSON.parse(content);

    expect(saved.debugMode).toBe(false);
    expect(saved.claudeCommand).toBeNull();
    expect(saved.logRetentionDays).toBe(7);
  });

  test('저장 후 캐시가 업데이트되어야 함', async () => {
    configModule.clearConfigCache();

    await configModule.saveConfig({
      botToken: 'cache-update-token',
      chatId: '77777'
    });

    const loaded = await configModule.loadConfig();
    expect(loaded.botToken).toBe('cache-update-token');
    expect(loaded.chatId).toBe('77777');
  });
});

describe('clearConfigCache', () => {
  test('캐시를 초기화해야 함', async () => {
    // 먼저 config 로드
    const config = {
      botToken: encryptionModule.encrypt('cache-test'),
      chatId: encryptionModule.encrypt('55555')
    };
    await fs.writeFile(
      path.join(dataDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    configModule.clearConfigCache();
    await configModule.loadConfig();

    // 캐시 초기화
    configModule.clearConfigCache();

    // 파일 내용 변경
    const newConfig = {
      botToken: encryptionModule.encrypt('new-cache-test'),
      chatId: encryptionModule.encrypt('44444')
    };
    await fs.writeFile(
      path.join(dataDir, 'config.json'),
      JSON.stringify(newConfig, null, 2)
    );

    // 다시 로드하면 새 값이 나와야 함
    const loaded = await configModule.loadConfig();
    expect(loaded.botToken).toBe('new-cache-test');
    expect(loaded.chatId).toBe('44444');
  });
});
