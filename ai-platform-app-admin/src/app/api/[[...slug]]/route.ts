import { NextResponse } from "next/server";

/**
 * This app is a pure frontend. All API requests must go to the backend.
 * Set NEXT_PUBLIC_API_BASE_URL to your backend URL (e.g. http://localhost:3001).
 */
export async function GET() {
  return NextResponse.json(
    {
      error:
        "API not available on this server. Set NEXT_PUBLIC_API_BASE_URL to your backend URL.",
    },
    { status: 404 },
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "API not available on this server. Set NEXT_PUBLIC_API_BASE_URL to your backend URL.",
    },
    { status: 404 },
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      error:
        "API not available on this server. Set NEXT_PUBLIC_API_BASE_URL to your backend URL.",
    },
    { status: 404 },
  );
}

export async function PATCH() {
  return NextResponse.json(
    {
      error:
        "API not available on this server. Set NEXT_PUBLIC_API_BASE_URL to your backend URL.",
    },
    { status: 404 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      error:
        "API not available on this server. Set NEXT_PUBLIC_API_BASE_URL to your backend URL.",
    },
    { status: 404 },
  );
}
