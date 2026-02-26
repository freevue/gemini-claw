# Gemini CLI Discord Terminal Bridge - "Claw"

이 프로젝트는 터미널에서 실행 중인 **Gemini CLI**를 **Discord**와 연동하는 브릿지 시스템입니다. 
단순한 API 호출을 넘어, 실제로 터미널 세션(`tmux`) 내에서 작동하는 CLI의 기능을 Discord로 가져옵니다.

## 🛠️ 작동 원리 (Bridge Architecture)
1.  봇이 시작될 때 `tmux` 세션(`gemini-claw`)을 생성하고 Gemini CLI를 실행합니다.
2.  Discord 사용자가 봇을 언급하며 메시지를 보내면, 봇은 이를 `tmux send-keys`를 통해 터미널에 입력합니다.
3.  터미널의 출력을 실시간으로 감지하여, 응답이 완료되면 이를 캡처해 다시 Discord 채널로 전송합니다.

## 🚀 시작하기

### 1. 전제 조건
-   시스템에 `tmux`가 설치되어 있어야 합니다. (`brew install tmux` 등)
-   `gemini` CLI 도구가 전역적으로 설치되어 있거나 실행 가능해야 합니다.

### 2. 환경 변수 설정
`.env` 파일에 필요한 정보를 입력하세요.
```env
DISCORD_TOKEN=your_discord_bot_token
GEMINI_API_KEY=your_gemini_api_key  # CLI 실행 시에도 필요할 수 있음
```

### 3. 실행 방법
```bash
# 개발 모드 실행 (tmux 세션이 자동으로 생성됩니다)
npm run dev
```

## 🧠 페르소나: 클로 (Claw)
터미널 브릿지 모드에서도 **'클로(Claw)'** 페르소나가 유지되도록 시스템 프롬프트가 CLI 실행 인자로 전달됩니다.
-   "당신의 생각이 무디군요(Your thought is dull)" 등 고유의 말투를 사용합니다.
-   CLI 기반이므로 파일 시스템 접근이나 셸 명령어 실행 등 CLI의 강력한 기능을 Discord에서 경험할 수 있습니다.
