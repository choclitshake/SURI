import {
  checkPlaygroundAnswer,
  getPlaygroundSitting,
  getPlaygroundTopics,
  revealPlaygroundAnswer,
  type PlaygroundCheckResult,
  type PlaygroundDifficulty,
  type PlaygroundReveal,
  type PlaygroundSitting,
  type PlaygroundTopics,
} from "../api";

export interface PlaygroundClient {
  getTopics(): Promise<PlaygroundTopics>;
  getSitting(nodeId: string, difficulty: PlaygroundDifficulty): Promise<PlaygroundSitting>;
  check(problemId: string, answerLatex: string): Promise<PlaygroundCheckResult>;
  reveal(problemId: string): Promise<PlaygroundReveal>;
}

export const playground: PlaygroundClient = {
  getTopics: getPlaygroundTopics,
  getSitting: getPlaygroundSitting,
  check: checkPlaygroundAnswer,
  reveal: revealPlaygroundAnswer,
};
