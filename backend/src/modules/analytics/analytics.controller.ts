import type { Request, Response, NextFunction } from "express";
import {
  getDealHealth,
  listAlerts,
  resolveAlert,
  escalateAlert,
  getSalesReport,
} from "./analytics.service.js";
import {
  dealHealthQuerySchema,
  alertsQuerySchema,
  escalateAlertSchema,
  salesReportQuerySchema,
} from "./analytics.schemas.js";
import { ApiError } from "../../lib/api-error.js";

export async function getDealHealthHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const query = dealHealthQuerySchema.parse(req.query);
    const data = await getDealHealth(query.stalled_days);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listAlertsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const query = alertsQuerySchema.parse(req.query);
    const { items, pagination } = await listAlerts(query);
    res.status(200).json({ success: true, data: items, pagination });
  } catch (err) {
    next(err);
  }
}

export async function resolveAlertHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) throw ApiError.badRequest("Invalid alert ID");
    const data = await resolveAlert(id);
    res.status(200).json({ success: true, data, message: "Alert marked as resolved" });
  } catch (err) {
    next(err);
  }
}

export async function escalateAlertHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) throw ApiError.badRequest("Invalid alert ID");
    const body = escalateAlertSchema.parse(req.body);
    const managerId = Number(req.user?.id || 1);
    const data = await escalateAlert(id, managerId, body.message);
    res.status(200).json({
      success: true,
      data,
      message: "Alert escalated to sales representative",
    });
  } catch (err) {
    next(err);
  }
}

export async function getSalesReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const query = salesReportQuerySchema.parse(req.query);
    const data = await getSalesReport(query);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
