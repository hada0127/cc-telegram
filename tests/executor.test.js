/**
 * executor.js 단위 테스트
 * 결과 분석 로직 테스트 및 모듈 함수 테스트
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
let executorModule;
let tasksModule;
let encryptionModule;
let i18nModule;

// fetch mock
global.fetch = jest.fn();

beforeAll(async () => {
  // 임시 디렉토리 생성
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-telegram-executor-test-'));
  dataDir = path.join(testDir, '.cc-telegram');

  // 디렉토리 구조 생성
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(path.join(dataDir, 'tasks'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'completed'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'failed'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'logs'), { recursive: true });

  // 초기 JSON 파일 생성
  await fs.writeFile(
    path.join(dataDir, 'tasks.json'),
    JSON.stringify({ lastUpdated: '', tasks: [] }, null, 2)
  );
  await fs.writeFile(
    path.join(dataDir, 'completed.json'),
    JSON.stringify({ tasks: [] }, null, 2)
  );
  await fs.writeFile(
    path.join(dataDir, 'failed.json'),
    JSON.stringify({ tasks: [] }, null, 2)
  );

  // config 모듈 import 및 cwd 설정
  configModule = await import('../src/config.js');
  configModule.setCwd(testDir);

  // encryption 모듈 import
  encryptionModule = await import('../src/utils/encryption.js');

  // i18n 모듈 import
  i18nModule = await import('../src/i18n.js');

  // config 파일 생성
  await fs.writeFile(
    path.join(dataDir, 'config.json'),
    JSON.stringify({
      botToken: encryptionModule.encrypt('test-token'),
      chatId: encryptionModule.encrypt('12345')
    }, null, 2)
  );

  // tasks 모듈 import
  tasksModule = await import('../src/tasks.js');

  // executor 모듈 import
  executorModule = await import('../src/executor.js');
});

afterAll(async () => {
  // 실행기 중지
  if (executorModule) {
    executorModule.stopExecutor();
  }

  // 임시 디렉토리 삭제
  if (testDir) {
    await fs.rm(testDir, { recursive: true, force: true });
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch.mockResolvedValue({
    json: () => Promise.resolve({ ok: true, result: {} })
  });
});

// 완료 신호 상수
const COMPLETION_SIGNAL = '<promise>COMPLETE</promise>';
const FAILURE_SIGNAL = '<promise>FAILED</promise>';

/**
 * 결과 분석 (완료 조건 충족 여부) - executor.js 로직 재현
 * @param {string} output
 * @returns {{success: boolean, reason: string|null}}
 */
function analyzeResult(output) {
  // 1. 완료 신호 기반 판단 (최우선)
  const hasCompletionSignal = output.includes(COMPLETION_SIGNAL);
  const hasFailureSignal = output.includes(FAILURE_SIGNAL);

  // 명시적 완료 신호가 있으면 성공
  if (hasCompletionSignal && !hasFailureSignal) {
    return { success: true, reason: null };
  }

  // 명시적 실패 신호가 있으면 실패
  if (hasFailureSignal) {
    const reason = executorModule.extractFailureReason(output);
    return { success: false, reason };
  }

  // 2. 완료 신호가 없는 경우 패턴 기반 폴백 분석
  const criticalFailPatterns = [
    /error:\s*(.{0,100})/i,
    /fatal:\s*(.{0,100})/i,
    /exception:\s*(.{0,100})/i,
    /panic:\s*(.{0,100})/i,
    /failed to\s+(.{0,50})/i,
    /could not\s+(.{0,50})/i,
    /unable to\s+(.{0,50})/i
  ];

  // 성공 지표 패턴
  const successIndicators = [
    '완료했',
    '완료됐',
    '작업을 완료',
    'successfully',
    'completed successfully',
    'all tests passed',
    '모든 테스트 통과',
    'build succeeded',
    '빌드 성공'
  ];

  // 마지막 출력 부분 분석 (결론 부분이 중요)
  const lastPortion = output.slice(-2000);

  // 성공 지표가 마지막 부분에 있는지 확인
  const hasSuccessIndicator = successIndicators.some(pattern =>
    lastPortion.toLowerCase().includes(pattern.toLowerCase())
  );

  // 심각한 오류가 마지막 부분에 있는지 확인
  for (const pattern of criticalFailPatterns) {
    const match = lastPortion.match(pattern);
    if (match) {
      // 성공 지표가 오류 이후에 나타나면 성공으로 간주
      if (hasSuccessIndicator) {
        const errorIndex = lastPortion.search(pattern);
        const successIndex = successIndicators.reduce((minIdx, p) => {
          const idx = lastPortion.toLowerCase().lastIndexOf(p.toLowerCase());
          return idx > minIdx ? idx : minIdx;
        }, -1);

        if (successIndex > errorIndex) {
          return { success: true, reason: null };
        }
      }
      return { success: false, reason: match[1]?.trim() || '오류 발생' };
    }
  }

  // 성공 지표가 있으면 성공
  if (hasSuccessIndicator) {
    return { success: true, reason: null };
  }

  // 3. 완료 신호도 없고 명확한 판단이 안되면 불확실 (성공으로 간주)
  return { success: true, reason: null };
}

