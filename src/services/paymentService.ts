import type { PaymentBody } from "../types.js";
import initializePayment from "../integrations/paystack.js";

export const initializeOrderPayment = async (body: PaymentBody) => {
  const data = await initializePayment(body);

  if (!data.status) {
    throw new Error(data.message);
  }

  return data;
};