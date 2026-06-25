const ordersRepository = require("../repositories/ordersRepository");
const productsRepository = require("../repositories/productsRepository");
const paymentsRepository = require("../repositories/paymentsRepository");
const paymentGateway = require("./paymentGateway");
const redis = require("../db/redis");
const db = require("../db/postgres");

async function withTransaction(callback) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function createOrder({ customerId, items, totalAmount }) {
  if (!customerId || !Array.isArray(items) || items.length === 0) {
    const error = new Error("customerId and items are required");
    error.status = 400;
    throw error;
  }

  const enrichedItems = [];
  for (const item of items) {
    const product = await productsRepository.getProductById(item.productId);
    if (!product) {
      const error = new Error(`Product ${item.productId} not found`);
      error.status = 404;
      throw error;
    }
    if (product.stock < item.quantity) {
      const error = new Error(`Insufficient stock for ${product.name}`);
      error.status = 409;
      throw error;
    }
    enrichedItems.push({
      productId: product.id,
      quantity: item.quantity,
      unitPrice: Number(product.price),
    });
  }

  for (const item of enrichedItems) {
    await productsRepository.decrementStock(
      item.productId,
      item.quantity,
      db,
    );
  }

  const order = await ordersRepository.createOrder({
    customerId,
    totalAmount: Number(totalAmount),
    items: enrichedItems,
  });

  return order;
}

/* async function chargeOrder({ orderId, idempotencyKey }) {
  if (idempotencyKey) {
    const cached = await redis.get(`idem:${idempotencyKey}`);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  const order = await ordersRepository.getOrderById(orderId);
  if (!order) {
    const error = new Error("Order not found");
    error.status = 404;
    throw error;
  }

  if (order.status !== "PENDING") {
    const error = new Error("Only pending orders can be charged");
    error.status = 409;
    throw error;
  }

  const gatewayResponse = await paymentGateway.charge({
    orderId: order.id,
    amount: order.totalAmount,
  });

  const payment = await paymentsRepository.createPayment({
    orderId: order.id,
    amount: gatewayResponse.chargedAmount,
    providerTxnId: gatewayResponse.providerTxnId,
    status: "SUCCESS",
    idempotencyKey,
  });

  const updatedOrder = await ordersRepository.markOrderAsPaid(order.id);

  if (idempotencyKey) {
    await redis.set(
      `idem:${idempotencyKey}`,
      JSON.stringify({ order: updatedOrder, payment }),
      "EX",
      3600,
    );
  }

  return { order: updatedOrder, payment };
} */

async function chargeOrder({ orderId, idempotencyKey }) {
  const redisKey = `idem:${idempotencyKey}`;

  // check existing state (did they already pay, or is it currently processing?)
  const cached = await redis.get(redisKey);
  if (cached) {
    if (cached === 'PROCESSING') {
      const error = new Error("Payment is currently processing. Please wait.");
      error.status = 409;
      throw error;
    }
    // If it's not 'PROCESSING', it's a cached successful response. Return it safely.
    return JSON.parse(cached);
  }

  // acquire an atomic lock (SET if Not eXists, expires in 60 seconds which is enough time for a payment to process in ideal conditions unless Glo :( )
  const lockAcquired = await redis.set(redisKey, 'PROCESSING', 'NX', 'EX', 60);
  if (!lockAcquired) {
    const error = new Error("Payment is currently processing. Please wait.");
    error.status = 409;
    throw error;
  }

  try {
    const order = await ordersRepository.getOrderById(orderId);
    if (!order) {
      const error = new Error("Order not found");
      error.status = 404;
      throw error;
    }

    if (order.status !== "PENDING") {
      const error = new Error("Only pending orders can be charged");
      error.status = 409;
      throw error;
    }

    // Strict backend stock re-verification
    const orderDetails = await ordersRepository.getOrderWithDetails(order.id);
    for (const item of orderDetails.items) {
      const product = await productsRepository.getProductById(item.productId);
      if (!product || product.stock < item.quantity) {
        const error = new Error(`Payment declined: Insufficient stock for ${item.name || 'a product'}.`);
        error.status = 409;
        throw error;
      }
    }

    const gatewayResponse = await paymentGateway.charge({
      orderId: order.id,
      amount: order.totalAmount,
    });

    const payment = await paymentsRepository.createPayment({
      orderId: order.id,
      amount: gatewayResponse.chargedAmount,
      providerTxnId: gatewayResponse.providerTxnId,
      status: "SUCCESS",
      idempotencyKey,
    });

    const updatedOrder = await ordersRepository.markOrderAsPaid(order.id);

    const responsePayload = { order: updatedOrder, payment };

    // cache the successful result and overwrite the lock (Expire in 24 hours)
    await redis.set(
      redisKey,
      JSON.stringify(responsePayload),
      "EX",
      86400 
    );

    return responsePayload;
  } catch (error) {
    // critical: release the lock if payment failed so the user can retry
    await redis.del(redisKey);
    throw error;
  }
}

async function processPaymentWebhook({
  providerEventId,
  orderId,
  eventType,
  payload,
}) {
  await paymentsRepository.createWebhookEvent({
    providerEventId,
    orderId,
    eventType,
    payload,
  });

  if (eventType === "payment_succeeded") {
    await ordersRepository.markOrderAsPaid(orderId);
  }

  return { accepted: true };
}

async function getOrderById(orderId) {
  const order = await ordersRepository.getOrderWithDetails(orderId);
  if (!order) {
    const error = new Error("Order not found");
    error.status = 404;
    throw error;
  }
  return order;
}

async function listOrders(params) {
  return ordersRepository.listOrders(params);
}

module.exports = {
  createOrder,
  chargeOrder,
  processPaymentWebhook,
  getOrderById,
  listOrders,
};
