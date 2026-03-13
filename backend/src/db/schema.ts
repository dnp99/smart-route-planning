import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, time, timestamp, uuid } from "drizzle-orm/pg-core";

export const nurses = pgTable("nurses", {
  id: uuid("id").defaultRandom().primaryKey(),
  externalKey: text("external_key").notNull().unique(),
  displayName: text("display_name").notNull(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nurseId: uuid("nurse_id")
      .notNull()
      .references(() => nurses.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    address: text("address").notNull(),
    googlePlaceId: text("google_place_id"),
    preferredVisitStartTime: time("preferred_visit_start_time").notNull(),
    preferredVisitEndTime: time("preferred_visit_end_time").notNull(),
    visitTimeType: text("visit_time_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("patients_nurse_id_idx").on(table.nurseId),
    index("patients_nurse_name_idx").on(table.nurseId, table.lastName, table.firstName),
    check("patients_visit_time_type_chk", sql`${table.visitTimeType} in ('fixed', 'flexible')`),
    check(
      "patients_visit_window_order_chk",
      sql`${table.preferredVisitEndTime} > ${table.preferredVisitStartTime}`,
    ),
  ],
);

export type Nurse = typeof nurses.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
