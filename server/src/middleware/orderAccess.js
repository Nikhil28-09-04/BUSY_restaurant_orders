import { prisma } from "../lib/prisma.js";

export async function requireOrderAccess(req, res, next) {
  try {
    const orderId = req.params.orderId;

    if (!orderId) {
      return res.status(400).json({
        error: "Order ID is required",
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        primaryWaiterId: true,
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

    req.order = order;
    next();
  } catch (error) {
    console.error("Order access error:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}

export async function requireOrderLineAccess(req, res, next) {
  try {
    const { lineId } = req.params;

    const line = await prisma.orderLine.findUnique({
      where: { id: lineId },
      select: {
        order: {
          select: {
            id: true,
            primaryWaiterId: true,
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
        },
      },
    });

    if (!line || !line.order || line.order.archivedAt) {
      return res.status(404).json({
        error: "Order line not found",
      });
    }

    const isManager = req.user.role === "MANAGER";
    const isPrimaryWaiter =
      line.order.primaryWaiterId === req.user.userId;
    const isCollaborator =
      line.order.collaborators.length > 0;

    if (!isManager && !isPrimaryWaiter && !isCollaborator) {
      return res.status(403).json({
        error: "You do not have access to this order",
      });
    }

    req.order = line.order;
    next();
  } catch (error) {
    console.error("Order line access error:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}