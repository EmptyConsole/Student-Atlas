export type Subject = {
  name: string;
  description: string;
  /** Pastel color used for the sidebar bookmark tab. */
  color: string;
  /** Very light pastel tint used as the course card background. */
  tint: string;
  /** Slightly stronger accent (text/badges) that reads on the tint. */
  accent: string;
};

export const SUBJECTS: Subject[] = [
  {
    name: "Arts",
    description: "Creative expression",
    color: "#f7c5d9",
    tint: "#fdeef4",
    accent: "#b14e7a",
  },
  {
    name: "Performing Arts",
    description: "Theater, dance & music",
    color: "#d9c2f0",
    tint: "#f4eefb",
    accent: "#7c52ad",
  },
  {
    name: "Visual Arts",
    description: "Drawing, painting & design",
    color: "#f3c4ec",
    tint: "#fceefa",
    accent: "#a8489c",
  },
  {
    name: "Computer Science",
    description: "Code & computing",
    color: "#bcd4f6",
    tint: "#eef4fd",
    accent: "#3d6bb3",
  },
  {
    name: "Economics",
    description: "Markets & money",
    color: "#bfe6c9",
    tint: "#eef9f1",
    accent: "#3f8b58",
  },
  {
    name: "Engineering",
    description: "Design & build systems",
    color: "#f8d7a8",
    tint: "#fdf3e4",
    accent: "#b3792b",
  },
  {
    name: "English",
    description: "Reading & writing",
    color: "#f6bdb4",
    tint: "#fceeeb",
    accent: "#b65244",
  },
  {
    name: "History",
    description: "People & the past",
    color: "#e6cfb0",
    tint: "#f8f1e6",
    accent: "#946a36",
  },
  {
    name: "Interdisciplinary",
    description: "Where subjects meet",
    color: "#b6e6df",
    tint: "#ecf9f7",
    accent: "#358077",
  },
  {
    name: "Languages",
    description: "Speak the world",
    color: "#c4cdf2",
    tint: "#eef0fc",
    accent: "#4f5bb0",
  },
  {
    name: "Math",
    description: "Numbers & logic",
    color: "#b3e2ee",
    tint: "#ebf8fc",
    accent: "#2f7d92",
  },
  {
    name: "Science",
    description: "How nature works",
    color: "#cfe9aa",
    tint: "#f3f9e8",
    accent: "#5f8a2f",
  },
  {
    name: "Social Emotional Learning",
    description: "Social & emotional growth",
    color: "#f6e6a8",
    tint: "#fcf8e6",
    accent: "#a8902f",
  },
];
