import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { bot } from "./bot";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import * as xlsx from "xlsx";

import { Request } from "express";

const upload = multer({ storage: multer.memoryStorage() });

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Excel Upload API
  app.post(api.deadlines.upload.path, upload.single("file"), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet) as any[];

      let count = 0;
      for (const row of data) {
        // Mappa le colonne del foglio Google (Atleta, Scadenza, Descrizione, Data)
        const userId = row.userId || row["Atleta"] || row["Discord ID"];
        const type = row.type || row["Scadenza"] || row["Tipo"];
        const description = row.description || row["Descrizione"];
        const dateStr = row.date || row["Data"];

        if (userId && type && description && dateStr) {
          await storage.createDeadline({
            userId: String(userId),
            type: String(type),
            description: String(description),
            date: new Date(dateStr),
          });
          count++;
        }
      }

      res.json({ message: "Importazione completata con successo", count });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Impossibile elaborare il file Excel" });
    }
  });

  // Logs API
  app.get(api.logs.list.path, async (req, res) => {
    const logs = await storage.getLogs();
    res.json(logs);
  });

  // Settings API
  app.get(api.settings.list.path, async (req, res) => {
    const settings = await storage.getSettings();
    res.json(settings);
  });

  app.post(api.settings.update.path, async (req, res) => {
    try {
      const { key, value } = api.settings.update.input.parse(req.body);
      const updated = await storage.updateSetting(key, value);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // Bot Status API
  app.get(api.bot.status.path, async (req, res) => {
    const status = bot.getStatus();
    // Map status string to union type
    const mappedStatus = status.status === "online" ? "online" 
      : status.status === "connecting" ? "connecting" 
      : "offline";
      
    res.json({
      ...status,
      status: mappedStatus
    });
  });

  // Try to start the bot if token is available
  const token = process.env.DISCORD_TOKEN;
  
  // Seed default settings if empty
  const existingSettings = await storage.getSettings();
  if (existingSettings.length === 0) {
    await storage.updateSetting("prefix", "!");
    await storage.updateSetting("ownerId", "YOUR_ID_HERE");
    await storage.updateSetting("statusMessage", "Serving athletes!");
    
    // Seed some initial data for demonstration
    // Note: These use dummy IDs for illustration
    await storage.createDeadline({
      userId: "123456789", // Replace with real Discord ID
      type: "medical",
      description: "Medical Check-up",
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
    });
    
    await storage.createDeadline({
      userId: "123456789",
      type: "training_plan",
      description: "Training Plan Renewal",
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
    });
  }

  if (token) {
    bot.start(token).catch(console.error);
  } else {
    console.log("No DISCORD_TOKEN found in environment variables. Bot will be offline.");
    // Log this so it appears in the dashboard logs
    await storage.createLog({
      action: "Startup Warning",
      details: "No DISCORD_TOKEN found. Please set this environment variable.",
      username: "System"
    });
  }

  return httpServer;
}
