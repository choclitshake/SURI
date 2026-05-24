import { NextResponse } from "next/server";
import mathsteps from "mathsteps";

// 1. Recursive helper to format steps and substeps into JSON-safe strings
function formatStep(step: any): any {
  return {
    changeType: step.changeType,
    oldNode: step.oldNode ? step.oldNode.toString() : null,
    newNode: step.newNode ? step.newNode.toString() : null,
    // Recursively format nested sub-steps if they exist
    substeps: Array.isArray(step.substeps) 
      ? step.substeps.map(formatStep) 
      : Array.isArray(step.subSteps)
        ? step.subSteps.map(formatStep)
        : []
  };
}

// 2. In your POST API handler:
export async function POST(req: Request) {
  try {
    const { expression } = await req.json();
    if (!expression) {
      return NextResponse.json({ error: "No expression provided" }, { status: 400 });
    }

    // Solve expression using mathsteps
    const steps = mathsteps.simplifyExpression(expression);

    // Format all steps (and substeps) recursively before returning
    const formattedSteps = steps.map(formatStep);

    return NextResponse.json({ steps: formattedSteps });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}