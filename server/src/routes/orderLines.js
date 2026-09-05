import express from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOrderLineAccess } from "../middleware/orderAccess.js";

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { orderId, menuItemId, quantity, instructions } = req.body;

    if (!orderId || !menuItemId || quantity === undefined) {
      return res.status(400).json({
        error: "orderId, menuItemId, and quantity are required",
      });
    }

    const numericQuantity = Number(quantity);

    if (
      !Number.isInteger(numericQuantity) ||
      numericQuantity <= 0
    ) {
      return res.status(400).json({
        error: "Quantity must be a positive integer",
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        primaryWaiterId: true,
        status: true,
        archivedAt: true,
        collaborators: {
          where: {
            userId: req.user.userId,
          },
          select: {
            userId: true,
          },
        },
      },
    });

    if (!order || order.archivedAt) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    const isManager = req.user.role === "MANAGER";
    const isPrimaryWaiter =
      order.primaryWaiterId === req.user.userId;
    const isCollaborator =
      order.collaborators.length > 0;

    if (!isManager && !isPrimaryWaiter && !isCollaborator) {
      return res.status(403).json({
        error: "You do not have access to this order",
      });
    }

    if (["SERVED", "CANCELLED"].includes(order.status)) {
      return res.status(400).json({
        error: "Cannot add lines to a served or cancelled order",
      });
    }

    const menuItem = await prisma.menuItem.findUnique({
      where: {
        id: menuItemId,
      },
    });

    if (!menuItem || menuItem.archivedAt) {
      return res.status(404).json({
        error: "Menu item not found",
      });
    }

    if (!menuItem.available) {
      return res.status(400).json({
        error: "Menu item is currently unavailable",
      });
    }

    const orderLine = await prisma.$transaction(async (transaction) => {
      const createdLine = await transaction.orderLine.create({
        data: {
          orderId,
          menuItemId,
          quantity: numericQuantity,
          unitPrice: menuItem.price,
          instructions: instructions?.trim() || null,
        },
      });

      await transaction.orderEvent.create({
        data: {
          orderId,
          actorUserId: req.user.userId,
          eventType: "LINE_ADDED",
          orderLineId: createdLine.id,
          metadata: {
            menuItemName: menuItem.name,
            quantity: numericQuantity,
            unitPrice: menuItem.price.toString(),
          },
        },
      });

      return createdLine;
    });

    const lines = await prisma.orderLine.findMany({
      where: {
        orderId,
        voidedAt: null,
      },
    });

    const total = lines.reduce((sum, line) => {
      return sum + Number(line.unitPrice) * line.quantity;
    }, 0);

    return res.status(201).json({
      orderLine,
      total: total.toFixed(2),
    });
  } catch (error) {
    console.error("Add order line error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.patch("/:lineId/void", requireAuth, requireOrderLineAccess, async (req, res) => {
  try {
    const { lineId } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        error: "A reason is required to void an order line",
      });
    }

    const line = await prisma.orderLine.findUnique({
      where: { id: lineId },
      include: {
        order: true,
      },
    });

    if (!line) {
      return res.status(404).json({
        error: "Order line not found",
      });
    }

    if (line.voidedAt) {
      return res.status(400).json({
        error: "Order line is already voided",
      });
    }

    if (["SERVED", "CANCELLED"].includes(line.order.status)) {
      return res.status(400).json({
        error: "Cannot void lines on a served or cancelled order",
      });
    }

    const trimmedReason = reason.trim();

    const voidedLine = await prisma.$transaction(async (transaction) => {
      const updatedLine = await transaction.orderLine.update({
        where: { id: lineId },
        data: {
          voidedAt: new Date(),
          voidReason: trimmedReason,
        },
      });

      await transaction.orderEvent.create({
        data: {
          orderId: line.orderId,
          actorUserId: req.user.userId,
          eventType: "LINE_VOIDED",
          orderLineId: lineId,
          reason: trimmedReason,
        },
      });

      return updatedLine;
    });

    return res.json({
      message: "Order line voided successfully",
      orderLine: voidedLine,
    });
  } catch (error) {
    console.error("Void order line error:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

export default router;