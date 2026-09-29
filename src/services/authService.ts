import {env} from "../config/env.js"
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types.js";
import {
  fetchCustomerByEmail,
  fetchStaffByEmail,
  insertCustomer as insertCustomerStore,
} from "../store/authStore.js";

type AuthResult =
  | { success: false; reason: string }
  | { success: true; token: string; message: string };

export const loginStaff = async (
  email: string,
  password: string,
): Promise<AuthResult> => {
  const staff = await fetchStaffByEmail(email);

  if (!staff) {
    return {
      success: false,
      reason: "Invalid credentials",
    };
  }

  const isValidPassword = await bcrypt.compare(password, staff.passwordHash);
  if (!isValidPassword) {
    return {
      success: false,
      reason: "Invalid credentials",
    };
  }

  const payload: JwtPayload = {
    id: staff.id,
    role: staff.role,
  };

  const theSecret = env.jwtSecret;
  if (!theSecret) {
    throw new Error("JWT_SECRET is not configured");
  }

  const token = jwt.sign(payload, theSecret, {
    expiresIn: "1h",
  });

  return {
    success: true,
    token,
    message: "Staff logged in successfully",
  };
};

export const registerCustomer = async (
  email: string,
  password: string,
): Promise<
  { success: false; reason: string } | { success: true; message: string }
> => {
  try {
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newCustomer = await insertCustomerStore(email, hashedPassword);

    return {
      success: true,
      message: `Customer with email ${newCustomer.email} has been registered successfully`,
    };
  } catch {
    return {
      success: false,
      reason: "Customer already exists or registration failed",
    };
  }
};

export const loginCustomer = async (
  email: string,
  password: string,
): Promise<AuthResult> => {
  const customer = await fetchCustomerByEmail(email);

  if (!customer) {
    return {
      success: false,
      reason: "Invalid credentials",
    };
  }

  const isValidPassword = await bcrypt.compare(password, customer.passwordHash);
  if (!isValidPassword) {
    return {
      success: false,
      reason: "Invalid credentials",
    };
  }

  const payload: JwtPayload = {
    id: customer.id,
    role: "customer",
  };

  const theSecret = env.jwtSecret;
  if (!theSecret) {
    throw new Error("JWT_SECRET is not configured");
  }

  const token = jwt.sign(payload, theSecret, {
    expiresIn: "1h",
  });

  return {
    success: true,
    token,
    message: "Customer logged in successfully",
  };
};
