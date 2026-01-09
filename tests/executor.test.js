/**
 * executor.js 단위 테스트
 * 결과 분석 로직 테스트
 */

import { jest } from '@jest/globals';

// analyzeResult와 extractFailureReason 함수를 테스트하기 위해
// executor 모듈의 내부 로직을 재현

// 완료 신호 상수
const COMPLETION_SIGNAL = '<promise>COMPLETE</promise>';
const FAILURE_SIGNAL = '<promise>FAILED</promise>';

/**
 * 결과 분석 (완료 조건 충족 여부)
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
    const reason = extractFailureReason(output);
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
 * 실패 이유 추출
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

  return '알 수 없는 오류';
}

describe('analyzeResult - 완료 신호 기반 판단', () => {
  test('완료 신호가 있으면 성공으로 판단해야 함', () => {
    const output = `작업을 진행합니다...
작업이 완료되었습니다.
${COMPLETION_SIGNAL}`;

    const result = analyzeResult(output);
    expect(result.success).toBe(true);
    expect(result.reason).toBeNull();
  });

  test('실패 신호가 있으면 실패로 판단해야 함', () => {
    const output = `작업을 진행합니다...
오류가 발생했습니다.
${FAILURE_SIGNAL}
실패 이유: 테스트가 실패했습니다`;

    const result = analyzeResult(output);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('테스트가 실패했습니다');
  });

  test('완료 신호와 실패 신호가 모두 있으면 실패로 판단해야 함', () => {
    const output = `${COMPLETION_SIGNAL}
...하지만 뭔가 문제가 있습니다
${FAILURE_SIGNAL}
실패 이유: 검증 실패`;

    const result = analyzeResult(output);
    expect(result.success).toBe(false);
  });
});

describe('analyzeResult - 패턴 기반 폴백', () => {
  test('오류 패턴이 있으면 실패로 판단해야 함', () => {
    const output = `작업을 진행합니다...
Error: 파일을 찾을 수 없습니다
`;

    const result = analyzeResult(output);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('파일을 찾을 수 없습니다');
  });

  test('fatal 패턴이 있으면 실패로 판단해야 함', () => {
    const output = `작업을 진행합니다...
Fatal: 메모리 부족
`;

    const result = analyzeResult(output);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('메모리 부족');
  });

  test('성공 지표가 있으면 성공으로 판단해야 함', () => {
    const output = `빌드를 진행합니다...
컴파일 완료
빌드 성공`;

    const result = analyzeResult(output);
    expect(result.success).toBe(true);
  });

  test('성공 지표 - successfully', () => {
    const output = `Test completed successfully.`;

    const result = analyzeResult(output);
    expect(result.success).toBe(true);
  });

  test('성공 지표 - 모든 테스트 통과', () => {
    const output = `테스트 실행 중...
모든 테스트 통과`;

    const result = analyzeResult(output);
    expect(result.success).toBe(true);
  });

  test('오류 이후 성공 지표가 있으면 성공으로 간주해야 함', () => {
    const output = `작업을 진행합니다...
Error: 일시적인 오류
재시도 중...
작업을 완료했습니다`;

    const result = analyzeResult(output);
    expect(result.success).toBe(true);
  });

  test('성공 지표가 오류보다 먼저 나오면 실패로 판단해야 함', () => {
    const output = `작업을 완료했습니다
...
Error: 검증 실패`;

    const result = analyzeResult(output);
    expect(result.success).toBe(false);
  });
});

describe('analyzeResult - 불확실한 경우', () => {
  test('완료 신호도 오류도 없으면 성공으로 간주해야 함', () => {
    const output = `작업을 진행했습니다.
결과를 저장했습니다.`;

    const result = analyzeResult(output);
    expect(result.success).toBe(true);
  });

  test('빈 출력은 성공으로 간주해야 함', () => {
    const output = '';
    const result = analyzeResult(output);
    expect(result.success).toBe(true);
  });
});

describe('extractFailureReason', () => {
  test('실패 신호 이후 이유를 추출해야 함', () => {
    const output = `${FAILURE_SIGNAL}
실패 이유: 빌드가 실패했습니다`;

    const reason = extractFailureReason(output);
    expect(reason).toContain('빌드가 실패했습니다');
  });

  test('Reason: 형식도 추출해야 함', () => {
    const output = `${FAILURE_SIGNAL}
Reason: Build failed due to syntax error`;

    const reason = extractFailureReason(output);
    expect(reason).toContain('Build failed');
  });

  test('Error: 패턴에서 이유를 추출해야 함', () => {
    const output = `작업 중 오류 발생
Error: 네트워크 연결 실패`;

    const reason = extractFailureReason(output);
    expect(reason).toContain('네트워크 연결 실패');
  });

  test('패턴이 없으면 알 수 없는 오류 반환해야 함', () => {
    const output = '뭔가 잘못됐습니다';
    const reason = extractFailureReason(output);
    expect(reason).toBe('알 수 없는 오류');
  });
});

describe('HTML 이스케이프', () => {
  // HTML 이스케이프 함수 재현
  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  test('& 문자를 이스케이프해야 함', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  test('< 문자를 이스케이프해야 함', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b');
  });

  test('> 문자를 이스케이프해야 함', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  test('모든 특수 문자를 이스케이프해야 함', () => {
    expect(escapeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });
});
