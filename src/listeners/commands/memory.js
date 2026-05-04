import { answerFromMemory } from '../../services/rag.service.js';

export function registerMemoryCommand(app) {
  app.command('/memory', async ({ command, ack, respond }) => {
    await ack();

    const [subcommand, ...rest] = command.text.trim().split(' ');
    const query = rest.join(' ');

    if (subcommand === 'ask') {
      if (!query) {
        await respond('Usage: `/memory ask <your question>`');
        return;
      }

      await respond({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Searching workspace memory...*`,
            },
          }
        ],
      });

      const answer = await answerFromMemory(command.team_id, query);

      await respond({
        replace_original: true,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${query}*`,
            },
          },
          { type: 'divider' },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: answer,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `MemGo · <@${command.user_id}> · <!date^${Math.floor(Date.now() / 1000)}^{time}|now>`,
              },
            ],
          },
        ],
      });
      return;
    }

    await respond('Available commands: `ask`, `summarize`, `search`, `save`, `decisions`');
  });
}