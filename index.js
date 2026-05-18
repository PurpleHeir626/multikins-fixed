const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const http = require('http');

const bots = [
  { token: 'YOUR_BOT_TOKEN_1', kindroidId: 'YOUR_KINDROID_AI_ID_1', shareCode: 'YOUR_SHARE_CODE_1', apiKey: 'YOUR_API_KEY', inferUrl: 'https://api.kindroid.ai/v1/discord-bot', index: 1 },
  { token: 'YOUR_BOT_TOKEN_2', kindroidId: 'YOUR_KINDROID_AI_ID_2', shareCode: 'YOUR_SHARE_CODE_2', apiKey: 'YOUR_API_KEY', inferUrl: 'https://api.kindroid.ai/v1/discord-bot', index: 2 },
  { token: 'YOUR_BOT_TOKEN_3', kindroidId: 'YOUR_KINDROID_AI_ID_3', shareCode: 'YOUR_SHARE_CODE_3', apiKey: 'YOUR_API_KEY', inferUrl: 'https://api.kindroid.ai/v1/discord-bot', index: 3 },
  { token: 'YOUR_BOT_TOKEN_4', kindroidId: 'YOUR_KINDROID_AI_ID_4', shareCode: 'YOUR_SHARE_CODE_4', apiKey: 'YOUR_API_KEY', inferUrl: 'https://api.kindroid.ai/v1/discord-bot', index: 4 },
  { token: 'YOUR_BOT_TOKEN_5', kindroidId: 'YOUR_KINDROID_AI_ID_5', shareCode: 'YOUR_SHARE_CODE_5', apiKey: 'YOUR_API_KEY', inferUrl: 'https://api.kindroid.ai/v1/discord-bot', index: 5 },
  { token: 'YOUR_BOT_TOKEN_6', kindroidId: 'YOUR_KINDROID_AI_ID_6', shareCode: 'YOUR_SHARE_CODE_6', apiKey: 'YOUR_API_KEY', inferUrl: 'https://api.kindroid.ai/v1/discord-bot', index: 6 },
  { token: 'YOUR_BOT_TOKEN_7', kindroidId: 'YOUR_KINDROID_AI_ID_7', shareCode: 'YOUR_SHARE_CODE_7', apiKey: 'YOUR_API_KEY', inferUrl: 'https://api.kindroid.ai/v1/discord-bot', index: 7 },
  { token: 'YOUR_BOT_TOKEN_8', kindroidId: 'YOUR_KINDROID_AI_ID_8', shareCode: 'YOUR_SHARE_CODE_8', apiKey: 'YOUR_API_KEY', inferUrl: 'https://api.kindroid.ai/v1/discord-bot', index: 8 },
];

function loadMemory(index) {
  try {
    return JSON.parse(fs.readFileSync(`memory_bot${index}.json`, 'utf8')) || {};
  } catch {
    return {};
  }
}

function saveMemory(index, memory) {
  fs.writeFileSync(`memory_bot${index}.json`, JSON.stringify(memory, null, 2));
}

async function sendToKindroid(message, config) {
  const memory = loadMemory(config.index);
  const uid = message.author.id;
  if (!memory[uid]) memory[uid] = { facts: [], history: [] };
  const lastMessages = memory[uid].history.slice(-30);

  memory[uid].history.push({ role: 'user', content: message.content });

  try {
    const response = await fetch(config.inferUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        share_code: config.shareCode,
        enable_filter: false,
        conversation: lastMessages.map(m => ({
          username: message.author.username || 'user',
          text: m.content,
          timestamp: new Date().toISOString()
        }))
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Bot ${config.index} Kindroid HTTP error ${response.status}: ${errorText}`);
      return `Sorry, error ${response.status}`;
    }
    const data = await response.json();
    const aiReply = data.reply || data.content || data.text || "No response";
    memory[uid].history.push({ role: 'assistant', content: aiReply });
    saveMemory(config.index, memory);
    return aiReply;
  } catch (error) {
    console.error(`Bot ${config.index} Kindroid error:`, error.message);
    return "Trouble connecting to AI.";
  }
}

function createBot(config) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers
    ]
  });

  client.once('clientReady', () => {
    console.log(`Bot ${config.index} ready! Logged in as ${client.user.tag}`);
  });

  client.on('messageCreate', async (message) => {
    console.log(`[BOT ${config.index}] MSG: "${message.content}" by ${message.author.username}`);
    if (message.author.bot) return;

    const cleanContent = message.content.replace(new RegExp(`<@!?${client.user.id}>\\s*`), '').trim();

    if (cleanContent.toLowerCase() === '!ping') {
      try { await message.reply(`Bot ${config.index} is online!`); }
      catch (err) { console.error(`Bot ${config.index} reply error:`, err.message); }
      return;
    }

    try {
      const reply = await sendToKindroid({ ...message, content: cleanContent }, config);
      await message.reply(reply);
    } catch (err) {
      console.error(`Bot ${config.index} failed:`, err.message);
    }
  });

  client.login(config.token)
    .then(() => console.log(`Bot ${config.index} login OK`))
    .catch(err => console.error(`Bot ${config.index} login FAIL:`, err.message));
}

bots.filter(b => b.token && b.kindroidId).forEach((config, i) => {
  setTimeout(() => createBot(config), i * 3000);
});

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => res.end('OK')).listen(PORT, () => {
  console.log(`Health check on port ${PORT}`);
});
