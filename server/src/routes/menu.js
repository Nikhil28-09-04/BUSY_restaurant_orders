import express from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const menuItems = await prisma.menuItem.findMany({
      where: {
        archivedAt: null,
      },
      orderBy: {
        name: "asc",
      },
    });

    return res.json({
      menuItems,
    });
  } catch (error) {
    console.error("Get menu error:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.post("/", requireAuth, requireRole("MANAGER"), async (req, res) => {
  try {
    const { name, price, available = true } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({
        error: "Name and price are required",
      });
    }

    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({
        error: "Price must be a positive number",
      });
    }

    const menuItem = await prisma.menuItem.create({
      data: {
        name: name.trim(),
        price: numericPrice,
        available: Boolean(available),
      },
    });

    return res.status(201).json({
      menuItem,
    });
  } catch (error) {
    console.error("Create menu item error:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.patch("/:id", requireAuth, requireRole("MANAGER"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, available } = req.body;

    const existingItem = await prisma.menuItem.findUnique({
      where: { id },
    });

    if (!existingItem || existingItem.archivedAt) {
      return res.status(404).json({
        error: "Menu item not found",
      });
    }

    const data = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          error: "Name cannot be empty",
        });
      }

      data.name = name.trim();
    }

    if (price !== undefined) {
      const numericPrice = Number(price);

      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        return res.status(400).json({
          error: "Price must be a positive number",
        });
      }

      data.price = numericPrice;
    }

    if (available !== undefined) {
      if (typeof available !== "boolean") {
        return res.status(400).json({
          error: "Available must be a boolean",
        });
      }

      data.available = available;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        error: "No valid fields provided for update",
      });
    }

    const menuItem = await prisma.menuItem.update({
      where: { id },
      data,
    });

    return res.json({
      menuItem,
    });
  } catch (error) {
    console.error("Update menu item error:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.delete("/:id", requireAuth, requireRole("MANAGER"), async (req, res) => {
  try {
    const { id } = req.params;

    const existingItem = await prisma.menuItem.findUnique({
      where: { id },
    });

    if (!existingItem || existingItem.archivedAt) {
      return res.status(404).json({
        error: "Menu item not found",
      });
    }

    const menuItem = await prisma.menuItem.update({
      where: { id },
      data: {
        archivedAt: new Date(),
      },
    });

    return res.json({
      message: "Menu item archived successfully",
      menuItem,
    });
  } catch (error) {
    console.error("Archive menu item error:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

export default router;