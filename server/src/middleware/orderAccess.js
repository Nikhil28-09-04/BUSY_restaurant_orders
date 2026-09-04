import { prisma } from "../lib/prisma.js";

export async function requireOrderAccess(req, res, next) {
  try {
    const orderId = req.params.orderId;

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