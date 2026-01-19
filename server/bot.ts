import { Client, GatewayIntentBits, Events, TextChannel } from 'discord.js';
import { storage } from './storage';
import axios from 'axios';
import { parse } from 'csv-parse/sync';

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
    this.startSyncJob();
  }

  private async startSyncJob() {
    // Run sync immediately on start, then every hour
    this.syncFromGoogleSheets().catch(console.error);
    setInterval(() => this.syncFromGoogleSheets().catch(console.error), 60 * 60 * 1000);
  }

  private async syncFromGoogleSheets() {
    const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbsVcggwfWJlfxn7afuRr7lEvZV2UlQpoipGeiEY97VVqwwHwki79q8hjEaSAhhOMmh4KLNhIc-CMn/pub?output=csv";
    
    try {
      console.log("Starting Google Sheets sync...");
      const response = await axios.get(csvUrl);
      const records = parse(response.data, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      if (records.length > 0) {
        // Clear existing deadlines before sync to avoid duplicates
        // In a production app, we might want to do a more smart merge (upsert)
        await (storage as any).clearAllDeadlines();
        
        let count = 0;
        for (const row of records as any[]) {
          const athleteName = row["NOME"] || row["nome dell'atleta"] || row["Atleta"];
          const dateOfBirth = row["DATA DI NASCITA"];
          const fidalCard = row["TESSERA FIDAL"];
          const subscriptionType = row["TIPO DI ABBONAMENTO"];
          
          const pagamentoDate = row["SCADENZA ABBONAMENTO"] || row["data di scadenza pagamento"];
          const certificatoDate = row["SCADENZA CERTIFICATO"] || row["data di scadenza certificato medico"];
          const tabellaDate = row["SCADENZA TABELLA"] || row["data di scadenza tabella"];

          if (athleteName) {
            const baseData = {
              athleteName: String(athleteName),
              dateOfBirth: dateOfBirth ? String(dateOfBirth) : null,
              fidalCard: fidalCard ? String(fidalCard) : null,
              subscriptionType: subscriptionType ? String(subscriptionType) : null,
            };

            const parseDate = (d: string) => {
              if (!d) return null;
              // Handle DD/MM/YYYY format commonly used in Italy
              const parts = d.split('/');
              if (parts.length === 3) {
                return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
              }
              return new Date(d);
            };

            if (pagamentoDate) {
              const d = parseDate(pagamentoDate);
              if (d && !isNaN(d.getTime())) {
                await storage.createDeadline({ ...baseData, type: "pagamento", description: "Scadenza Abbonamento", date: d });
                count++;
              }
            }
            if (certificatoDate) {
              const d = parseDate(certificatoDate);
              if (d && !isNaN(d.getTime())) {
                await storage.createDeadline({ ...baseData, type: "certificato", description: "Scadenza Certificato Medico", date: d });
                count++;
              }
            }
            if (tabellaDate) {
              const d = parseDate(tabellaDate);
              if (d && !isNaN(d.getTime())) {
                await storage.createDeadline({ ...baseData, type: "tabella", description: "Scadenza Tabella", date: d });
                count++;
              }
            }
          }
        }
        console.log(`Sync completed. Imported ${count} deadlines.`);
        await storage.createLog({
          action: "Sync Google Sheets",
          details: `Importate con successo ${count} scadenze dal foglio Google.`,
          username: "System"
        });
      }
    } catch (error: any) {
      console.error("Error syncing with Google Sheets:", error.message);
      await storage.createLog({
        action: "Sync Error",
        details: `Errore durante la sincronizzazione: ${error.message}`,
        username: "System"
      });
    }
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
        const nameInput = content.replace('!info ', '').trim();
        if (!nameInput) {
          await message.reply('Specifica il nome dell\'atleta. Es: `!info Mario Rossi`');
          return;
        }

        const deadlines = await storage.getDeadlinesByAthlete(nameInput);
        if (deadlines.length === 0) {
          await message.reply(`Nessuna informazione trovata per l'atleta "${nameInput}". Assicurati di aver scritto il nome correttamente come nel foglio Google.`);
        } else {
          const first = deadlines[0];
          let reply = `📋 **Scheda Atleta: ${first.athleteName}**\n`;
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
        const nameInput = content.replace('!scadenza', '').trim();
        if (!nameInput) {
          await message.reply('Specifica il nome dell\'atleta. Es: `!scadenza Mario Rossi`');
          return;
        }

        const deadlines = await storage.getDeadlinesByAthlete(nameInput);
        if (deadlines.length === 0) {
          await message.reply(`Nessuna scadenza trovata per l'atleta "${nameInput}".`);
        } else {
          const first = deadlines[0];
          let reply = `Scadenze per **${first.athleteName}**:\n`;
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
            const nameInput = content.replace(kw.key, '').trim();
            if (!nameInput) continue;

            const deadlines = await storage.getDeadlinesByAthlete(nameInput);
            if (deadlines.length > 0) {
              const first = deadlines[0];
              const athleteNameFound = first.athleteName;
              if ('field' in kw) {
                const val = (first as any)[(kw as any).field];
                await message.reply(`La **${kw.label}** di **${athleteNameFound}** è: ${val || 'N/D'}`);
              } else if ('type' in kw) {
                const d = deadlines.find(dl => dl.type === (kw as any).type);
                if (d) {
                  const diffDays = Math.ceil((d.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  await message.reply(`La **${kw.label}** di **${athleteNameFound}** è il **${d.date.toLocaleDateString()}** (tra ${diffDays} giorni).`);
                } else {
                  await message.reply(`Non ho trovato una ${kw.label} per **${athleteNameFound}**.`);
                }
              }
              return;
            }
          }
        }
      }
    });
  }

  private async sendAdminNotification(text: string, type?: string) {
    const ownerId = (await storage.getSetting("ownerId"))?.value;
    
    // Prova a inviare nel canale specifico se definito
    if (type) {
      const channelMap: Record<string, string> = {
        'certificato': 'scadenza-visite',
        'pagamento': 'scadenze-pagamenti',
        'tabella': 'scadenze-tabelle'
      };
      
      const channelName = channelMap[type];
      if (channelName) {
        const guild = this.client.guilds.cache.first(); // Prende il primo server in cui si trova il bot
        if (guild) {
          const channel = guild.channels.cache.find(c => c.name === channelName && c.isTextBased());
          if (channel) {
            try {
              await (channel as TextChannel).send(text);
              return; // Notifica inviata al canale, saltiamo il DM
            } catch (e) {
              console.error(`Failed to send to channel ${channelName}`, e);
            }
          }
        }
      }
    }

    // Fallback: invia DM all'admin
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
          await this.sendAdminNotification(`📢 **Promemoria Scadenza**\n${msg}`, d.type);
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
