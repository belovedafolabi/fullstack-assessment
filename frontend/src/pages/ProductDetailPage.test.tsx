import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ProductDetailPage from "./ProductDetailPage";
import * as api from "../api";
import { CartProvider } from "../state/CartContext";

// FIX 1: Import the DOM matchers so Vitest recognizes 'toHaveAttribute' and 'toBeDisabled'
import "@testing-library/jest-dom"; 
import type { Product } from "../types";

// Mock the API calls
vi.mock("../api", () => ({
  getProduct: vi.fn(),
  createOrder: vi.fn(),
}));

// FIX 2: Explicitly type the mock and provide the missing 'createdAt' and 'updatedAtts' properties
const mockProduct: Product = {
  id: 6,
  sku: "SKU-001",
  name: "Test Gadget",
  description: "A cool gadget",
  price: "99.99",
  stock: 5, 
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z", // Matches your exact type spelling
};

describe("ProductDetailPage - Quantity Stock Constraint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getProduct).mockResolvedValue(mockProduct);
  });

  const renderComponent = () => {
    return render(
      
      <MemoryRouter initialEntries={["/products/6"]}>
        <CartProvider>
          <Routes>
            <Route path="/products/:id" element={<ProductDetailPage />} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    );
  };

  it("should bind the max attribute of the input to the product stock", async () => {
    renderComponent();

    const qtyInput = await screen.findByLabelText(/quantity/i);

    expect(qtyInput).toHaveAttribute("min", "1");
    expect(qtyInput).toHaveAttribute("max", "5");
  });

  it("should clamp the value to the max stock when a user tries to type an excessive number", async () => {
    renderComponent();

    const qtyInput = (await screen.findByLabelText(/quantity/i)) as HTMLInputElement;

    fireEvent.change(qtyInput, { target: { value: "500" } });

    expect(qtyInput.value).toBe("5");
  });

  it("should clamp the value to 1 if a user tries to type a negative number or 0", async () => {
    renderComponent();

    const qtyInput = (await screen.findByLabelText(/quantity/i)) as HTMLInputElement;

    fireEvent.change(qtyInput, { target: { value: "0" } });
    expect(qtyInput.value).toBe("1");

    fireEvent.change(qtyInput, { target: { value: "-10" } });
    expect(qtyInput.value).toBe("1");
  });

  it("should disable the quantity input and action buttons if the product is out of stock", async () => {
    // FIX 2b: Keep the type complete when overriding for the out-of-stock scenario
    vi.mocked(api.getProduct).mockResolvedValue({
      ...mockProduct,
      stock: 0,
    });

    renderComponent();

    const qtyInput = await screen.findByLabelText(/quantity/i);
    const addToCartButton = screen.getByRole("button", { name: /add to cart/i });
    const buyNowButton = screen.getByRole("button", { name: /buy now/i });

    expect(qtyInput).toBeDisabled();
    expect(addToCartButton).toBeDisabled();
    expect(buyNowButton).toBeDisabled();
  });
});