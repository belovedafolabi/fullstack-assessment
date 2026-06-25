import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createOrder, getProduct } from "../api";
import { useCart } from "../state/CartContext";
import type { Product } from "../types";

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!id) return;
    getProduct(id)
      .then(setProduct)
      .catch((err) => console.error(err));
  }, [id]);

  // handler to ensure quantity stays within 1 and available stock
  const handleQuantityChange = (value: number) => {
    if (!product) return;
    
    // Clamp the value between 1 and the available stock
    const clampedValue = Math.min(Math.max(1, value), product.stock);
    setQuantity(clampedValue);
  };

  if (!product) return <p>Loading...</p>;

  async function buyNow() {
    if (!product) return;
    const order = await createOrder({
      customerId: "customer_001",
      items: [{ productId: product.id, quantity }],
      totalAmount: parseFloat(product.price) * quantity,
    });
    navigate(`/orders/${order.id}`);
  }

  return (
    <div className="page">
      <h1>{product.name}</h1>
      <p className="sku">{product.sku}</p>
      <div
        className="description"
        dangerouslySetInnerHTML={{ __html: product.description }}
      />
      <p className="price">${product.price}</p>
      <p className="stock">
        {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
      </p>
      <div className="qty-row">
        <label htmlFor="quantity">Quantity:</label>
        <input
          id="quantity"
          type="number"
          min={1}
          max={product.stock} // Native HTML max attribute
          value={quantity}
          onChange={(e) => handleQuantityChange(Number(e.target.value))}
          disabled={product.stock === 0} // Prevent input if out of stock
        />
      </div>
      <div className="actions">
        <button 
          onClick={() => add(product, quantity)}
          disabled={product.stock === 0}
        >Add to cart</button>
        <button onClick={buyNow} className="primary" disabled={product.stock === 0}>
          Buy now
        </button>
      </div>
    </div>
  );
}