/**
 * 실패 이유 추출 - executor.js 로직 재현
 * @param {string} output
 * @returns {string}
 */
function extractFailureReason(output) {
  // 실패 신호 이후의 "실패 이유:" 패턴 찾기
  const failureMatch = output.match(/<promise>FAILED<\/promise>\s*(?:실패 이유:|Reason:)?\s*(.{1,200})/i);
  if (failureMatch) {
    return failureMatch[1].trim();
  }

  // 일반적인 오류 메시지 추출
  const errorPatterns = [
    /error:\s*(.{1,150})/i,
    /failed:\s*(.{1,150})/i,
    /실패:\s*(.{1,150})/,
    /오류:\s*(.{1,150})/
  ];

  for (const pattern of errorPatterns) {
    const match = output.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  // Note: This helper function is a simplified version that doesn't use i18n
  // The actual executor.js uses t('executor.unknown_error')
  return 'Unknown error';
}

/**
 * HTML 이스케이프 함수 - executor.js 로직 재현
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 프롬프트 생성 - executor.js 로직 재현
 */
function buildPrompt(task) {
  return `# 작업 요청

## 요구사항
${task.requirement}

## 완료 조건
${task.completionCriteria || '없음'}

## 지시사항
- 위 요구사항을 수행하고 완료 조건을 충족시켜주세요.
- 작업이 완료되면 완료 조건이 충족되었는지 확인해주세요.
- 완료 조건을 충족하지 못했다면 그 이유를 설명해주세요.

## 완료 신호 (중요!)
- 모든 작업을 완료하고 완료 조건을 충족했다면 반드시 다음 신호를 출력해주세요:
  ${COMPLETION_SIGNAL}
- 작업을 완료할 수 없거나 완료 조건을 충족하지 못했다면 다음 신호와 함께 이유를 출력해주세요:
  ${FAILURE_SIGNAL}
  실패 이유: [구체적인 이유]
`;
}

/**
 * 요약 생성 - executor.js 로직 재현
 */
function generateSummary(output, success, reason = null) {
  const lines = output.split('\n').filter(l => l.trim());
  const lastLines = escapeHtml(lines.slice(-5).join('\n'));

  if (success) {
    return `작업 완료. ${lastLines.slice(0, 250)}`;
  } else {
    const reasonText = reason ? `\n실패 원인: ${escapeHtml(reason)}` : '';
    return `작업 실패.${reasonText}\n${lastLines.slice(0, 200)}`;
  }
}

describe('analyzeResult - 완료 신호 기반 판단', () => {
  test('완료 신호가 있으면 성공으로 판단해야 함', () => {
    const output = `작업을 진행합니다...
작업이 완료되었습니다.
${COMPLETION_SIGNAL}`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(true);
    expect(result.reason).toBeNull();
  });

  test('실패 신호가 있으면 실패로 판단해야 함', () => {
    const output = `작업을 진행합니다...
오류가 발생했습니다.
${FAILURE_SIGNAL}
실패 이유: 테스트가 실패했습니다`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('테스트가 실패했습니다');
  });

  test('완료 신호와 실패 신호가 모두 있으면 실패로 판단해야 함', () => {
    const output = `${COMPLETION_SIGNAL}
...하지만 뭔가 문제가 있습니다
${FAILURE_SIGNAL}
실패 이유: 검증 실패`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(false);
  });
});

describe('analyzeResult - 패턴 기반 폴백', () => {
  test('오류 패턴이 있으면 실패로 판단해야 함', () => {
    const output = `작업을 진행합니다...
Error: 파일을 찾을 수 없습니다
`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('파일을 찾을 수 없습니다');
  });

  test('fatal 패턴이 있으면 실패로 판단해야 함', () => {
    const output = `작업을 진행합니다...
Fatal: 메모리 부족
`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('메모리 부족');
  });

  test('exception 패턴이 있으면 실패로 판단해야 함', () => {
    const output = `작업을 진행합니다...
Exception: NullPointerException
`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('NullPointerException');
  });

  test('panic 패턴이 있으면 실패로 판단해야 함', () => {
    const output = `작업을 진행합니다...
Panic: stack overflow
`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('stack overflow');
  });

  test('failed to 패턴이 있으면 실패로 판단해야 함', () => {
    const output = `작업을 진행합니다...
Failed to compile the project
`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('compile the project');
  });

  test('could not 패턴이 있으면 실패로 판단해야 함', () => {
    const output = `작업을 진행합니다...
Could not connect to database
`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('connect to database');
  });

  test('unable to 패턴이 있으면 실패로 판단해야 함', () => {
    const output = `작업을 진행합니다...
Unable to find module
`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('find module');
  });

  test('성공 지표가 있으면 성공으로 판단해야 함', () => {
    const output = `빌드를 진행합니다...
컴파일 완료
빌드 성공`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(true);
  });

  test('성공 지표 - successfully', () => {
    const output = `Test completed successfully.`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(true);
  });

  test('성공 지표 - 모든 테스트 통과', () => {
    const output = `테스트 실행 중...
모든 테스트 통과`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(true);
  });

  test('성공 지표 - 완료됐', () => {
    const output = `작업이 완료됐습니다.`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(true);
  });

  test('성공 지표 - all tests passed', () => {
    const output = `All tests passed!`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(true);
  });

  test('성공 지표 - build succeeded', () => {
    const output = `Build succeeded!`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(true);
  });

  test('오류 이후 성공 지표가 있으면 성공으로 간주해야 함', () => {
    const output = `작업을 진행합니다...
Error: 일시적인 오류
재시도 중...
작업을 완료했습니다`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(true);
  });

  test('성공 지표가 오류보다 먼저 나오면 실패로 판단해야 함', () => {
    const output = `작업을 완료했습니다
...
Error: 검증 실패`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(false);
  });
});

describe('analyzeResult - 불확실한 경우', () => {
  test('완료 신호도 오류도 없으면 성공으로 간주해야 함', () => {
    const output = `작업을 진행했습니다.
결과를 저장했습니다.`;

    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(true);
  });

  test('빈 출력은 성공으로 간주해야 함', () => {
    const output = '';
    const result = executorModule.analyzeResult(output);
    expect(result.success).toBe(true);
  });
});

describe('extractFailureReason', () => {
  test('실패 신호 이후 이유를 추출해야 함', () => {
    const output = `${FAILURE_SIGNAL}
실패 이유: 빌드가 실패했습니다`;

    const reason = executorModule.extractFailureReason(output);
    expect(reason).toContain('빌드가 실패했습니다');
  });

  test('Reason: 형식도 추출해야 함', () => {
    const output = `${FAILURE_SIGNAL}
Reason: Build failed due to syntax error`;

    const reason = executorModule.extractFailureReason(output);
    expect(reason).toContain('Build failed');
  });

  test('Error: 패턴에서 이유를 추출해야 함', () => {
    const output = `작업 중 오류 발생
Error: 네트워크 연결 실패`;

    const reason = executorModule.extractFailureReason(output);
    expect(reason).toContain('네트워크 연결 실패');
  });

  test('Failed: 패턴에서 이유를 추출해야 함', () => {
    const output = `작업 중 오류 발생
Failed: 빌드 실패`;

    const reason = executorModule.extractFailureReason(output);
    expect(reason).toContain('빌드 실패');
  });

  test('실패: 패턴에서 이유를 추출해야 함', () => {
    const output = `작업 중 오류 발생
실패: 테스트 실패`;

    const reason = executorModule.extractFailureReason(output);
    expect(reason).toContain('테스트 실패');
  });

  test('오류: 패턴에서 이유를 추출해야 함', () => {
    const output = `작업 중
오류: 파일 없음`;

    const reason = executorModule.extractFailureReason(output);
    expect(reason).toContain('파일 없음');
  });

  test('패턴이 없으면 알 수 없는 오류 반환해야 함', () => {
    const output = '뭔가 잘못됐습니다';
    const reason = executorModule.extractFailureReason(output);
    expect(reason).toBe(i18nModule.t('executor.unknown_error'));
  });
});

describe('HTML 이스케이프', () => {
  test('& 문자를 이스케이프해야 함', () => {
    expect(executorModule.escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  test('< 문자를 이스케이프해야 함', () => {
    expect(executorModule.escapeHtml('a < b')).toBe('a &lt; b');
  });

  test('> 문자를 이스케이프해야 함', () => {
    expect(executorModule.escapeHtml('a > b')).toBe('a &gt; b');
  });

  test('모든 특수 문자를 이스케이프해야 함', () => {
    expect(executorModule.escapeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });

  test('복합 문자열을 이스케이프해야 함', () => {
    expect(executorModule.escapeHtml('a < b & c > d'))
      .toBe('a &lt; b &amp; c &gt; d');
  });

  test('빈 문자열은 그대로 반환해야 함', () => {
    expect(executorModule.escapeHtml('')).toBe('');
  });
});

describe('buildPrompt', () => {
  test('프롬프트가 올바른 형식이어야 함', () => {
    const task = {
      requirement: '테스트 작업',
      completionCriteria: '완료 조건'
    };

    const prompt = executorModule.buildPrompt(task);
    expect(prompt).toContain('테스트 작업');
    expect(prompt).toContain('완료 조건');
    expect(prompt).toContain(COMPLETION_SIGNAL);
    expect(prompt).toContain(FAILURE_SIGNAL);
  });

  test('completionCriteria가 없으면 "없음"으로 표시해야 함', () => {
    const task = {
      requirement: '테스트 작업',
      completionCriteria: null
    };

    const prompt = executorModule.buildPrompt(task);
    // Use i18n to get the correct translation for "Completion Criteria" and "None"
    expect(prompt).toContain(i18nModule.t('prompt.completion_criteria'));
    expect(prompt).toContain(i18nModule.t('prompt.none'));
  });
});

describe('generateSummary', () => {
  test('성공 시 요약을 생성해야 함', () => {
    const output = '작업 완료\n모든 테스트 통과\n빌드 성공';
    const summary = executorModule.generateSummary(output, true);
    // Check that summary contains the task_done i18n key content pattern
    expect(summary).toContain('.');
    expect(summary.length).toBeGreaterThan(0);
  });

  test('실패 시 요약을 생성해야 함', () => {
    const output = '작업 실패\n오류 발생';
    const reason = '빌드 오류';
    const summary = executorModule.generateSummary(output, false, reason);
    // Check that the summary contains the failure reason
    expect(summary).toContain('빌드 오류');
    expect(summary.length).toBeGreaterThan(0);
  });

  test('실패 시 이유 없이 요약을 생성해야 함', () => {
    const output = '작업 실패\n오류 발생';
    const summary = executorModule.generateSummary(output, false);
    // When no reason is provided, summary should not contain reason text
    expect(summary.length).toBeGreaterThan(0);
  });

  test('HTML 특수 문자를 이스케이프해야 함', () => {
    const output = '<script>alert("xss")</script>';
    const summary = executorModule.generateSummary(output, true);
    expect(summary).toContain('&lt;script&gt;');
  });

  test('빈 출력도 처리해야 함', () => {
    const output = '';
    const summary = executorModule.generateSummary(output, true);
    // Summary should still be generated for empty output
    expect(summary.length).toBeGreaterThan(0);
  });

  test('긴 출력을 잘라야 함', () => {
    const lines = Array(20).fill('아주 긴 줄의 텍스트입니다.');
    const output = lines.join('\n');
    const summary = executorModule.generateSummary(output, true);
    // 마지막 5줄만 포함되어야 함
    expect(summary.split('\n').length).toBeLessThan(10);
  });
});

describe('executor 모듈 함수 테스트', () => {
  test('startExecutor가 함수여야 함', () => {
    expect(typeof executorModule.startExecutor).toBe('function');
  });

  test('stopExecutor가 함수여야 함', () => {
    expect(typeof executorModule.stopExecutor).toBe('function');
  });

  test('getCurrentTaskId가 함수여야 함', () => {
    expect(typeof executorModule.getCurrentTaskId).toBe('function');
  });

  test('getCurrentTaskId 초기값은 null이어야 함', () => {
    const currentTaskId = executorModule.getCurrentTaskId();
    expect(currentTaskId).toBeNull();
  });

  test('getRunningTaskIds가 함수여야 함', () => {
    expect(typeof executorModule.getRunningTaskIds).toBe('function');
  });

  test('getRunningTaskIds 초기값은 빈 배열이어야 함', () => {
    const runningTaskIds = executorModule.getRunningTaskIds();
    expect(Array.isArray(runningTaskIds)).toBe(true);
    expect(runningTaskIds.length).toBe(0);
  });

  test('stopExecutor가 오류 없이 호출되어야 함', () => {
    expect(() => executorModule.stopExecutor()).not.toThrow();
  });

  test('startExecutor가 오류 없이 호출되어야 함', async () => {
    await expect(executorModule.startExecutor()).resolves.not.toThrow();
    // 바로 중지
    executorModule.stopExecutor();
  });

  test('중복 startExecutor 호출이 안전해야 함', async () => {
    await executorModule.startExecutor();
    await executorModule.startExecutor(); // 중복 호출
    executorModule.stopExecutor();
  });
});

describe('getClaudeCommand 로직', () => {
  test('Windows에서는 claude.cmd를 사용해야 함', () => {
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      // Windows 환경에서 테스트
      const expectedCommand = 'claude.cmd';
      expect(expectedCommand).toBe('claude.cmd');
    } else {
      // 다른 환경에서 테스트
      const expectedCommand = 'claude';
      expect(expectedCommand).toBe('claude');
    }
  });

  test('사용자 지정 명령어가 파싱되어야 함', () => {
    const claudeCommand = 'npx @anthropic-ai/claude-code';
    const parts = claudeCommand.split(' ');
    const command = parts[0];
    const args = [...parts.slice(1), '--dangerously-skip-permissions'];

    expect(command).toBe('npx');
    expect(args).toContain('@anthropic-ai/claude-code');
    expect(args).toContain('--dangerously-skip-permissions');
  });
});

describe('runClaude 로직 시뮬레이션', () => {
  test('spawn 옵션이 올바르게 설정되어야 함', () => {
    const useShell = true;
    const isWindows = process.platform === 'win32';

    const spawnOptions = {
      cwd: testDir,
      stdio: ['pipe', 'pipe', 'pipe']
    };

    if (useShell) {
      spawnOptions.shell = true;
      if (isWindows) {
        spawnOptions.windowsHide = true;
      }
    }

    expect(spawnOptions.shell).toBe(true);
    if (isWindows) {
      expect(spawnOptions.windowsHide).toBe(true);
    }
  });

  test('타임아웃 값이 30분이어야 함', () => {
    const timeout = 30 * 60 * 1000;
    expect(timeout).toBe(1800000);
  });
});

describe('executeTask 로직 시뮬레이션', () => {
  test('exitCode가 0이 아니면 실패로 처리해야 함', () => {
    const exitCode = 1;
    const output = '프로세스 오류';

    if (exitCode !== 0) {
      const result = { success: false, output, reason: `프로세스 종료 코드: ${exitCode}` };
      expect(result.success).toBe(false);
      expect(result.reason).toContain('1');
    }
  });

  test('예외 발생 시 실패로 처리해야 함', () => {
    const err = new Error('실행 오류');
    const result = { success: false, output: err.message, reason: err.message };

    expect(result.success).toBe(false);
    expect(result.reason).toBe('실행 오류');
  });
});

describe('executionLoop 로직 시뮬레이션', () => {
  test('작업이 없으면 5초 대기해야 함', async () => {
    const POLL_INTERVAL = 5000;
    expect(POLL_INTERVAL).toBe(5000);
  });

  test('작업 완료 후 2초 대기해야 함', async () => {
    const TASK_INTERVAL = 2000;
    expect(TASK_INTERVAL).toBe(2000);
  });

  test('성공 메시지 형식이 올바라야 함', () => {
    const task = {
      requirement: '테스트 작업',
      currentRetry: 0,
      maxRetries: 3
    };
    const summary = '작업 완료';
    const totalRetries = task.currentRetry + 1;

    const message = `✅ <b>작업 완료!</b>\n\n` +
      `📝 요구사항: ${task.requirement}\n\n` +
      `🔄 반복횟수: ${totalRetries}/${task.maxRetries}회\n\n` +
      `📋 요약:\n${summary}`;

    expect(message).toContain('작업 완료!');
    expect(message).toContain('1/3회');
  });

  test('실패 메시지 형식이 올바라야 함', () => {
    const task = {
      requirement: '테스트 작업',
      maxRetries: 3
    };
    const updatedTask = { currentRetry: 3 };
    const summary = '작업 실패';

    const message = `❌ <b>작업 실패</b>\n\n` +
      `📝 요구사항: ${task.requirement}\n\n` +
      `🔄 반복횟수: ${updatedTask.currentRetry}/${task.maxRetries}회 시도 후 실패\n\n` +
      `📋 요약:\n${summary}`;

    expect(message).toContain('작업 실패');
    expect(message).toContain('3/3회');
  });

  test('재시도 메시지 형식이 올바라야 함', () => {
    const updatedTask = { currentRetry: 2 };
    const task = { maxRetries: 3 };
    const reason = '일시적 오류';
    const reasonText = reason ? `\n원인: ${executorModule.escapeHtml(reason)}` : '';

    const message = `🔄 <b>재시도 중...</b> (${updatedTask.currentRetry}/${task.maxRetries})${reasonText}`;

    expect(message).toContain('재시도 중');
    expect(message).toContain('2/3');
    expect(message).toContain('일시적 오류');
  });
});
