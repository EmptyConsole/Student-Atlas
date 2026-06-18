export type Term = "fall" | "spring" | "both" | "all-year";

export type Course = {
  id: string;
  subject: string;
  title: string;
  grades: number[];
  prerequisites: string[];
  corequisites: string[];
  /** Omitted when the instructor is not yet assigned. */
  teacher?: string;
  term: Term;
  shortDescription: string;
  longDescription: string;
};

export const TERM_LABELS: Record<Term, string> = {
  fall: "Fall",
  spring: "Spring",
  both: "Both",
  "all-year": "All Year",
};

/** Distinct colors used for term badges and term filter chips. */
export const TERM_COLORS: Record<Term, { bg: string; fg: string }> = {
  fall: { bg: "#fcd9a6", fg: "#9a5b14" },
  spring: { bg: "#c5ecc0", fg: "#357a3a" },
  both: { bg: "#e0cdf2", fg: "#6b3fa0" },
  "all-year": { bg: "#bcd6f5", fg: "#2f5fa3" },
};

/** Filterable terms (a course tagged "both" matches fall and spring filters). */
export const TERM_FILTERS: Term[] = ["fall", "spring", "all-year"];

export const GRADES = [8, 9, 10, 11, 12] as const;

/** Distinct colors used for grade filter chips. */
export const GRADE_COLORS: Record<number, { bg: string; fg: string }> = {
  8: { bg: "#f7c8d2", fg: "#a83f57" },
  9: { bg: "#f8ddb0", fg: "#9a6a1e" },
  10: { bg: "#cfe8b4", fg: "#5a7d2e" },
  11: { bg: "#b6dced", fg: "#2f6f8f" },
  12: { bg: "#d0c7ef", fg: "#5b4399" },
};

export type CourseCompletion = "prereq" | "coreq";

export type Filters = {
  grades: Set<number>;
  terms: Set<Term>;
  sortByPrerequisites: boolean;
};

export const DEFAULT_FILTERS: Filters = {
  grades: new Set(),
  terms: new Set(),
  sortByPrerequisites: false,
};

/** True when every prerequisite is marked completed in the user's profile. */
export function meetsPrerequisites(
  course: Course,
  completedCourses: Record<string, CourseCompletion | null>,
): boolean {
  return course.prerequisites.every(
    (title) => completedCourses[title] === "prereq",
  );
}

/** Which filter terms a course's term satisfies. */
const TERM_MATCHES: Record<Term, Term[]> = {
  fall: ["fall"],
  spring: ["spring"],
  both: ["fall", "spring"],
  "all-year": ["all-year"],
};

/** True if a course passes the active filters (empty sets = no constraint). */
export function matchesFilters(
  course: Course,
  filters: Filters,
  completedCourses: Record<string, CourseCompletion | null> = {},
): boolean {
  if (filters.grades.size > 0) {
    const gradeOk = course.grades.some((g) => filters.grades.has(g));
    if (!gradeOk) return false;
  }
  if (filters.terms.size > 0) {
    const termOk = TERM_MATCHES[course.term].some((t) => filters.terms.has(t));
    if (!termOk) return false;
  }
  if (filters.sortByPrerequisites && !meetsPrerequisites(course, completedCourses)) {
    return false;
  }
  return true;
}

/** True if a course matches the search query (title first, then description). */
export function matchesSearch(course: Course, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (course.title.toLowerCase().includes(q)) return true;
  if (course.shortDescription.toLowerCase().includes(q)) return true;
  if (course.longDescription.toLowerCase().includes(q)) return true;
  return false;
}

/** Formats a grade list compactly, e.g. [9,10,11,12] -> "Gr. 9-12". */
export function formatGrades(grades: number[]): string {
  if (grades.length === 0) return "All grades";
  const sorted = [...grades].sort((a, b) => a - b);
  if (sorted.length === 1) return `Gr. ${sorted[0]}`;
  return `Gr. ${sorted[0]}-${sorted[sorted.length - 1]}`;
}

