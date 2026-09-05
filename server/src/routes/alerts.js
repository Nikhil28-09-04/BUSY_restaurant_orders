import express from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = express.Router();

const ALERT_THRESHOLD_MINUTES = 30;
const REPEAT_INTERVAL_MINUTES = 30;

function getAlertThresholdDate() {
  const date = new Date();
  date.setMinutes(
    date.getMinutes() - ALERT_THRESHOLD_MINUTES
  );
  return date;
}

function getNextAlertDate() {
  const date = new Date();
  date.setMinutes(
    date.getMinutes() + REPEAT_INTERVAL_MINUTES
  );
  return date;
}

// Generate or return currently active slow-order alerts.
router.get(
  "/",
  requireAuth,
  requireRole("MANAGER"),
  async (req, res) => {
    try {
      const thresholdDate = getAlertThresholdDate();
      const now = new Date();

      const slowOrders = await prisma.order.findMany({
        where: {
          archivedAt: null,
          status: {
            notIn: ["READY", "SERVED", "CANCELLED"],
          },
          placedAt: {
            lte: thresholdDate,
          },
        },
        include: {
          primaryWaiter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          placedAt: "asc",
        },
      });

      const alerts = [];

      for (const order of slowOrders) {
        const existingAlert = await prisma.orderAlert.findFirst({
          where: {
            orderId: order.id,
            OR: [
              {
                acknowledgedAt: null,
              },
              {
                nextAlertAt: {
                  lte: now,
                },
              },
            ],
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        if (existingAlert) {
          alerts.push({
            ...existingAlert,
            order,
          });
          continue;
        }

        const alert = await prisma.orderAlert.create({
          data: {
            orderId: order.id,
            nextAlertAt: getNextAlertDate(),
          },
        });

        alerts.push({
          ...alert,
          order,
        });
      }

      return res.json({
        alerts,
        thresholdMinutes: ALERT_THRESHOLD_MINUTES,
        repeatIntervalMinutes: REPEAT_INTERVAL_MINUTES,
      });
    } catch (error) {
      console.error("Get alerts error:", error);

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

// Acknowledge an alert.
router.patch(
  "/:alertId/acknowledge",
  requireAuth,
  requireRole("MANAGER"),
  async (req, res) => {
    try {
      const { alertId } = req.params;

      const alert = await prisma.orderAlert.findUnique({
        where: {
          id: alertId,
        },
      });

      if (!alert) {
        return res.status(404).json({
          error: "Alert not found",
        });
      }

      if (alert.acknowledgedAt) {
        return res.status(400).json({
          error: "Alert has already been acknowledged",
        });
      }

      const acknowledgedAlert = await prisma.orderAlert.update({
        where: {
          id: alertId,
        },
        data: {
          acknowledgedAt: new Date(),
          acknowledgedById: req.user.userId,
          nextAlertAt: null,
        },
      });

      return res.json({
        message: "Alert acknowledged successfully",
        alert: acknowledgedAlert,
      });
    } catch (error) {
      console.error("Acknowledge alert error:", error);

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

export default router;