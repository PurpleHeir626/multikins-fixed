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
    const isMentioned = message.mentions.has(client.user);
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
      if (!Object.keys(mem).length) return message.reply('No memory saved yet.');
      const json = JSON.stringify(mem, null, 2);
      if (json.length > 1900) {
        return message.reply({
          content: 'Memory export:',
          files: [{ attachment: Buffer.from(json), name: `memory_bot${config.index}.json` }],
        });
      }
      return message.reply(````json
${json}
````);
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
        '**Commands:**
' +
        '`!sovereign` — toggle memory saving on/off
' +
        '`!remember <text>` — save something to memory
' +
        '`!forget` — clear your memory
' +
        '`!export` — export all saved memory as JSON
' +
        '`!help` — show this list

' +
        'Just send any message (DM or @mention) to chat!'
      );
    }

    if (!content) return;

    try {
      await message.channel.sendTyping();
      const reply = await askKindroid(config.aiId, config.shareCode, content);
      await message.reply(reply);

      if (memorySaveEnabled) {
        const uid = message.author.id;
        if (!memory[uid]) memory[uid] = { facts: [], history: [] };
        if (!memory[uid].history) memory[uid].history = [];
        memory[uid].history.push({
          user: content,
          bot: reply,
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