import { bridge } from './bridge'
import { config } from './config'
import { Client, GatewayIntentBits, GatewayDispatchEvents } from '@discordjs/core'
import { REST } from '@discordjs/rest'
import { WebSocketManager } from '@discordjs/ws'
import http from 'http'

// 1. REST 클라이언트 초기화
const rest = new REST({ version: '10' }).setToken(config.discordToken)

// 2. WebSocket 매니저 초기화
const gateway = new WebSocketManager({
  token: config.discordToken,
  intents:
    GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages | GatewayIntentBits.MessageContent,
  rest,
})

// 3. Client 인스턴스 생성
const client = new Client({ rest, gateway })

// 봇의 ID를 저장할 변수
let botId: string

/**
 * [New] Skill로부터의 상태/답변 업데이트를 수신할 로컬 브릿지 서버
 */
const startBridgeServer = (api: any) => {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST') {
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', async () => {
        try {
          const { channelId, text } = JSON.parse(body)
          console.log(
            `[Push Notification] Sending new message to ${channelId}: ${text.slice(0, 30)}...`
          )

          // 기존 Edit 대신 새로운 메시지 생성 (Create)
          await api.channels.createMessage(channelId, {
            content: text,
          })

          res.writeHead(200)
          res.end('OK')
        } catch (err) {
          console.error('[BridgeServer] Error processing request:', err)
          res.writeHead(500)
          res.end('Error')
        }
      })
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  server.listen(3000, () => {
    console.log('🚀 Skill Bridge Server listening on port 3000')
  })
}

// 메시지 이벤트 핸들러
client.on(GatewayDispatchEvents.MessageCreate, async ({ data: message, api }) => {
  // [Global Policy] 봇 본인 또는 다른 봇 무시 (인간 사용자만 허용)
  if (message.author.bot) return

  // 만약 특정 채널만 반응하게 하고 싶다면 여기서 체크 가능 (현재는 서버 전체)
  console.log(
    `\n[Input Received] Channel: ${message.channel_id} | ${message.author.username}: ${message.content}`
  )

  // 1. 타이핑 인디케이터 활성화 (작업 중임을 사용자에게 알림)
  try {
    await api.channels.showTyping(message.channel_id)
  } catch (err) {
    console.error('[Index] Error triggering typing:', err)
  }

  // 2. 멘션 제거 (있는 경우에만)
  const userPrompt = message.content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim()

  // 3. Gemini CLI에 입력 전달 (비동기로 실행, 결과는 Skill이 직접 푸시)
  try {
    // 이제 placeholder가 없으므로 messageId는 빈 문자열로 전달
    bridge.sendMessage(userPrompt, '', message.channel_id).catch((err) => {
      console.error('[Index] Gemini Execution Error:', err)
    })
  } catch (error) {
    console.error('[Index] Error starting bridge:', error)
  }
})

// 준비 완료 이벤트
client.once(GatewayDispatchEvents.Ready, ({ data }) => {
  botId = data.user.id
  console.log(`✅ Gemini 봇 온라인! (Server-wide Human Tracking Mode)`)

  // 브릿지 서버 시작
  startBridgeServer(client.api)
})

// 게이트웨이 시작
gateway.connect()
