import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
export const nurses = pgTable("nurses", {
  id: uuid("id").defaultRandom().primaryKey(),
  externalKey: text("external_key").notNull().unique(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull().unique(),
  homeAddress: text("home_address"),
  workingHours: jsonb("working_hours"),
  breakGapThresholdMinutes: integer("break_gap_threshold_minutes"),
  optimizationObjective: text("optimization_objective"),
  passwordHash: text("password_hash").notNull(),
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
    visitDurationMinutes: integer("visit_duration_minutes").notNull().default(30),
    preferredVisitStartTime: time("preferred_visit_start_time").notNull(),
    preferredVisitEndTime: time("preferred_visit_end_time").notNull(),
    visitTimeType: text("visit_time_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("patients_nurse_id_idx").on(table.nurseId),
    index("patients_nurse_name_idx").on(table.nurseId, table.lastName, table.firstName),
    check(
      "patients_visit_duration_minutes_chk",
      sql`${table.visitDurationMinutes} between 1 and 180`,
    ),
    check("patients_visit_time_type_chk", sql`${table.visitTimeType} in ('fixed', 'flexible')`),
    check(
      "patients_visit_window_order_chk",
      sql`${table.preferredVisitEndTime} > ${table.preferredVisitStartTime}`,
    ),
  ],
);

export const patientVisitWindows = pgTable(
  "patient_visit_windows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    visitTimeType: text("visit_time_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("patient_visit_windows_patient_id_idx").on(table.patientId),
    index("patient_visit_windows_patient_time_idx").on(
      table.patientId,
      table.startTime,
      table.endTime,
    ),
    check(
      "patient_visit_windows_visit_time_type_chk",
      sql`${table.visitTimeType} in ('fixed', 'flexible')`,
    ),
    check("patient_visit_windows_window_order_chk", sql`${table.endTime} > ${table.startTime}`),
  ],
);

export type Nurse = typeof nurses.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
export type PatientVisitWindow = typeof patientVisitWindows.$inferSelect;
export type NewPatientVisitWindow = typeof patientVisitWindows.$inferInsert;
