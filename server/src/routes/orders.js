import express from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOrderAccess } from "../middleware/orderAccess.js";

const router = express.Router();

router.post("/", requireAuth, requireOrderAccess,async (req, res) => {
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

router.get("/:orderId", requireAuth, requireOrderAccess, async (req, res) => {
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

router.patch("/:orderId/status", requireAuth, requireOrderAccess, async (req, res) => {
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

router.get("/:orderId/events", requireAuth, requireOrderAccess, async (req, res) => {
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

router.post("/:orderId/collaborators", requireAuth, requireOrderAccess, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: "userId is required",
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.archivedAt) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    const waiter = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!waiter || waiter.archivedAt) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    if (waiter.role !== "WAITER") {
      return res.status(400).json({
        error: "Only waiters can be collaborators",
      });
    }

    if (order.primaryWaiterId === userId) {
      return res.status(400).json({
        error: "The primary waiter is already assigned to this order",
      });
    }

    const existingCollaborator =
      await prisma.orderCollaborator.findUnique({
        where: {
          orderId_userId: {
            orderId,
            userId,
          },
        },
      });

    if (existingCollaborator) {
      return res.status(400).json({
        error: "This waiter is already a collaborator",
      });
    }

    const collaborator = await prisma.$transaction(async (transaction) => {
      const createdCollaborator =
        await transaction.orderCollaborator.create({
          data: {
            orderId,
            userId,
            addedByUserId: req.user.userId,
          },
        });

      await transaction.orderEvent.create({
        data: {
          orderId,
          actorUserId: req.user.userId,
          eventType: "COLLABORATOR_ADDED",
          metadata: {
            collaboratorUserId: userId,
            collaboratorName: waiter.name,
          },
        },
      });

      return createdCollaborator;
    });

    return res.status(201).json({
      message: "Collaborator added successfully",
      collaborator,
    });
  } catch (error) {
    console.error("Add collaborator error:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.get("/:orderId/collaborators", requireAuth, requireOrderAccess, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        archivedAt: true,
        primaryWaiter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!order || order.archivedAt) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    return res.json({
      primaryWaiter: order.primaryWaiter,
      collaborators: order.collaborators.map((item) => item.user),
    });
  } catch (error) {
    console.error("Get collaborators error:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.delete(
  "/:orderId/collaborators/:userId",
  requireAuth,
  requireOrderAccess,
  async (req, res) => {
    try {
      const { orderId, userId } = req.params;

      const collaborator = await prisma.orderCollaborator.findUnique({
        where: {
          orderId_userId: {
            orderId,
            userId,
          },
        },
      });

      if (!collaborator) {
        return res.status(404).json({
          error: "Collaborator not found",
        });
      }

      await prisma.$transaction(async (transaction) => {
        await transaction.orderCollaborator.delete({
          where: {
            orderId_userId: {
              orderId,
              userId,
            },
          },
        });

        await transaction.orderEvent.create({
          data: {
            orderId,
            actorUserId: req.user.userId,
            eventType: "COLLABORATOR_REMOVED",
            metadata: {
              collaboratorUserId: userId,
            },
          },
        });
      });

      return res.json({
        message: "Collaborator removed successfully",
      });
    } catch (error) {
      console.error("Remove collaborator error:", error);
      return res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

export default router;