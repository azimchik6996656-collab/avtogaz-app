import { verifyGoogleStaff } from "../../../lib/staffAuth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const result = await verifyGoogleStaff(token, searchParams.get("branchId"));
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });
  return Response.json({
    ok: true, role: result.role, email: result.email, fullName: result.fullName,
    requiresPin: !!result.pinHash,
  });
}
