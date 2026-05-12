const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const http = require('http');

const bots = [
  { token: process.env.BOT_TOKEN_1, kindroidId: process.env.KINDROID_AI_ID_1, apiKey: process.env.KINDROID_API_KEY, inferUrl: process.env.KINDROID_INFER_URL || 'https://api.kindroid.ai/v1/discord-bot', index: 1 },
  { token: process.env.BOT_TOKEN_2, kindroidId: process.env.KINDROID_AI_ID_2, apiKey: process.env.KINDROID_API_KEY, inferUrl: process.env.KINDROID_INFER_URL || 'https://api.kindroid.ai/v1/discord-bot', index: 2 },
  { token: process.env.BOT_TOKEN_3, kindroidId: process.env.KINDROID_AI_ID_3, apiKey: process.env.KINDROID_API_KEY, inferUrl: process.env.KINDROID_INFER_URL || 'https://api.kindroid.ai/v1/discord-bot', index: 3 },
  { token: process.env.BOT_TOKEN_4, kindroidId: process.env.KINDROID_AI_ID_4, apiKey: process.env.KINDROID_API_KEY, inferUrl: process.env.KINDROID_INFER_URL || 'https://api.kindroid.ai/v1/discord-bot', index: 4 },
  { token: process.env.BOT_TOKEN_5, kindroidId: process.env.KINDROID_AI_ID_5, apiKey: process.env.KINDROID_API_KEY, inferUrl: process.env.KINDROID_INFER_URL || 'https://api.kindroid.ai/v1/discord-bot', index: 5 },
  { token: process.env.BOT_TOKEN_6, kindroidId: process.env.KINDROID_AI_ID_6, apiKey: process.env.KINDROID_API_KEY, inferUrl: process.env.KINDROID_INFER_URL || 'https://api.kindroid.ai/v1/discord-bot', index: 6 },
  { token: process.env.BOT_TOKEN_7, kindroidId: process.env.KINDROID_AI_ID_7, apiKey: process.env.KINDROID_API_KEY, inferUrl: process.env.KINDROID_INFER_URL || 'https://api.kindroid.ai/v1/discord-bot', index: 7 },
  { token: process.env.BOT_TOKEN_8, kindroidId: process.env.KINDROID_AI_ID_8, apiKey: process.env.KINDROID_API_KEY, inferUrl: process.env.KINDROID_INFER_URL || 'https://api.kindroid.ai/v1/discord-bot', index: 8 },
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
  memory[uid].history.push({ role: 'user', content: message.content });

  try {
    const response = await fetch(config.inferUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kindroidId: config.kindroidId,
        message: message.content,
        memory: memory[uid]
      })
    });

    const data = await response.json();
    const aiReply = data.reply || "No response";

    memory[uid].history.push({ role: 'assistant', content: aiReply });
    saveMemory(config.index, memory);

    return aiReply;
  } catch (error) {
    console.error('Kindroid error:', error);
    return "AI service error - check logs";
  }
}

function createBot(config) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
  });

  client.once('ready', () => {
    console.log(`Bot ${config.index} ready!`);
  });

  let memorySaveEnabled = true;

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const lowered = message.content.toLowerCase().trim();

    if (lowered === 'memory on') {
      memorySaveEnabled = true;
      return message.reply("Memory saving is now **ON**.");
    }

    if (lowered === 'memory off') {
      memorySaveEnabled = false;
      return message.reply("Memory saving is now **OFF**.");
    }

    if (!memorySaveEnabled) return;

    if (lowered === 'lexport') {
      const mem = loadMemory(config.index);
      const json = JSON.stringify(mem, null, 2);

      if (json.length > 1900) {
        return message.reply({
          content: 'Memory export:',
          files: [{ attachment: Buffer.from(json), name: `memory_bot${config.index}.json` }],
        });
      }

      return message.reply("```json\n" + json + "\n```");
    }

    if (lowered.startsWith('iremember ')) {
      const fact = message.content.slice(10).trim();
      if (!fact) return message.reply('What should I remember?');

      const uid = message.author.id;
      const memory = loadMemory(config.index);

      if (!memory[uid]) memory[uid] = { facts: [], history: [] };
      if (!memory[uid].facts) memory[uid].facts = [];
      memory[uid].facts.push(fact);
      saveMemory(config.index, memory);

      return message.reply(`✅ Remembered: ${fact}`);
    }

    const reply = await sendToKindroid(message, config);
    message.reply(reply);
  });

  client.login(config.token)
  .then(() => console.log(`Bot ${config.index} login successful`))
  .catch(err => console.error(`Bot ${config.index} login failed:`, err.message));

setTimeout(() => {
  if (!client.isReady()) {
    console.error(`Bot ${config.index} timed out - still not connected after 30s`);
  }
}, 30000);
}

bots.filter(b => b.token && b.kindroidId).forEach(createBot);

// Health check server for Render free tier
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => res.end('OK')).listen(PORT, () => {
  console.log(`Health check server on port ${PORT}`);
});