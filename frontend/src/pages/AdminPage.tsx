import { useEffect, useState } from "react";
import { listOrdersAdmin, listProducts, updateProductAdmin } from "../api";
import type { Order, Product } from "../types";
import { z } from "zod";

// strip common XSS injection characters from all field entries
const sanitizeXSS = (val: string) => val.replace(/[<>'"&]/g, "");

// zod validation schema
const adminProductSchema = z.object({
  name: z.string({ message: "Name must be a valid text string" }).transform(sanitizeXSS).optional(),
  description: z.string({ message: "Description must be a valid text string" }).transform(sanitizeXSS).optional(),
  price: z.preprocess(
    (val) => {
      if (val === "" || val === undefined) return undefined;
      const clean = String(val).replace(/[<>'"&]/g, "");
      return isNaN(Number(clean)) ? clean : Number(clean);
    },
    z.number({ message: "Price must be a number" }).min(0, "Price cannot be less than 0").optional()
  ),
  stock: z.preprocess(
    (val) => {
      if (val === "" || val === undefined) return undefined;
      const clean = String(val).replace(/[<>'"&]/g, "");
      return isNaN(Number(clean)) ? clean : Number(clean);
    },
    z.number({ message: "Stock must be a number" }).min(0, "Stock cannot be less than 0").optional()
  ),
});

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Record<number, Partial<Product>>>({});
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    listOrdersAdmin().then(setOrders);
    listProducts().then(setProducts);
  }, []);

  function onChangeField(id: number, field: keyof Product, value: string) {
    const partialData = { [field]: value };
    const result = adminProductSchema.pick({ [field]: true } as any).safeParse(partialData);

    if (!result.success) {
      const message = result.error.issues[0].message;
      setNotification(`${String(field)} Error: ${message}`);
    } else {
      setNotification(null);
    }

    const sanitizedValue = value.replace(/[<>'"&]/g, "");
    setEditing((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: sanitizedValue },
    }));
  }

  async function save(p: Product) {
    const draft = editing[p.id] || {};
    // making sure if no changes were made a network request is not wasted and the user is informed
    if (!draft || Object.keys(draft).length === 0) {
      setNotification("No changes detected for this product.");
      return;
    }

    const result = adminProductSchema.safeParse(draft);
    if (!result.success) {
      const message = result.error.issues[0].message;
      setNotification(`Validation Error: ${message}`);
      return;
    }

    setProducts((current) =>
      current.map((it) =>
        it.id === p.id
          ? { ...it, ...draft, price: draft.price ?? it.price }
          : it,
      ),
    );
    // try/catch to handle the promise rejection cleanly
    try {
      await updateProductAdmin(p.id, {
        price: draft.price !== undefined ? Number(draft.price) : undefined,
        stock: draft.stock !== undefined ? Number(draft.stock) : undefined,
        description: draft.description as string | undefined,
        name: draft.name as string | undefined,
      });
      // clear the editing cache for this specific product upon successful save
      setEditing((prev) => {
        const copy = { ...prev };
        delete copy[p.id];
        return copy;
      });

      setNotification("Product updated successfully!");
    } catch (err: any) {
      console.error(err);
      // leveraging my custom error message format from api.ts to provide detailed feedback to the admin user
      setNotification(`\n${err.message}`);
    }
  }

  return (
    <div className="page">
      <h1>Admin</h1>

      <section>
        <h2>Orders</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, idx) => (
              <tr key={idx}>
                <td>{o.id}</td>
                <td>{o.customerId}</td>
                <td>${o.totalAmount}</td>
                <td>{o.status}</td>
                <td>{new Date(o.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Products</h2>
        {notification && <div className="notification">{notification}</div>}
        <ul className="admin-products">
          {products.map((p, idx) => (
            <li key={idx} className="admin-product">
              <input
                type="text"
                defaultValue={p.name}
                onChange={(e) => onChangeField(p.id, "name", e.target.value)}
              />
              <input
                type="number"
                defaultValue={p.price}
                onChange={(e) => onChangeField(p.id, "price", e.target.value)}
              />
              <input
                type="number"
                defaultValue={String(p.stock)}
                onChange={(e) => onChangeField(p.id, "stock", e.target.value)}
              />
              <textarea
                defaultValue={p.description}
                onChange={(e) =>
                  onChangeField(p.id, "description", e.target.value)
                }
              />
              <button onClick={() => save(p)}>Save</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}