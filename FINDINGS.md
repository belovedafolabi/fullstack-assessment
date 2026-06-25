# Findings

## Backend

### Issue: Payment Idempotency Failure
- **What:** The payment endpoint processes multiple charges for the same order if the user clicks the "Pay Now" button repeatedly in rapid succession and this is also possible if there are network issues.
- **Where:** `backend/src/routes/paymentsRoutes.js`
- **Why:** The backend does not verify if a transaction has already been initiated or completed for the given order, nor does it enforce the use of an `Idempotency-Key` to ensure there are no duplicate charges. Network faliure is one cause of this and I've encountered this a lot of times personally so it's a major issue whenever payments are involved.
- **Impact:** Financial risk. Customers can be charged multiple times for the same order.
- **Fix:** I'm implementing a Redis-based cache to store `Idempotency-Key` values. Before processing a payment, the server would check if the key exists. If it does, it should return the status of the original request instead of re-processing the payment. I'm making the Idempotency-Key a mandatory header. No key, no payment.
- **Trade-offs:** Introduces a dependency on Redis availability during the payment flow.

### Issue: Not using Unique Identifiers (UUIDs)
- **What:** The system uses sequential database IDs instead of UUIDs.
- **Where:** `backend/src/db/schema.ts` and `backend/src/services/orderService.ts`
- **Why:** The database schema is configured for standard auto-incrementing integers, and the business logic does not require or validate unique request tokens.
- **Impact:** Security and data integrity risk. Sequential IDs are not the best and honestly easy to guess, making the system prone to attacks and collision issues during high-concurrency order creation.
- **Fix:** Migrate identifier columns to UUIDs and update the `POST /orders` and `POST /payments/charge` logic to require unique client-generated identifiers.
- **Trade-offs:** Requires a schema migration which could be disruptive for existing data if not handled with care. For this specific assessment it wouldn't be an issue though.

### Issue: Admin Product Update Server-Side Crash
- **What:** The `PATCH` endpoint for products returns a 500 Internal Server Error when updated.
- **Where:** `backend/src/routes/adminRoutes.js` and `frontend/src/api.ts`
- **Why:** The backend code attempts to destructure `price` and other properties from `req.body` without verifying if the request body exists or is correctly formatted, I consider this a major flaw as it's not possible it was overlooked during development.
- **Impact:** The Admin cannot update product details making the admin dashboard unusable for inventory management which is the core feature of this app.
- **Fix:** Add a validation layer (Zod since it's maintained properly) to ensure `req.body` is correctly structured and present before processing the request. Return a `400 Bad Request` if validation fails and also use an alert to let the Admin know the exact reason of the failure thereby increasing UX.
- **Trade-offs:** This might slightly increase backend latency due to validation overhead but on this scale it can be overlooked.

## Frontend

### Issue: Product Quantity Entered Not Tied To Available Stock
- **What:** Users can input a quantity for a product that exceeds the available stock.
- **Where:** `frontend/src/pages/ProductDetailPage.tsx`
- **Why:** The UI input element lacks a `max` attribute linked to the product's current stock, and there is no frontend validation logic to cap the quantity to the value of the stock.
- **Impact:** Poor UX cause the users are allowed to add items to the cart that cannot be fulfilled.
- **Fix:** Bind the input's `max` attribute to the product's `stock` value and implement a validation check to display a warning if the user attempts to enter an invalid number.
- **Trade-offs:** Requires the frontend to stay in constant sync with the latest stock data, which may lag if not using WebSockets. But for this scale I'd use gotten stock value to bind the quantity cap.

### Issue: Search Filter Stale State
- **What:** Clearing the search bar does not reset the product display to the full list.
- **Where:** `frontend/src/pages/ProductsPage.tsx`
- **Why:** The component only triggers a fetch/filter on input; it fails to reset the state when the search input value becomes empty.
- **Impact:** Poor UX and this would make the Users feel stuck in a filtered view and cannot easily return to the full product catalog. They would be forced to reload the page to see the full Products listing.
- **Fix:** Add an `onChange` listener to detect when the search string is empty and trigger a re-fetch or reset of the product list state.
- **Trade-offs:** Potentially increases the number of API calls if I make the reset trigger a new fetch rather than a local state filter.

### Issue: No Auto-Refresh for Payment Status on Admin Dashboard
- **What:** The admin dashboard does not automatically refresh the payment status of orders and this would definitely cause issues for the Admin in proper processing of orders.
- **Where:** `frontend/src/pages/AdminPage.tsx`
- **Why:** The page performs a static fetch on mount but lacks a polling mechanism or a WebSocket listener to observe status changes.
- **Impact:** UX degradation which should not be allowed for these types of web apps cause the Admins must manually refresh the entire browser page to see if an order has been paid.
- **Fix:** Implement a `setInterval` hook to poll the `/orders` endpoint for updates just as how it was done for the `Order Details Page`.
- **Trade-offs:** Increased load on the backend server due to continuous polling.


### Issue: "Buy Now" Button Visibility
- **What:** The "Buy Now" button on the product page is rendered but effectively invisible because of the text color.
- **Where:** `frontend/src/components/ProductDetailPage.tsx`
- **Why:** Likely a CSS styling conflict.
- **Impact:** UX failure as the users are unable to complete purchases because they cannot find or click the primary call-to-action button for the activity they want to carry out.
- **Fix:** Inspect the component's styles and correct the CSS/Tailwind classes to ensure the button is properly visible and accessible.
- **Trade-offs:** None.


## Cross-cutting

### Issue: Stock Validation Failure Before Payment
- **What:** The system processes payments for orders even if the product inventory has depleted since the order was originally created. This potentially lead to negative stock values in the database.
- **Where:** Frontend ()`frontend/src/pages/OrderDetailPage.tsx`) and Backend (`backend/src/services/ordersService.js`).
- **Why:** The order page does not re-verify the real-time stock levels of the ordered items before allowing the user to initiate the payment. If another concurrent user buys the last available item while the current user is still viewing the order page, the system blindly proceeds with the charge. In production reservation of items for a set duration of time could be implemented but for this assessment I'm going with the current case.
- **Impact:** Operational failure and poor user experience (overselling). Customers will successfully pay for items that no longer exist, forcing manual refunds and inventory corrections.
- **Fix:** Implement a pre-payment validation check on the order page to fetch the current product stock. If the stock is insufficient, disable the "Pay Now" button and display an "Out of Stock" alert to the user. Back this up with a strict stock re-verification in the backend `chargeOrder` service immediately before hitting the payment gateway to prevent API bypasses.
- **Trade-offs:** Introduces an additional API call to fetch real-time product data before executing the checkout, which slightly increases latency upon clicking the payment button.