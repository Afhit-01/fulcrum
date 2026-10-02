import type { OrderItemInput, OrderStatus } from "../types.js";
import validator from "validator";

const isOrderItemInput = (value: unknown): value is OrderItemInput => {
  if (typeof value !== "object" || value === null) return false;

  const item = value as Record<string, unknown>;
  return (
    typeof item.productId === "string" &&
    item.productId.length > 0 &&
    typeof item.quantity === "number"
  );
};

export const isCreateOrderPayload = (
  body: unknown,
): body is { items: OrderItemInput[] } => {
  if (typeof body !== "object" || body === null) return false;

  const payload = body as Record<string, unknown>;

  return (
    Array.isArray(payload.items) &&
    payload.items.every((item) => isOrderItemInput(item))
  );
};

const orderStatuses = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
  "return_requested",
  "returned",
] as const;

export const isValidStatus = (status: unknown): status is OrderStatus => {
  if (typeof status !== "string") return false;

  return orderStatuses.includes(status as OrderStatus);
};

export function isValidParam(
  value: string | string[] | undefined,
): value is string {
  return typeof value === "string";
}

export const isNumericString = (value: unknown): value is string => {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    !Number.isNaN(Number(value))
  );
};

export const isValidEmail = (email: string): boolean => {
  return validator.isEmail(email);
};
