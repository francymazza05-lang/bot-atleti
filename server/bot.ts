import { Client, GatewayIntentBits, Events } from 'discord.js';
import { storage } from './storage';

export class BotService {
  private client: Client;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.setupListeners();
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

      // Simple Ping-Pong command
      if (message.content === '!ping') {
        await message.reply('Pong!');
        await storage.createLog({
          action: "Command Executed",
          details: "Executed !ping",
          username: message.author.tag
        });
      }
    });

    this.client.on(Events.Error, (error) => {
      console.error('Discord Client Error:', error);
      this.isConnected = false;
      storage.createLog({
        action: "Error",
        details: error.message,
        username: "System"
      });
    });
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
