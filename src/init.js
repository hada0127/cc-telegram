/**
 * 초기화 로직
 * 최초 실행 시 환경 설정
 */

import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { getDataDir, saveConfig } from './config.js';

/**
 * readline 인터페이스로 사용자 입력 받기
 * @param {string} question
 * @returns {Promise<string>}
 */
/* istanbul ignore next */
export function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * 텔레그램 API 호출
 * @param {string} botToken
 * @param {string} method
 * @param {object} params
 */
export async function callTelegramApi(botToken, method, params = {}) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram API 오류: ${data.description}`);
  }
  return data.result;
}

/**
 * 봇 토큰 유효성 검사
 * @param {string} botToken
 * @returns {Promise<{valid: boolean, botName?: string, error?: string}>}
 */
export async function validateBotToken(botToken) {
  try {
    const result = await callTelegramApi(botToken, 'getMe');
    return { valid: true, botName: result.username };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * /start 메시지 대기 및 chatId 감지
 * @param {string} botToken
 * @returns {Promise<{chatId: string, username: string}>}
 */
/* istanbul ignore next */
export async function waitForStartMessage(botToken) {
  let lastUpdateId = 0;

  console.log('\n⏳ /start 메시지를 기다리는 중...\n');

  while (true) {
    try {
      const updates = await callTelegramApi(botToken, 'getUpdates', {
        offset: lastUpdateId + 1,
        timeout: 10,
        allowed_updates: ['message']
      });

      for (const update of updates) {
        lastUpdateId = update.update_id;

        if (update.message && update.message.text === '/start') {
          const chatId = update.message.chat.id.toString();
          const username = update.message.from.username || update.message.from.first_name || 'Unknown';

          // 사용자에게 chatId 알려주기
          await callTelegramApi(botToken, 'sendMessage', {
            chat_id: chatId,
            text: `🔑 당신의 chatId: ${chatId}\n\nCLI에서 이 값을 입력하세요.`
          });

          return { chatId, username };
        }
      }
    } catch (err) {
      // 폴링 오류 무시
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * .gitignore에 .cc-telegram 추가
 * @param {string} cwd
 */
export async function updateGitignore(cwd) {
  const gitignorePath = path.join(cwd, '.gitignore');
  const gitDirPath = path.join(cwd, '.git');

  try {
    // .git 폴더 존재 확인
    let isGitRepo = false;
    try {
      const stat = await fs.stat(gitDirPath);
      isGitRepo = stat.isDirectory();
    } catch {
      // .git 폴더 없음 - Git 저장소가 아님
      return;
    }

    if (!isGitRepo) return;

    // .gitignore 읽기 또는 새로 생성
    let content = '';
    try {
      content = await fs.readFile(gitignorePath, 'utf8');
    } catch {
      // .gitignore가 없으면 새로 생성
      content = '';
    }

    if (!content.includes('.cc-telegram')) {
      const entry = '# cc-telegram\n.cc-telegram/\n';
      const newContent = content
        ? (content.endsWith('\n') ? `${content}\n${entry}` : `${content}\n\n${entry}`)
        : entry;
      await fs.writeFile(gitignorePath, newContent);
      console.log('.gitignore에 .cc-telegram/ 추가됨');
    }
  } catch (err) {
    /* istanbul ignore next */
    console.warn('.gitignore 업데이트 실패:', err.message);
  }
}

/**
 * 환경 초기화
 * @param {string} cwd - 현재 작업 디렉토리
 */
/* istanbul ignore next */
export async function initialize(cwd) {
  console.log('\n🚀 cc-telegram 초기화를 시작합니다.\n');

  const dataDir = getDataDir();

  // 1. 폴더 생성
  console.log('📁 폴더 구조 생성 중...');
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(path.join(dataDir, 'tasks'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'completed'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'failed'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'logs'), { recursive: true });

  // 2. 초기 JSON 파일 생성
  const initialTasks = { lastUpdated: '', tasks: [] };
  const initialList = { tasks: [] };

  await fs.writeFile(
    path.join(dataDir, 'tasks.json'),
    JSON.stringify(initialTasks, null, 2)
  );
  await fs.writeFile(
    path.join(dataDir, 'completed.json'),
    JSON.stringify(initialList, null, 2)
  );
  await fs.writeFile(
    path.join(dataDir, 'failed.json'),
    JSON.stringify(initialList, null, 2)
  );

  // 3. .gitignore 업데이트
  await updateGitignore(cwd);

  // 4. 사용자 정보 입력
  console.log('\n📱 텔레그램 봇 설정\n');
  console.log('1. @BotFather에서 봇을 생성하고 토큰을 받으세요.');
  console.log('   (https://t.me/BotFather 에서 /newbot 명령어 사용)\n');

  const botToken = await prompt('봇 토큰을 입력하세요: ');

  if (!botToken) {
    throw new Error('봇 토큰이 필요합니다.');
  }

  // 5. 봇 토큰 유효성 검사
  console.log('\n🔍 봇 토큰 확인 중...');
  const validation = await validateBotToken(botToken);

  if (!validation.valid) {
    throw new Error(`유효하지 않은 봇 토큰: ${validation.error}`);
  }

  console.log(`✅ 봇 확인됨: @${validation.botName}`);

  // 6. /start 메시지 대기
  console.log('\n2. 텔레그램에서 봇(@' + validation.botName + ')에게 /start 메시지를 보내세요.');

  const { chatId: detectedChatId, username } = await waitForStartMessage(botToken);

  console.log(`\n📨 메시지 수신됨!`);
  console.log(`   사용자: ${username}`);
  console.log(`   chatId: ${detectedChatId}\n`);

  // 7. chatId 검증 입력
  const inputChatId = await prompt('위 chatId를 입력하여 확인하세요: ');

  if (inputChatId !== detectedChatId) {
    throw new Error('chatId가 일치하지 않습니다. 다시 시도해주세요.');
  }

  // 8. 기본 반복횟수 입력
  console.log('\n⚙️ 기본 설정\n');
  const maxRetriesInput = await prompt('기본 반복횟수를 입력하세요 (15 권장): ');
  const defaultMaxRetries = parseInt(maxRetriesInput, 10) || 15;

  // 9. 병렬 실행 설정
  console.log('\n🔄 병렬 실행 설정\n');
  console.log('여러 작업을 동시에 실행할 수 있습니다.');
  console.log('주의: 병렬 실행 시 시스템 리소스를 더 많이 사용합니다.\n');
  const parallelInput = await prompt('병렬 실행을 사용하시겠습니까? (y/N): ');
  const parallelExecution = parallelInput.toLowerCase() === 'y';

  let maxParallel = 3;
  if (parallelExecution) {
    const maxParallelInput = await prompt('최대 동시 실행 개수를 입력하세요 (3 권장): ');
    maxParallel = parseInt(maxParallelInput, 10) || 3;
    if (maxParallel < 1) maxParallel = 1;
    if (maxParallel > 10) maxParallel = 10;
    console.log(`✅ 병렬 실행: 최대 ${maxParallel}개 동시 실행`);
  } else {
    console.log('✅ 순차 실행 모드');
  }

  // 10. 설정 저장
  await saveConfig({ botToken, chatId: detectedChatId, debugMode: false, defaultMaxRetries, parallelExecution, maxParallel });

  // 11. 봇 명령어 등록 (자동완성용)
  console.log('📝 봇 명령어 등록 중...');
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

  try {
    await callTelegramApi(botToken, 'setMyCommands', { commands });
    console.log('✅ 봇 명령어 등록 완료');
  } catch (err) {
    console.warn('⚠️ 봇 명령어 등록 실패:', err.message);
  }

  // 확인 메시지 전송
  await callTelegramApi(botToken, 'sendMessage', {
    chat_id: detectedChatId,
    text: '✅ cc-telegram 설정이 완료되었습니다!\n\n봇이 시작되면 알림을 받을 수 있습니다.\n\n/를 입력하면 명령어 목록을 볼 수 있습니다.'
  });

  console.log('\n✅ 초기화가 완료되었습니다!');
  console.log('   npx cc-telegram 을 실행하면 텔레그램 봇이 시작됩니다.\n');
}
