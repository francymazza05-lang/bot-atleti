import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { bot } from "./bot";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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
    await storage.updateSetting("statusMessage", "Serving commands!");
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
