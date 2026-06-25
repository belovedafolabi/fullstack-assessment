import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { chargeOrder, getOrder } from "../api";
import type { Order } from "../types";

export default function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [paying, setPaying] = useState(false);
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

  async function pay() {
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
  }

  return (
    <div className="page">
      <h1>Order #{order.id}</h1>
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
