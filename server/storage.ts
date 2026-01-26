import { db } from "./db";
import {
  logs,
  settings,
  workouts,
  deadlines,
  birthdayWishes,
  type InsertLog,
  type Log,
  type InsertSetting,
  type Setting,
  type InsertWorkout,
  type Workout,
  type InsertDeadline,
  type Deadline,
  type BirthdayWish,
} from "@shared/schema";
import { eq, desc, lte, and, ilike } from "drizzle-orm";

export interface IStorage {
  // Logs
  getLogs(limit?: number): Promise<Log[]>;
  createLog(log: InsertLog): Promise<Log>;

  // Settings
  getSettings(): Promise<Setting[]>;
  getSetting(key: string): Promise<Setting | undefined>;
  updateSetting(key: string, value: string): Promise<Setting>;

  // Workouts
  getWorkouts(userId: string): Promise<Workout[]>;
  createWorkout(workout: InsertWorkout): Promise<Workout>;

  // Deadlines
  getUpcomingDeadlines(): Promise<Deadline[]>;
  getDeadlineById(id: number): Promise<Deadline | undefined>;
  createDeadline(deadline: InsertDeadline): Promise<Deadline>;
  createDeadlineWithFlags(deadline: InsertDeadline, flags: { oneMonth: boolean, tenDays: boolean, threeDays: boolean, oneDay: boolean }): Promise<Deadline>;
  markDeadlineNotified(id: number, level: 'oneMonth' | 'tenDays' | 'threeDays' | 'oneDay'): Promise<void>;
  getDeadlinesByAthlete(name: string): Promise<Deadline[]>;

  // Birthday wishes
  getBirthdayWish(athleteName: string): Promise<BirthdayWish | undefined>;
  setBirthdayWish(athleteName: string, year: number): Promise<void>;
  getAthletesWithBirthdays(): Promise<{ athleteName: string; dateOfBirth: string }[]>;
}

export class DatabaseStorage implements IStorage {
  async getLogs(limit: number = 50): Promise<Log[]> {
    return await db.select().from(logs).orderBy(desc(logs.createdAt)).limit(limit);
  }

  async createLog(log: InsertLog): Promise<Log> {
    const [newLog] = await db.insert(logs).values(log).returning();
    return newLog;
  }

