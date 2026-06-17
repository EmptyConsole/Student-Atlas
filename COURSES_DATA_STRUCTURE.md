# Courses Data Structure Summary

## Database Schema Overview

```
┌─────────────────────────────────────────────────────────────┐
│                          schools                             │
├─────────────────────────────────────────────────────────────┤
│ • id (PK)                                                    │
│ • name: "Student Atlas High School"                         │
│ • city: "San Francisco"                                     │
│ • state: "CA"                                               │
│ • website: "https://studentatlas.example.com"              │
└────────────────────┬──────────────────────────────────────┬─┘
                     │                                      │
        ┌────────────┴──────────────┐          ┌───────────┴──────────┐
        │                           │          │                      │
   ┌────▼─────────────┐    ┌──────▼──────────┐  ┌────────▼──────────┐
   │    teachers      │    │    courses      │  │   departments    │
   ├──────────────────┤    ├─────────────────┤  ├──────────────────┤
   │ • id (PK)        │    │ • id (PK)       │  │ • id (PK)        │
   │ • school_id (FK) │    │ • school_id(FK) │  │ • school_id (FK) │
   │ • first_name     │    │ • title         │  │ • name           │
   │ • last_name      │    │ • subject       │  │ • code           │
   │ • email          │    │ • short_desc    │  └──────────────────┘
   │ • department     │    │ • long_desc     │
   └──────────────────┘    │ • grade         │
                          │ • term          │
                          │ • teacher_id(FK)│
                          │ • dept_id (FK)  │
                          └────┬─────────────┘
                              │
               ┌──────────────┼──────────────┐
               │              │              │
          ┌────▼──────┐  ┌────▼──────────┐ ┌─▼─────────┐
          │prerequisites corequisites    │ │ enrollments
          ├───────────┤  ├──────────────┤ └──────────┘
          │ course_id │  │ course_id    │
          │ prereq_id │  │ coreq_id     │
          └───────────┘  └──────────────┘

# COURSES TABLE (45 records)

## Courses by Subject (13 subjects)

### Arts (3 courses)
├─ Art Foundations (Ms. Elena Vasquez)
│  └ Grade 8, Fall, No prerequisites
├─ Portfolio Studio (Mr. James Whitfield)
│  └ Grade 11, All Year, Requires: Art Foundations
└─ Printmaking (Ms. Priya Kapoor)
   └ Grade 10, Spring, Requires: Art Foundations

### Performing Arts (3 courses)
├─ Acting & Improvisation (Ms. Rachel Donovan)
│  └ Grade 9, Fall, No prerequisites
├─ Music Ensemble (Mr. Marcus Chen)
│  └ Grade 9, All Year, No prerequisites
└─ Dance Composition (Ms. Sofia Reyes)
   └ Grade 10, Spring, No prerequisites

### Visual Arts (3 courses)
├─ Drawing & Observation (Mr. Daniel Okonkwo)
│  └ Grade 8, Fall, No prerequisites
├─ Digital Design (Ms. Hannah Brooks)
│  └ Grade 9, Spring, No prerequisites
└─ Painting Studio (Mr. Thomas Lindqvist)
   └ Grade 10, All Year, Requires: Drawing & Observation

### Computer Science (4 courses)
├─ Intro to Programming (Ms. Aisha Rahman)
│  └ Grade 8, Fall, No prerequisites
├─ Data Structures & Algorithms (Mr. Kevin Park)
│  └ Grade 10, Spring, Requires: Intro to Programming
├─ Web Development (Ms. Laura Nguyen)
│  └ Grade 9, Both Terms, Requires: Intro to Programming
└─ Intro to Machine Learning (Dr. Samuel Ortiz)
   └ Grade 11, Spring, Requires: Data Structures & Algorithms
   └ Corequisite: Statistics

### Economics (3 courses)
├─ Microeconomics (Mr. Gregory Walsh)
│  └ Grade 10, Fall, No prerequisites
├─ Macroeconomics (Ms. Natalie Fischer)
│  └ Grade 11, Spring, Requires: Microeconomics
└─ Personal Finance (Mr. David Kim)
   └ Grade 9, Both Terms, No prerequisites

### Engineering (3 courses)
├─ Intro to Engineering Design (Mr. Richard Pemberton)
│  └ Grade 9, Fall, No prerequisites
├─ Robotics (Mr. Ryan Holloway)
│  └ Grade 10, All Year, Requires: Intro to Engineering Design
└─ CAD & Fabrication (Ms. Christine Alvarez)
   └ Grade 10, Spring, Requires: Intro to Engineering Design

### English (3 courses)
├─ World Literature (Ms. Margaret Sullivan)
│  └ Grade 9, All Year, No prerequisites
├─ Creative Writing (Mr. Ethan Morrison)
│  └ Grade 10, Fall, No prerequisites
└─ Rhetoric & Argument (Dr. Claire Bennett)
   └ Grade 11, Spring, Requires: World Literature

### History (3 courses)
├─ Modern World History (Mr. Omar Hassan)
│  └ Grade 9, All Year, No prerequisites
├─ United States History (Ms. Jennifer Caldwell)
│  └ Grade 10, All Year, No prerequisites
└─ History of Capitalism (Dr. Robert Stein)
   └ Grade 11, Fall, Requires: Modern World History

### Interdisciplinary (3 courses)
├─ Design Thinking (Ms. Maya Patel)
│  └ Grade 9, Fall, No prerequisites
├─ Sustainability & Society (Mr. Andrew Green)
│  └ Grade 10, Spring, No prerequisites
└─ Independent Capstone (Ms. Diane Foster)
   └ Grade 12, All Year, Requires: Design Thinking

### Languages (3 courses)
├─ Spanish I (Sra. Carmen Delgado)
│  └ Grade 8, All Year, No prerequisites
├─ Mandarin I (Ms. Wei Lin)
│  └ Grade 8, All Year, No prerequisites
└─ Advanced French (Mme. Isabelle Moreau)
   └ Grade 11, All Year, Requires: Spanish I

### Math (5 courses)
├─ Algebra I (Mr. Steven Clarke)
│  └ Grade 8, All Year, No prerequisites
├─ Geometry (Ms. Angela Torres)
│  └ Grade 9, All Year, Requires: Algebra I
├─ Statistics (Ms. Olivia Grant)
│  └ Grade 10, Fall, Requires: Algebra I
├─ Calculus (Dr. Michael Brennan)
│  └ Grade 11, All Year, Requires: Algebra I, Geometry
└─ [5th math course if applicable]

### Science (5 courses)
├─ Biology (Dr. Susan Nakamura)
│  └ Grade 9, All Year, No prerequisites
├─ Chemistry (Mr. Paul Richardson)
│  └ Grade 10, All Year, Requires: Biology
│  └ Corequisite: Algebra I
├─ Physics (Dr. Helen Voss)
│  └ Grade 11, All Year, Requires: Chemistry
│  └ Corequisite: Calculus
├─ Environmental Science (Ms. Emily Carter)
│  └ Grade 10, Spring, Requires: Biology
└─ [5th science course if applicable]

### Social Emotional Learning (3 courses)
├─ Mindfulness & Wellbeing (Ms. Grace Williams)
│  └ Grade 8, Both Terms, No prerequisites
├─ Leadership & Community (Mr. Jonathan Price)
│  └ Grade 10, Fall, No prerequisites
└─ Healthy Relationships (Ms. Karen Mitchell)
   └ Grade 9, Spring, No prerequisites


## Key Statistics

┌──────────────────────────────────────────┐
│           MIGRATION STATISTICS           │
├──────────────────────────────────────────┤
│ Total Courses              │    45        │
│ Total Teachers             │    ~34       │
│ Prerequisite Relationships │    18        │
│ Corequisite Relationships  │    2         │
│ Unique Subjects            │    13        │
│ Total Schools              │    1         │
├──────────────────────────────────────────┤
│ Courses with Prerequisites │    11        │
│ Courses with Corequisites  │    2         │
│ Grade Range Available      │    8-12      │
│ Terms Available            │    4         │
│ Teachers Per Course        │    ~1        │
└──────────────────────────────────────────┘


## Data Flow Diagram

```

