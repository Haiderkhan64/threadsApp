import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Acknowledge all Clerk webhook events gracefully.
  // Add user sync logic here if needed (user.created, user.updated, etc.)
  return NextResponse.json({ received: true }, { status: 200 });
}