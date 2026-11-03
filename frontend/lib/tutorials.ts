export type TutorialStep = {
  title: string;
  description: string;
  target?: string;
  optional?: boolean;
};

export type Tutorial = { id: string; label: string; ready: string; steps: TutorialStep[] };
const at = (name: string) => `[data-tutorial="${name}"]`;
const info = (title: string, description: string, target?: string): TutorialStep => ({ title, description, target });

export const TUTORIALS: Record<string, Tutorial> = {
  dashboard: { id: "dashboard", label: "Explore your kingdom", ready: ".dashboard-world, .dashboard-world-fallback", steps: [
    info("Welcome to your learning kingdom!", "I’m Suri, your guide. Each landmark opens a different learning tool. Use Continue and Back to explore this guide at your pace. You can skip or replay it whenever you need."),
    info("Your progress archive", "Progress shows the skills you have mastered, lessons you can study, and mistakes to review.", `${at("map-champions")}, ${at("fallback-progress")}`),
    info("Your algebra workshop", "The calculator simplifies expressions and explains each change. It is a useful place to explore how algebra works.", `${at("map-calculator")}, ${at("fallback-calculator")}`),
    info("Practice at your own pace", "The playground has problem sets grouped by skill and difficulty. Visit it whenever you want extra practice.", `${at("map-records")}, ${at("fallback-playground")}`),
    info("Your account and your guide", "Open your name for account details. Use Help for a quick reference, or Tutorial to replay the guide on this page.", ".suri-app-bar-actions"),
    info("Open your first spellbook", "Select Topics to enter the library. A new guide will show you how to choose a topic.", `${at("map-topics")}, ${at("fallback-topics")}`),
  ] },
  topics: { id: "topics", label: "Choose a topic", ready: ".topics-carousel-action", steps: [
    info("Welcome to the spellbook library", "Each spellbook is a topic. The selected book shows its title, mastery, and learning status.", ".topics-carousel-summary"),
    { ...info("Browse the volumes", "Select the right arrow to bring another spellbook into focus. You can also use the left and right arrow keys when browsing while browsing.", ".topics-carousel-side-arrow.is-next:not(:disabled)"), optional: true },
    info("Check your mastery", "Mastery grows as you complete the skills in this topic. An active quest can be resumed; a completed one can be reviewed.", ".topics-carousel-mastery"),
    info("Enter a topic", "Select Open volume, Resume quest, or Review again to continue with the selected topic.", ".topics-carousel-action"),
  ] },
  topic: { id: "topic", label: "Start a learning path", ready: ".topic-entry-actions", steps: [
    info("Meet your next chapter", "Read the overview to see what this topic covers and the earlier skills it builds on.", ".topic-entry-meta"),
    info("Two ways to begin", "Diagnostic Assessment checks your earlier skills and adapts your starting point. Skip to Lessons takes you directly to learning. Choose whichever fits you.", ".topic-entry-actions"),
    info("Choose your starting point", "Select either Diagnostic Assessment or Skip to Lessons. This starts or resumes your learning session.", ".topic-entry-actions button:not(:disabled)"),
  ] },
  calculator: { id: "calculator", label: "Use the algebra workshop", ready: ".calculator-samples button", steps: [
    info("Let’s simplify an expression", "You can type with the math keyboard or try a ready-made example. Examples show you how the working is explained. You can continue through this guide without solving anything."),
    info("Try an example", "Choose any example below. It fills the expression field and solves it automatically.", ".calculator-samples button:not(:disabled)"),
    info("Follow the working", "Compare the expression before and after each change, then read Why this works. The final answer appears at the end.", ".calculator-results, .calculator-empty-state, .calculator-route-error"),
    info("Start fresh whenever you like", "Reset clears the expression and any working. Enter an expression and select Show steps, or press Enter, whenever you are ready to try one.", ".calculator-reset-button"),
  ] },
  progress: { id: "progress", label: "Read your mastery trail", ready: '[aria-label="Overall curriculum mastery"]', steps: [
    info("See how far you’ve come", "Curriculum mastery combines your progress across the learning path. The status counts show mastered, active, unresolved, and unattempted skills.", '[aria-label="Overall curriculum mastery"]'),
    info("Find the right lesson", "Grade, topic, and status filters narrow the lesson list. You can also search by skill.", 'select[aria-label="Grade"]'),
    info("Study or review a skill", "Study opens an available lesson. Review revisits a mastered one. Locked lessons name the prerequisite to complete first.", "#competency-heading"),
    info("Learn from mistakes", "Reflect & review keeps your recorded mistakes and recovery notes. When records are available, expand one or open the full history to revisit it.", "#recent-review-heading"),
  ] },
  "playground-topics": { id: "playground-topics", label: "Explore the playground", ready: at("playground-topic"), steps: [
    info("Extra practice, one skill at a time", "Follow a path from foundational skills toward its goal. The bars track solved problems at each difficulty.", at("playground-topic")),
    info("Choose a skill", "Select a skill card to see the available difficulties.", at("playground-topic")),
  ] },
  "playground-difficulty": { id: "playground-difficulty", label: "Choose a difficulty", ready: `${at("playground-difficulty")}:not(:disabled)`, steps: [
    info("Find your challenge level", "Easy, Medium, and Hard have separate problem sets. A Coming soon option has no problems available yet."),
    info("Open a problem set", "Choose an available difficulty. You can change it later.", `${at("playground-difficulty")}:not(:disabled)`),
  ] },
  "playground-problem": { id: "playground-problem", label: "Solve a playground problem", ready: at("playground-answer"), steps: [
    info("Read the problem first", "Solve the problem and check any units before entering your answer.", at("playground-prompt")),
    info("Write an answer", "The math field and its keyboard let you enter expressions, powers, and fractions. You can explore the rest of this guide without entering an answer.", at("playground-answer")),
    info("You have support", "Check gives feedback on your answer. You can retry, reveal the worked solution, or skip a problem. After finishing, select Next to move on.", at("playground-actions")),
    info("Check your answer", "Select Check when you are ready. Your solved progress updates as you practice.", at("playground-check")),
  ] },
  lesson: { id: "lesson", label: "Study your spellbook", ready: ".page-tabs", steps: [
    info("Three pages, one skill", "Study the Concept, Worked Example, and Guided Walkthrough. The knowledge orbs track which pages you have checked off.", ".orb-row"),
    info("Open the worked example", "Select Page II to see a problem worked out step by step.", at("lesson-example")),
    info("Record your understanding", "After studying a page, select Check Off Page. Check off all three pages to unlock Quiz Me. Take your time reading each one.", ".page-footer-row"),
    info("Put your learning to work", "Let’s Practice opens guided practice whenever you need it. Quiz Me checks your understanding once all pages are studied.", ".tome-footer"),
    info("Return to the concept", "Select Page I to begin studying. Your lesson is now yours to explore.", at("lesson-concept")),
  ] },
  "diagnostic-battle": { id: "diagnostic-battle", label: "Answer a diagnostic question", ready: ".spell-grid", steps: [
    info("Read the question", "Take your time with the question before choosing a spell. Your answers help SURI find skills to review.", ".question-strip"),
    info("Choose your answer", "Select the answer you think is correct. Selecting a choice does not submit it yet.", ".spell-tile:not(:disabled)"),
    info("Cast your spell", "Select Cast Spell to submit your chosen answer and continue the assessment. Follow the feedback as the battle progresses.", "#cast-spell-btn"),
  ] },
  "practice-battle": { id: "practice-battle", label: "Complete a practice step", ready: ".equation-input-strip", steps: [
    info("One step at a time", "Read the instruction and work out the missing part of the expression.", ".step-instruction-text"),
    info("Fill the blank", "The blank accepts your answer for this step. Use the math keyboard for algebraic notation when you are ready to practice.", ".equation-input-strip"),
    info("Cast your inscription", "Submit this step to see feedback. Practice will guide you through the remaining steps and help you recover from mistakes.", ".input-panel .attack-btn"),
  ] },
  "quiz-step": { id: "quiz-step", label: "Solve a quiz rune", ready: ".quiz-answer-grid", steps: [
    info("Your timer is paused for this guide", "Each rune has a countdown. Study the expression and work out the missing value, then submit before time runs out. The timer resumes after you complete or skip this tutorial.", ".quiz-expression"),
    info("Boosts and skipping", "Hint and Freeze Timer each cost 750 points. Skip Rune moves past a step. You do not need to spend points during this tutorial.", ".quiz-actions"),
    info("Choose your answer", "Answer choices fill the blank in the expression. Selecting a choice does not submit it; Submit Rune confirms your answer.", ".quiz-answer:not(:disabled)"),
    info("Seal your rune", "Select Submit Rune to submit this answer. Results are revealed in the final ledger; the challenge continues with the next rune.", ".submit-rune"),
  ] },
  "quiz-summary": { id: "quiz-summary", label: "Review your quiz", ready: ".quiz-summary-title", steps: [
    info("Your answers are revealed", "Review your score and rune ledger to see what went well and what needs more practice.", ".quiz-summary-title"),
    info("Choose your next step", "Use the available actions to continue your learning or review the lesson.", ".quiz-summary-actions"),
  ] },
  results: { id: "results", label: "Understand your results", ready: ".result-summary", steps: [
    info("See what you learned", "Your result explains your progress and the next recommended step. Review any skills that need improvement.", ".result-summary"),
    info("Continue your learning path", "The buttons below let you continue, practice, review a prerequisite, choose another topic, or return to the dashboard, depending on your result.", ".button-row"),
  ] },
};