┌─────────────────────────────┐
│ src/data/courses.ts │
│ (45 course objects) │
│ │
│ - id (string, app-level) │
│ - title, subject │
│ - description (short/long) │
│ - grades: number[] │
│ - prerequisites: string[] │
│ - corequisites: string[] │
│ - teacher?: string │
│ - term: "fall"|"spring"... │
└──────────┬──────────────────┘
│
│ npm run migrate-courses
│ (scripts/migrate-courses.ts)
▼
┌─────────────────────────────────────────┐
│ Supabase Database │
├─────────────────────────────────────────┤
│ │
│ schools (1) │
│ teachers (~34) │
│ courses (45) ─────┬─────────────────┐ │
│ │ │ │
│ course_prerequisites (18 relations) │ │
│ course_corequisites (2 relations) ─┘ │
│ │
└─────────────────────────────────────────┘

```


## Grade Field Mapping

The app supports multiple grades per course, but Supabase stores a single grade.

Strategy: Use minimum grade (lowest eligible grade)

Examples:
```

App Grades │ DB Grade │ Meaning
────────────────┼────────────┼─────────────────────────────────
[8, 9, 10] │ 8 │ Offered to grades 8 and up
[9, 10, 11, 12] │ 9 │ Offered to grades 9 and up
[10, 11, 12] │ 10 │ Offered to grades 10 and up
[11, 12] │ 11 │ Offered to grades 11 and up
[12] │ 12 │ Senior year only

```


## Teacher Name Parsing

Teachers are stored in the app as full names with titles:
```

Raw Input │ Parsed As
───────────────────────┼──────────────────────
"Ms. Elena Vasquez" │ first: "Ms."
│ last: "Elena Vasquez"
───────────────────────┼──────────────────────
"Dr. Samuel Ortiz" │ first: "Dr."
│ last: "Samuel Ortiz"
───────────────────────┼──────────────────────
"Sra. Carmen Delgado" │ first: "Sra."
│ last: "Carmen Delgado"

```

Note: Consider updating teacher records to separate titles and names properly.


## Prerequisite Network

Key prerequisite chains:

```

Math Chain:
Algebra I → Geometry
→ Calculus
→ Statistics

Science Chain:
Biology → Chemistry → Physics
→ Environmental Science

English Chain:
World Literature → Rhetoric & Argument

CS Chain:
Intro to Programming → Data Structures → Machine Learning
→ Web Development

Economics Chain:
Microeconomics → Macroeconomics

Engineering Chain:
Intro to Design → Robotics
→ CAD & Fabrication

Languages:
Spanish I → Advanced French

Interdisciplinary:
Design Thinking → Independent Capstone

Art:
Art Foundations → Portfolio Studio
→ Printmaking

Visual Arts:
Drawing & Observation → Painting Studio

History:
Modern World History → History of Capitalism

```

```