  async getSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting;
  }

  async updateSetting(key: string, value: string): Promise<Setting> {
    const [existing] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key));

    if (existing) {
      const [updated] = await db
        .update(settings)
        .set({ value })
        .where(eq(settings.key, key))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(settings)
        .values({ key, value })
        .returning();
      return created;
    }
  }

  async getWorkouts(userId: string): Promise<Workout[]> {
    return await db.select().from(workouts).where(eq(workouts.userId, userId)).orderBy(desc(workouts.createdAt));
  }

  async createWorkout(workout: InsertWorkout): Promise<Workout> {
    const [newWorkout] = await db.insert(workouts).values(workout).returning();
    return newWorkout;
  }

  async getUpcomingDeadlines(): Promise<Deadline[]> {
    return await db.select().from(deadlines);
  }

  async getDeadlineById(id: number): Promise<Deadline | undefined> {
    const [deadline] = await db.select().from(deadlines).where(eq(deadlines.id, id));
    return deadline;
  }

  async createDeadline(deadline: InsertDeadline): Promise<Deadline> {
    const [newDeadline] = await db.insert(deadlines).values(deadline).returning();
    return newDeadline;
  }

  async createDeadlineWithFlags(deadline: InsertDeadline, flags: { oneMonth: boolean, tenDays: boolean, threeDays: boolean, oneDay: boolean }): Promise<Deadline> {
    const [newDeadline] = await db.insert(deadlines).values({
      ...deadline,
      notifiedOneMonth: flags.oneMonth,
      notifiedTenDays: flags.tenDays,
      notifiedThreeDays: flags.threeDays,
      notifiedOneDay: flags.oneDay
    }).returning();
    return newDeadline;
  }

  async markDeadlineNotified(id: number, level: 'oneMonth' | 'tenDays' | 'threeDays' | 'oneDay'): Promise<void> {
    const update: any = {};
    if (level === 'oneMonth') update.notifiedOneMonth = true;
    if (level === 'tenDays') update.notifiedTenDays = true;
    if (level === 'threeDays') update.notifiedThreeDays = true;
    if (level === 'oneDay') update.notifiedOneDay = true;
    await db.update(deadlines).set(update).where(eq(deadlines.id, id));
  }

  async getDeadlinesByAthlete(name: string): Promise<Deadline[]> {
    return await db.select().from(deadlines).where(ilike(deadlines.athleteName, name));
  }

  async clearAllDeadlines(): Promise<void> {
    await db.delete(deadlines);
  }

  async setSmartNotificationFlags(): Promise<number> {
    // Set flags intelligently based on days remaining to each deadline
    // This ensures existing deadlines get correct future reminders without spam
    const allDeadlines = await db.select().from(deadlines);
    const now = Date.now();
    let updated = 0;
    
    for (const d of allDeadlines) {
      if (d.type === 'info') continue;
      
      const diffDays = Math.ceil((d.date.getTime() - now) / (1000 * 60 * 60 * 24));
      
      // Set flags based on which windows have PASSED (not current window)
      // This ensures the reminder for the CURRENT window can still be sent
      // Reminder windows: 30-10 days, 10-3 days, 3-1 days, 1-0 days
      // 
      // Example: deadline in 5 days (diffDays=5)
      // - oneMonth window (30-10) has passed → oneMonth=true
      // - tenDays window (10-3) is CURRENT → tenDays=false (can send reminder)
      // - threeDays window (3-1) not yet → threeDays=false
      // - oneDay window (1-0) not yet → oneDay=false
      
      // Check if this deadline was incorrectly blocked (all flags true but deadline still in future)
      const wasBlocked = d.notifiedOneMonth && d.notifiedTenDays && d.notifiedThreeDays && d.notifiedOneDay && diffDays > 0;
      
      let flags;
      if (wasBlocked) {
        // Reset: soglie passate = true, soglie future = false
        flags = {
          notifiedOneMonth: diffDays <= 10,
          notifiedTenDays: diffDays <= 3,
          notifiedThreeDays: diffDays <= 1,
          notifiedOneDay: diffDays <= 0
        };
      } else {
        // Normal: flag true resta true (irreversibile), flag false → true se soglia passata
        flags = {
          notifiedOneMonth: d.notifiedOneMonth || diffDays <= 10,
          notifiedTenDays: d.notifiedTenDays || diffDays <= 3,
          notifiedThreeDays: d.notifiedThreeDays || diffDays <= 1,
          notifiedOneDay: d.notifiedOneDay || diffDays <= 0
        };
      }
      
      await db.update(deadlines)
        .set(flags)
        .where(eq(deadlines.id, d.id));
      updated++;
    }
    
    return updated;
  }

  async getBirthdayWish(athleteName: string): Promise<BirthdayWish | undefined> {
    const [wish] = await db.select().from(birthdayWishes).where(eq(birthdayWishes.athleteName, athleteName));
    return wish;
  }

  async setBirthdayWish(athleteName: string, year: number): Promise<void> {
    const existing = await this.getBirthdayWish(athleteName);
    if (existing) {
      await db.update(birthdayWishes)
        .set({ lastWishYear: year })
        .where(eq(birthdayWishes.athleteName, athleteName));
    } else {
      await db.insert(birthdayWishes).values({ athleteName, lastWishYear: year });
    }
  }

  async getAthletesWithBirthdays(): Promise<{ athleteName: string; dateOfBirth: string }[]> {
    const allDeadlines = await db.select().from(deadlines);
    const uniqueAthletes = new Map<string, string>();
    for (const d of allDeadlines) {
      if (d.dateOfBirth && !uniqueAthletes.has(d.athleteName)) {
        uniqueAthletes.set(d.athleteName, d.dateOfBirth);
      }
    }
    return Array.from(uniqueAthletes.entries()).map(([athleteName, dateOfBirth]) => ({ athleteName, dateOfBirth }));
  }
}

export const storage = new DatabaseStorage();
