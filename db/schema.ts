import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  sourceLeadId: text("source_lead_id"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, table => [uniqueIndex("idx_work_items_source_lead_id").on(table.sourceLeadId)]);

export const leadAssets = sqliteTable("lead_assets", {
  id: text("id").primaryKey(),
  leadId: text("lead_id").notNull().references(() => workItems.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedAt: integer("uploaded_at").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
}, table => [index("idx_lead_assets_lead_id").on(table.leadId)]);

export const projectAssets = sqliteTable("project_assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => workItems.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedAt: integer("uploaded_at").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
}, table => [index("idx_project_assets_project_id").on(table.projectId)]);

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  contactPerson: text("contact_person").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  specialty: text("specialty").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, table => [index("idx_contacts_kind").on(table.kind)]);