export type TutorialPreferences = { disabled: boolean; seen: Record<string, "completed" | "skipped"> };
export const emptyTutorialPreferences = (): TutorialPreferences => ({ disabled: false, seen: {} });
export const tutorialStorageKey = (userId?: string) => `suri:tutorials:v1:${userId ?? "guest"}`;

export function tutorialIsPending(id: string, state: { identityReady: boolean; hasUser: boolean; loaded: boolean; preferences: TutorialPreferences; activeId?: string }) {
  if (state.activeId === id || !state.identityReady) return true;
  // Failed account/progress loading must not leave a quiz permanently paused.
  return state.hasUser && (!state.loaded || (!state.preferences.disabled && !state.preferences.seen[id]));
}

export function parseTutorialPreferences(value: string | null): TutorialPreferences {
  try {
    const parsed: unknown = JSON.parse(value ?? "null");
    if (!parsed || typeof parsed !== "object") return emptyTutorialPreferences();
    const { disabled, seen } = parsed as Partial<TutorialPreferences>;
    return { disabled: disabled === true, seen: Object.fromEntries(Object.entries(seen && typeof seen === "object" ? seen : {}).filter(([, status]) => status === "completed" || status === "skipped")) };
  } catch { return emptyTutorialPreferences(); }
}

export function tutorialForPage(pathname: string, scope?: string): Tutorial | null {
  if (pathname === "/login" || pathname === "/register") return null;
  if (["/dashboard", "/topics", "/calculator", "/progress"].includes(pathname)) return TUTORIALS[pathname.slice(1)];
  if (pathname.startsWith("/topics/")) return TUTORIALS.topic;
  if (pathname === "/playground" || pathname.startsWith("/session/")) return scope ? TUTORIALS[scope] ?? null : null;
  return null;
}
