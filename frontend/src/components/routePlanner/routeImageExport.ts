import type { OptimizeRouteResponse } from "../types";
import { expectedStartTimeFormatter, formatBreakGap } from "./routePlannerResultUtils";
import { formatDuration } from "./routePlannerUtils";
import { formatNameWords } from "../patients/patientName";

const CANVAS_WIDTH = 800;
const PAD_X = 32;
const STOP_ROW_HEIGHT = 64;
const BREAK_ROW_HEIGHT = 44;
const HEADER_HEIGHT = 80;
const METRICS_HEIGHT = 56;
const SECTION_LABEL_HEIGHT = 40;
const FOOTER_HEIGHT = 40;

// Colours
const COLOR_HEADER_BG = "#1e293b";
const COLOR_HEADER_TEXT = "#f8fafc";
const COLOR_HEADER_SUB = "#94a3b8";
const COLOR_WHITE = "#ffffff";
const COLOR_ROW_ALT = "#f8fafc";
const COLOR_BORDER = "#e2e8f0";
const COLOR_TEXT_MAIN = "#0f172a";
const COLOR_TEXT_SUB = "#64748b";
const COLOR_GREEN_BG = "#dcfce7";
const COLOR_GREEN_TEXT = "#15803d";
const COLOR_RED_BG = "#fee2e2";
const COLOR_RED_TEXT = "#b91c1c";
const COLOR_AMBER_BG = "#fffbeb";
const COLOR_AMBER_TEXT = "#92400e";
const COLOR_METRICS_BG = "#f1f5f9";
const COLOR_FOOTER_BG = "#f1f5f9";
const COLOR_FOOTER_TEXT = "#94a3b8";
const COLOR_BREAK_BG = "#eff6ff"; // blue-50
const COLOR_BREAK_BORDER = "#bfdbfe"; // blue-200
const COLOR_BREAK_TEXT = "#1e40af"; // blue-800
const COLOR_BREAK_SUB = "#3b82f6"; // blue-500

type BreakInfo = {
  isLunch: boolean;
  durationMinutes: number;
  startMs: number;
  endMs: number;
};

type Row =
  | { kind: "stop"; stop: OptimizeRouteResponse["orderedStops"][number]; stopNum: number }
  | { kind: "break"; info: BreakInfo };

function isLunchBreak(
  breakStartMs: number,
  breakDurationMinutes: number,
  lunchStartTime?: string,
  lunchDurationMinutes?: number,
): boolean {
  if (!lunchStartTime || !lunchDurationMinutes) return false;
  if (Math.abs(breakDurationMinutes - lunchDurationMinutes) > 1) return false;
  const [lh, lm] = lunchStartTime.split(":").map(Number);
  const lunchStartMin = lh * 60 + lm;
  const d = new Date(breakStartMs);
  const breakMin = d.getHours() * 60 + d.getMinutes();
  return Math.abs(breakMin - lunchStartMin) <= 90;
}

