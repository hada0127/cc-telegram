/**
 * 첨부 파일 관리 유틸리티
 * 파일 다운로드, 저장, 정리 기능
 */

import fs from 'fs/promises';
import path from 'path';
import { getDataDir } from '../config.js';
import { debug, error as logError } from './logger.js';

/**
 * 임시 파일 디렉토리 경로 반환
 * @returns {string}
 */
export function getTempDir() {
  return path.join(getDataDir(), 'temp');
}

/**
 * 작업별 임시 디렉토리 경로 반환
 * @param {string} taskId
 * @returns {string}
 */
export function getTaskTempDir(taskId) {
  return path.join(getTempDir(), taskId);
}

/**
 * 작업별 임시 디렉토리 생성
 * @param {string} taskId
 * @returns {Promise<string>} 생성된 디렉토리 경로
 */
export async function createTaskTempDir(taskId) {
  const dir = getTaskTempDir(taskId);
  await fs.mkdir(dir, { recursive: true });
  debug('Task temp directory created', { taskId, dir });
  return dir;
}

/**
 * 작업별 임시 디렉토리 삭제
 * @param {string} taskId
 * @returns {Promise<boolean>} 삭제 성공 여부
 */
export async function cleanupTaskTempDir(taskId) {
  const dir = getTaskTempDir(taskId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
    debug('Task temp directory cleaned', { taskId, dir });
    return true;
  } catch (err) {
    // 디렉토리가 없으면 무시
    if (err.code === 'ENOENT') {
      return true;
    }
    logError('Failed to cleanup task temp directory', { taskId, error: err.message });
    return false;
  }
}

/**
 * 파일을 작업 임시 디렉토리에 저장
 * @param {string} taskId
 * @param {string} fileName
 * @param {Buffer} content
 * @returns {Promise<string>} 저장된 파일 경로
 */
export async function saveAttachment(taskId, fileName, content) {
  const dir = await createTaskTempDir(taskId);
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, content);
  debug('Attachment saved', { taskId, fileName, filePath });
  return filePath;
}

/**
 * 작업의 첨부 파일 목록 조회
 * @param {string} taskId
 * @returns {Promise<string[]>} 파일 경로 목록
 */
export async function getTaskAttachments(taskId) {
  const dir = getTaskTempDir(taskId);
  try {
    const files = await fs.readdir(dir);
    return files.map(file => path.join(dir, file));
  } catch (err) {
    // 디렉토리가 없으면 빈 배열
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

/**
 * 임시 세션 ID 생성 (파일 첨부를 위한 임시 ID)
 * @returns {string}
 */
export function generateSessionId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');

  return `session-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
}

/**
 * 세션 디렉토리를 작업 디렉토리로 이동 (rename)
 * @param {string} sessionId
 * @param {string} taskId
 * @returns {Promise<boolean>} 성공 여부
 */
export async function moveSessionToTask(sessionId, taskId) {
  const sessionDir = getTaskTempDir(sessionId);
  const taskDir = getTaskTempDir(taskId);

  try {
    // 세션 디렉토리가 존재하는지 확인
    await fs.access(sessionDir);

    // 작업 디렉토리로 이동 (rename)
    await fs.rename(sessionDir, taskDir);
    debug('Session directory moved to task', { sessionId, taskId });
    return true;
  } catch (err) {
    // 세션 디렉토리가 없으면 무시 (첨부 파일이 없는 경우)
    if (err.code === 'ENOENT') {
      return false;
    }
    logError('Failed to move session directory to task', { sessionId, taskId, error: err.message });
    return false;
  }
}

/**
 * 모든 임시 디렉토리 정리 (오래된 세션 정리용)
 * @param {number} maxAgeMs - 최대 유지 시간 (밀리초)
 * @returns {Promise<number>} 삭제된 디렉토리 수
 */
export async function cleanupOldTempDirs(maxAgeMs = 24 * 60 * 60 * 1000) {
  const tempDir = getTempDir();
  let cleaned = 0;

  try {
    const entries = await fs.readdir(tempDir, { withFileTypes: true });
    const now = Date.now();

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // session- 으로 시작하는 오래된 디렉토리만 정리
      if (!entry.name.startsWith('session-')) continue;

      const dirPath = path.join(tempDir, entry.name);
      try {
        const stat = await fs.stat(dirPath);
        const age = now - stat.mtimeMs;

        if (age > maxAgeMs) {
          await fs.rm(dirPath, { recursive: true, force: true });
          cleaned++;
          debug('Old session directory cleaned', { dir: entry.name, ageMs: age });
        }
      } catch {
        // 개별 디렉토리 처리 실패 시 무시하고 계속
      }
    }
  } catch (err) {
    // temp 디렉토리가 없으면 무시
    if (err.code !== 'ENOENT') {
      logError('Failed to cleanup old temp directories', { error: err.message });
    }
  }

  return cleaned;
}
