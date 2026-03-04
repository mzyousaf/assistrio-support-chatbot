import bcrypt from "bcryptjs";
import jwt, { JwtPayload } from "jsonwebtoken";
import { cookies } from "next/headers";

import { SuperAdminUser, SuperAdminUserDocument } from "@/models/SuperAdminUser";
import { connectToDatabase } from "./mongoose";

type SuperAdminTokenPayload = JwtPayload & {
  sub: string;
  role: "superadmin";
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "Missing JWT_SECRET environment variable. Please set it in .env.local.",
    );
  }

  return secret;
}

export async function findSuperAdminByEmail(
  email: string,
): Promise<SuperAdminUserDocument | null> {
  await connectToDatabase();
  return SuperAdminUser.findOne({ email: email.trim().toLowerCase() }).exec();
}

export async function createSuperAdmin(
  email: string,
  password: string,
): Promise<SuperAdminUserDocument> {
  await connectToDatabase();

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    throw new Error("Email and password are required to create a super admin.");
  }

  const existingUser = await SuperAdminUser.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new Error("A super admin with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  return SuperAdminUser.create({
    email: normalizedEmail,
    passwordHash,
    role: "superadmin",
  });
}

export function signSuperAdminToken(userId: string): string {
  if (!userId) {
    throw new Error("Cannot sign token without a user id.");
  }

  return jwt.sign({ sub: userId, role: "superadmin" }, getJwtSecret(), {
    expiresIn: "7d",
  });
}

export function verifySuperAdminToken(token: string): SuperAdminTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret());

  if (typeof decoded !== "object" || !decoded) {
    throw new Error("Invalid super admin token payload.");
  }

  const payload = decoded as JwtPayload;
  if (typeof payload.sub !== "string" || payload.role !== "superadmin") {
    throw new Error("Invalid super admin token claims.");
  }

  return payload as SuperAdminTokenPayload;
}

// TODO: Seed the initial super admin via a one-time script/route or MongoDB tool.
export async function getAuthenticatedSuperAdmin(): Promise<SuperAdminUserDocument | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("sa_token")?.value;

  if (!token) {
    return null;
  }

  let payload: SuperAdminTokenPayload;
  try {
    payload = verifySuperAdminToken(token);
  } catch {
    return null;
  }

  await connectToDatabase();
  const user = await SuperAdminUser.findById(payload.sub).exec();

  if (!user || user.role !== "superadmin") {
    return null;
  }

  return user;
}
