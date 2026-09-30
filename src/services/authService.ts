import { env } from "../config/env.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types.js";
import {
  fetchCustomerByEmail,
  fetchStaffByEmail,
  insertCustomer as insertCustomerStore,
} from "../store/authStore.js";
import { ConflictError, UnauthorizedError } from "../errors/AppError.js";

const isUniqueViolation = (err: unknown): boolean =>
  typeof err === "object" &&
  err !== null &&
  "code" in err &&
  err.code === "23505";

const signToken = (payload: JwtPayload): string => {
  if (!env.jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "1h" });
};

export const loginStaff = async (email: string, password: string) => {
  const staff = await fetchStaffByEmail(email);
  if (!staff || !(await bcrypt.compare(password, staff.passwordHash))) {
    throw new UnauthorizedError("Invalid credentials");
  }
  return {
    token: signToken({ id: staff.id, role: staff.role }),
    message: "Staff logged in successfully",
  };
};

export const loginCustomer = async (email: string, password: string) => {
  const customer = await fetchCustomerByEmail(email);
  if (!customer || !(await bcrypt.compare(password, customer.passwordHash))) {
    throw new UnauthorizedError("Invalid credentials");
  }
  return {
    token: signToken({ id: customer.id, role: "customer" }),
    message: "Customer logged in successfully",
  };
};

export const registerCustomer = async (email: string, password: string) => {
  const hashedPassword = await bcrypt.hash(password, 12);
  try {
    const newCustomer = await insertCustomerStore(email, hashedPassword);
    return {
      message: `Customer with email ${newCustomer.email} has been registered successfully`,
    };
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new ConflictError("Customer already exists");
    }
    throw err;
  }
};
