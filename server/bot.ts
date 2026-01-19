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
      } else if (content.startsWith('!info ')) {
        const name = content.replace('!info ', '').trim();
        if (!name) {
          await message.reply('Specifica il nome dell\'atleta. Es: `!info Mario Rossi`');
          return;
        }

        const deadlines = await storage.getDeadlinesByAthlete(name);
        if (deadlines.length === 0) {
          await message.reply(`Nessuna informazione trovata per l'atleta "${name}".`);
        } else {
          const first = deadlines[0];
          let reply = `📋 **Scheda Atleta: ${name}**\n`;
          reply += `- **Data di Nascita**: ${first.dateOfBirth || 'N/D'}\n`;
          reply += `- **Tessera FIDAL**: ${first.fidalCard || 'N/D'}\n`;
          reply += `- **Tipo Abbonamento**: ${first.subscriptionType || 'N/D'}\n\n`;
          
          reply += `**Scadenze:**\n`;
          for (const d of deadlines) {
            const diffDays = Math.ceil((d.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            let status = "";
            if (diffDays < 0) status = " (SCADUTA)";
            else if (diffDays === 0) status = " (SCADE OGGI)";
            else status = ` (tra ${diffDays} gg)`;
            
            reply += `- **${d.description}**: ${d.date.toLocaleDateString()}${status}\n`;
          }
          await message.reply(reply);
        }
      } else if (content.startsWith('!scadenza')) {
        const name = content.replace('!scadenza', '').trim();
        if (!name) {
          await message.reply('Specifica il nome dell\'atleta. Es: `!scadenza Mario Rossi`');
          return;
        }

        const deadlines = await storage.getDeadlinesByAthlete(name);
        if (deadlines.length === 0) {
          await message.reply(`Nessuna scadenza trovata per l'atleta "${name}".`);
        } else {
          let reply = `Scadenze per **${name}**:\n`;
          for (const d of deadlines) {
            const diffDays = Math.ceil((d.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            let status = "";
            if (diffDays < 0) status = " (SCADUTA)";
            else if (diffDays === 0) status = " (SCADE OGGI)";
            else status = ` (scade tra ${diffDays} giorni)`;
            
            reply += `- **${d.description}**: ${d.date.toLocaleDateString()}${status}\n`;
          }
          await message.reply(reply);
        }
      } else {
        // Cerca se il messaggio contiene un nome di colonna e un nome atleta
        // Esempio: "tessera fidal Mario Rossi"
        const keywords = [
          { key: "tessera fidal", field: "fidalCard", label: "Tessera FIDAL" },
          { key: "data di nascita", field: "dateOfBirth", label: "Data di Nascita" },
          { key: "abbonamento", field: "subscriptionType", label: "Tipo Abbonamento" },
          { key: "scadenza abbonamento", type: "pagamento", label: "Scadenza Abbonamento" },
          { key: "scadenza certificato", type: "certificato", label: "Scadenza Certificato" },
          { key: "scadenza tabella", type: "tabella", label: "Scadenza Tabella" }
        ];

        for (const kw of keywords) {
          if (content.startsWith(kw.key)) {
            const name = content.replace(kw.key, '').trim();
            if (!name) continue;

            const deadlines = await storage.getDeadlinesByAthlete(name);
            if (deadlines.length > 0) {
              const first = deadlines[0];
              if ('field' in kw) {
                const val = (first as any)[kw.field];
                await message.reply(`La **${kw.label}** di **${name}** è: ${val || 'N/D'}`);
              } else if ('type' in kw) {
                const d = deadlines.find(dl => dl.type === (kw as any).type);
                if (d) {
                  const diffDays = Math.ceil((d.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  await message.reply(`La **${kw.label}** di **${name}** è il **${d.date.toLocaleDateString()}** (tra ${diffDays} giorni).`);
                } else {
                  await message.reply(`Non ho trovato una ${kw.label} per **${name}**.`);
                }
              }
              return;
            }
          }
        }
      }
    });
  }

  private async sendAdminNotification(text: string) {
    const ownerId = (await storage.getSetting("ownerId"))?.value;
    if (ownerId) {
      try {
        const owner = await this.client.users.fetch(ownerId);
        if (owner) await owner.send(text);
      } catch (e) {
        console.error("Failed to send notification to owner", e);
      }
    }
  }

  private startReminderCheck() {
    setInterval(async () => {
      if (!this.isConnected) return;

      const now = Date.now();
      const deadlines = await storage.getUpcomingDeadlines();
      
      for (const d of deadlines) {
        const diffDays = Math.ceil((d.date.getTime() - now) / (1000 * 60 * 60 * 24));
        let level: 'oneMonth' | 'tenDays' | 'threeDays' | 'oneDay' | null = null;
        let msg = "";

        if (diffDays === 30 && !d.notifiedOneMonth) {
          level = 'oneMonth';
          msg = `Il ${d.description} di **${d.athleteName}** scade tra 1 mese (${d.date.toLocaleDateString()}).`;
        } else if (diffDays === 10 && !d.notifiedTenDays) {
          level = 'tenDays';
          msg = `Il ${d.description} di **${d.athleteName}** scade tra 10 giorni (${d.date.toLocaleDateString()}).`;
        } else if (diffDays === 3 && !d.notifiedThreeDays) {
          level = 'threeDays';
          msg = `Il ${d.description} di **${d.athleteName}** scade tra 3 giorni (${d.date.toLocaleDateString()}).`;
        } else if (diffDays === 1 && !d.notifiedOneDay) {
          level = 'oneDay';
          msg = `Il ${d.description} di **${d.athleteName}** scade DOMANI (${d.date.toLocaleDateString()}).`;
        }

        if (level && msg) {
          await this.sendAdminNotification(`📢 **Promemoria Scadenza**\n${msg}`);
          await storage.markDeadlineNotified(d.id, level);
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
