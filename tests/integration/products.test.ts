import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import pool from "../../src/db/client.js";
import { resetDb } from "../helpers/resetDB.js";
import { createCustomerUser } from "../helpers/testUsers.js";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

let keyCounter = 0;
const placeOrder = (token: string, items: unknown[]) => {
  keyCounter += 1;
  return request(app)
    .post("/orders")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", `products-test-${keyCounter}`)
    .send({ items });
};

describe("server-side product pricing", () => {
  it("ignores client-supplied name and price", async () => {
    const customer = await createCustomerUser();

    const response = await placeOrder(customer.token, [
      { productId: "sku-1", name: "Free keyboard", unitPrice: 1, quantity: 2 },
    ]);

    expect(response.status).toBe(201);
    expect(response.body.items[0].name).toBe("Keyboard");
    expect(response.body.items[0].unitPrice).toBe(15000);

    const total = await request(app)
      .get(`/orders/${response.body.id}/total`)
      .set("Authorization", `Bearer ${customer.token}`);

    expect(Number(total.body.total)).toBe(30000);
  });

  it("rejects an unknown product", async () => {
    const customer = await createCustomerUser();
    const response = await placeOrder(customer.token, [
      { productId: "does-not-exist", quantity: 1 },
    ]);
    expect(response.status).toBe(400);
  });

  it("rejects fractional and out-of-range quantities", async () => {
    const customer = await createCustomerUser();

    for (const quantity of [1.5, 0, -2, 1001]) {
      const response = await placeOrder(customer.token, [
        { productId: "sku-1", quantity },
      ]);
      expect(response.status).toBe(400);
    }
  });

  it("rejects the same product twice in one cart", async () => {
    const customer = await createCustomerUser();
    const response = await placeOrder(customer.token, [
      { productId: "sku-1", quantity: 1 },
      { productId: "sku-1", quantity: 2 },
    ]);
    expect(response.status).toBe(400);
  });
});

describe("GET /products", () => {
  it("lists active products without authentication", async () => {
    const response = await request(app).get("/products");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: "sku-1", name: "Keyboard", unitPrice: 15000 },
      { id: "sku-2", name: "Mouse", unitPrice: 8000 },
    ]);
  });

  it("hides inactive products", async () => {
    await pool.query(`UPDATE products SET active = FALSE WHERE id = 'sku-2';`);

    const response = await request(app).get("/products");

    expect(response.body).toEqual([
      { id: "sku-1", name: "Keyboard", unitPrice: 15000 },
    ]);
  });
});
