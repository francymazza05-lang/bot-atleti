import { Client, GatewayIntentBits, Events, TextChannel } from 'discord.js';
import { storage } from './storage';

const MOTIVATIONAL_QUOTES = [
  "The only way to prove that you’re a good sport is to lose.",
  "Age is no barrier. It’s a limitation you put on your mind.",
  "You miss 100% of the shots you don’t take.",
  "Winning isn’t everything, but wanting to win is.",
  "I’ve failed over and over and over again in my life. And that is why I succeed."
];

const TRAINING_SUGGESTIONS = [
  "Today is a great day for 5km run!",
  "Leg day! Focus on squats and lunges.",
  "Rest day. Make sure to hydrate and stretch.",
  "Upper body strength: Push-ups, pull-ups, and dips.",
  "HIIT Session: 20 minutes of intense intervals."
];

export class BotService {
  private client: Client;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
      ],
    });

    this.setupListeners();
    this.startReminderCheck();
  }

  private setupListeners() {
    this.client.once(Events.ClientReady, (readyClient) => {
      console.log(`Ready! Logged in as ${readyClient.user.tag}`);
      this.isConnected = true;
      storage.createLog({
        action: "Bot Started",
        details: `Logged in as ${readyClient.user.tag}`,
        username: "System"
      });
    });

    this.client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;

      const content = message.content.toLowerCase();

      if (content === '!ping') {
        await message.reply('Pong!');
      } else if (content === '!allenamento') {
        const suggestion = TRAINING_SUGGESTIONS[Math.floor(Math.random() * TRAINING_SUGGESTIONS.length)];
        await message.reply(suggestion);
      } else if (content === '!motivazione') {
        const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
        await message.reply(quote);
      } else if (content.startsWith('!risultato')) {
        const result = content.replace('!risultato', '').trim();
        if (!result) {
          const lastWorkouts = await storage.getWorkouts(message.author.id);
          if (lastWorkouts.length > 0) {
            await message.reply(`Your latest workout result: ${lastWorkouts[0].result}`);
          } else {
            await message.reply('You haven\'t entered any results yet! Use `!risultato [your workout details]`');
          }
        } else {
          await storage.createWorkout({
            userId: message.author.id,
            username: message.author.tag,
            exercise: "Workout",
            result: result
          });
          await message.reply('Workout result saved! Great job.');
        }
      } else if (content === '!calendario') {
        await message.reply("Upcoming Training Events:\n- Mon: Sprint Training (6:00 PM)\n- Wed: Endurance Run (7:00 AM)\n- Sat: Team Match (10:00 AM)");
      }
    });
  }

  private startReminderCheck() {
    setInterval(async () => {
      if (!this.isConnected) return;

      const deadlines = await storage.getUpcomingDeadlines();
      for (const deadline of deadlines) {
        try {
          const user = await this.client.users.fetch(deadline.userId);
          if (user) {
            await user.send(`🚨 Reminder: Your ${deadline.description} is coming up on ${deadline.date.toLocaleDateString()}!`);
            await storage.markDeadlineNotified(deadline.id);
            await storage.createLog({
              action: "Reminder Sent",
              details: `Sent ${deadline.type} reminder to ${user.tag}`,
              username: "System"
            });
          }
        } catch (error) {
          console.error(`Failed to send reminder to ${deadline.userId}:`, error);
        }
      }
    }, 60 * 60 * 1000); // Check every hour
  }

  public async start(token: string) {
    try {
      await this.client.login(token);
    } catch (error) {
      console.error("Failed to login to Discord:", error);
      this.isConnected = false;
    }
  }

  public getStatus() {
    return {
      status: this.isConnected ? "online" : "offline",
      uptime: this.client.uptime,
      serverCount: this.client.guilds.cache.size,
      ping: this.client.ws.ping
    };
  }
}

export const bot = new BotService();
