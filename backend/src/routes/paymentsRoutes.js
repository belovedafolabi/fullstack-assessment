const express = require("express");
const ordersService = require("../services/ordersService");

const router = express.Router();

router.post("/charge", async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const idempotencyKey = req.header("Idempotency-Key");

    // fail fast if the client does not provide an idempotency key
    if (!idempotencyKey){
      return res.status(400).json({ error: "Idempotency-Key header is required" });
    }
    
    const result = await ordersService.chargeOrder({ orderId, idempotencyKey });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/webhook", async (req, res, next) => {
  try {
    const { providerEventId, orderId, eventType, payload } = req.body;
    const result = await ordersService.processPaymentWebhook({
      providerEventId,
      orderId,
      eventType,
      payload,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
