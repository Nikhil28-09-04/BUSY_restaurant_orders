import express from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { tableNumber } = req.body;

    if (!tableNumber || !String(tableNumber).trim()) {
      return res.status(400).json({
        error: "Table number is required",
      });
    }

    const order = await prisma.$transaction(async (transaction) => {
      const createdOrder = await transaction.order.create({
        data: {
          tableNumber: String(tableNumber).trim(),
          primaryWaiterId: req.user.userId,
        },
      });

      await transaction.orderEvent.create({
        data: {
          orderId: createdOrder.id,
          actorUserId: req.user.userId,
          eventType: "ORDER_CREATED",
          newStatus: createdOrder.status,
        },
      });

      return createdOrder;
    });

    return res.status(201).json({
      order,
    });
  } catch (error) {
    console.error("Create order error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.get("/:orderId", requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
      include: {
        primaryWaiter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lines: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!order || order.archivedAt) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    const total = order.lines.reduce((sum, line) => {
      if (line.voidedAt) {
        return sum;
      }

      return sum + Number(line.unitPrice) * line.quantity;
    }, 0);

    return res.json({
      order,
      total: total.toFixed(2),
    });
  } catch (error) {
    console.error("Get order error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.patch("/:orderId/status", requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "PLACED",
      "ACCEPTED",
      "PREPARING",
      "READY",
      "SERVED",
      "CANCELLED",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid status",
      });
    }

    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
    });

    if (!order || order.archivedAt) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    const validTransitions = {
      PLACED: ["ACCEPTED", "CANCELLED"],
      ACCEPTED: ["PREPARING", "CANCELLED"],
      PREPARING: ["READY"],
      READY: ["SERVED"],
      SERVED: [],
      CANCELLED: [],
    };

    const possibleNextStatuses = validTransitions[order.status];

    if (!possibleNextStatuses.includes(status)) {
      return res.status(400).json({
        error: `Cannot change order status from ${order.status} to ${status}`,
        allowedNextStatuses: possibleNextStatuses,
      });
    }

    const updatedOrder = await prisma.$transaction(async (transaction) => {
      const changedOrder = await transaction.order.update({
        where: {
          id: orderId,
        },
        data: {
          status,
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
      });

      await transaction.orderEvent.create({
        data: {
          orderId,
          actorUserId: req.user.userId,
          eventType: "STATUS_CHANGED",
          oldStatus: order.status,
          newStatus: status,
        },
      });

      return changedOrder;
    });

    return res.json({
      order: updatedOrder,
      message: `Order status changed from ${order.status} to ${status}`,
    });
  } catch (error) {
    console.error("Update order status error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.get("/:orderId/events", requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        id: true,
        archivedAt: true,
      },
    });

    if (!order || order.archivedAt) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    const events = await prisma.orderEvent.findMany({
      where: {
        orderId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return res.json({
      events,
    });
  } catch (error) {
    console.error("Get order events error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

export default router;