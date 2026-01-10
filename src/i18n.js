/**
 * 다국어(i18n) 지원 모듈
 * 시스템 언어 감지 및 번역 기능 제공
 */

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// 지원하는 언어 목록 (세계에서 가장 많이 쓰이는 10개 언어)
const SUPPORTED_LANGUAGES = [
  'ko', // 한국어
  'en', // 영어
  'zh', // 중국어
  'es', // 스페인어
  'hi', // 힌디어
  'ar', // 아랍어
  'pt', // 포르투갈어
  'ru', // 러시아어
  'ja', // 일본어
  'fr', // 프랑스어
  'de'  // 독일어
];

// 기본 언어
const DEFAULT_LANGUAGE = 'en';

// 현재 로드된 번역 데이터
let translations = null;
let currentLanguage = null;

/**
 * 시스템 언어 감지
 * @returns {string} 언어 코드 (예: 'ko', 'en', 'zh')
 */
export function detectSystemLanguage() {
  // Windows에서는 시스템 로케일을 우선 사용 (환경 변수가 실제 시스템 언어와 다를 수 있음)
  if (process.platform === 'win32') {
    try {
      const { execSync } = require('child_process');
      const result = execSync('powershell -NoProfile -Command "[System.Globalization.CultureInfo]::CurrentUICulture.TwoLetterISOLanguageName"', {
        encoding: 'utf8',
        timeout: 5000,
        windowsHide: true
      }).trim().toLowerCase();

      if (SUPPORTED_LANGUAGES.includes(result)) {
        return result;
      }
    } catch {
      // PowerShell 실패 시 환경 변수로 폴백
    }
  }

  // 환경 변수에서 언어 설정 확인 (Unix 계열 및 Windows 폴백)
  const envLang = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || process.env.LC_MESSAGES;

  if (envLang) {
    // 언어 코드 추출 (예: 'ko_KR.UTF-8' -> 'ko', 'zh_CN.UTF-8' -> 'zh')
    const langCode = envLang.split('_')[0].split('.')[0].toLowerCase();
    if (SUPPORTED_LANGUAGES.includes(langCode)) {
      return langCode;
    }
  }

  return DEFAULT_LANGUAGE;
}

/**
 * 번역 데이터 로드
 * @param {string} [lang] - 언어 코드 (미지정 시 자동 감지)
 */
export function loadTranslations(lang) {
  const language = lang || detectSystemLanguage();

  try {
    const localePath = path.join(__dirname, 'locales', `${language}.json`);
    translations = require(localePath);
    currentLanguage = language;
  } catch {
    // 지원하지 않는 언어면 영어로 폴백
    try {
      const fallbackPath = path.join(__dirname, 'locales', `${DEFAULT_LANGUAGE}.json`);
      translations = require(fallbackPath);
      currentLanguage = DEFAULT_LANGUAGE;
    } catch (err) {
      throw new Error(`Failed to load translations: ${err.message}`);
    }
  }
}

/**
 * 번역 문자열 가져오기
 * @param {string} key - 번역 키 (점 표기법, 예: 'app.name', 'telegram.bot_greeting')
 * @param {object} [params] - 치환할 파라미터 (예: { chatId: '123' })
 * @returns {string} 번역된 문자열
 */
export function t(key, params = {}) {
  // 번역 데이터가 없으면 로드
  if (!translations) {
    loadTranslations();
  }

  // 점 표기법으로 중첩된 키 접근
  const keys = key.split('.');
  let value = translations;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // 키를 찾지 못하면 키 자체를 반환
      return key;
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

  // 파라미터 치환 (예: {chatId} -> 실제 값)
  return value.replace(/\{(\w+)\}/g, (match, paramName) => {
    return params[paramName] !== undefined ? params[paramName] : match;
  });
}

/**
 * 현재 언어 가져오기
 * @returns {string} 현재 언어 코드
 */
export function getCurrentLanguage() {
  if (!currentLanguage) {
    loadTranslations();
  }
  return currentLanguage;
}

/**
 * 지원하는 언어 목록 가져오기
 * @returns {string[]} 지원하는 언어 코드 배열
 */
export function getSupportedLanguages() {
  return [...SUPPORTED_LANGUAGES];
}

/**
 * 언어 변경
 * @param {string} lang - 언어 코드
 * @returns {boolean} 성공 여부
 */
export function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    return false;
  }
  loadTranslations(lang);
  return true;
}

// 모듈 로드 시 자동으로 번역 데이터 초기화
loadTranslations();
