import { Client, GatewayIntentBits, Events, TextChannel } from 'discord.js';
import { storage } from './storage';

const MOTIVATIONAL_QUOTES = [
  "L'unico modo per dimostrare di essere un buon sportivo è perdere.",
  "L'età non è una barriera. È un limite che poni alla tua mente.",
  "Sbagli il 100% dei colpi che non tiri.",
  "Vincere non è tutto, ma voler vincere sì.",
  "Ho fallito più e più volte nella mia vita. Ed è per questo che ho successo."
];

const TRAINING_SUGGESTIONS = [
  "Oggi è un ottimo giorno per una corsa di 5km!",
  "Giorno delle gambe! Concentrati su squat e affondi.",
  "Giorno di riposo. Assicurati di idratarti e fare stretching.",
  "Forza della parte superiore del corpo: Flessioni, trazioni e dip.",
  "Sessione HIIT: 20 minuti di intervalli intensi."
];

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
            await message.reply(`Il tuo ultimo risultato: ${lastWorkouts[0].result}`);
          } else {
            await message.reply('Non hai ancora inserito nessun risultato! Usa `!risultato [dettagli del tuo allenamento]`');
          }
        } else {
          await storage.createWorkout({
            userId: message.author.id,
            username: message.author.tag,
            exercise: "Allenamento",
            result: result
          });
          await message.reply('Risultato salvato! Ottimo lavoro.');
        }
      } else if (content === '!calendario') {
        await message.reply("Prossimi Eventi di Allenamento:\n- Lun: Sprint Training (18:00)\n- Mer: Corsa di resistenza (07:00)\n- Sab: Partita di squadra (10:00)");
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
            await user.send(`🚨 Promemoria: La tua scadenza per "${deadline.description}" è prevista per il ${deadline.date.toLocaleDateString()}!`);
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
