import {
  BookMarked,
  BookOpen,
  Brush,
  Calculator,
  Code,
  Drama,
  FlaskConical,
  HeartHandshake,
  Landmark,
  Languages,
  Palette,
  Shuffle,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const SUBJECT_ICON_MAP: Record<string, LucideIcon> = {
  Arts: Palette,
  "Performing Arts": Drama,
  "Visual Arts": Brush,
  "Computer Science": Code,
  Economics: TrendingUp,
  Engineering: Wrench,
  English: BookOpen,
  History: Landmark,
  Interdisciplinary: Shuffle,
  Languages: Languages,
  Math: Calculator,
  Science: FlaskConical,
  "Social Emotional Learning": HeartHandshake,
};

/** Returns the lucide icon for a department name, or a generic fallback. */
export function getSubjectIcon(name: string): LucideIcon {
  return SUBJECT_ICON_MAP[name] ?? BookMarked;
}
