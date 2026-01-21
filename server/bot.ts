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
    // Run sync immediately on start, then every 5 minutes
    this.syncFromGoogleSheets().catch(console.error);
    setInterval(() => {
      console.log("[HEARTBEAT] Keeping process alive...");
      this.syncFromGoogleSheets().catch(console.error);
    }, 5 * 60 * 1000);
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
        // Save existing notification flags before clearing
        const existingDeadlines = await storage.getUpcomingDeadlines();
        // Helper to get date-only key (ignore time component)
        const getDateKey = (date: Date) => {
          const d = new Date(date);
          return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
        };
        
        const notificationFlags = new Map<string, { oneMonth: boolean, tenDays: boolean, threeDays: boolean, oneDay: boolean }>();
        for (const d of existingDeadlines) {
          const key = `${d.athleteName}|${d.type}|${getDateKey(d.date)}`;
          notificationFlags.set(key, {
            oneMonth: d.notifiedOneMonth || false,
            tenDays: d.notifiedTenDays || false,
            threeDays: d.notifiedThreeDays || false,
            oneDay: d.notifiedOneDay || false
          });
        }
        
        // Clear existing deadlines before sync to avoid duplicates
        await (storage as any).clearAllDeadlines();
        
        let count = 0;
        // Pre-process records to group by athlete name to ensure we get DOB and Fidal
        const athleteDataMap = new Map();

        for (const row of records as any[]) {
          const athleteName = (row["NOME"] || row["nome dell'atleta"] || row["Atleta"] || "").trim();
          if (!athleteName) continue;

          const dobValue = row["DATA  DI NASCITA"] || row["DATA DI NASCITA"] || row["data di nascita"] || row["Data di nascita"] || row["Data di Nascita"] || row["DATA DI NASCITA "] || row["DATA DI NASCITA  "];
          
          if (!athleteDataMap.has(athleteName)) {
            const dob = (dobValue && String(dobValue).trim()) || null;
            athleteDataMap.set(athleteName, {
              dateOfBirth: dob,
              fidalCard: (row["TESSERA FIDAL"] || row["TESSERA FIDAL "] || row["tessera fidal"] || "").trim() || null,
              subscriptionType: (row["TIPO DI ABBONAMENTO"] || row["tipo di abbonamento"] || "").trim() || null,
              deadlines: []
            });
          } else {
            const existing = athleteDataMap.get(athleteName);
            if (!existing.dateOfBirth && dobValue) {
              const dob = String(dobValue).trim();
              existing.dateOfBirth = dob;
            }
            if (!existing.fidalCard) {
              const fidal = (row["TESSERA FIDAL"] || row["TESSERA FIDAL "] || row["tessera fidal"] || "").trim();
              if (fidal) existing.fidalCard = fidal;
            }
            if (!existing.subscriptionType) {
              const sub = (row["TIPO DI ABBONAMENTO"] || row["tipo di abbonamento"] || "").trim();
              if (sub) existing.subscriptionType = sub;
            }
          }

          const pagamentoDate = row["SCADENZA ABBONAMENTO"] || row["data di scadenza pagamento"] || row["SCADENZA PAGAMENTO"];
          const certificatoDate = row["SCADENZA CERTIFICATO"] || row["data di scadenza certificato medico"];
          const tabellaDate = row["SCADENZA TABELLA"] || row["data di scadenza tabella"];

          const parseDate = (d: string) => {
            if (!d || typeof d !== 'string') return null;
            const cleaned = d.trim();
            if (!cleaned) return null;
            // Handle DD/MM/YYYY
            const parts = cleaned.split('/');
            if (parts.length === 3) {
              const day = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10);
              const year = parseInt(parts[2], 10);
              return new Date(year, month - 1, day);
            }
            const parsed = new Date(cleaned);
            return isNaN(parsed.getTime()) ? null : parsed;
          };

          if (pagamentoDate) {
            const d = parseDate(pagamentoDate);
            if (d) athleteDataMap.get(athleteName).deadlines.push({ type: "pagamento", desc: "Scadenza Abbonamento", date: d });
          }
          if (certificatoDate) {
            const d = parseDate(certificatoDate);
            if (d) athleteDataMap.get(athleteName).deadlines.push({ type: "certificato", desc: "Scadenza Certificato Medico", date: d });
          }
          if (tabellaDate) {
            const d = parseDate(tabellaDate);
            if (d) athleteDataMap.get(athleteName).deadlines.push({ type: "tabella", desc: "Scadenza Tabella", date: d });
          }
        }

        for (const [athleteName, data] of Array.from(athleteDataMap.entries())) {
          const baseData = {
            athleteName,
            dateOfBirth: data.dateOfBirth ? String(data.dateOfBirth).trim() : null,
            fidalCard: data.fidalCard ? String(data.fidalCard).trim() : null,
            subscriptionType: data.subscriptionType ? String(data.subscriptionType).trim() : null,
          };

          if (data.deadlines.length === 0) {
            const key = `${athleteName}|info|1970-01-01`;
            const existingFlags = notificationFlags.get(key) || { oneMonth: false, tenDays: false, threeDays: false, oneDay: false };
            await storage.createDeadlineWithFlags({
              ...baseData,
              type: "info",
              description: "Informazioni Atleta",
              date: new Date(0),
            }, existingFlags);
            count++;
          } else {
            for (const dl of data.deadlines) {
              const key = `${athleteName}|${(dl as any).type}|${getDateKey((dl as any).date)}`;
              const existingFlags = notificationFlags.get(key) || { oneMonth: false, tenDays: false, threeDays: false, oneDay: false };
              await storage.createDeadlineWithFlags({
                ...baseData,
                type: (dl as any).type,
                description: (dl as any).desc,
                date: (dl as any).date,
              }, existingFlags);
              count++;
            }
          }
        }
        console.log(`Sync completed. Imported ${count} records for ${athleteDataMap.size} athletes.`);
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
      const content = message.content.toLowerCase().trim();
      console.log(`[DEBUG] Received command: "${content}" from ${message.author.tag}`);
      
      const formatDate = (date: Date | null) => {
        if (!date || date.getTime() === 0) return 'N/D';
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
      };

      if (content === '!ping') {
        await message.reply('Pong!');
      } else if (content === '!comandi') {
        let helpMsg = '🤖 **Comandi Disponibili:**\n\n';
        helpMsg += '`!atleta [nome]` o `!info [nome]` - Mostra la scheda completa e le scadenze dell\'atleta\n';
        helpMsg += '`!scadenza [nome]` - Mostra solo l\'elenco delle scadenze di un atleta\n';
        helpMsg += '`!sync` - Sincronizza manualmente i dati dal foglio Google\n';
        helpMsg += '`!verificascadenze` - Forza il controllo delle scadenze e invia promemoria mancanti\n';
        helpMsg += '`!allenamento` - Ricevi un suggerimento di allenamento casuale\n';
        helpMsg += '`!motivazione` - Ricevi una frase motivazionale\n';
        helpMsg += '`!testpromemoria` - (Admin) Invia un test delle notifiche nei canali\n';
        helpMsg += '`!ping` - Verifica se il bot è online\n\n';
        helpMsg += '💡 *Puoi anche chiedere informazioni dirette, ad esempio: "tessera fidal Mario Rossi" o "scadenza certificato Mario Rossi"*';
        await message.reply(helpMsg);
      } else if (content === '!allenamento') {
        const suggestion = TRAINING_SUGGESTIONS[Math.floor(Math.random() * TRAINING_SUGGESTIONS.length)];
        await message.reply(suggestion);
      } else if (content === '!motivazione') {
        const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
        await message.reply(quote);
      } else if (content === '!sync') {
        await message.reply('Sincronizzazione manuale avviata...');
        this.syncFromGoogleSheets().then(() => {
          message.reply('Sincronizzazione completata con successo!');
        }).catch(err => {
          message.reply(`Errore durante la sincronizzazione: ${err.message}`);
        });
      } else if (content.startsWith('!promemoria ')) {
        const nameInput = content.replace('!promemoria ', '').trim();
        if (!nameInput) {
          await message.reply('Specifica il nome dell\'atleta. Es: `!promemoria Mario Rossi`');
          return;
        }

        const now = Date.now();
        const deadlines = await storage.getDeadlinesByAthlete(nameInput);
        if (deadlines.length === 0) {
          await message.reply(`Nessun atleta trovato con il nome "${nameInput}".`);
        } else {
          let sentCount = 0;
          for (const d of deadlines) {
            if (d.type === 'info') continue;
            const diffDays = Math.ceil((d.date.getTime() - now) / (1000 * 60 * 60 * 24));
            const formattedDate = formatDate(d.date);
            let msg = "";
            
            if (d.type === 'certificato') {
              msg = `Il certificato di **${d.athleteName}** scade il **${formattedDate}**.`;
            } else if (d.type === 'tabella') {
              msg = `La tabella di **${d.athleteName}** scade il **${formattedDate}**.`;
            } else if (d.type === 'pagamento') {
              msg = `L'abbonamento di **${d.athleteName}** scade il **${formattedDate}**.`;
            }

            if (msg) {
              await this.sendAdminNotification(`📢 **Promemoria Scadenza (Manuale)**\n${msg}`, d.type);
              sentCount++;
            }
          }
          await message.reply(`Inviati ${sentCount} promemoria per **${nameInput}** nei canali dedicati.`);
        }
      } else if (content === '!verificascadenze') {
        await message.reply('Verifica manuale delle scadenze in corso...');
        const count = await this.checkAllDeadlines();
        await message.reply(`Verifica completata. Inviati ${count} nuovi promemoria.`);
      } else if (content === '!testcheck') {
        const now = Date.now();
        const deadlines = await storage.getUpcomingDeadlines();
        await message.reply(`Trovate ${deadlines.length} scadenze da controllare.`);
        for (const d of deadlines) {
          const diffDays = Math.ceil((d.date.getTime() - now) / (1000 * 60 * 60 * 24));
          await message.reply(`- **${d.athleteName}** (${d.type}): ${diffDays} gg.`);
        }
      } else if (content === '!testpromemoria') {
        await message.reply('Avvio test promemoria manuale per tutte le tipologie...');
        const now = new Date();
        const fakeDeadlines = [
          { type: 'certificato', desc: 'Test Scadenza Certificato', date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
          { type: 'pagamento', desc: 'Test Scadenza Pagamento', date: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000) },
          { type: 'tabella', desc: 'Test Scadenza Tabella', date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) }
        ];

        for (const d of fakeDeadlines) {
          const formattedDate = formatDate(d.date);
          const diffDays = Math.ceil((d.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          let msg = "";
          if (d.type === 'certificato') {
            msg = `Il certificato di **TEST ATLETA** scade il **${formattedDate}** (tra ${diffDays} giorni).`;
          } else if (d.type === 'tabella') {
            msg = `La tabella di **TEST ATLETA** scade il **${formattedDate}** (tra ${diffDays} giorni).`;
          } else if (d.type === 'pagamento') {
            msg = `L'abbonamento di **TEST ATLETA** scade il **${formattedDate}** (tra ${diffDays} giorni).`;
          }
          
          console.log(`[TEST] Sending notification for ${d.type}: ${msg}`);
          await this.sendAdminNotification(`📢 **Promemoria Scadenza (TEST)**\n${msg}`, d.type);
        }
        await message.reply('Test promemoria completato. Controlla i canali dedicati!');
      } else if (content.startsWith('!atleta ') || content.startsWith('!info ')) {
        const nameInput = content.startsWith('!atleta ') 
          ? content.replace('!atleta ', '').trim()
          : content.replace('!info ', '').trim();
        if (!nameInput) {
          await message.reply('Specifica il nome dell\'atleta. Es: `!atleta Mario Rossi`');
          return;
        }

        const deadlines = await storage.getDeadlinesByAthlete(nameInput);
        if (deadlines.length === 0) {
          await message.reply(`Nessun atleta trovato con il nome "${nameInput}". Assicurati di aver scritto il nome correttamente come nel foglio Google.`);
        } else {
          const first = deadlines[0];
          let reply = `📋 **Scheda Atleta: ${first.athleteName}**\n`;
          
          let dobVal: any = first.dateOfBirth;
          if (dobVal && typeof dobVal === 'string') {
            // Se è già una stringa dd/mm/yyyy (come importata da GS) la lasciamo così
            // Altrimenti proviamo a formattarla se possibile
          } else if (dobVal && dobVal instanceof Date) {
            dobVal = formatDate(dobVal);
          }
          
          reply += `- **Data di Nascita**: ${dobVal || 'N/D'}\n`;
          reply += `- **Tessera FIDAL**: ${first.fidalCard || 'N/D'}\n`;
          reply += `- **Tipo Abbonamento**: ${first.subscriptionType || 'N/D'}\n\n`;
          
          reply += `**Scadenze:**\n`;

          for (const d of deadlines) {
            if (d.type === 'info') continue;
            const diffDays = Math.ceil((d.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            let status = "";
            if (diffDays < 0) status = " (SCADUTA)";
            else if (diffDays === 0) status = " (SCADE OGGI)";
            else status = ` (tra ${diffDays} gg)`;
            
            let emoji = "";
            if (d.type === 'tabella') emoji = "📅 ";
            else if (d.type === 'pagamento') emoji = "💸 ";
            else if (d.type === 'certificato') emoji = "🧬 ";

            reply += `- ${emoji}**${d.description}**: ${formatDate(d.date)}${status}\n`;
          }
          await message.reply(reply);
        }
      } else if (content.startsWith('!scadenza ')) {
        const nameInput = content.replace('!scadenza ', '').trim();
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
            if (d.type === 'info') continue;
            const diffDays = Math.ceil((d.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            let status = "";
            if (diffDays < 0) status = " (SCADUTA)";
            else if (diffDays === 0) status = " (SCADE OGGI)";
            else status = ` (scade tra ${diffDays} giorni)`;
            
            let emoji = "";
            if (d.type === 'tabella') emoji = "📅 ";
            else if (d.type === 'pagamento') emoji = "💸 ";
            else if (d.type === 'certificato') emoji = "🧬 ";

            reply += `- ${emoji}**${d.description}**: ${formatDate(d.date)}${status}\n`;
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
                let val = (first as any)[(kw as any).field];
                if (kw.field === 'dateOfBirth' && val) {
                  val = formatDate(new Date(val));
                }
                await message.reply(`La **${kw.label}** di **${athleteNameFound}** è: ${val || 'N/D'}`);
              } else if ('type' in kw) {
                const d = deadlines.find(dl => dl.type === (kw as any).type);
                if (d) {
                  const diffDays = Math.ceil((d.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  await message.reply(`La **${kw.label}** di **${athleteNameFound}** è il **${formatDate(d.date)}** (tra ${diffDays} giorni).`);
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
      const channelMap: Record<string, { name: string, emoji: string }> = {
        'certificato': { name: 'scadenza-visite', emoji: '🧬' },
        'pagamento': { name: 'PAGAMENTI', emoji: '💸' },
        'tabella': { name: 'scadenze-tabelle', emoji: '📅' }
      };
      
      const config = channelMap[type];
      if (config) {
        const guild = this.client.guilds.cache.first(); // Prende il primo server in cui si trova il bot
        if (guild) {
          console.log(`[NOTIF] Searching for channel ${config.name} in guild ${guild.name}`);
          const channel = guild.channels.cache.find(c => {
            if (!c.isTextBased()) return false;
            const cName = c.name.toLowerCase().trim();
            const configName = config.name.toLowerCase().trim();
            
            // Match if channel name contains the config name or vice versa (ignoring special chars)
            const cleanCName = cName.replace(/[^a-z0-9]/g, '');
            const cleanConfigName = configName.replace(/[^a-z0-9]/g, '');
            
            // Special case for PAGAMENTI as it's a common name and might be styled differently
            if (config.name === 'PAGAMENTI') {
              return cleanCName.includes('pagament');
            }
            
            return cleanCName.includes(cleanConfigName) || cleanConfigName.includes(cleanCName);
          });
          if (channel) {
            try {
              console.log(`[NOTIF] Found channel ${channel.name}, sending message...`);
              await (channel as TextChannel).send(`${config.emoji} ${text}`);
              return; // Notifica inviata al canale, saltiamo il DM
            } catch (e) {
              console.error(`Failed to send to channel ${config.name}`, e);
            }
          } else {
            console.log(`[NOTIF] Channel ${config.name} not found. Available channels: ${Array.from(guild.channels.cache.filter(c => c.isTextBased()).values()).map(c => (c as any).name).join(', ')}`);
          }
        }
      }
    }

    // Fallback: invia DM all'admin
    if (ownerId && ownerId !== 'YOUR_ID_HERE') {
      try {
        const owner = await this.client.users.fetch(ownerId);
        if (owner) await owner.send(text);
      } catch (e) {
        console.error("Failed to send notification to owner", e);
      }
    } else if (!type) {
      console.warn("No ownerId configured and no type provided for notification.");
    }
  }

  private async checkAllDeadlines() {
    if (!this.isConnected) return 0;

    const now = Date.now();
    const deadlines = await storage.getUpcomingDeadlines();
    let sentCount = 0;
    
    for (const d of deadlines) {
      const diffDays = Math.ceil((d.date.getTime() - now) / (1000 * 60 * 60 * 24));
      let level: 'oneMonth' | 'tenDays' | 'threeDays' | 'oneDay' | null = null;
      let msg = "";

      const formatDate = (date: Date | null) => {
        if (!date || date.getTime() === 0) return 'N/D';
        const dd = date.getDate().toString().padStart(2, '0');
        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      };

      const formattedDate = formatDate(d.date);

      if (diffDays <= 30 && diffDays > 10 && !d.notifiedOneMonth) {
        level = 'oneMonth';
      } else if (diffDays <= 10 && diffDays > 3 && !d.notifiedTenDays) {
        level = 'tenDays';
      } else if (diffDays <= 3 && diffDays > 1 && !d.notifiedThreeDays) {
        level = 'threeDays';
      } else if (diffDays <= 1 && diffDays >= 0 && !d.notifiedOneDay) {
        level = 'oneDay';
      }

      if (level) {
        if (d.type === 'certificato') {
          msg = `Il certificato di **${d.athleteName}** scade il **${formattedDate}**.`;
        } else if (d.type === 'tabella') {
          msg = `La tabella di **${d.athleteName}** scade il **${formattedDate}**.`;
        } else if (d.type === 'pagamento') {
          msg = `L'abbonamento di **${d.athleteName}** scade il **${formattedDate}**.`;
        }

        if (msg) {
          await this.sendAdminNotification(`📢 **Promemoria Scadenza**\n${msg}`, d.type);
          await storage.markDeadlineNotified(d.id, level);
          sentCount++;
        }
      }
    }
    return sentCount;
  }

  private startReminderCheck() {
    // Only run automatic reminder checks in production to avoid duplicates
    // when both dev and production bots are running
    if (process.env.NODE_ENV === 'development') {
      console.log('[REMINDER] Automatic reminders disabled in development mode');
      return;
    }
    
    // In production, check once per day at startup, then every 24 hours
    console.log('[REMINDER] Starting automatic reminder check (production mode)');
    setTimeout(async () => {
      await this.checkAllDeadlines();
    }, 60 * 1000); // Wait 1 minute after startup before first check
    
    setInterval(async () => {
      await this.checkAllDeadlines();
    }, 24 * 60 * 60 * 1000); // Check once per day
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
