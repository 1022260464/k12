import { EXPERIENCE } from "./experience.js";

const ROOT = "/assets/experience";

export const experienceVisuals = Object.freeze({
  [EXPERIENCE.PRIMARY]: Object.freeze({
    mascot: `${ROOT}/primary/mascot-wave.webp`,
    heroStudent: `${ROOT}/primary/student-explorer.webp`,
    assistant: `${ROOT}/primary/student-thinker.webp`,
    reading: `${ROOT}/primary/student-reading.webp`,
    courses: `${ROOT}/primary/books.webp`,
    code: `${ROOT}/primary/code-laptop.webp`,
    ai: `${ROOT}/primary/ai-brain.webp`,
    science: `${ROOT}/primary/science-flask.webp`,
    tasks: `${ROOT}/primary/goal-mountain.webp`,
    progress: `${ROOT}/primary/achievement-trophy.webp`,
    encouragement: `${ROOT}/primary/chat-star.webp`,
  }),
  [EXPERIENCE.TEEN]: Object.freeze({
    mascot: `${ROOT}/teen/mascot-idea.webp`,
    heroStudent: `${ROOT}/teen/students-team.webp`,
    assistant: `${ROOT}/teen/mascot-reading.webp`,
    reading: `${ROOT}/teen/open-book.webp`,
    courses: `${ROOT}/teen/open-book.webp`,
    code: `${ROOT}/teen/student-coding.webp`,
    ai: `${ROOT}/teen/mascot-idea.webp`,
    science: `${ROOT}/teen/cloud.webp`,
    tasks: `${ROOT}/teen/score-sheet.webp`,
    progress: `${ROOT}/teen/backpack.webp`,
    encouragement: `${ROOT}/teen/speech-study.webp`,
  }),
});

export function visualsFor(experience) {
  return experienceVisuals[experience] || experienceVisuals[EXPERIENCE.TEEN];
}
