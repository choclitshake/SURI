// mathsteps runner — Node.js subprocess script
// This will be called by the Python backend to solve step-by-step math expressions.

const mathsteps = require('mathsteps');

// Read expression from command-line argument
const expression = process.argv[2];

if (!expression) {
    console.error(JSON.stringify({ error: 'No expression provided' }));
    process.exit(1);
}

try {
    const steps = mathsteps.simplifyExpression(expression);
    const result = steps.map((step, index) => ({
        step: index + 1,
        changeType: step.changeType,
        oldNode: step.oldNode ? step.oldNode.toString() : null,
        newNode: step.newNode ? step.newNode.toString() : null,
    }));

    console.log(JSON.stringify({ expression, steps: result }));
} catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
}
