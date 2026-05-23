import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { expression } = await req.json();

  if (!expression || typeof expression !== "string") {
    return NextResponse.json({ error: "No expression provided" }, { status: 400 });
  }

  try {
    // Dynamically import so it only loads server-side
    const mathsteps = require("mathsteps");

    const rawSteps = mathsteps.simplifyExpression(expression);

    if (!rawSteps || rawSteps.length === 0) {
      return NextResponse.json({ expression, steps: [] });
    }

    const steps = rawSteps.map((step: any, index: number) => ({
      step:       index + 1,
      changeType: step.changeType,
      oldNode:    step.oldNode ? step.oldNode.toString() : null,
      newNode:    step.newNode ? step.newNode.toString() : null,
    }));

    return NextResponse.json({ expression, steps });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to solve expression" },
      { status: 500 }
    );
  }
}