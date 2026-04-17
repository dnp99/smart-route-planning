import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
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
    isActive: boolean("is_active").notNull().default(true),
    lastScheduledAt: timestamp("last_scheduled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("patients_nurse_id_idx").on(table.nurseId),
    index("patients_nurse_active_idx").on(table.nurseId, table.isActive),
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

export const routeOptimizationRuns = pgTable(
  "route_optimization_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nurseId: uuid("nurse_id")
      .notNull()
      .references(() => nurses.id, { onDelete: "cascade" }),
    planningDate: date("planning_date").notNull(),
    timezone: text("timezone").notNull(),
    endpointVersion: text("endpoint_version").notNull(),
    optimizerVersion: text("optimizer_version").notNull(),
    algorithmVersion: text("algorithm_version").notNull(),
    optimizationObjective: text("optimization_objective"),
    preserveOrder: boolean("preserve_order").notNull().default(false),
    requestedVisitCount: integer("requested_visit_count").notNull(),
    scheduledVisitCount: integer("scheduled_visit_count").notNull(),
    onTimeVisitCount: integer("on_time_visit_count").notNull(),
    unscheduledVisitCount: integer("unscheduled_visit_count").notNull(),
    fixedWindowViolations: integer("fixed_window_violations").notNull(),
    totalLateSeconds: integer("total_late_seconds").notNull(),
    totalWaitSeconds: integer("total_wait_seconds").notNull(),
    totalDistanceMeters: integer("total_distance_meters").notNull(),
    totalDurationSeconds: integer("total_duration_seconds").notNull(),
    warnings: jsonb("warnings")
      .notNull()
      .default(sql`'[]'::jsonb`),
    requestId: text("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("route_optimization_runs_nurse_id_idx").on(table.nurseId),
    index("route_optimization_runs_nurse_created_at_idx").on(table.nurseId, table.createdAt),
    index("route_optimization_runs_nurse_planning_date_idx").on(table.nurseId, table.planningDate),
    check(
      "route_optimization_runs_endpoint_version_chk",
      sql`${table.endpointVersion} in ('v2', 'v3')`,
    ),
    check(
      "route_optimization_runs_optimization_objective_chk",
      sql`${table.optimizationObjective} is null or ${table.optimizationObjective} in ('time', 'distance')`,
    ),
    check(
      "route_optimization_runs_requested_visit_count_chk",
      sql`${table.requestedVisitCount} >= 0`,
    ),
    check(
      "route_optimization_runs_scheduled_visit_count_chk",
      sql`${table.scheduledVisitCount} >= 0`,
    ),
    check("route_optimization_runs_on_time_visit_count_chk", sql`${table.onTimeVisitCount} >= 0`),
    check(
      "route_optimization_runs_unscheduled_visit_count_chk",
      sql`${table.unscheduledVisitCount} >= 0`,
    ),
    check(
      "route_optimization_runs_fixed_window_violations_chk",
      sql`${table.fixedWindowViolations} >= 0`,
    ),
    check("route_optimization_runs_total_late_seconds_chk", sql`${table.totalLateSeconds} >= 0`),
    check("route_optimization_runs_total_wait_seconds_chk", sql`${table.totalWaitSeconds} >= 0`),
    check(
      "route_optimization_runs_total_distance_meters_chk",
      sql`${table.totalDistanceMeters} >= 0`,
    ),
    check(
      "route_optimization_runs_total_duration_seconds_chk",
      sql`${table.totalDurationSeconds} >= 0`,
    ),
  ],
);

export const routeOptimizationTasks = pgTable(
  "route_optimization_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => routeOptimizationRuns.id, { onDelete: "cascade" }),
    nurseId: uuid("nurse_id")
      .notNull()
      .references(() => nurses.id, { onDelete: "cascade" }),
    visitId: text("visit_id").notNull(),
    patientId: text("patient_id").notNull(),
    patientName: text("patient_name").notNull(),
    address: text("address").notNull(),
    windowStart: time("window_start").notNull(),
    windowEnd: time("window_end").notNull(),
    windowType: text("window_type").notNull(),
    arrivalTime: timestamp("arrival_time", { withTimezone: true }),
    serviceStartTime: timestamp("service_start_time", { withTimezone: true }),
    serviceEndTime: timestamp("service_end_time", { withTimezone: true }),
    waitSeconds: integer("wait_seconds"),
    lateBySeconds: integer("late_by_seconds"),
    onTime: boolean("on_time"),
    isUnscheduled: boolean("is_unscheduled").notNull().default(false),
    unscheduledReason: text("unscheduled_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("route_optimization_tasks_run_id_idx").on(table.runId),
    index("route_optimization_tasks_nurse_id_idx").on(table.nurseId),
    index("route_optimization_tasks_nurse_service_start_idx").on(
      table.nurseId,
      table.serviceStartTime,
    ),
    check(
      "route_optimization_tasks_window_type_chk",
      sql`${table.windowType} in ('fixed', 'flexible')`,
    ),
    check(
      "route_optimization_tasks_window_order_chk",
      sql`${table.windowEnd} > ${table.windowStart}`,
    ),
    check(
      "route_optimization_tasks_wait_seconds_chk",
      sql`${table.waitSeconds} is null or ${table.waitSeconds} >= 0`,
    ),
    check(
      "route_optimization_tasks_late_by_seconds_chk",
      sql`${table.lateBySeconds} is null or ${table.lateBySeconds} >= 0`,
    ),
  ],
);

export type Nurse = typeof nurses.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
export type PatientVisitWindow = typeof patientVisitWindows.$inferSelect;
export type NewPatientVisitWindow = typeof patientVisitWindows.$inferInsert;
export type RouteOptimizationRun = typeof routeOptimizationRuns.$inferSelect;
export type NewRouteOptimizationRun = typeof routeOptimizationRuns.$inferInsert;
export type RouteOptimizationTask = typeof routeOptimizationTasks.$inferSelect;
export type NewRouteOptimizationTask = typeof routeOptimizationTasks.$inferInsert;
