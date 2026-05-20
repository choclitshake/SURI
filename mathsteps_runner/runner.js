const mathsteps = require('mathsteps');

const expr = process.argv[2];
if (!expr) {
  console.log(JSON.stringify({ error: 'no expression provided' }));
  process.exit(1);
}

try {
  const steps = mathsteps.simplifyExpression(expr);
  const output = steps.map((step, i) => ({
    step_index: i,
    from: step.oldNode.toString(),
    to: step.newNode.toString(),
    rule: step.changeType
  }));
  console.log(JSON.stringify(output));
} catch (e) {
  console.log(JSON.stringify({ error: e.message }));
}
