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
  price: text("price").notNull().default("0"),
  cost: text("cost").notNull().default("0"),
  costItems: text("cost_items").notNull().default("[]"),
  projectId: text("project_id"),
  vendorId: text("vendor_id"),
  sourceLeadId: text("source_lead_id"),
  category: text("category").notNull().default(""),
  paymentMethod: text("payment_method").notNull().default(""),
  reference: text("reference").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, table => [uniqueIndex("idx_work_items_source_lead_id").on(table.sourceLeadId), index("idx_work_items_project_id").on(table.projectId), index("idx_work_items_vendor_id").on(table.vendorId)]);

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

export const projectDeliverables = sqliteTable("project_deliverables", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => workItems.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull().default("Planned"),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, table => [index("idx_project_deliverables_project_date").on(table.projectId, table.dueDate)]);

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  contactPerson: text("contact_person").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  specialty: text("specialty").notNull().default(""),
  location: text("location").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, table => [index("idx_contacts_kind").on(table.kind)]);

export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: text("order_id").notNull(),
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date").notNull(),
  billToName: text("bill_to_name").notNull().default(""),
  billToDetails: text("bill_to_details").notNull().default(""),
  currency: text("currency").notNull().default("GHS"),
  lineItems: text("line_items").notNull(),
  paymentDetails: text("payment_details").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, table => [uniqueIndex("idx_invoices_order_id").on(table.orderId)]);

export const financeBudgets = sqliteTable("finance_budgets", {
  month: text("month").notNull(),
  currency: text("currency").notNull(),
  revenueTarget: text("revenue_target").notNull().default("0"),
  expenseLimit: text("expense_limit").notNull().default("0"),
  updatedAt: integer("updated_at").notNull(),
}, table => [uniqueIndex("idx_finance_budgets_month_currency").on(table.month, table.currency)]);
