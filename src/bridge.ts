import { execSync } from 'child_process'

export class TmuxBridge {
  private sessionName: string = 'gemini-claw'

  constructor() {
    this.checkSession()
  }

  // 세션이 있는지 확인하고 없으면 사용자에게 알립니다.
  private checkSession() {
    try {
      execSync(`tmux has-session -t ${this.sessionName} 2>/dev/null`)
      console.log(`[Bridge] '${this.sessionName}' 세션에 성공적으로 연결되었습니다.`)
    } catch {
      console.warn(
        `[Bridge] 경고: '${this.sessionName}' 세션이 없습니다. 미리 터미널에서 생성하고 Gemini CLI를 실행해 두어야 합니다.`
      )
    }
  }

  // 메시지를 tmux 세션으로 전송 (환경 변수 주입 포함)
  public async sendMessage(message: string, messageId: string, channelId: string): Promise<string> {
    try {
      const escapedMessage = message.replace(/'/g, "'\\''")
      const bridgeUrl = 'http://localhost:3000' // 로컬 브릿지 서버 주소

      console.log(`[Bridge] Dispatched to tmux: ${message.slice(0, 30)}...`)

      // Skill이 사용할 환경 변수를 tmux 세션에 주입
      // export 명령어를 통해 세션 내 환경 변수 설정
      execSync(
        `tmux send-keys -t ${this.sessionName} "export DISCORD_MESSAGE_ID='${messageId}'" C-m`
      )
      execSync(
        `tmux send-keys -t ${this.sessionName} "export DISCORD_CHANNEL_ID='${channelId}'" C-m`
      )
      execSync(
        `tmux send-keys -t ${this.sessionName} "export DISCORD_BRIDGE_URL='${bridgeUrl}/status'" C-m`
      ) // 기본은 status

      // 실제 사용자 메시지 전송 및 실행
      execSync(`tmux send-keys -t ${this.sessionName} '${escapedMessage}'`)
      await new Promise((resolve) => setTimeout(resolve, 200))
      execSync(`tmux send-keys -t ${this.sessionName} C-m`)

      // [Push Mode] 이제 답변은 Skill이 직접 푸시하므로,
      // 브릿지 레벨에서의 Polling 캡처는 보조적인 수단으로만 남겨두거나 비활성화할 수 있습니다.
      // 여기서는 즉시 성공 반환 (결과는 비동기로 Skill이 처리)
      return 'Success: Dispatched to Gemini'
    } catch (error) {
      console.error('[Bridge] 입력 전송 실패:', error)
      throw error
    }
  }

  private async captureResponse(sentMessage: string): Promise<string> {
    const maxRetries = 150 // 최대 약 60초 대기 (400ms * 150)
    let lastContent = ''
    let retryCount = 0
    // 터미널 출력(스트리밍)이 멈춘 상태가 15번(약 6초) 지속되면 응답 완료로 간주
    const stabilityThreshold = 15

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        try {
          // 현재 터미널 화면 캡처 (-e 옵션으로 ANSI 이스케이프 코드 포함하여 가져온 후 처리)
          const rawContent = execSync(`tmux capture-pane -t ${this.sessionName} -p`).toString()
          const currentContent = this.cleanAnsi(rawContent)

          if (currentContent !== lastContent && currentContent.trim() !== '') {
            // 내용에 변화가 생기면(타이핑 중이면) 카운트를 초기화
            lastContent = currentContent
            retryCount = 0
          } else {
            // 변화가 없다면 카운트 증가
            retryCount++
          }

          // 터미널의 변화가 일정 시간 이상 멈추면(응답 완료로 간주) 텍스트 추출
          if (retryCount >= stabilityThreshold) {
            clearInterval(interval)
            resolve(this.extractLatestResponse(currentContent, sentMessage))
          }

          if (retryCount >= maxRetries) {
            clearInterval(interval)
            resolve('...응답 대기 시간을 초과했습니다.')
          }
        } catch (err) {
          clearInterval(interval)
          resolve('...터미널 캡처 중 오류가 발생했습니다.')
        }
      }, 400) // 400ms 간격
    })
  }

  private cleanAnsi(text: string): string {
    // ANSI 이스케이프 코드 제거 정규식
    return text.replace(
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      ''
    )
  }

  private extractLatestResponse(content: string, sentMessage: string): string {
    // 1. 터미널 출력에서 라인 번호와 불필요한 테두리 미리 제거
    const cleanedContent = content
      .split('\n')
      .map((line) => line.replace(/^\s*\d+\s*/, '')) // 줄 시작의 공백+숫자 제거
      .join('\n')

    // 2. <output> 태그의 내용을 추출하는 정규식
    // <output>과 </output> 사이의 모든 문자(줄바꿈 포함)를 캡처합니다.
    // 가장 마지막에 등장하는 <output> 블록을 찾기 위해 global 매칭을 사용합니다.
    const outputMatches = cleanedContent.match(/<output>([\s\S]*?)<\/output>/g)

    if (outputMatches && outputMatches.length > 0) {
      // 가장 최근(터미널 하단)의 답변 블록을 선택
      const lastMatch = outputMatches[outputMatches.length - 1]

      // 태그를 제거하고 내부 텍스트만 추출
      const result = lastMatch
        .replace(/<output>/, '')
        .replace(/<\/output>/, '')
        .trim()

      if (result) return result
    }

    // 3. 만약 완벽한 태그가 감지되지 않았을 때의 최후의 수단 (Fallback)
    // <response> 태그 내의 텍스트라도 최대한 긁어옵니다.
    const responseMatch = cleanedContent.match(/<response>([\s\S]*?)<\/response>/)
    if (responseMatch) {
      return responseMatch[1].trim()
    }

    return '...응답에서 <output> 태그를 찾지 못했습니다. 터미널 출력을 확인해 주세요.'
  }
}

export const bridge = new TmuxBridge()
