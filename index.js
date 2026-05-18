const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const http = require('http');

const bots = [
  { token: 'BOT_TOKEN_1', kindroidId: 'KINDROID_AI_ID_1', shareCode: '_SHARE_CODE_1', apiKey: 'KINDROID_API_KEY', inferUrl: 'KINDROID_INFER_URL', index: 1 },
  { token: 'BOT_TOKEN_2', kindroidId: 'KINDROID_AI_ID_2', shareCode: '_SHARE_CODE_2', apiKey: 'KINDROID_API_KEY', inferUrl: 'KINDROID_INFER_URL', index: 2 },
  { token: 'BOT_TOKEN_3', kindroidId: 'KINDROID_AI_ID_3', shareCode: '_SHARE_CODE_3', apiKey: 'KINDROID_API_KEY', inferUrl: 'KINDROID_INFER_URL', index: 3 },
  { token: 'BOT_TOKEN_4', kindroidId: 'KINDROID_AI_ID_4', shareCode: '_SHARE_CODE_4', apiKey: 'KINDROID_API_KEY', inferUrl: 'KINDROID_INFER_URL', index: 4 },
  { token: 'BOT_TOKEN_5', kindroidId: 'KINDROID_AI_ID_5', shareCode: '_SHARE_CODE_5', apiKey: 'KINDROID_API_KEY', inferUrl: 'KINDROID_INFER_URL', index: 5 },
  { token: 'BOT_TOKEN_6', kindroidId: 'KINDROID_AI_ID_6', shareCode: '_SHARE_CODE_6', apiKey: 'KINDROID_API_KEY', inferUrl: 'KINDROID_INFER_URL', index: 6 },
  { token: 'BOT_TOKEN_7', kindroidId: 'KINDROID_AI_ID_7', shareCode: '_SHARE_CODE_7', apiKey: 'KINDROID_API_KEY', inferUrl: 'KINDROID_INFER_URL', index: 7 },
  { token: 'BOT_TOKEN_8', kindroidId: 'KINDROID_AI_ID_8', shareCode: '_SHARE_CODE_8', apiKey: 'KINDROID_API_KEY', inferUrl: 'KINDROID_INFER_URL', index: 8 },
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
