import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workItems = sqliteTable("work_items", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  client: text("client").notNull().default(""),
  service: text("service").notNull().default(""),
  status: text("status").notNull(),
  dueDate: text("due_date").notNull().default(""),
  notes: text("notes").notNull().default(""),
  amount: text("amount").notNull().default(""),
  currency: text("currency").notNull().default(""),
  direction: text("direction").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
