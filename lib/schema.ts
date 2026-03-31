import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  pgEnum,
  date,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "viewer"]);
export const planStatusEnum = pgEnum("plan_status", ["draft", "active", "completed"]);
export const taskStatusEnum = pgEnum("task_status", ["pending", "done"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("viewer"),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rawMaterials = pgTable("raw_materials", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }).notNull(),
  stockQty: numeric("stock_qty", { precision: 10, scale: 3 }).notNull().default("0"),
  minStock: numeric("min_stock", { precision: 10, scale: 3 }).notNull().default("0"),
  shelfLifeHours: integer("shelf_life_hours"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const baseProducts = pgTable("base_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  yieldQty: numeric("yield_qty", { precision: 10, scale: 3 }).notNull(),
  fireRate: numeric("fire_rate", { precision: 5, scale: 4 }).notNull().default("0"),
  shelfLifeHours: integer("shelf_life_hours").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const baseProductIngredients = pgTable("base_product_ingredients", {
  id: uuid("id").defaultRandom().primaryKey(),
  baseProductId: uuid("base_product_id").notNull().references(() => baseProducts.id, { onDelete: "cascade" }),
  rawMaterialId: uuid("raw_material_id").notNull().references(() => rawMaterials.id),
  qtyPerUnit: numeric("qty_per_unit", { precision: 10, scale: 4 }).notNull(),
  unit: text("unit").notNull(),
});

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  sellingPrice: numeric("selling_price", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productBaseRequirements = pgTable("product_base_requirements", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  baseProductId: uuid("base_product_id").notNull().references(() => baseProducts.id),
  qtyPerUnit: numeric("qty_per_unit", { precision: 10, scale: 4 }).notNull(),
});

export const productStages = pgTable("product_stages", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  stageName: text("stage_name").notNull(),
  stageOrder: integer("stage_order").notNull(),
  dayOffset: integer("day_offset").notNull(),
  durationHours: numeric("duration_hours", { precision: 5, scale: 2 }).notNull(),
  notes: text("notes"),
});

export const weeklyPlans = pgTable("weekly_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  weekStart: date("week_start").notNull(),
  status: planStatusEnum("status").notNull().default("draft"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const weeklyPlanItems = pgTable("weekly_plan_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  planId: uuid("plan_id").notNull().references(() => weeklyPlans.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  targetQty: integer("target_qty").notNull(),
});

export const scheduleTasks = pgTable("schedule_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  planId: uuid("plan_id").notNull().references(() => weeklyPlans.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id),
  baseProductId: uuid("base_product_id").references(() => baseProducts.id),
  dayOfWeek: integer("day_of_week").notNull(),
  stageName: text("stage_name").notNull(),
  taskDescription: text("task_description").notNull(),
  requiredQty: numeric("required_qty", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  fifoDeadline: timestamp("fifo_deadline"),
  status: taskStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const salesHistory = pgTable("sales_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  weekStart: date("week_start").notNull(),
  soldQty: integer("sold_qty").notNull(),
  revenue: numeric("revenue", { precision: 10, scale: 2 }),
  channel: text("channel").notNull().default("mağaza"),
  eventType: text("event_type").notNull().default("normal"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const baseProductSubProducts = pgTable("base_product_sub_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  baseProductId: uuid("base_product_id").notNull().references(() => baseProducts.id, { onDelete: "cascade" }),
  subBaseProductId: uuid("sub_base_product_id").notNull().references(() => baseProducts.id),
  qtyPerBatch: numeric("qty_per_batch", { precision: 10, scale: 4 }).notNull(),
  unit: text("unit").notNull(),
});

export const stockMovementTypeEnum = pgEnum("stock_movement_type", ["usage", "restock", "adjustment"]);

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  rawMaterialId: uuid("raw_material_id").notNull().references(() => rawMaterials.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => scheduleTasks.id, { onDelete: "set null" }),
  type: stockMovementTypeEnum("type").notNull(),
  qtyChange: numeric("qty_change", { precision: 10, scale: 4 }).notNull(), // negative=usage, positive=restock
  unit: text("unit").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
