/**
 * 초기화 로직
 * 최초 실행 시 환경 설정
 */

import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { getDataDir, saveConfig } from './config.js';
import { t } from './i18n.js';

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
    throw new Error(`Telegram API error: ${data.description}`);
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

  console.log(`\n⏳ ${t('init.waiting_for_start')}\n`);

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
            text: `🔑 ${t('init.your_chatid', { chatId })}\n\n${t('init.enter_chatid_in_cli')}`
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
      console.log(t('init.gitignore_updated'));
    }
  } catch (err) {
    /* istanbul ignore next */
    // internal warning - not translated
    console.warn('gitignore update failed:', err.message);
  }
}

/**
 * 환경 초기화
 * @param {string} cwd - 현재 작업 디렉토리
 */
/* istanbul ignore next */
export async function initialize(cwd) {
  console.log(`\n🚀 ${t('init.starting')}\n`);

  const dataDir = getDataDir();

  // 1. 폴더 생성
  console.log(`📁 ${t('init.creating_folders')}`);
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
  console.log(`\n📱 ${t('init.telegram_setup')}\n`);
  console.log(`${t('init.botfather_instruction1')}`);
  console.log(`   ${t('init.botfather_instruction2')}\n`);

  const botToken = await prompt(t('init.enter_bot_token'));

  if (!botToken) {
    throw new Error(t('init.bot_token_required'));
  }

  // 5. 봇 토큰 유효성 검사
  console.log(`\n🔍 ${t('init.validating_token')}`);
  const validation = await validateBotToken(botToken);

  if (!validation.valid) {
    throw new Error(t('init.invalid_token', { error: validation.error }));
  }

  console.log(`✅ ${t('init.bot_confirmed', { botName: validation.botName })}`);

  // 6. /start 메시지 대기
  console.log(`\n${t('init.send_start_instruction', { botName: validation.botName })}`);

  const { chatId: detectedChatId, username } = await waitForStartMessage(botToken);

  console.log(`\n📨 ${t('init.message_received')}`);
  console.log(`   ${t('init.user', { username })}`);
  console.log(`   ${t('init.chatid_received', { chatId: detectedChatId })}\n`);

  // 7. chatId 검증 입력
  const inputChatId = await prompt(t('init.enter_chatid'));

  if (inputChatId !== detectedChatId) {
    throw new Error(t('init.chatid_mismatch'));
  }

  // 8. 기본 반복횟수 입력
  console.log(`\n⚙️ ${t('init.default_settings')}\n`);
  const maxRetriesInput = await prompt(t('init.enter_max_retries', { recommended: '15' }));
  const defaultMaxRetries = parseInt(maxRetriesInput, 10) || 15;

  // 9. 병렬 실행 설정
  console.log(`\n🔄 ${t('init.parallel_settings')}\n`);
  console.log(t('init.parallel_description'));
  console.log(`${t('init.parallel_warning')}\n`);
  const parallelInput = await prompt(t('init.enable_parallel'));
  const parallelExecution = parallelInput.toLowerCase() === 'y';

  let maxParallel = 3;
  if (parallelExecution) {
    const maxParallelInput = await prompt(t('init.enter_max_parallel', { recommended: '3' }));
    maxParallel = parseInt(maxParallelInput, 10) || 3;
    if (maxParallel < 1) maxParallel = 1;
    if (maxParallel > 10) maxParallel = 10;
    console.log(`✅ ${t('init.parallel_enabled', { count: maxParallel })}`);
  } else {
    console.log(`✅ ${t('init.sequential_mode')}`);
  }

  // 10. 타임아웃 설정
  console.log(`\n⏱️ ${t('init.timeout_setting')}\n`);
  const timeoutInput = await prompt(t('init.enter_timeout', { recommended: '30' }));
  let taskTimeout = parseInt(timeoutInput, 10) || 30;
  if (taskTimeout < 5) taskTimeout = 5;     // 최소 5분
  if (taskTimeout > 180) taskTimeout = 180; // 최대 3시간
  console.log(`✅ ${t('init.timeout_set', { minutes: taskTimeout })}`);

  // 11. 설정 저장
  await saveConfig({ botToken, chatId: detectedChatId, debugMode: false, defaultMaxRetries, parallelExecution, maxParallel, taskTimeout });

  // 12. 봇 명령어 등록 (자동완성용)
  console.log(`📝 ${t('init.registering_commands')}`);
  const commands = [
    { command: 'start', description: t('telegram.cmd_start') },
    { command: 'new', description: t('telegram.cmd_new') },
    { command: 'list', description: t('telegram.cmd_list') },
    { command: 'completed', description: t('telegram.cmd_completed') },
    { command: 'failed', description: t('telegram.cmd_failed') },
    { command: 'status', description: t('telegram.cmd_status') },
    { command: 'debug', description: t('telegram.cmd_debug') },
    { command: 'cancel', description: t('telegram.cmd_cancel') }
  ];

  try {
    await callTelegramApi(botToken, 'setMyCommands', { commands });
    console.log(`✅ ${t('init.commands_registered')}`);
  } catch (err) {
    console.warn(`⚠️ ${t('init.commands_failed', { error: err.message })}`);
  }

  // 확인 메시지 전송
  await callTelegramApi(botToken, 'sendMessage', {
    chat_id: detectedChatId,
    text: t('init.setup_complete_telegram')
  });

  console.log(`\n✅ ${t('init.init_complete')}`);
  console.log(`   ${t('init.run_instruction')}\n`);
}
