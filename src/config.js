/**
 * 설정 관리
 */

import fs from 'fs/promises';
import path from 'path';
import { encrypt, decrypt } from './utils/encryption.js';

/** @type {string} 현재 작업 디렉토리 */
let cwd = process.cwd();

/** @type {object|null} 캐시된 설정 */
let cachedConfig = null;

/**
 * 작업 디렉토리 설정
 * @param {string} dir
 */
export function setCwd(dir) {
  cwd = dir;
  cachedConfig = null;
}

/**
 * .cc-telegram 폴더 경로
 * @returns {string}
 */
export function getDataDir() {
  return path.join(cwd, '.cc-telegram');
}

/**
 * config.json 경로
 * @returns {string}
 */
export function getConfigPath() {
  return path.join(getDataDir(), 'config.json');
}

/**
 * 설정 파일 존재 여부 확인
 * @returns {Promise<boolean>}
 */
export async function configExists() {
  try {
    await fs.access(getConfigPath());
    return true;
  } catch {
    return false;
  }
}

/**
 * 설정 로드
 * @returns {Promise<{botToken: string, chatId: string, debugMode: boolean, claudeCommand: string|null, logRetentionDays: number, defaultMaxRetries: number, parallelExecution: boolean, maxParallel: number, taskTimeout: number}>}
 */
export async function loadConfig() {
  if (cachedConfig) return cachedConfig;

  const configPath = getConfigPath();
  const content = await fs.readFile(configPath, 'utf8');
  const config = JSON.parse(content);

  cachedConfig = {
    botToken: decrypt(config.botToken),
    chatId: decrypt(config.chatId),
    debugMode: config.debugMode || false,
    claudeCommand: config.claudeCommand || null, // null이면 자동 감지
    logRetentionDays: config.logRetentionDays || 7,
    defaultMaxRetries: config.defaultMaxRetries || 15,
    parallelExecution: config.parallelExecution || false,
    maxParallel: config.maxParallel || 3,
    taskTimeout: config.taskTimeout || 30 // 기본 30분
  };

  return cachedConfig;
}

/**
 * 설정 저장
 * @param {object} config
 * @param {string} config.botToken
 * @param {string} config.chatId
 * @param {boolean} [config.debugMode]
 * @param {string|null} [config.claudeCommand]
 * @param {number} [config.logRetentionDays]
 * @param {number} [config.defaultMaxRetries]
 * @param {boolean} [config.parallelExecution]
 * @param {number} [config.maxParallel]
 * @param {number} [config.taskTimeout]
 */
export async function saveConfig({ botToken, chatId, debugMode = false, claudeCommand = null, logRetentionDays = 7, defaultMaxRetries = 15, parallelExecution = false, maxParallel = 3, taskTimeout = 30 }) {
  const configPath = getConfigPath();
  const encryptedConfig = {
    botToken: encrypt(botToken),
    chatId: encrypt(chatId),
    debugMode,
    claudeCommand,
    logRetentionDays,
    defaultMaxRetries,
    parallelExecution,
    maxParallel,
    taskTimeout
  };

  await fs.writeFile(configPath, JSON.stringify(encryptedConfig, null, 2));
  cachedConfig = { botToken, chatId, debugMode, claudeCommand, logRetentionDays, defaultMaxRetries, parallelExecution, maxParallel, taskTimeout };
}

/**
 * 설정 캐시 초기화
 */
export function clearConfigCache() {
  cachedConfig = null;
}
