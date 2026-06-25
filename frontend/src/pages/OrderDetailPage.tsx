import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { chargeOrder, getOrder } from "../api";
import type { Order } from "../types";

export default function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [paying, setPaying] = useState(false);
  // NEW: State to hold the validation error message
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // unique key for this component's lifecycle
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  useEffect(() => {
    if (!id) return;
    getOrder(id).then(setOrder);

    setInterval(() => {
      getOrder(id).then(setOrder);
    }, 2000);
  }, [id]);

  if (!order) return <p>Loading order...</p>;

  /* async function pay() {
    setPaying(true);
    try {
      // pass the stable key to the API call
      const result = await chargeOrder(order!.id, idempotencyKeyRef.current);
      setOrder(result.order);
    } catch (error) {
      console.error("Payment request failed or was rejected as a duplicate:", error);
    } finally {
      // 3. Ensure the button unlocks even if the backend rejects the duplicate click
      setPaying(false);
    }
  } */

  async function pay() {
    if (!order) return;
    setPaying(true);
    setErrorMessage(null); // clear previous errors

    try {
      // rely on the backend's strict validation.
      const result = await chargeOrder(order!.id, idempotencyKeyRef.current);
      setOrder(result.order);

    } catch (error: any) {
      // the backend will return a 409 error if stock is insufficient.
      console.error("Payment failed:", error);
      
      // check if it's an "Insufficient stock" error (or a generic one)
      const message = error.message || "Payment failed. Please try again.";
      setErrorMessage(message);
      
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="page">
      <h1>Order #{order.id}</h1>
      {/* NEW: Notification area */}
      {errorMessage && 
        <div className="error-notification" style={{ color: 'red', marginBottom: '10px' }}>
          <strong>Alert:</strong> {errorMessage}
        </div>
      }
      <p>
        Status: <span className={`status ${order.status}`}>{order.status}</span>
      </p>
      <p>Total: ${order.totalAmount}</p>

      <h2>Items</h2>
      <ul>
        {(order.items || []).map((item, idx) => (
          <li key={idx}>
            {item.name} x {item.quantity} @ ${item.unitPrice}
          </li>
        ))}
      </ul>

      <h2>Payments</h2>
      {(order.payments || []).length === 0 && <p>No payments yet.</p>}
      <ul>
        {(order.payments || []).map((p, idx) => (
          <li key={idx}>
            {p.status} - ${p.amount} ({p.providerTxnId})
          </li>
        ))}
      </ul>

      {order.status === "PENDING" && (
        <button className="primary" onClick={pay}>
          {paying ? "Charging..." : "Pay now"}
        </button>
      )}
    </div>
  );
}
