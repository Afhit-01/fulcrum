import type { PaymentBody } from "../types.js";
import { env } from "../config/env.js";

const paystackSecretKey = env.paystackSecretKey;

const initializePayment = async (body: PaymentBody) => {
  if (!paystackSecretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }

  const response = await fetch(
    "https://api.paystack.co/transaction/initialize",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const data = await response.json();

  return data;
};

export default initializePayment;
