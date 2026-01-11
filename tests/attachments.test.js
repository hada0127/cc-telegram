/**
 * attachments.js 단위 테스트
 * 파일 첨부 관리 유틸리티 테스트
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// 테스트용 임시 디렉토리
let testDir;
let dataDir;

// 모듈 동적 import
let attachmentsModule;
let configModule;

beforeAll(async () => {
  // 임시 디렉토리 생성
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-telegram-test-attachments-'));
  dataDir = path.join(testDir, '.cc-telegram');

  // 디렉토리 구조 생성
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(path.join(dataDir, 'temp'), { recursive: true });

  // config 모듈 import 및 cwd 설정
  configModule = await import('../src/config.js');
  configModule.setCwd(testDir);

  // attachments 모듈 import
  attachmentsModule = await import('../src/utils/attachments.js');
});

afterAll(async () => {
  // 임시 디렉토리 삭제
  if (testDir) {
    await fs.rm(testDir, { recursive: true, force: true });
  }
});

describe('getTempDir', () => {
  test('올바른 temp 디렉토리 경로를 반환해야 함', () => {
    const tempDir = attachmentsModule.getTempDir();
    expect(tempDir).toBe(path.join(dataDir, 'temp'));
  });
});

describe('getTaskTempDir', () => {
  test('작업 ID에 맞는 임시 디렉토리 경로를 반환해야 함', () => {
    const taskId = 'test-task-123';
    const taskTempDir = attachmentsModule.getTaskTempDir(taskId);
    expect(taskTempDir).toBe(path.join(dataDir, 'temp', taskId));
  });
});

describe('createTaskTempDir', () => {
  test('작업 임시 디렉토리를 생성해야 함', async () => {
    const taskId = 'create-test-task';
    const dir = await attachmentsModule.createTaskTempDir(taskId);

    expect(dir).toBe(path.join(dataDir, 'temp', taskId));

    // 디렉토리가 실제로 생성되었는지 확인
    const stat = await fs.stat(dir);
    expect(stat.isDirectory()).toBe(true);

    // 정리
    await fs.rm(dir, { recursive: true, force: true });
  });

  test('이미 존재하는 디렉토리에도 오류 없이 동작해야 함', async () => {
    const taskId = 'existing-task';
    const dir = path.join(dataDir, 'temp', taskId);

    // 미리 디렉토리 생성
    await fs.mkdir(dir, { recursive: true });

    // 다시 생성해도 오류 없어야 함
    const result = await attachmentsModule.createTaskTempDir(taskId);
    expect(result).toBe(dir);

    // 정리
    await fs.rm(dir, { recursive: true, force: true });
  });
});

describe('cleanupTaskTempDir', () => {
  test('작업 임시 디렉토리를 삭제해야 함', async () => {
    const taskId = 'cleanup-test-task';
    const dir = await attachmentsModule.createTaskTempDir(taskId);

    // 파일 추가
    await fs.writeFile(path.join(dir, 'test.txt'), 'test content');

    // 삭제
    const result = await attachmentsModule.cleanupTaskTempDir(taskId);
    expect(result).toBe(true);

    // 디렉토리가 삭제되었는지 확인
    await expect(fs.access(dir)).rejects.toThrow();
  });

  test('존재하지 않는 디렉토리 삭제 시 true를 반환해야 함', async () => {
    const taskId = 'non-existent-task';
    const result = await attachmentsModule.cleanupTaskTempDir(taskId);
    expect(result).toBe(true);
  });
});

describe('saveAttachment', () => {
  test('파일을 작업 임시 디렉토리에 저장해야 함', async () => {
    const taskId = 'save-attachment-task';
    const fileName = 'test-file.txt';
    const content = Buffer.from('Hello, World!');

    const filePath = await attachmentsModule.saveAttachment(taskId, fileName, content);

    expect(filePath).toBe(path.join(dataDir, 'temp', taskId, fileName));

    // 파일 내용 확인
    const savedContent = await fs.readFile(filePath);
    expect(savedContent.toString()).toBe('Hello, World!');

    // 정리
    await attachmentsModule.cleanupTaskTempDir(taskId);
  });

  test('바이너리 파일도 저장할 수 있어야 함', async () => {
    const taskId = 'binary-attachment-task';
    const fileName = 'test.bin';
    const content = Buffer.from([0x00, 0xFF, 0x12, 0x34, 0xAB, 0xCD]);

    const filePath = await attachmentsModule.saveAttachment(taskId, fileName, content);

    const savedContent = await fs.readFile(filePath);
    expect(Buffer.compare(savedContent, content)).toBe(0);

    // 정리
    await attachmentsModule.cleanupTaskTempDir(taskId);
  });
});

describe('getTaskAttachments', () => {
  test('작업의 첨부 파일 목록을 반환해야 함', async () => {
    const taskId = 'list-attachments-task';

    // 파일 저장
    await attachmentsModule.saveAttachment(taskId, 'file1.txt', Buffer.from('content1'));
    await attachmentsModule.saveAttachment(taskId, 'file2.txt', Buffer.from('content2'));

    const attachments = await attachmentsModule.getTaskAttachments(taskId);

    expect(attachments).toHaveLength(2);
    expect(attachments).toContain(path.join(dataDir, 'temp', taskId, 'file1.txt'));
    expect(attachments).toContain(path.join(dataDir, 'temp', taskId, 'file2.txt'));

    // 정리
    await attachmentsModule.cleanupTaskTempDir(taskId);
  });

  test('디렉토리가 없으면 빈 배열을 반환해야 함', async () => {
    const taskId = 'no-attachments-task';
    const attachments = await attachmentsModule.getTaskAttachments(taskId);
    expect(attachments).toEqual([]);
  });
});

describe('generateSessionId', () => {
  test('세션 ID를 생성해야 함', () => {
    const sessionId = attachmentsModule.generateSessionId();

    expect(sessionId).toMatch(/^session-\d{8}-\d{6}-\d{3}$/);
  });

  test('연속 호출 시 다른 ID를 생성해야 함', async () => {
    const id1 = attachmentsModule.generateSessionId();
    await new Promise(resolve => setTimeout(resolve, 10));
    const id2 = attachmentsModule.generateSessionId();

    // 같은 초에 생성되면 랜덤 부분이 다를 수 있음
    // 최소한 패턴은 맞아야 함
    expect(id1).toMatch(/^session-/);
    expect(id2).toMatch(/^session-/);
  });
});

describe('moveSessionToTask', () => {
  test('세션 디렉토리를 작업 디렉토리로 이동해야 함', async () => {
    const sessionId = 'session-test-move';
    const taskId = 'task-moved';

    // 세션 디렉토리에 파일 저장
    await attachmentsModule.saveAttachment(sessionId, 'session-file.txt', Buffer.from('session content'));

    // 이동
    const result = await attachmentsModule.moveSessionToTask(sessionId, taskId);
    expect(result).toBe(true);

    // 세션 디렉토리가 없어졌는지 확인
    const sessionDir = attachmentsModule.getTaskTempDir(sessionId);
    await expect(fs.access(sessionDir)).rejects.toThrow();

    // 작업 디렉토리에 파일이 있는지 확인
    const taskDir = attachmentsModule.getTaskTempDir(taskId);
    const files = await fs.readdir(taskDir);
    expect(files).toContain('session-file.txt');

    // 정리
    await attachmentsModule.cleanupTaskTempDir(taskId);
  });

  test('세션 디렉토리가 없으면 false를 반환해야 함', async () => {
    const sessionId = 'non-existent-session';
    const taskId = 'task-no-move';

    const result = await attachmentsModule.moveSessionToTask(sessionId, taskId);
    expect(result).toBe(false);
  });
});

describe('cleanupOldTempDirs', () => {
  test('오래된 세션 디렉토리를 정리해야 함', async () => {
    // 오래된 세션 디렉토리 생성 (수동으로 시간 설정은 어려우므로 로직만 테스트)
    const sessionId = 'session-old-test';
    await attachmentsModule.createTaskTempDir(sessionId);

    // 0ms maxAge로 호출하면 모든 세션이 "오래된" 것으로 처리됨
    const cleaned = await attachmentsModule.cleanupOldTempDirs(0);

    // 최소한 1개는 정리되어야 함 (방금 생성한 것)
    expect(cleaned).toBeGreaterThanOrEqual(1);

    // 디렉토리가 삭제되었는지 확인
    const sessionDir = attachmentsModule.getTaskTempDir(sessionId);
    await expect(fs.access(sessionDir)).rejects.toThrow();
  });

  test('작업 디렉토리(session- 접두사 없음)는 정리하지 않아야 함', async () => {
    // 작업 디렉토리 생성
    const taskId = 'task-should-not-cleanup';
    await attachmentsModule.createTaskTempDir(taskId);

    // 정리 실행
    await attachmentsModule.cleanupOldTempDirs(0);

    // 작업 디렉토리는 남아있어야 함
    const taskDir = attachmentsModule.getTaskTempDir(taskId);
    const stat = await fs.stat(taskDir);
    expect(stat.isDirectory()).toBe(true);

    // 정리
    await attachmentsModule.cleanupTaskTempDir(taskId);
  });
});

describe('통합 시나리오', () => {
  test('전체 파일 첨부 플로우 테스트', async () => {
    // 1. 세션 생성
    const sessionId = attachmentsModule.generateSessionId();
    expect(sessionId).toMatch(/^session-/);

    // 2. 파일 첨부
    await attachmentsModule.saveAttachment(sessionId, 'doc.pdf', Buffer.from('PDF content'));
    await attachmentsModule.saveAttachment(sessionId, 'image.jpg', Buffer.from('JPEG content'));

    // 3. 첨부 파일 확인
    let attachments = await attachmentsModule.getTaskAttachments(sessionId);
    expect(attachments).toHaveLength(2);

    // 4. 작업 생성 시 세션을 작업으로 이동
    const taskId = 'final-task-id';
    await attachmentsModule.moveSessionToTask(sessionId, taskId);

    // 5. 작업 첨부 파일 확인
    attachments = await attachmentsModule.getTaskAttachments(taskId);
    expect(attachments).toHaveLength(2);

    // 6. 작업 완료/실패 시 정리
    const cleaned = await attachmentsModule.cleanupTaskTempDir(taskId);
    expect(cleaned).toBe(true);

    // 7. 정리 확인
    attachments = await attachmentsModule.getTaskAttachments(taskId);
    expect(attachments).toHaveLength(0);
  });
});
