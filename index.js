const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
}).listen(PORT, () => console.log(`Health check running on port ${PORT}`));

const KINDROID_API_KEY = process.env.KINDROID_API_KEY;
const KINDROID_INFER_URL = process.env.KINDROID_INFER_URL || 'https://api.kindroid.ai/v1/discord-bot';

if (!KINDROID_API_KEY) {
  console.error('MISSING: KINDROID_API_KEY - set it in Render Environment Variables');
  process.exit(1);
}

function loadBotConfigs() {
  const configs = [];
  for (let i = 1; i <= 8; i++) {
    const token = process.env[`BOT_TOKEN_${i}`];
    const shareCode = process.env[`SHARED_AI_CODE_${i}`];
    if (!token || !shareCode) continue;
    configs.push({
      index: i,
      token,
      shareCode,
      enableFilter: process.env[`ENABLE_FILTER_${i}`] !== 'false',
    });
  }
  return configs;
}

function memoryPath(i) {
  return path.join('/app', `brain_core_${i}.json`);
}

function loadMemory(i) {
  try {
    if (fs.existsSync(memoryPath(i))) {
      return JSON.parse(fs.readFileSync(memoryPath(i), 'utf8'));
    }
  } catch (_) {}
  return {};
}

function saveMemory(i, mem) {
  try {
    fs.writeFileSync(memoryPath(i), JSON.stringify(mem, null, 2));
  } catch (e) {
    console.error(`Failed to save memory for bot ${i}:`, e.message);
  }
}

async function askKindroid(config, conversation, requester) {
  const res = await fetch(KINDROID_INFER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KINDROID_API_KEY}`,
      'X-Kindroid-Requester': requester,
    },
    body: JSON.stringify({
      share_code: config.shareCode,
      enable_filter: config.enableFilter,
      conversation,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Kindroid API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.reply || data.message || data.response || JSON.stringify(data);
}

function createBot(config) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  const memory = loadMemory(config.index);
  let memorySaveEnabled = true;

  client.on(Events.ClientReady, () => {
    console.log(`[Bot ${config.index}] Logged in as ${client.user.tag}`);
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const isDM = message.channel.type === 1;
    const isMentioned = client.user ? message.mentions.has(client.user) : false;
    if (!isDM && !isMentioned) return;

    const content = message.content
      .replace(`<@${client.user.id}>`, '')
      .replace(`<@!${client.user.id}>`, '')
      .trim();

    if (content.toLowerCase() === '!sovereign') {
      memorySaveEnabled = !memorySaveEnabled;
      return message.reply(`Memory saving is now **${memorySaveEnabled ? 'ON' : 'OFF'}**.`);
    }

    if (content.toLowerCase() === '!export') {
      const mem = loadMemory(config.index);
      const json = JSON.stringify(mem, null, 2);
      if (!Object.keys(mem).length) return message.reply('No memory saved yet.');
      if (json.length > 1900) {
        return message.reply({
          content: 'Memory export:',
          files: [{ attachment: Buffer.from(json), name: `memory_bot${config.index}.json` }],
        });
      }
      return message.reply('```json\n' + json + '\n```');
    }

    if (content.toLowerCase().startsWith('!remember ')) {
      const fact = content.slice(10).trim();
      if (!fact) return message.reply('What should I remember?');
      const uid = message.author.id;
      if (!memory[uid]) memory[uid] = { facts: [], history: [] };
      if (!memory[uid].facts) memory[uid].facts = [];
      memory[uid].facts.push(fact);
      saveMemory(config.index, memory);
      return message.reply(`Got it! I'll remember: *${fact}*`);
    }

    if (content.toLowerCase() === '!forget') {
      const uid = message.author.id;
      if (memory[uid]) {
        delete memory[uid];
        saveMemory(config.index, memory);
      }
      return message.reply('Your memory has been cleared.');
    }

    if (content.toLowerCase() === '!help') {
      return message.reply(
        '**Commands:**\n' +
          '`!sovereign` — toggle memory saving on/off\n' +
          '`!remember <text>` — save something to memory\n' +
          '`!forget` — clear your memory\n' +
          '`!export` — export all saved memory as JSON\n' +
          '`!help` — show this list\n\n' +
          'Just send any message (DM or @mention) to chat!'
      );
    }

    if (!content) return;

    try {
      await message.channel.sendTyping();

      const uid = message.author.id;
      if (!memory[uid]) memory[uid] = { facts: [], history: [] };
      if (!memory[uid].history) memory[uid].history = [];

      memory[uid].history.push({ role: 'user', content });

      const conversation = memory[uid].history.slice(-30).map((item, i) => ({
        username: i % 2 === 0 ? message.author.username : client.user.username,
        text: item.content || '',
        timestamp: new Date().toISOString(),
      }));

      const requester = Buffer.from(message.author.id).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
      const reply = await askKindroid(config, conversation, requester);

      await message.reply(reply);

      if (memorySaveEnabled) {
        memory[uid].history.push({
          role: 'assistant',
          content: reply,
          ts: new Date().toISOString(),
        });

        if (memory[uid].history.length > 50) {
          memory[uid].history = memory[uid].history.slice(-50);
        }

        saveMemory(config.index, memory);
      }
    } catch (err) {
      console.error(`[Bot ${config.index}] Error:`, err.message);
      await message.reply('Sorry, I had trouble connecting right now. Try again in a moment!');
    }
  });

  client.login(config.token).catch((err) => {
    console.error(`[Bot ${config.index}] Login failed:`, err.message);
  });

  return client;
}

const configs = loadBotConfigs();

if (configs.length === 0) {
  console.error('No bots configured. Set BOT_TOKEN_1 and SHARED_AI_CODE_1 at minimum in Render Environment Variables.');
  process.exit(1);
}

console.log(`Starting ${configs.length} bot(s)...`);
configs.forEach(createBot);
