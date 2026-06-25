// test-concurrency.js
// when the server is running run `node test-concurrency.js` in terminal
const orderId = 26;
const idempotencyKey = "concurrent-test-" + Date.now();

const requestOptions = {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
  },
  body: JSON.stringify({ orderId }),
};

console.log(`Firing 5 concurrent requests with key: ${idempotencyKey}...`);

Promise.all(
  Array.from({ length: 5 }).map(() =>
    fetch("http://localhost:3000/payments/charge", requestOptions).then(async (r) => ({
      status: r.status,
      body: await r.text(),
    }))
  )
).then((results) => {
  console.log("\n--- TEST RESULTS ---");
  results.forEach((res, index) => {
    console.log(`Request ${index + 1}: [Status ${res.status}] ${res.body.substring(0, 60)}...`);
  });
});