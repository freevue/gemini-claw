import 'dotenv/config';

export const config = {
  discordToken: process.env.DISCORD_TOKEN || '',
};

if (!config.discordToken) {
  console.warn('⚠️  경고: .env 파일에서 DISCORD_TOKEN을 설정해야 합니다.');
}