function formatDateLabel(planningDate: string): string {
  const [year, month, day] = planningDate.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let low = 0;
  let high = text.length;
  while (low < high - 1) {
    const mid = Math.floor((low + high) / 2);
    if (ctx.measureText(text.slice(0, mid) + "…").width <= maxWidth) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return text.slice(0, low) + "…";
}

export type ExportRouteImageOptions = {
  breakGapThresholdMinutes?: number | null;
  lunchStartTime?: string;
  lunchDurationMinutes?: number;
};

export async function exportRouteImage(
  result: OptimizeRouteResponse,
  planningDate: string,
  options: ExportRouteImageOptions = {},
): Promise<void> {
  const { breakGapThresholdMinutes, lunchStartTime, lunchDurationMinutes } = options;
  const effectiveBreakGap = breakGapThresholdMinutes ?? null;

  const scheduledStops = result.orderedStops.filter((s) => !s.isEndingPoint && s.tasks.length > 0);

  // Build rows array interleaving breaks and stops
  const rows: Row[] = [];
  scheduledStops.forEach((stop, index) => {
    if (index > 0 && effectiveBreakGap !== null) {
      const prevStop = scheduledStops[index - 1];
      const prevDepartureMs = new Date(prevStop.departureTime).getTime();
      const nextServiceStartMs = new Date(stop.tasks[0].serviceStartTime).getTime();
      const travelMs = stop.durationFromPreviousSeconds * 1000;
      const idleGapMinutes = (nextServiceStartMs - prevDepartureMs - travelMs) / 60000;
      if (idleGapMinutes >= effectiveBreakGap) {
        const breakStartMs = prevDepartureMs;
        const breakEndMs = nextServiceStartMs - travelMs;
        rows.push({
          kind: "break",
          info: {
            isLunch: isLunchBreak(
              breakStartMs,
              idleGapMinutes,
              lunchStartTime,
              lunchDurationMinutes,
            ),
            durationMinutes: idleGapMinutes,
            startMs: breakStartMs,
            endMs: breakEndMs,
          },
        });
      }
    }
    rows.push({ kind: "stop", stop, stopNum: index + 1 });
  });

  const hasUnscheduled = result.unscheduledTasks.length > 0;
  const unscheduledSectionHeight = hasUnscheduled
    ? SECTION_LABEL_HEIGHT + result.unscheduledTasks.length * 48 + 16
    : 0;

  const timelineHeight = rows.reduce(
    (sum, row) => sum + (row.kind === "stop" ? STOP_ROW_HEIGHT : BREAK_ROW_HEIGHT),
    0,
  );

  const canvasHeight =
    HEADER_HEIGHT +
    METRICS_HEIGHT +
    SECTION_LABEL_HEIGHT +
    timelineHeight +
    unscheduledSectionHeight +
    FOOTER_HEIGHT;

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // ── Header ──────────────────────────────────────────────────
  ctx.fillStyle = COLOR_HEADER_BG;
  ctx.fillRect(0, 0, CANVAS_WIDTH, HEADER_HEIGHT);

  ctx.fillStyle = COLOR_HEADER_TEXT;
  ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText("CareFlow", PAD_X, 18);

  ctx.fillStyle = COLOR_HEADER_SUB;
  ctx.font = "14px system-ui, -apple-system, sans-serif";
  ctx.fillText(formatDateLabel(planningDate), PAD_X, 46);

  const leaveBy = expectedStartTimeFormatter.format(new Date(result.start.departureTime));
  const leaveByText = `Suggested leave-by ~ ${leaveBy}`;
  ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#fbbf24";
  const leaveByWidth = ctx.measureText(leaveByText).width;
  ctx.fillText(leaveByText, CANVAS_WIDTH - PAD_X - leaveByWidth, 46);

  // ── Metrics row ─────────────────────────────────────────────
  const metricY = HEADER_HEIGHT;
  ctx.fillStyle = COLOR_METRICS_BG;
  ctx.fillRect(0, metricY, CANVAS_WIDTH, METRICS_HEIGHT);

  ctx.strokeStyle = COLOR_BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, metricY);
  ctx.lineTo(CANVAS_WIDTH, metricY);
  ctx.stroke();

  const metrics = [
    { label: "Stops", value: String(scheduledStops.length) },
    { label: "Drive time", value: formatDuration(result.metrics.totalDurationSeconds) },
    { label: "Distance", value: `${result.metrics.totalDistanceKm} km` },
  ];

  const cellWidth = CANVAS_WIDTH / metrics.length;
  metrics.forEach((m, i) => {
    const cx = cellWidth * i + cellWidth / 2;
    ctx.fillStyle = COLOR_TEXT_MAIN;
    ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(m.value, cx, metricY + 10);
    ctx.fillStyle = COLOR_TEXT_SUB;
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.fillText(m.label, cx, metricY + 32);
  });

  // ── Section label ────────────────────────────────────────────
  let curY = HEADER_HEIGHT + METRICS_HEIGHT;
  ctx.textAlign = "left";
  ctx.fillStyle = COLOR_WHITE;
  ctx.fillRect(0, curY, CANVAS_WIDTH, SECTION_LABEL_HEIGHT);
  ctx.strokeStyle = COLOR_BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, curY);
  ctx.lineTo(CANVAS_WIDTH, curY);
  ctx.stroke();

  ctx.fillStyle = COLOR_TEXT_SUB;
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("ROUTE TIMELINE", PAD_X, curY + SECTION_LABEL_HEIGHT / 2);
  curY += SECTION_LABEL_HEIGHT;

  // ── Timeline rows ─────────────────────────────────────────────
  let stopRowIndex = 0; // for alternating bg
  rows.forEach((row) => {
    if (row.kind === "break") {
      const { info } = row;
      ctx.fillStyle = COLOR_BREAK_BG;
      ctx.fillRect(0, curY, CANVAS_WIDTH, BREAK_ROW_HEIGHT);
      ctx.strokeStyle = COLOR_BREAK_BORDER;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, curY + BREAK_ROW_HEIGHT);
      ctx.lineTo(CANVAS_WIDTH, curY + BREAK_ROW_HEIGHT);
      ctx.stroke();

      // Break label pill
      const label = info.isLunch ? "Lunch" : "Break";
      const duration = formatBreakGap(info.durationMinutes);
      const pillText = `${label} · ${duration}`;
      ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
      const pillWidth = ctx.measureText(pillText).width + 20;
      const pillH = 22;
      const pillX = PAD_X;
      const pillY = curY + (BREAK_ROW_HEIGHT - pillH) / 2;
      drawRoundedRect(ctx, pillX, pillY, pillWidth, pillH, 11);
      ctx.fillStyle = COLOR_BREAK_BG;
      ctx.fill();
      ctx.strokeStyle = COLOR_BREAK_BORDER;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = COLOR_BREAK_TEXT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pillText, pillX + pillWidth / 2, pillY + pillH / 2);

      // Time range
      const timeRange = `${expectedStartTimeFormatter.format(new Date(info.startMs))} – ${expectedStartTimeFormatter.format(new Date(info.endMs))}`;
      ctx.fillStyle = COLOR_BREAK_SUB;
      ctx.font = "12px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(timeRange, PAD_X + pillWidth + 12, curY + BREAK_ROW_HEIGHT / 2);

      curY += BREAK_ROW_HEIGHT;
    } else {
      const { stop, stopNum } = row;
      const rowBg = stopRowIndex % 2 === 0 ? COLOR_WHITE : COLOR_ROW_ALT;
      stopRowIndex += 1;

      ctx.fillStyle = rowBg;
      ctx.fillRect(0, curY, CANVAS_WIDTH, STOP_ROW_HEIGHT);
      ctx.strokeStyle = COLOR_BORDER;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, curY + STOP_ROW_HEIGHT);
      ctx.lineTo(CANVAS_WIDTH, curY + STOP_ROW_HEIGHT);
      ctx.stroke();

      const task = stop.tasks[0];
      const timeText = task
        ? expectedStartTimeFormatter.format(new Date(task.serviceStartTime))
        : "";
      const isOnTime = task ? task.onTime : true;
      const patientName = task?.patientName ? formatNameWords(task.patientName) : stop.address;
      const addressText = task?.address ?? stop.address;

      // Stop number circle
      const circleX = PAD_X + 16;
      const circleY = curY + STOP_ROW_HEIGHT / 2;
      ctx.beginPath();
      ctx.arc(circleX, circleY, 14, 0, Math.PI * 2);
      ctx.fillStyle = "#e2e8f0";
      ctx.fill();
      ctx.fillStyle = COLOR_TEXT_MAIN;
      ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(stopNum), circleX, circleY);

      // Patient name
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = COLOR_TEXT_MAIN;
      ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
      const nameX = PAD_X + 40;
      const nameMaxWidth = CANVAS_WIDTH - nameX - PAD_X - 110;
      ctx.fillText(truncate(ctx, patientName, nameMaxWidth), nameX, curY + 12);

      // Address
      ctx.fillStyle = COLOR_TEXT_SUB;
      ctx.font = "12px system-ui, -apple-system, sans-serif";
      ctx.fillText(truncate(ctx, addressText, nameMaxWidth), nameX, curY + 34);

      // Time
      if (timeText) {
        ctx.fillStyle = COLOR_TEXT_MAIN;
        ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillText(timeText, CANVAS_WIDTH - PAD_X - 2, curY + 12);
      }

      // Status pill
      const pillText = isOnTime ? "✓ On time" : "✗ Late";
      const pillBg = isOnTime ? COLOR_GREEN_BG : COLOR_RED_BG;
      const pillFg = isOnTime ? COLOR_GREEN_TEXT : COLOR_RED_TEXT;
      ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
      const pillWidth = ctx.measureText(pillText).width + 16;
      const pillX = CANVAS_WIDTH - PAD_X - pillWidth;
      const pillY = curY + 36;
      const pillH = 20;
      drawRoundedRect(ctx, pillX, pillY, pillWidth, pillH, 10);
      ctx.fillStyle = pillBg;
      ctx.fill();
      ctx.fillStyle = pillFg;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pillText, pillX + pillWidth / 2, pillY + pillH / 2);

      curY += STOP_ROW_HEIGHT;
    }
  });

  // ── Unscheduled section ──────────────────────────────────────
  if (hasUnscheduled) {
    ctx.fillStyle = COLOR_AMBER_BG;
    ctx.fillRect(0, curY, CANVAS_WIDTH, SECTION_LABEL_HEIGHT);
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, curY);
    ctx.lineTo(CANVAS_WIDTH, curY);
    ctx.stroke();

    ctx.fillStyle = COLOR_AMBER_TEXT;
    ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `UNSCHEDULED VISITS (${result.unscheduledTasks.length})`,
      PAD_X,
      curY + SECTION_LABEL_HEIGHT / 2,
    );
    curY += SECTION_LABEL_HEIGHT;

    result.unscheduledTasks.forEach((task) => {
      ctx.fillStyle = COLOR_AMBER_BG;
      ctx.fillRect(0, curY, CANVAS_WIDTH, 48);
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, curY + 48);
      ctx.lineTo(CANVAS_WIDTH, curY + 48);
      ctx.stroke();

      const name = task.patientName ? formatNameWords(task.patientName) : task.patientId;
      ctx.fillStyle = "#78350f";
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(truncate(ctx, name, CANVAS_WIDTH - PAD_X * 2), PAD_X, curY + 10);

      if (task.address) {
        ctx.fillStyle = COLOR_AMBER_TEXT;
        ctx.font = "12px system-ui, -apple-system, sans-serif";
        ctx.fillText(truncate(ctx, task.address, CANVAS_WIDTH - PAD_X * 2), PAD_X, curY + 28);
      }

      curY += 48;
    });

    curY += 16;
  }

  // ── Footer ───────────────────────────────────────────────────
  ctx.fillStyle = COLOR_FOOTER_BG;
  ctx.fillRect(0, curY, CANVAS_WIDTH, FOOTER_HEIGHT);
  ctx.strokeStyle = COLOR_BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, curY);
  ctx.lineTo(CANVAS_WIDTH, curY);
  ctx.stroke();
  ctx.fillStyle = COLOR_FOOTER_TEXT;
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Generated by CareFlow", CANVAS_WIDTH / 2, curY + FOOTER_HEIGHT / 2);

  // ── Save / share ─────────────────────────────────────────────
  return new Promise<void>((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("Failed to generate image blob"));
        return;
      }

      const filename = `careflow-schedule-${planningDate}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      try {
        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "CareFlow Schedule" });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        resolve();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          resolve();
        } else {
          reject(err);
        }
      }
    }, "image/png");
  });
}
