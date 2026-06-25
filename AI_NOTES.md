# AI Usage Notes

## 1. Tools Used

* ChatGPT
* Gemini
---

## 2. Prompt Journal

### Prompt 1

#### Prompt

```text
On the product detail page, users can manually input a quantity that exceeds available stock, leading to a poor UX where orders fail at checkout. How can I bind the input's max attribute to the product's stock value and implement validation logic in React to clamp the quantity state safely?
```

#### What the Model Produced

An updated `ProductDetailPage.tsx` component introducing an imperative clamping handler using:

```ts
Math.min(Math.max(1, value), product.stock)
```

alongside declarative `max` and `disabled` HTML attributes.

#### What I Kept

I kept the entirety of the input-clamping mathematics and the conditional HTML properties. The approach cleanly intercepts user typing or copy-pasting numbers that exceed valid boundaries before an invalid state can propagate to downstream API requests.

#### What I Rejected

I rejected the suggestion to add separate error text elements. Instead, I opted for a minimal user experience that silently clamps values to the nearest valid quantity.

---

### Prompt 2

#### Prompt

```text
Write an integration test for this updated React product detail page using React Testing Library and Vitest to confirm that the quantity input correctly enforces the upper stock limit, clamps invalid user entries, and disables actions entirely when stock is zero.
```

#### What the Model Produced

A comprehensive Vitest test suite (`ProductDetailPage.test.tsx`) using React Testing Library, mocked API responses, and DOM state assertions to validate quantity boundaries and button states.

#### What I Kept

I retained the overall testing methodology, including:

* Validation of native HTML attributes
* State boundary assertions
* Disabled button verification
* Mocked API-driven component rendering

#### What I Rejected

The generated mock product object did not satisfy the project's TypeScript requirements and caused compilation errors.

I updated the mock data to include all required fields, including:

```ts
id: number
updatedAt: Date
```

to ensure compatibility with the application's data model.

---

### Prompt 3

#### Prompt

```text
Write a Node.js concurrency test script to fire 5 simultaneous requests to the /payments/charge endpoint using the same Idempotency-Key. The script should verify that our backend locking mechanism prevents duplicate charges under load.
```

#### What the Model Produced

A standalone asynchronous testing script (`test-concurrency.js`) that used:

```js
Promise.all(...)
```

to execute concurrent requests against the payment endpoint and compare the resulting responses.

#### What I Kept

I retained the complete concurrency-testing implementation because it effectively validated the Redis-based locking and idempotency controls under simulated race conditions.

#### What I Rejected

I modified the logging behavior to truncate excessively long error payloads so that terminal output remained readable during failure scenarios.

---

## 3. AI Got It Wrong

### Problem

While attempting to solve Windows-related testing deadlocks, the AI generated the following Vitest configuration:

```ts
poolOptions: {
  threads: {
    singleThread: true,
  },
}
```

### Why It Was Incorrect

The generated configuration referenced properties that do not exist in the version of Vitest used by the project.

This resulted in the following TypeScript compilation error:

```text
Object literal may only specify known properties,
and 'poolOptions' does not exist in type 'InlineConfig'. ts(2769)
```

The AI effectively hallucinated a configuration schema belonging to a different version of the testing framework.

### How I Identified the Issue

The TypeScript compiler immediately flagged the structural typing violation during local development, preventing successful compilation.

### Resolution

I removed the invalid configuration entirely and instead addressed the issue through runtime arguments in `package.json`:

```json
{
  "scripts": {
    "test": "vitest --no-fork"
  }
}
```

This resolved the execution issue without introducing unsupported configuration parameters.

---

## 4. Validation Strategy

To ensure correctness and stability, I applied multiple validation layers.

### Automated Integration Testing

I used:

* Vitest
* React Testing Library

to execute state-boundary simulations and verify that invalid quantity values were safely constrained within acceptable limits.

### Targeted Concurrency Stress Testing

I executed a custom Node.js script that used:

```js
Promise.all(...)
```

to issue five concurrent requests against the payment endpoint using a shared idempotency key.

This verified that the Redis-backed locking and idempotency mechanisms correctly prevented duplicate payment processing.

### Static Type Audits

I continuously monitored the codebase using TypeScript compiler checks to ensure:

* Type-safe API contracts
* Valid mock objects
* Consistent state management
* Correct model mappings

---

## 5. What I Did Not Delegate

### Concurrency Verification and Stock Integrity

I did not rely exclusively on AI-generated frontend validation for stock management.

While client-side quantity clamping improves user experience, the backend remains the authoritative source of truth.

I manually ensured that stock availability is revalidated within the payment-processing workflow immediately before payment capture to prevent overselling and race-condition exploits.

### Unsanitized Data Interception

The application renders product descriptions using:

```tsx
dangerouslySetInnerHTML
```

Because this introduces potential XSS risks, I manually reviewed the implementation rather than relying solely on AI-generated code.

This review ensured that future integrations involving user-supplied HTML can be protected through proper sanitization mechanisms before rendering content to the browser.