export const COURSES: Course[] = [
  // Arts
  {
    id: "art-foundations",
    subject: "Arts",
    title: "Art Foundations",
    grades: [8, 9, 10],
    prerequisites: [],
    corequisites: [],
    teacher: "Ms. Elena Vasquez",
    term: "fall",
    shortDescription:
      "Explore color, composition, and material across drawing, collage, and mixed media while building a personal visual vocabulary.",
    longDescription:
      "Art Foundations is an entry point into studio practice. Students experiment with line, value, color theory, and composition through weekly projects in drawing, collage, and mixed media. Critiques build a shared vocabulary and the confidence to take creative risks, culminating in a small portfolio of finished work.",
  },
  {
    id: "art-portfolio",
    subject: "Arts",
    title: "Portfolio Studio",
    grades: [11, 12],
    prerequisites: ["Art Foundations"],
    corequisites: [],
    teacher: "Mr. James Whitfield",
    term: "all-year",
    shortDescription:
      "An advanced studio for self-directed artists developing a cohesive body of work for college or exhibition.",
    longDescription:
      "Portfolio Studio supports students in producing a sustained, cohesive body of work. Through individual conferences, group critiques, and exposure to contemporary artists, students refine a personal direction, document their process, and prepare a portfolio suitable for college applications or public exhibition.",
  },
  {
    id: "art-printmaking",
    subject: "Arts",
    title: "Printmaking",
    grades: [10, 11, 12],
    prerequisites: ["Art Foundations"],
    corequisites: [],
    teacher: "Ms. Priya Kapoor",
    term: "spring",
    shortDescription:
      "Carve, ink, and press original editions using relief, monotype, and screen techniques.",
    longDescription:
      "Printmaking introduces relief, monotype, and screen printing as both reproductive and expressive media. Students plan multi-layer images, learn registration and editioning, and consider how repetition and variation shape meaning. The course ends with a collaborative print exchange.",
  },

  // Performing Arts
  {
    id: "pa-acting",
    subject: "Performing Arts",
    title: "Acting & Improvisation",
    grades: [9, 10, 11, 12],
    prerequisites: [],
    corequisites: [],
    teacher: "Ms. Rachel Donovan",
    term: "fall",
    shortDescription:
      "Build presence, listening, and spontaneity through scene work, games, and improvisation.",
    longDescription:
      "Acting & Improvisation develops the actor's core tools: focus, listening, physicality, and spontaneity. Through ensemble games, scene study, and improvisation, students learn to make bold choices, respond truthfully to partners, and perform short scenes with growing confidence.",
  },
  {
    id: "pa-music-ensemble",
    subject: "Performing Arts",
    title: "Music Ensemble",
    grades: [9, 10, 11, 12],
    prerequisites: [],
    corequisites: [],
    teacher: "Mr. Marcus Chen",
    term: "all-year",
    shortDescription:
      "Rehearse and perform as a group across genres, developing musicianship and collaboration.",
    longDescription:
      "Music Ensemble brings together instrumentalists and vocalists to rehearse and perform repertoire spanning classical, jazz, and contemporary styles. Students strengthen sight-reading, intonation, and ensemble listening while preparing for seasonal concerts.",
  },
  {
    id: "pa-dance",
    subject: "Performing Arts",
    title: "Dance Composition",
    grades: [10, 11, 12],
    prerequisites: [],
    corequisites: [],
    teacher: "Ms. Sofia Reyes",
    term: "spring",
    shortDescription:
      "Choreograph and perform original movement studies grounded in modern and contemporary technique.",
    longDescription:
      "Dance Composition pairs technique with choreography. Students study principles of space, time, and energy, then create solo and group works. Showings and feedback help dancers refine intention, musicality, and stagecraft toward an end-of-term performance.",
  },

  // Visual Arts
  {
    id: "va-drawing",
    subject: "Visual Arts",
    title: "Drawing & Observation",
    grades: [8, 9, 10, 11, 12],
    prerequisites: [],
    corequisites: [],
    teacher: "Mr. Daniel Okonkwo",
    term: "fall",
    shortDescription:
      "Train your eye and hand through observational drawing of still life, figure, and landscape.",
    longDescription:
      "Drawing & Observation builds fundamental seeing and rendering skills. Students work from direct observation, exploring proportion, perspective, value, and gesture across still life, figure, and landscape. Regular sketchbook practice anchors steady improvement.",
  },
  {
    id: "va-digital",
    subject: "Visual Arts",
    title: "Digital Design",
    grades: [9, 10, 11, 12],
    prerequisites: [],
    corequisites: [],
    teacher: "Ms. Hannah Brooks",
    term: "spring",
    shortDescription:
      "Design with type, layout, and image using industry-standard vector and raster tools.",
    longDescription:
      "Digital Design introduces visual communication through type, color, grid, and image. Using vector and raster software, students complete branding, poster, and layout projects, learning to give and receive design critique and to prepare files for print and screen.",
  },
  {
    id: "va-painting",
    subject: "Visual Arts",
    title: "Painting Studio",
    grades: [10, 11, 12],
    prerequisites: ["Drawing & Observation"],
    corequisites: [],
    teacher: "Mr. Thomas Lindqvist",
    term: "all-year",
    shortDescription:
      "Develop a painting practice in acrylic and oil with attention to color, surface, and intent.",
    longDescription:
      "Painting Studio guides students through the materials and decisions of painting. Beginning with color mixing and underpainting, the course moves toward independent projects in acrylic and oil. Critiques emphasize composition, surface, and the relationship between subject and intent.",
  },

  // Computer Science
  {
    id: "cs-intro",
    subject: "Computer Science",
    title: "Intro to Programming",
    grades: [8, 9, 10],
    prerequisites: [],
    corequisites: [],
    teacher: "Ms. Aisha Rahman",
    term: "fall",
    shortDescription:
      "Learn programming fundamentals — variables, loops, functions, and logic — by building small interactive projects.",
    longDescription:
      "Intro to Programming teaches computational thinking through hands-on projects. Students learn variables, conditionals, loops, functions, and basic data structures while building games and tools. The course emphasizes debugging, problem decomposition, and clear code over memorization.",
  },
  {
    id: "cs-data-structures",
    subject: "Computer Science",
    title: "Data Structures & Algorithms",
    grades: [10, 11, 12],
    prerequisites: ["Intro to Programming"],
    corequisites: [],
    teacher: "Mr. Kevin Park",
    term: "spring",
    shortDescription:
      "Study core data structures and algorithmic strategies, analyzing efficiency and trade-offs.",
    longDescription:
      "Data Structures & Algorithms explores lists, stacks, queues, trees, hash maps, and graphs alongside searching, sorting, and recursion. Students analyze time and space complexity, implement structures from scratch, and apply them to substantial programming challenges.",
  },
  {
    id: "cs-web",
    subject: "Computer Science",
    title: "Web Development",
    grades: [9, 10, 11, 12],
    prerequisites: ["Intro to Programming"],
    corequisites: [],
    teacher: "Ms. Laura Nguyen",
    term: "both",
    shortDescription:
      "Build responsive, interactive websites with HTML, CSS, and JavaScript from concept to deployment.",
    longDescription:
      "Web Development covers the modern front-end stack. Students build accessible, responsive interfaces with HTML, CSS, and JavaScript, learn version control, and deploy live projects. The term concludes with a self-designed web application.",
  },
  {
    id: "cs-ml",
    subject: "Computer Science",
    title: "Intro to Machine Learning",
    grades: [11, 12],
    prerequisites: ["Data Structures & Algorithms"],
    corequisites: ["Statistics"],
    teacher: "Dr. Samuel Ortiz",
    term: "spring",
    shortDescription:
      "An accessible introduction to the ideas and ethics behind modern machine learning models.",
    longDescription:
      "Intro to Machine Learning demystifies how models learn from data. Students explore regression, classification, and neural networks through guided notebooks, building intuition for training, evaluation, and overfitting. Discussions of bias and ethics run throughout.",
  },

  // Economics
  {
    id: "econ-micro",
    subject: "Economics",
    title: "Microeconomics",
    grades: [10, 11, 12],
    prerequisites: [],
    corequisites: [],
    teacher: "Mr. Gregory Walsh",
    term: "fall",
    shortDescription:
      "Examine how individuals, firms, and markets make decisions under scarcity.",
    longDescription:
      "Microeconomics studies decision-making at the level of consumers and firms. Topics include supply and demand, elasticity, market structures, and the role of incentives. Students apply models to real cases and debate when markets succeed and fail.",
  },
  {
    id: "econ-macro",
    subject: "Economics",
    title: "Macroeconomics",
    grades: [11, 12],
    prerequisites: ["Microeconomics"],
    corequisites: [],
    teacher: "Ms. Natalie Fischer",
    term: "spring",
    shortDescription:
      "Analyze national economies through growth, inflation, unemployment, and policy.",
    longDescription:
      "Macroeconomics zooms out to whole economies. Students examine GDP, inflation, unemployment, trade, and the tools of fiscal and monetary policy, evaluating how governments and central banks respond to booms and recessions.",
  },
  {
    id: "econ-personal-finance",
    subject: "Economics",
    title: "Personal Finance",
    grades: [9, 10, 11, 12],
    prerequisites: [],
    corequisites: [],
    teacher: "Mr. David Kim",
    term: "both",
    shortDescription:
      "Practical money skills: budgeting, saving, credit, investing, and planning for the future.",
    longDescription:
      "Personal Finance equips students with everyday financial literacy. Through simulations and projects, students learn budgeting, banking, credit, taxes, and the basics of investing, leaving with a personal financial plan they can actually use.",
  },

  // Engineering
  {
    id: "eng-intro",
    subject: "Engineering",
    title: "Intro to Engineering Design",
    grades: [9, 10, 11, 12],
    prerequisites: [],
    corequisites: [],
    teacher: "Mr. Richard Pemberton",
    term: "fall",
    shortDescription:
      "Apply the design process to real problems through sketching, prototyping, and testing.",
    longDescription:
      "Intro to Engineering Design introduces the iterative design process. Students identify problems, brainstorm and sketch solutions, build prototypes, and test against criteria. Projects develop teamwork, documentation, and hands-on fabrication skills.",
  },
  {
    id: "eng-robotics",
    subject: "Engineering",
    title: "Robotics",
    grades: [10, 11, 12],
    prerequisites: ["Intro to Engineering Design"],
    corequisites: [],
    teacher: "Mr. Ryan Holloway",
    term: "all-year",
    shortDescription:
      "Design, build, and program robots to complete autonomous and driver-controlled challenges.",
    longDescription:
      "Robotics combines mechanical design, electronics, and programming. Teams build and iterate on robots to meet seasonal challenges, learning sensors, motors, control loops, and the discipline of testing under competition constraints.",
  },
  {
    id: "eng-cad",
    subject: "Engineering",
    title: "CAD & Fabrication",
    grades: [10, 11, 12],
    prerequisites: ["Intro to Engineering Design"],
    corequisites: [],
    teacher: "Ms. Christine Alvarez",
    term: "spring",
    shortDescription:
      "Model parts in 3D CAD and bring them to life with 3D printing and laser cutting.",
    longDescription:
      "CAD & Fabrication teaches parametric 3D modeling and digital fabrication. Students design functional parts and assemblies, then manufacture them with 3D printers and laser cutters, learning tolerances, materials, and design-for-manufacturing.",
  },

  // English
  {
    id: "eng-lit",
    subject: "English",
    title: "World Literature",
    grades: [9, 10],
    prerequisites: [],
    corequisites: [],
    teacher: "Ms. Margaret Sullivan",
    term: "all-year",
    shortDescription:
      "Read across cultures and centuries, building close-reading and analytical writing skills.",
    longDescription:
      "World Literature surveys voices across cultures and eras, from epic and drama to short fiction and poetry. Students practice close reading, develop arguments supported by evidence, and write analytical essays that grow in nuance over the year.",
  },
  {
    id: "eng-creative-writing",
    subject: "English",
    title: "Creative Writing",
    grades: [10, 11, 12],
    prerequisites: [],
    corequisites: [],
    teacher: "Mr. Ethan Morrison",
    term: "fall",
    shortDescription:
      "Craft poetry, fiction, and creative nonfiction in a supportive workshop setting.",
    longDescription:
      "Creative Writing is a generative workshop. Students write and revise across poetry, fiction, and creative nonfiction, studying craft through mentor texts and giving thoughtful peer feedback. The course ends with a polished portfolio and a public reading.",
  },
  {
    id: "eng-rhetoric",
    subject: "English",
    title: "Rhetoric & Argument",
    grades: [11, 12],
    prerequisites: ["World Literature"],
    corequisites: [],
    teacher: "Dr. Claire Bennett",
    term: "spring",
    shortDescription:
      "Analyze and craft persuasive arguments across speeches, essays, and media.",
    longDescription:
      "Rhetoric & Argument examines how language persuades. Students analyze speeches, essays, and media for rhetorical strategy, then compose and deliver their own arguments. Emphasis falls on logic, evidence, audience, and ethical persuasion.",
  },

  // History
  {
    id: "hist-world",
    subject: "History",
    title: "Modern World History",
    grades: [9, 10],
    prerequisites: [],
    corequisites: [],
    teacher: "Mr. Omar Hassan",
    term: "all-year",
    shortDescription:
      "Trace global change from revolutions to the present through evidence and interpretation.",
    longDescription:
      "Modern World History follows major transformations from the age of revolutions through globalization. Students work with primary and secondary sources, weigh competing interpretations, and write evidence-based arguments about cause, change, and continuity.",
  },
  {
    id: "hist-us",
    subject: "History",
    title: "United States History",
    grades: [10, 11],
    prerequisites: [],
    corequisites: [],
    teacher: "Ms. Jennifer Caldwell",
    term: "all-year",
    shortDescription:
      "Investigate the American past through its conflicts, movements, and enduring questions.",
    longDescription:
      "United States History examines the nation's development through political, social, and economic lenses. Students analyze documents, debate pivotal moments, and consider how the past shapes present questions of democracy, rights, and identity.",
  },
  {
    id: "hist-econ-history",
    subject: "History",
    title: "History of Capitalism",
    grades: [11, 12],
    prerequisites: ["Modern World History"],
    corequisites: [],
    teacher: "Dr. Robert Stein",
    term: "fall",
    shortDescription:
      "Explore how markets, labor, and money reshaped societies over five centuries.",
    longDescription:
      "History of Capitalism traces the rise of market economies and their global consequences. Students study trade, industrialization, labor, and finance, connecting historical developments to contemporary debates about inequality and growth.",
  },

  // Interdisciplinary
  {
    id: "inter-design-thinking",
    subject: "Interdisciplinary",
    title: "Design Thinking",
    grades: [9, 10, 11, 12],
    prerequisites: [],
    corequisites: [],
    teacher: "Ms. Maya Patel",
    term: "fall",
    shortDescription:
      "Tackle open-ended problems with empathy, prototyping, and iteration across disciplines.",
    longDescription:
      "Design Thinking is a human-centered problem-solving studio. Students interview users, define needs, ideate broadly, and prototype solutions to ambiguous challenges, drawing on tools from art, engineering, and the social sciences.",
  },
  {
    id: "inter-sustainability",
    subject: "Interdisciplinary",
    title: "Sustainability & Society",
    grades: [10, 11, 12],
    prerequisites: [],
    corequisites: [],
    teacher: "Mr. Andrew Green",
    term: "spring",
    shortDescription:
      "Examine climate and sustainability through science, policy, and ethics together.",
    longDescription:
      "Sustainability & Society connects environmental science with economics, policy, and ethics. Students model systems, evaluate trade-offs, and propose local interventions, learning to reason about complex problems that cross disciplinary boundaries.",
  },
  {
    id: "inter-capstone",
    subject: "Interdisciplinary",
    title: "Independent Capstone",
    grades: [12],
    prerequisites: ["Design Thinking"],
    corequisites: [],
    teacher: "Ms. Diane Foster",
    term: "all-year",
    shortDescription:
      "Pursue a year-long, self-directed project culminating in a public presentation.",
    longDescription:
      "The Independent Capstone is a self-directed inquiry. With mentorship, students scope an ambitious question or project, manage their own timeline, and synthesize research and making into a final product shared with an authentic audience.",
  },

  // Languages
  {
    id: "lang-spanish",
    subject: "Languages",
    title: "Spanish I",
    grades: [8, 9, 10],
    prerequisites: [],
    corequisites: [],
    teacher: "Sra. Carmen Delgado",
    term: "all-year",
    shortDescription:
      "Begin communicating in Spanish through speaking, listening, reading, and culture.",
    longDescription:
      "Spanish I builds foundational communication. Students develop everyday vocabulary, core grammar, and pronunciation while exploring the cultures of the Spanish-speaking world through stories, music, and conversation.",
  },
  {
    id: "lang-mandarin",
    subject: "Languages",
    title: "Mandarin I",
    grades: [8, 9, 10],
    prerequisites: [],
    corequisites: [],
    teacher: "Ms. Wei Lin",
    term: "all-year",
    shortDescription:
      "Start speaking and reading Mandarin Chinese with tones, characters, and culture.",
    longDescription:
      "Mandarin I introduces spoken and written Chinese. Students learn pinyin, tones, and foundational characters, building practical conversation skills and cultural understanding through immersive, daily practice.",
  },
  {
    id: "lang-french-adv",
    subject: "Languages",
    title: "Advanced French",
    grades: [11, 12],
    prerequisites: ["Spanish I"],
    corequisites: [],
    teacher: "Mme. Isabelle Moreau",
    term: "all-year",
    shortDescription:
      "Refine fluency through literature, film, and discussion conducted entirely in French.",
    longDescription:
      "Advanced French deepens fluency and cultural literacy. Conducted in the target language, the course engages students with literature, film, and current events, sharpening their ability to discuss, write, and think critically in French.",
  },

  // Math
  {
    id: "math-algebra",
    subject: "Math",
    title: "Algebra I",
    grades: [8, 9],
    prerequisites: [],
    corequisites: [],
    teacher: "Mr. Steven Clarke",
    term: "all-year",
    shortDescription:
      "Master linear and quadratic relationships, functions, and algebraic reasoning.",
    longDescription:
      "Algebra I develops the language of mathematics. Students model with linear and quadratic functions, solve equations and systems, and build the algebraic fluency and reasoning that underpin all later math and science courses.",
  },
  {
    id: "math-geometry",
    subject: "Math",
    title: "Geometry",
    grades: [9, 10],
    prerequisites: ["Algebra I"],
    corequisites: [],
    teacher: "Ms. Angela Torres",
    term: "all-year",
    shortDescription:
      "Reason about shape, proof, and space through construction and deductive logic.",
    longDescription:
      "Geometry emphasizes logical reasoning and proof. Students explore congruence, similarity, circles, and transformations, learning to construct rigorous arguments and to connect algebraic and geometric ways of seeing.",
  },
  {
    id: "math-calculus",
    subject: "Math",
    title: "Calculus",
    grades: [11, 12],
    prerequisites: ["Algebra I", "Geometry"],
    corequisites: [],
    teacher: "Dr. Michael Brennan",
    term: "all-year",
    shortDescription:
      "Study limits, derivatives, and integrals with applications to change and motion.",
    longDescription:
      "Calculus introduces the mathematics of change. Students develop limits, derivatives, and integrals, applying them to optimization, motion, and accumulation. Conceptual understanding is balanced with technique and real-world modeling.",
  },
  {
    id: "math-stats",
    subject: "Math",
    title: "Statistics",
    grades: [10, 11, 12],
    prerequisites: ["Algebra I"],
    corequisites: [],
    teacher: "Ms. Olivia Grant",
    term: "fall",
    shortDescription:
      "Collect, analyze, and interpret data to reason under uncertainty.",
    longDescription:
      "Statistics teaches how to learn from data. Students study distributions, sampling, probability, and inference, and complete a data project that takes a question from collection through analysis to a defensible conclusion.",
  },

  // Science
  {
    id: "sci-biology",
    subject: "Science",
    title: "Biology",
    grades: [9, 10],
    prerequisites: [],
    corequisites: [],
    teacher: "Dr. Susan Nakamura",
    term: "all-year",
    shortDescription:
      "Investigate life from cells to ecosystems through inquiry and lab work.",
    longDescription:
      "Biology explores living systems across scales. Through labs and investigation, students study cells, genetics, evolution, and ecology, developing scientific reasoning and an appreciation for the interconnectedness of life.",
  },
  {
    id: "sci-chemistry",
    subject: "Science",
    title: "Chemistry",
    grades: [10, 11],
    prerequisites: ["Biology"],
    corequisites: ["Algebra I"],
    teacher: "Mr. Paul Richardson",
    term: "all-year",
    shortDescription:
      "Understand matter, reactions, and energy through experimentation and modeling.",
    longDescription:
      "Chemistry examines the composition and behavior of matter. Students model atomic structure, bonding, and reactions, and use quantitative lab work to connect the microscopic and observable worlds.",
  },
  {
    id: "sci-physics",
    subject: "Science",
    title: "Physics",
    grades: [11, 12],
    prerequisites: ["Chemistry"],
    corequisites: ["Calculus"],
    teacher: "Dr. Helen Voss",
    term: "all-year",
    shortDescription:
      "Explore motion, forces, energy, and waves through experiment and mathematics.",
    longDescription:
      "Physics studies the fundamental rules of the physical world. Students investigate motion, forces, energy, and waves, building models that they test in the lab and express mathematically, connecting theory to everyday phenomena.",
  },
  {
    id: "sci-environmental",
    subject: "Science",
    title: "Environmental Science",
    grades: [10, 11, 12],
    prerequisites: ["Biology"],
    corequisites: [],
    teacher: "Ms. Emily Carter",
    term: "spring",
    shortDescription:
      "Study ecosystems, resources, and human impact through fieldwork and data.",
    longDescription:
      "Environmental Science integrates biology, chemistry, and earth science to study ecosystems and human impact. Through fieldwork and data analysis, students examine energy, biodiversity, and sustainability, and propose evidence-based solutions.",
  },

  // Social Emotional Learning
  {
    id: "sel-mindfulness",
    subject: "Social Emotional Learning",
    title: "Mindfulness & Wellbeing",
    grades: [8, 9, 10, 11, 12],
    prerequisites: [],
    corequisites: [],
    teacher: "Ms. Grace Williams",
    term: "both",
    shortDescription:
      "Build attention, self-awareness, and resilience through mindfulness practice.",
    longDescription:
      "Mindfulness & Wellbeing introduces practices that support focus and emotional balance. Students learn breath and attention techniques, reflect on stress and habits, and develop a personal toolkit for resilience and wellbeing.",
  },
  {
    id: "sel-leadership",
    subject: "Social Emotional Learning",
    title: "Leadership & Community",
    grades: [10, 11, 12],
    prerequisites: [],
    corequisites: [],
    teacher: "Mr. Jonathan Price",
    term: "fall",
    shortDescription:
      "Develop collaboration, communication, and ethical leadership through real projects.",
    longDescription:
      "Leadership & Community develops the skills to lead with empathy. Students practice communication, facilitation, and conflict resolution while planning and running a service project that meets a genuine community need.",
  },
  {
    id: "sel-relationships",
    subject: "Social Emotional Learning",
    title: "Healthy Relationships",
    grades: [9, 10],
    prerequisites: [],
    corequisites: [],
    teacher: "Ms. Karen Mitchell",
    term: "spring",
    shortDescription:
      "Learn communication, empathy, and boundary-setting for healthy connections.",
    longDescription:
      "Healthy Relationships supports students in building strong, respectful connections. Through discussion and role-play, students practice empathy, active listening, boundary-setting, and conflict resolution in friendships, families, and beyond.",
  },
];
