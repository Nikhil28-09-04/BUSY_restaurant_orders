import express from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOrderAccess } from "../middleware/orderAccess.js";
import { requireRole } from "../middleware/role.js";

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { tableNumber, primaryWaiterId  } = req.body;

    if (!tableNumber || !String(tableNumber).trim()) {
      return res.status(400).json({
        error: "Table number is required",
      });
    }

    if (req.user.role === "MANAGER") {
      if (!primaryWaiterId) {
        return res.status(400).json({
          error: "Primary waiter is required",
        });
      }

      const waiter = await prisma.user.findFirst({
        where: {
          id: primaryWaiterId,
          role: "WAITER",
        },
      });

      if (!waiter) {
        return res.status(400).json({
          error: "Selected primary waiter is invalid",
        });
      }
    }

    const order = await prisma.$transaction(async (transaction) => {
      const createdOrder = await transaction.order.create({
        data: {
          tableNumber: String(tableNumber).trim(),
          primaryWaiterId:
            req.user.role === "MANAGER"
            ? primaryWaiterId
            : req.user.userId,
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

router.get("/", requireAuth, async (req, res) => {
  try {
    const {
      search,
      status,
      waiterId,
      date,
      sortBy = "placedAt",
      sortOrder = "desc",
      page = "1",
      limit = "10",
    } = req.query;

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.min(Math.max(Number(limit), 1), 100);

    const where = {
      archivedAt: null,
    };

    // Waiters can see only their own orders or collaboration orders.
    if (req.user.role !== "MANAGER") {
      where.OR = [
        {
          primaryWaiterId: req.user.userId,
        },
        {
          collaborators: {
            some: {
              userId: req.user.userId,
            },
          },
        },
      ];
    }

    // Search by table number.
    if (search) {
      where.tableNumber = {
        contains: String(search),
        mode: "insensitive",
      };
    }

    // Filter by order status.
    if (status) {
      where.status = String(status).toUpperCase();
    }

    // Filter by primary waiter.
    if (waiterId) {
      where.primaryWaiterId = String(waiterId);
    }

    // Filter by placed date.
    if (date) {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);

      where.placedAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const allowedSortFields = [
      "placedAt",
      "status",
      "tableNumber",
    ];

    const safeSortBy = allowedSortFields.includes(String(sortBy))
      ? String(sortBy)
      : "placedAt";

    const safeSortOrder =
      String(sortOrder).toLowerCase() === "asc"
        ? "asc"
        : "desc";

    const skip = (pageNumber - 1) * limitNumber;

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: {
          primaryWaiter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          lines: {
            where: {
              voidedAt: null,
            },
            include: {
              menuItem: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          [safeSortBy]: safeSortOrder,
        },
        skip,
        take: limitNumber,
      }),

      prisma.order.count({ where }),
    ]);

    const formattedOrders = orders.map((order) => {
      const total = order.lines.reduce((sum, line) => {
        return sum + Number(line.unitPrice) * line.quantity;
      }, 0);

      return {
        ...order,
        total: total.toFixed(2),
      };
    });

    return res.json({
      orders: formattedOrders,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("List orders error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.get(
  "/archived",
  requireAuth,
  requireRole("MANAGER"),
  async (req, res) => {
    try {
      const orders = await prisma.order.findMany({
        where: {
          archivedAt: {
            not: null,
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
          lines: {
            include: {
              menuItem: true,
            },
          },
        },
        orderBy: {
          archivedAt: "desc",
        },
      });

      const ordersWithTotals = orders.map((order) => {
        const total = order.lines.reduce((sum, line) => {
          if (line.voidedAt) {
            return sum;
          }

          return sum + Number(line.unitPrice) * line.quantity;
        }, 0);

        return {
          ...order,
          total: total.toFixed(2),
        };
      });

      return res.json(ordersWithTotals);
    } catch (error) {
      console.error("Get archived orders error:", error);

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  },
);

router.get(
  "/export/csv",
  requireAuth,
  requireRole("MANAGER"),
  async (req, res) => {
    try {
      const { date } = req.query;

      if (!date) {
        return res.status(400).json({
          error: "date query parameter is required in YYYY-MM-DD format",
        });
      }

      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);

      if (
        Number.isNaN(startOfDay.getTime()) ||
        Number.isNaN(endOfDay.getTime())
      ) {
        return res.status(400).json({
          error: "Invalid date format",
        });
      }

      const orders = await prisma.order.findMany({
        where: {
          placedAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        include: {
          primaryWaiter: {
            select: {
              name: true,
              email: true,
            },
          },
          lines: {
            where: {
              voidedAt: null,
            },
          },
        },
        orderBy: {
          placedAt: "asc",
        },
      });

      const escapeCsv = (value) => {
        const text = String(value ?? "");

        if (
          text.includes(",") ||
          text.includes('"') ||
          text.includes("\n")
        ) {
          return `"${text.replaceAll('"', '""')}"`;
        }

        return text;
      };

      const rows = [
        [
          "Order ID",
          "Table Number",
          "Primary Waiter",
          "Waiter Email",
          "Status",
          "Placed At",
          "Total",
        ],
      ];

      for (const order of orders) {
        const total = order.lines.reduce((sum, line) => {
          return sum + Number(line.unitPrice) * line.quantity;
        }, 0);

        rows.push([
          order.id,
          order.tableNumber,
          order.primaryWaiter.name,
          order.primaryWaiter.email,
          order.status,
          order.placedAt.toISOString(),
          total.toFixed(2),
        ]);
      }

      const csv = rows
        .map((row) => row.map(escapeCsv).join(","))
        .join("\r\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="orders-${date}.csv"`
      );

      return res.send(csv);
    } catch (error) {
      console.error("Export orders CSV error:", error);

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

router.get(
  "/dashboard/summary",
  requireAuth,
  requireRole("MANAGER"),
  async (req, res) => {
    try {
      const now = new Date();

      const startOfToday = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate()
        )
      );

      const startOfTomorrow = new Date(startOfToday);
      startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);

      const startOf14DaysAgo = new Date(startOfToday);
      startOf14DaysAgo.setUTCDate(startOf14DaysAgo.getUTCDate() - 13);

      const [
        openOrders,
        placedToday,
        servedToday,
        servedTodayOrders,
        ordersByStatus,
        ordersByWaiter,
        servedLast14Days,
      ] = await prisma.$transaction([
        prisma.order.count({
          where: {
            archivedAt: null,
            status: {
              notIn: ["SERVED", "CANCELLED"],
            },
          },
        }),

        prisma.order.count({
          where: {
            archivedAt: null,
            placedAt: {
              gte: startOfToday,
              lt: startOfTomorrow,
            },
          },
        }),

        prisma.order.count({
          where: {
            archivedAt: null,
            status: "SERVED",
            updatedAt: {
              gte: startOfToday,
              lt: startOfTomorrow,
            },
          },
        }),

        prisma.order.findMany({
          where: {
            archivedAt: null,
            status: "SERVED",
            updatedAt: {
              gte: startOfToday,
              lt: startOfTomorrow,
            },
          },
          include: {
            lines: {
              where: {
                voidedAt: null,
              },
            },
          },
        }),

        prisma.order.groupBy({
          by: ["status"],
          where: {
            archivedAt: null,
          },
          _count: {
            id: true,
          },
        }),

        prisma.order.groupBy({
          by: ["primaryWaiterId"],
          where: {
            archivedAt: null,
          },
          _count: {
            id: true,
          },
        }),

        prisma.order.findMany({
          where: {
            archivedAt: null,
            status: "SERVED",
            updatedAt: {
              gte: startOf14DaysAgo,
              lt: startOfTomorrow,
            },
          },
          select: {
            updatedAt: true,
          },
          orderBy: {
            updatedAt: "asc",
          },
        }),
      ]);

      const revenueToday = servedTodayOrders.reduce((sum, order) => {
        const orderTotal = order.lines.reduce((lineSum, line) => {
          return lineSum + Number(line.unitPrice) * line.quantity;
        }, 0);

        return sum + orderTotal;
      }, 0);

      const waiterIds = ordersByWaiter.map(
        (item) => item.primaryWaiterId
      );

      const waiters = await prisma.user.findMany({
        where: {
          id: {
            in: waiterIds,
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      const waiterMap = new Map(
        waiters.map((waiter) => [waiter.id, waiter])
      );

      const byWaiter = ordersByWaiter.map((item) => ({
        waiter: waiterMap.get(item.primaryWaiterId) || {
          id: item.primaryWaiterId,
          name: "Unknown",
          email: "",
        },
        count: item._count.id,
      }));

      const byStatus = ordersByStatus.map((item) => ({
        status: item.status,
        count: item._count.id,
      }));

      const servedChart = [];

      for (let i = 0; i < 14; i++) {
        const day = new Date(startOf14DaysAgo);
        day.setUTCDate(day.getUTCDate() + i);

        const nextDay = new Date(day);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);

        const count = servedLast14Days.filter((order) => {
          return (
            order.updatedAt >= day &&
            order.updatedAt < nextDay
          );
        }).length;

        servedChart.push({
          date: day.toISOString().slice(0, 10),
          served: count,
        });
      }

      return res.json({
        summary: {
          openOrders,
          placedToday,
          servedToday,
          revenueToday: revenueToday.toFixed(2),
        },
        byStatus,
        byWaiter,
        servedLast14Days: servedChart,
      });
    } catch (error) {
      console.error("Dashboard summary error:", error);

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);


router.post("/:orderId/notes", requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({
        error: "Note is required",
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
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
    const isPrimaryWaiter = order.primaryWaiterId === req.user.userId;
    const isCollaborator = order.collaborators.length > 0;

    if (!isManager && !isPrimaryWaiter && !isCollaborator) {
      return res.status(403).json({
        error: "You do not have access to this order",
      });
    }

    if (order.status === "SERVED" || order.status === "CANCELLED") {
      return res.status(400).json({
        error: "Cannot add notes to a completed or cancelled order",
      });
    }

    const event = await prisma.orderEvent.create({
      data: {
        orderId,
        actorUserId: req.user.userId,
        eventType: "NOTE_ADDED",
        note: note.trim(),
      },
    });

    return res.status(201).json({
      message: "Note added successfully",
      event,
    });
  } catch (error) {
    console.error("Add order note error:", error);

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

router.patch(
  "/:orderId/archive",
  requireAuth,
  requireRole("MANAGER"),
  async (req, res) => {
    try {
      const { orderId } = req.params;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order || order.archivedAt) {
        return res.status(404).json({
          error: "Order not found",
        });
      }

      const archivedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          archivedAt: new Date(),
        },
      });

      return res.json({
        message: "Order archived successfully",
        order: archivedOrder,
      });
    } catch (error) {
      console.error("Archive order error:", error);

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

router.patch(
  "/:orderId/restore",
  requireAuth,
  requireRole("MANAGER"),
  async (req, res) => {
    try {
      const { orderId } = req.params;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order || !order.archivedAt) {
        return res.status(404).json({
          error: "Archived order not found",
        });
      }

      const restoredOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          archivedAt: null,
        },
      });

      return res.json({
        message: "Order restored successfully",
        order: restoredOrder,
      });
    } catch (error) {
      console.error("Restore order error:", error);

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

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