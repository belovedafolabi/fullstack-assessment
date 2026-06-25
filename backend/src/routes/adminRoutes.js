const express = require("express");
const { z } = require("zod");
const productsRepository = require("../repositories/productsRepository");

const router = express.Router();

// zod validation schema for product updates
const updateProductSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").optional(),
  description: z.string().optional(),
  price: z.coerce.number().positive("Price must be greater than 0").optional(),
  stock: z.coerce.number().int().nonnegative("Stock cannot be negative").optional(),
}).strict();

router.post("/products", async (req, res, next) => {
  try {
    const { sku, name, description, price, stock } = req.body;
    if (!sku || !name || price == null || stock == null) {
      return res
        .status(400)
        .json({ error: "sku, name, price, stock are required" });
    }
    const product = await productsRepository.createProduct({
      sku,
      name,
      description,
      price,
      stock,
    });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

// zod validated PATCH route for updating a product
router.patch("/products/:id", async (req, res, next) => {
  try {
    // safely parse the body. if req.body is undefined, safeParse will gracefully fail instead of crashing.
    const validation = updateProductSchema.safeParse(req.body || {});

    if (!validation.success) {
      // return a 400 instead of a 500, listing the exact validation issues
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
    }

    // extracted clean, validated data
    const { price, stock, description, name } = validation.data;

    // check if the admin actually sent anything to update
    if (Object.keys(validation.data).length === 0) {
      return res.status(400).json({ error: "No update parameters provided" });
    }

    const product = await productsRepository.updateProduct(req.params.id, {
      price,
      stock,
      description,
      name,
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
