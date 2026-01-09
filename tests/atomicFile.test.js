/**
 * atomicFile.js 단위 테스트
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// 테스트용 임시 디렉토리
let testDir;

// 모듈 동적 import
let atomicFileModule;

beforeAll(async () => {
  // 임시 디렉토리 생성
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-telegram-atomic-test-'));

  // atomicFile 모듈 import
  atomicFileModule = await import('../src/utils/atomicFile.js');
});

afterAll(async () => {
  // 임시 디렉토리 삭제
  if (testDir) {
    await fs.rm(testDir, { recursive: true, force: true });
  }
});

describe('atomicWriteFile', () => {
  test('파일을 원자적으로 작성해야 함', async () => {
    const filePath = path.join(testDir, 'test-atomic.txt');
    const content = 'Hello, Atomic World!';

    await atomicFileModule.atomicWriteFile(filePath, content);

    const read = await fs.readFile(filePath, 'utf8');
    expect(read).toBe(content);
  });

  test('기존 파일을 덮어써야 함', async () => {
    const filePath = path.join(testDir, 'test-overwrite.txt');

    await atomicFileModule.atomicWriteFile(filePath, 'original');
    await atomicFileModule.atomicWriteFile(filePath, 'updated');

    const read = await fs.readFile(filePath, 'utf8');
    expect(read).toBe('updated');
  });

  test('빈 문자열도 작성할 수 있어야 함', async () => {
    const filePath = path.join(testDir, 'test-empty.txt');

    await atomicFileModule.atomicWriteFile(filePath, '');

    const read = await fs.readFile(filePath, 'utf8');
    expect(read).toBe('');
  });

  test('유니코드 내용도 작성할 수 있어야 함', async () => {
    const filePath = path.join(testDir, 'test-unicode.txt');
    const content = '안녕하세요! 🎉 测试文字';

    await atomicFileModule.atomicWriteFile(filePath, content);

    const read = await fs.readFile(filePath, 'utf8');
    expect(read).toBe(content);
  });

  test('긴 내용도 작성할 수 있어야 함', async () => {
    const filePath = path.join(testDir, 'test-long.txt');
    const content = 'A'.repeat(100000);

    await atomicFileModule.atomicWriteFile(filePath, content);

    const read = await fs.readFile(filePath, 'utf8');
    expect(read).toBe(content);
  });

  test('멀티라인 내용도 작성할 수 있어야 함', async () => {
    const filePath = path.join(testDir, 'test-multiline.txt');
    const content = 'Line 1\nLine 2\nLine 3\n';

    await atomicFileModule.atomicWriteFile(filePath, content);

    const read = await fs.readFile(filePath, 'utf8');
    expect(read).toBe(content);
  });

  test('존재하지 않는 디렉토리에 쓰면 오류가 발생해야 함', async () => {
    const filePath = path.join(testDir, 'nonexistent', 'test.txt');

    await expect(
      atomicFileModule.atomicWriteFile(filePath, 'content')
    ).rejects.toThrow();
  });

  test('임시 파일이 남아있지 않아야 함', async () => {
    const filePath = path.join(testDir, 'test-no-temp.txt');

    await atomicFileModule.atomicWriteFile(filePath, 'test content');

    // 디렉토리 내 파일 목록 확인
    const files = await fs.readdir(testDir);
    const tempFiles = files.filter(f => f.includes('.tmp'));
    expect(tempFiles).toHaveLength(0);
  });
});

describe('atomicWriteJson', () => {
  test('JSON 객체를 파일로 작성해야 함', async () => {
    const filePath = path.join(testDir, 'test.json');
    const data = { name: 'test', value: 123, nested: { key: 'val' } };

    await atomicFileModule.atomicWriteJson(filePath, data);

    const read = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(read);
    expect(parsed).toEqual(data);
  });

  test('기본 들여쓰기 2칸으로 포맷팅되어야 함', async () => {
    const filePath = path.join(testDir, 'test-indent.json');
    const data = { key: 'value' };

    await atomicFileModule.atomicWriteJson(filePath, data);

    const read = await fs.readFile(filePath, 'utf8');
    expect(read).toBe('{\n  "key": "value"\n}');
  });

  test('커스텀 들여쓰기를 사용할 수 있어야 함', async () => {
    const filePath = path.join(testDir, 'test-custom-indent.json');
    const data = { key: 'value' };

    await atomicFileModule.atomicWriteJson(filePath, data, 4);

    const read = await fs.readFile(filePath, 'utf8');
    expect(read).toBe('{\n    "key": "value"\n}');
  });

  test('빈 객체도 작성할 수 있어야 함', async () => {
    const filePath = path.join(testDir, 'test-empty.json');

    await atomicFileModule.atomicWriteJson(filePath, {});

    const read = await fs.readFile(filePath, 'utf8');
    expect(JSON.parse(read)).toEqual({});
  });

  test('배열도 작성할 수 있어야 함', async () => {
    const filePath = path.join(testDir, 'test-array.json');
    const data = [1, 2, 3, { key: 'value' }];

    await atomicFileModule.atomicWriteJson(filePath, data);

    const read = await fs.readFile(filePath, 'utf8');
    expect(JSON.parse(read)).toEqual(data);
  });

  test('null도 작성할 수 있어야 함', async () => {
    const filePath = path.join(testDir, 'test-null.json');

    await atomicFileModule.atomicWriteJson(filePath, null);

    const read = await fs.readFile(filePath, 'utf8');
    expect(JSON.parse(read)).toBeNull();
  });

  test('유니코드 문자열이 포함된 객체도 작성할 수 있어야 함', async () => {
    const filePath = path.join(testDir, 'test-unicode.json');
    const data = { message: '안녕하세요 🎉', chinese: '测试' };

    await atomicFileModule.atomicWriteJson(filePath, data);

    const read = await fs.readFile(filePath, 'utf8');
    expect(JSON.parse(read)).toEqual(data);
  });

  test('기존 JSON 파일을 덮어써야 함', async () => {
    const filePath = path.join(testDir, 'test-overwrite.json');

    await atomicFileModule.atomicWriteJson(filePath, { old: true });
    await atomicFileModule.atomicWriteJson(filePath, { new: true });

    const read = await fs.readFile(filePath, 'utf8');
    expect(JSON.parse(read)).toEqual({ new: true });
  });

  test('복잡한 중첩 객체도 작성할 수 있어야 함', async () => {
    const filePath = path.join(testDir, 'test-nested.json');
    const data = {
      level1: {
        level2: {
          level3: {
            array: [1, 2, { deep: 'value' }]
          }
        }
      }
    };

    await atomicFileModule.atomicWriteJson(filePath, data);

    const read = await fs.readFile(filePath, 'utf8');
    expect(JSON.parse(read)).toEqual(data);
  });
});

describe('동시 쓰기 테스트', () => {
  test('동시에 여러 파일에 쓸 수 있어야 함', async () => {
    const promises = [];
    const fileCount = 10;

    for (let i = 0; i < fileCount; i++) {
      const filePath = path.join(testDir, `concurrent-${i}.json`);
      promises.push(
        atomicFileModule.atomicWriteJson(filePath, { index: i })
      );
    }

    await Promise.all(promises);

    // 모든 파일이 올바르게 작성되었는지 확인
    for (let i = 0; i < fileCount; i++) {
      const filePath = path.join(testDir, `concurrent-${i}.json`);
      const content = await fs.readFile(filePath, 'utf8');
      expect(JSON.parse(content)).toEqual({ index: i });
    }
  });
});
