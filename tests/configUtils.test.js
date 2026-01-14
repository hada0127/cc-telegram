/**
 * configUtils 테스트
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { loadRawConfig } from '../src/utils/configUtils.js';

describe('loadRawConfig', () => {
  let tempDir;
  let configPath;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'configUtils-test-'));
    configPath = path.join(tempDir, 'config.json');
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {
      // ignore
    }
  });

  test('config 파일이 없으면 null을 반환해야 함', async () => {
    const result = await loadRawConfig(path.join(tempDir, 'nonexistent.json'));
    expect(result).toBeNull();
  });

  test('config 파일이 있으면 원시 객체를 반환해야 함', async () => {
    const config = {
      botToken: 'encrypted-token',
      chatId: 'encrypted-chat-id',
      taskTimeout: 45
    };
    await fs.writeFile(configPath, JSON.stringify(config));

    const result = await loadRawConfig(configPath);
    expect(result).toEqual(config);
  });

  test('taskTimeout 필드가 없는 config를 정확히 반환해야 함', async () => {
    const config = {
      botToken: 'encrypted-token',
      chatId: 'encrypted-chat-id'
    };
    await fs.writeFile(configPath, JSON.stringify(config));

    const result = await loadRawConfig(configPath);
    expect(result).toEqual(config);
    expect(result.taskTimeout).toBeUndefined();
  });

  test('taskTimeout 필드가 있는 config를 정확히 반환해야 함', async () => {
    const config = {
      botToken: 'encrypted-token',
      chatId: 'encrypted-chat-id',
      taskTimeout: 60
    };
    await fs.writeFile(configPath, JSON.stringify(config));

    const result = await loadRawConfig(configPath);
    expect(result.taskTimeout).toBe(60);
  });

  test('잘못된 JSON 파일은 null을 반환해야 함', async () => {
    await fs.writeFile(configPath, 'invalid json content');

    const result = await loadRawConfig(configPath);
    expect(result).toBeNull();
  });
});
