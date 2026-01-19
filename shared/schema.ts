import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  details: text("details").notNull(),
  username: text("username"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workouts = pgTable("workouts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  exercise: text("exercise").notNull(),
  result: text("result").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const deadlines = pgTable("deadlines", {
  id: serial("id").primaryKey(),
  athleteName: text("athlete_name").notNull(),
  dateOfBirth: text("date_of_birth"),
  fidalCard: text("fidal_card"),
  subscriptionType: text("subscription_type"),
  type: text("type").notNull(), // 'pagamento', 'certificato', 'tabella'
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  notifiedOneMonth: boolean("notified_one_month").default(false),
  notifiedTenDays: boolean("notified_ten_days").default(false),
  notifiedThreeDays: boolean("notified_three_days").default(false),
  notifiedOneDay: boolean("notified_one_day").default(false),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const insertLogSchema = createInsertSchema(logs).omit({ id: true, createdAt: true });
export const insertWorkoutSchema = createInsertSchema(workouts).omit({ id: true, createdAt: true });
export const insertDeadlineSchema = createInsertSchema(deadlines).omit({ 
  id: true,
  notifiedOneMonth: true,
  notifiedTenDays: true,
  notifiedThreeDays: true,
  notifiedOneDay: true
});
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });

export type Log = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;
export type Workout = typeof workouts.$inferSelect;
export type InsertWorkout = z.infer<typeof insertWorkoutSchema>;
export type Deadline = typeof deadlines.$inferSelect;
export type InsertDeadline = z.infer<typeof insertDeadlineSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

export type BotStatus = {
  status: "online" | "offline" | "connecting";
  uptime: number | null;
  serverCount: number;
  ping: number;
};
