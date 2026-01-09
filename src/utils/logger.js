/**
 * 로깅 유틸리티
 */

import fs from 'fs/promises';
import path from 'path';

let logDir = null;
let debugMode = false;

/**
 * 로거 초기화
 * @param {string} logsPath - 로그 디렉토리 경로
 * @param {boolean} debug - 디버그 모드
 */
export function initLogger(logsPath, debug = false) {
  logDir = logsPath;
  debugMode = debug;
}

/**
 * 로그 메시지 출력 및 파일 저장
 * @param {string} level - 로그 레벨 (info, warn, error, debug)
 * @param {string} message - 로그 메시지
 * @param {any} [data] - 추가 데이터
 */
export async function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  // 콘솔 출력
  if (level === 'error') {
    console.error(logLine, data || '');
  } else if (level === 'warn') {
    console.warn(logLine, data || '');
  } else if (level === 'debug' && debugMode) {
    console.log(logLine, data || '');
  } else if (level === 'info') {
    console.log(logLine, data || '');
  }

  // 파일 저장
  if (logDir) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(logDir, `${today}.log`);
      const fileContent = data
        ? `${logLine} ${JSON.stringify(data)}\n`
        : `${logLine}\n`;
      await fs.appendFile(logFile, fileContent);
    } catch (err) {
      // 로그 저장 실패는 무시
    }
  }
}

export const info = (msg, data) => log('info', msg, data);
export const warn = (msg, data) => log('warn', msg, data);
export const error = (msg, data) => log('error', msg, data);
export const debug = (msg, data) => log('debug', msg, data);
