import { index, bigint, integer, pgTable, serial, text, uniqueIndex, customType, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
export const servicePrices = pgTable("service_prices", {
  id: text("id").primaryKey(),
  service: text("service").notNull(),
  option: text("option").notNull().default(""),
  amount: text("amount").notNull().default(""),
  currency: text("currency").notNull().default("GHS"),
  unit: text("unit").notNull().default("per project"),
  mode: text("mode").notNull().default("fixed"),
  minimum: integer("minimum").notNull().default(1),
  notes: text("notes").notNull().default(""),
  updatedAt: bigint("updated_at", { mode:"number" }).notNull(),
}, table => [index("service_prices_service_idx").on(table.service)]);
export const storedFiles = pgTable("stored_files", {
  objectKey: text("object_key").primaryKey(),
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, table => [check("stored_files_size", sql`octet_length(${table.data}) <= 26214400`)]);

export const workItems = pgTable("work_items", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  client: text("client").notNull().default(""),
  service: text("service").notNull().default(""),
  status: text("status").notNull(),
  dueDate: text("due_date").notNull().default(""),
  accountingDate: text("accounting_date").notNull().default(""),
  notes: text("notes").notNull().default(""),
  amount: text("amount").notNull().default(""),
  currency: text("currency").notNull().default(""),
  direction: text("direction").notNull().default(""),
  price: text("price").notNull().default("0"),
  cost: text("cost").notNull().default("0"),
  costItems: text("cost_items").notNull().default("[]"),
  projectId: text("project_id"),
  vendorId: text("vendor_id"),
  sourceLeadId: text("source_lead_id"),
  createdById: text("created_by_id").notNull().default(""),
  createdByName: text("created_by_name").notNull().default(""),
  taskSourceKind: text("task_source_kind").notNull().default(""),
  taskSourceId: text("task_source_id"),
  taskKey: text("task_key"),
  taskAssignee: text("task_assignee").notNull().default(""),
  taskAssigneeId: text("task_assignee_id").notNull().default(""),
  taskReferenceUrl: text("task_reference_url").notNull().default(""),
  taskReferenceDate: text("task_reference_date").notNull().default(""),
  taskPriority: text("task_priority").notNull().default("Normal"),
  taskChecklist: text("task_checklist").notNull().default("[]"),
  taskLabels: text("task_labels").notNull().default(""),
  category: text("category").notNull().default(""),
  paymentMethod: text("payment_method").notNull().default(""),
  reference: text("reference").notNull().default(""),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, table => [uniqueIndex("idx_work_items_source_lead_id").on(table.sourceLeadId), index("idx_work_items_project_id").on(table.projectId), index("idx_work_items_vendor_id").on(table.vendorId), uniqueIndex("idx_work_items_task_key").on(table.taskKey)]);

export const teamMembers = pgTable("team_members", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  customName: text("custom_name").notNull().default(""),
  role: text("role").notNull().default("Team member"),
  lastSeen: bigint("last_seen", { mode: "number" }).notNull(),
});
export const taskColumns = pgTable("task_columns", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const leadAssets = pgTable("lead_assets", {
  id: text("id").primaryKey(),
  leadId: text("lead_id").notNull().references(() => workItems.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedAt: bigint("uploaded_at", { mode: "number" }).notNull(),
  uploadedBy: text("uploaded_by").notNull(),
}, table => [index("idx_lead_assets_lead_id").on(table.leadId)]);

export const projectAssets = pgTable("project_assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => workItems.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedAt: bigint("uploaded_at", { mode: "number" }).notNull(),
  uploadedBy: text("uploaded_by").notNull(),
}, table => [index("idx_project_assets_project_id").on(table.projectId)]);

export const projectDeliverables = pgTable("project_deliverables", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => workItems.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull().default("Planned"),
  notes: text("notes").notNull().default(""),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, table => [index("idx_project_deliverables_project_date").on(table.projectId, table.dueDate)]);

export const contacts = pgTable("contacts", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  contactPerson: text("contact_person").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  specialty: text("specialty").notNull().default(""),
  location: text("location").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, table => [index("idx_contacts_kind").on(table.kind)]);

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  orderId: text("order_id"),
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date").notNull(),
  billToName: text("bill_to_name").notNull().default(""),
  billToDetails: text("bill_to_details").notNull().default(""),
  currency: text("currency").notNull().default("GHS"),
  lineItems: text("line_items").notNull(),
  paymentDetails: text("payment_details").notNull().default(""),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, table => [uniqueIndex("idx_invoices_order_id").on(table.orderId)]);

export const financeBudgets = pgTable("finance_budgets", {
  month: text("month").notNull(),
  currency: text("currency").notNull(),
  revenueTarget: text("revenue_target").notNull().default("0"),
  expenseLimit: text("expense_limit").notNull().default("0"),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, table => [uniqueIndex("idx_finance_budgets_month_currency").on(table.month, table.currency)]);

export const marketingPosts = pgTable("marketing_posts", {
  time: text("time").notNull().default(""),
  pillar: text("pillar").notNull().default(""),
  message: text("message").notNull().default(""),
  purpose: text("purpose").notNull().default(""),
  hashtag: text("hashtag").notNull().default(""),
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  service: text("service").notNull().default(""),
  date: text("date").notNull(),
  channel: text("channel").notNull(),
  format: text("format").notNull(),
  caption: text("caption").notNull().default(""),
  brief: text("brief").notNull().default(""),
  campaign: text("campaign").notNull().default(""),
  status: text("status").notNull().default("Draft"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, table => [index("idx_marketing_posts_date").on(table.date)]);

export const taskGenerations = pgTable("task_generations", {
  sourceKey: text("source_key").primaryKey(),
  sourceKind: text("source_kind").notNull(),
  sourceId: text("source_id").notNull(),
  sourceTitle: text("source_title").notNull(),
  status: text("status").notNull(),
  error: text("error").notNull().default(""),
  runId: text("run_id").notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const taskUpdates = pgTable("task_updates", {
 id: text("id").primaryKey(),
 taskId: text("task_id").notNull().references(()=>workItems.id,{onDelete:"cascade"}),
 author: text("author").notNull(),
 body: text("body").notNull(),
 kind: text("kind").notNull(),
 createdAt: bigint("created_at", { mode: "number" }).notNull(),
},table=>[index("idx_task_updates_task").on(table.taskId,table.createdAt)]);
