#!/usr/bin/env python3
"""Generate scripts/test2-school.sql from catalog_data.py."""
from __future__ import annotations

import random
import textwrap
from pathlib import Path

from catalog_data import (
    COURSES_BY_DEPT,
    FOUNDATIONS,
    INDEPENDENT_OFFERINGS,
    TEACHER_FIRST,
    TEACHER_LAST,
)

OUT = Path(__file__).resolve().parents[1] / "test2-school.sql"

SCHOOL = "a2b20000-0000-4000-a000-000000000000"
Q = {
    1: "a2b21111-0000-4000-a000-000000000001",
    2: "a2b21111-0000-4000-a000-000000000002",
    3: "a2b21111-0000-4000-a000-000000000003",
    4: "a2b21111-0000-4000-a000-000000000004",
}
DEPT_META = [
    ("Mathematics", "MATH", "3 years required", "Quantitative reasoning across four quarters.", "a2b22222-0000-4000-a000-000000000001"),
    ("English", "ENG", "4 years required", "Literature, rhetoric, and composition.", "a2b22222-0000-4000-a000-000000000002"),
    ("Science", "SCI", "3 years required", "Laboratory science and inquiry.", "a2b22222-0000-4000-a000-000000000003"),
    ("Computer Science", "CS", "Elective", "Programming, systems, and data.", "a2b22222-0000-4000-a000-000000000004"),
    ("History", "HIST", "3 years required", "History of societies and ideas.", "a2b22222-0000-4000-a000-000000000005"),
    ("World Languages", "WL", "2 years required", "Modern and classical languages.", "a2b22222-0000-4000-a000-000000000006"),
    ("Arts", "ARTS", "1 year required", "Visual arts and design.", "a2b22222-0000-4000-a000-000000000007"),
    ("Physical Education", "PE", "2 years required", "Movement, fitness, and wellness.", "a2b22222-0000-4000-a000-000000000008"),
    ("Social Sciences", "SS", "Elective", "Civics, economics, and society.", "a2b22222-0000-4000-a000-000000000009"),
    ("Engineering", "ENGIN", "Elective", "Design, build, and iterate.", "a2b22222-0000-4000-a000-000000000010"),
    ("Music", "MUS", "Elective", "Performance and musicianship.", "a2b22222-0000-4000-a000-000000000011"),
    ("Theater", "THTR", "Elective", "Performance and production.", "a2b22222-0000-4000-a000-000000000012"),
    ("Business", "BUS", "Elective", "Entrepreneurship and markets.", "a2b22222-0000-4000-a000-000000000013"),
    ("Media Studies", "MEDIA", "Elective", "Film, journalism, and digital media.", "a2b22222-0000-4000-a000-000000000014"),
    ("Philosophy", "PHIL", "Elective", "Ethics, logic, and inquiry.", "a2b22222-0000-4000-a000-000000000015"),
    ("Health", "HLTH", "1 semester required", "Personal and community health.", "a2b22222-0000-4000-a000-000000000016"),
    ("Debate", "DEB", "Elective", "Argumentation and public speaking.", "a2b22222-0000-4000-a000-000000000017"),
]

# Ten contiguous / spanning term shapes (independent offerings handled separately).
TERM_PATTERNS = [
    [1],
    [2],
    [3],
    [4],
    [1, 2],
    [2, 3],
    [3, 4],
    [1, 2, 3],
    [2, 3, 4],
    [1, 2, 3, 4],
]

# Prerequisite / corequisite recipe names applied to specific advanced courses.
# Scattered deliberately — not sequential in catalog order.
REQ_RECIPES = [
    # (recipe_id, list of advanced titles that get this shape) — each recipe >= 2 titles
    ("none_explicit", ["Competition Math", "SAT Math Prep"]),
    ("single_uuid", ["Honors Geometry", "Honors Algebra II"]),
    ("single_text", ["Creative Writing Workshop", "Advanced Problem Solving"]),
    ("and_two", ["Pre-Calculus", "AP Calculus AB"]),
    ("or_uuid_text", ["AP Statistics", "Number Theory"]),
    ("or_uuid_uuid", ["Discrete Mathematics", "Linear Algebra"]),
    ("uneven_pad", ["Multivariable Calculus", "Differential Equations"]),
    ("coreq_uuid", ["Chemistry", "Physics"]),
    ("coreq_text", ["Economics", "Psychology"]),
    ("coreq_and", ["Machine Learning", "Data Structures"]),
    ("coreq_or", ["Robotics", "Web Development"]),
    ("pre_and_coreq", ["AP Chemistry", "AP Physics 1"]),
    ("pre_uuid_coreq_text", ["Journalism", "Film Production"]),
    ("complex", ["AP Calculus BC", "Organic Chemistry"]),
    ("text_and_group", ["Senior Thesis", "Independent Science Research"]),
]


def sql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def sql_grades(grades: list[int]) -> str:
    return "ARRAY[" + ",".join(str(g) for g in grades) + "]"


def sql_uuid_array(quarters: list[int]) -> str:
    parts = ",".join(f"'{Q[q]}'" for q in quarters)
    return f"ARRAY[{parts}]::uuid[]"


def sql_text2d(rows: list[list[str]] | None) -> str:
    if rows is None:
        return "NULL"
    # Pad to rectangular
    width = max(len(r) for r in rows)
    padded = [r + [""] * (width - len(r)) for r in rows]
    outer = []
    for r in padded:
        inner = ",".join(sql_str(x) for x in r)
        outer.append(f"ARRAY[{inner}]")
    return "ARRAY[" + ", ".join(outer) + "]"


def validate_catalog() -> dict[str, dict]:
    expected = {
        "Mathematics": 48,
        "English": 40,
        "Science": 35,
        "Computer Science": 28,
        "History": 24,
        "World Languages": 20,
        "Arts": 15,
        "Physical Education": 13,
        "Social Sciences": 14,
        "Engineering": 12,
        "Music": 8,
        "Theater": 7,
        "Business": 7,
        "Media Studies": 4,
        "Philosophy": 5,
        "Health": 5,
        "Debate": 5,
    }
    by_title: dict[str, dict] = {}
    for dept, courses in COURSES_BY_DEPT.items():
        if dept not in expected:
            raise SystemExit(f"Unexpected department {dept}")
        if len(courses) != expected[dept]:
            raise SystemExit(f"{dept}: expected {expected[dept]}, got {len(courses)}")
        for c in courses:
            t = c["title"]
            if t in by_title:
                raise SystemExit(f"Duplicate title: {t}")
            by_title[t] = {**c, "department": dept}
    total = sum(expected.values())
    if total != 290:
        raise SystemExit(f"Expected 290 unique, got {total}")
    for name in FOUNDATIONS:
        if name not in by_title:
            raise SystemExit(f"Missing foundation: {name}")
    for title, _qs in INDEPENDENT_OFFERINGS:
        if title not in by_title:
            raise SystemExit(f"Missing independent offering base: {title}")
    # Soft-check recipe titles: skip missing with warning in assign
    return by_title


def assign_term_patterns(titles: list[str], rng: random.Random) -> dict[str, list[int]]:
    """Shuffle term patterns across unique courses, forcing coverage without visible cycles."""
    indep_titles = {t for t, _ in INDEPENDENT_OFFERINGS}
    pool = [t for t in titles if t not in indep_titles]
    rng.shuffle(pool)

    # Start with at least 3 of each pattern (30), then fill remaining from a shuffled deck.
    assignment: dict[str, list[int]] = {}
    forced: list[list[int]] = []
    for pat in TERM_PATTERNS:
        forced.extend([pat[:] for _ in range(3)])
    rng.shuffle(forced)

    i = 0
    for pat in forced:
        if i >= len(pool):
            break
        assignment[pool[i]] = pat[:]
        i += 1

    # Remaining: weighted random so year-long and singles both appear often
    weights = [12, 12, 12, 12, 10, 10, 10, 7, 7, 8]
    for t in pool[i:]:
        pat = rng.choices(TERM_PATTERNS, weights=weights, k=1)[0]
        assignment[t] = pat[:]

    # Independent bases get only their first offering here; clones added later
    for title, qs in INDEPENDENT_OFFERINGS:
        assignment[title] = [qs[0]]

    return assignment


def build_req_map(by_title: dict[str, dict], rng: random.Random) -> dict[str, tuple]:
    """Map course title -> (prereq_options rows or None, coreq_options rows or None)."""
    # Resolve foundation UUIDs later; here store foundation title refs as placeholders.
    # Shape: values are ("raw", prereq_rows, coreq_rows) where rows use foundation titles
    # or free text. UUID substitution happens at SQL emit time via title->id map.

    f = {name: name for name in FOUNDATIONS}  # identity

    def u(name: str) -> str:
        # placeholder token resolved at emit
        return f"@@{name}@@"

    shapes: dict[str, tuple] = {}

    def set_shape(title: str, pre, core):
        if title not in by_title:
            return
        shapes[title] = (pre, core)

    # Guaranteed variants — pick existing titles from catalog when possible
    candidates = {
        "none_explicit": ["Competition Math", "SAT Math Prep", "Lifetime Recreation", "Dance Fitness"],
        "single_uuid": ["Honors Geometry", "Honors Algebra II", "English 10", "Chemistry"],
        "single_text": ["Creative Writing Workshop", "Advanced Problem Solving", "Portfolio Development"],
        "and_two": ["Pre-Calculus", "AP Calculus AB", "Honors Pre-Calculus"],
        "or_uuid_text": ["AP Statistics", "Number Theory", "Discrete Mathematics"],
        "or_uuid_uuid": ["Linear Algebra", "Multivariable Calculus", "AP Calculus BC"],
        "uneven_pad": ["Differential Equations", "Real Analysis Seminar", "Topology for Explorers"],
        "coreq_uuid": ["Physics", "AP Physics 1", "Environmental Science"],
        "coreq_text": ["Economics", "Psychology", "Introduction to Business"],
        "coreq_and": ["Machine Learning", "Data Structures and Algorithms", "Software Engineering"],
        "coreq_or": ["Robotics Programming", "Web Development I", "Mobile App Development"],
        "pre_and_coreq": ["AP Chemistry", "AP Biology", "Anatomy and Physiology"],
        "pre_uuid_coreq_text": ["Journalism", "Journalism Lab", "Podcasting and Audio Storytelling"],
        "complex": ["AP Calculus BC", "Computer Science Capstone", "Artificial Intelligence"],
        "text_and_group": ["Theater Production", "Directing", "Open Source Software"],
    }

    def pick_two(keys: list[str]) -> list[str]:
        present = [k for k in keys if k in by_title]
        rng.shuffle(present)
        if len(present) < 2:
            # fall back to any non-foundation advanced courses
            pool = [t for t in by_title if t not in FOUNDATIONS and t not in shapes]
            rng.shuffle(pool)
            present = (present + pool)[:2]
        return present[:2]

    alg1, geo, alg2 = u("Algebra I"), u("Geometry"), u("Algebra II")
    eng9, eng10 = u("English 9"), u("English 10")
    bio, chem = u("Biology"), u("Chemistry")
    wh, ics = u("World History"), u("Intro to Computer Science")
    sp1 = u("Spanish I")

    recipe_builders = {
        "none_explicit": lambda: (None, None),
        "single_uuid": lambda: ([[alg1]], None),
        "single_text": lambda: ([["Instructor permission"]], None),
        "and_two": lambda: ([[alg1, geo]], None),
        "or_uuid_text": lambda: ([[alg2], ["Placement test"]], None),
        "or_uuid_uuid": lambda: ([[eng9], [eng10]], None),
        "uneven_pad": lambda: ([[alg2, geo], [chem, ""]], None),  # pad applied in sql_text2d
        "coreq_uuid": lambda: (None, [[alg2]]),
        "coreq_text": lambda: (None, [["Concurrent enrollment in a math course"]]),
        "coreq_and": lambda: (None, [[ics, alg2]]),
        "coreq_or": lambda: (None, [[ics], ["Lab section required"]]),
        "pre_and_coreq": lambda: ([[bio]], [[chem]]),
        "pre_uuid_coreq_text": lambda: ([[eng10]], [["Ability to meet publication deadlines"]]),
        "complex": lambda: (
            [[alg2, geo], [chem, ""], ["Department approval", ""]],
            [[ics, alg1]],
        ),
        "text_and_group": lambda: (
            [["Successful completion of a placement exam", "Counselor recommendation"]],
            None,
        ),
    }

    for recipe, title_candidates in candidates.items():
        chosen = pick_two(title_candidates)
        pre, core = recipe_builders[recipe]()
        for t in chosen:
            set_shape(t, pre, core)

    # Scatter more organic requirements across remaining advanced courses
    protected = set(FOUNDATIONS) | {t for t, _ in INDEPENDENT_OFFERINGS}
    no_req_depts = {"Physical Education", "Health", "Music"}
    extras = [
        t
        for t, meta in by_title.items()
        if t not in protected
        and t not in shapes
        and meta["department"] not in no_req_depts
    ]
    rng.shuffle(extras)
    organic = [
        ([[alg1]], None),
        ([[geo]], None),
        ([[alg2], ["Teacher recommendation"]], None),
        (None, [[eng9]]),
        ([[bio]], [[alg1]]),
        ([[wh]], None),
        ([[ics]], None),
        ([[sp1], ["Native speaker assessment"]], None),
        ([[eng10, eng9]], None),
        (None, [["Concurrent reading seminar"]]),
        ([[chem]], [[alg2]]),
        (None, None),
        (None, None),
        (None, None),
    ]
    for i, t in enumerate(extras[:120]):
        # Skip nonsensical cross-department math prereqs on arts/theater unless CS/Sci/Math/Eng
        dept = by_title[t]["department"]
        pre, core = organic[i % len(organic)]
        if dept in {"Arts", "Theater", "Debate", "Philosophy"} and pre and any(
            "Algebra" in str(x) or "Geometry" in str(x) for row in (pre or []) for x in row
        ):
            pre, core = ([[eng9]], None) if dept != "Philosophy" else ([["Instructor permission"]], None)
        shapes[t] = (pre, core)

    # Foundations and independent-offering bases stay clean of random extras
    for name in protected:
        if name in FOUNDATIONS or name in {t for t, _ in INDEPENDENT_OFFERINGS}:
            # Keep any explicit recipe already applied; otherwise none
            if name not in shapes:
                shapes[name] = (None, None)

    for name in FOUNDATIONS:
        shapes[name] = (None, None)

    for name, _ in INDEPENDENT_OFFERINGS:
        # Independent offerings should stay requirement-light so clones share a clean signature
        shapes[name] = (None, None)

    return shapes


def resolve_tokens(rows, title_to_id: dict[str, str]):
    if rows is None:
        return None
    out = []
    for group in rows:
        g = []
        for cell in group:
            if isinstance(cell, str) and cell.startswith("@@") and cell.endswith("@@"):
                title = cell[2:-2]
                g.append(title_to_id[title])
            else:
                g.append(cell)
        out.append(g)
    return out


def make_teacher_rows(n: int, rng: random.Random) -> list[tuple[str, str, str]]:
    rows = []
    for i in range(n):
        fn = TEACHER_FIRST[i % len(TEACHER_FIRST)]
        ln = TEACHER_LAST[(i * 11 + 3) % len(TEACHER_LAST)]
        # slight shuffle so adjacent teachers aren't alphabetically patterned
        if rng.random() < 0.35:
            fn = TEACHER_FIRST[(i * 7 + 5) % len(TEACHER_FIRST)]
        email = f"{fn.lower()}.{ln.lower()}{i}@test2.example.edu"
        rows.append((fn, ln, email))
    return rows


def main() -> None:
    rng = random.Random(20260713)
    by_title = validate_catalog()

    # Build ordered unique course list by department order, but shuffle within dept
    unique_courses: list[dict] = []
    dept_id = {name: did for name, _, _, _, did in DEPT_META}
    for name, *_rest, did in DEPT_META:
        courses = list(COURSES_BY_DEPT[name])
        rng.shuffle(courses)
        for c in courses:
            unique_courses.append({**c, "department": name, "department_id": did})

    term_map = assign_term_patterns([c["title"] for c in unique_courses], rng)
    req_map = build_req_map(by_title, rng)

    # Expand to rows including independent offering clones
    rows: list[dict] = []
    indep = {t: qs for t, qs in INDEPENDENT_OFFERINGS}
    teacher_count_plan = 0
    for c in unique_courses:
        title = c["title"]
        if title in indep:
            qs = indep[title]
            for qi, q in enumerate(qs):
                rows.append(
                    {
                        **c,
                        "term_quarters": [q],
                        "offering_index": qi,
                        "is_clone": qi > 0,
                        "logical_key": title,
                    }
                )
        else:
            rows.append(
                {
                    **c,
                    "term_quarters": term_map[title],
                    "offering_index": 0,
                    "is_clone": False,
                    "logical_key": title,
                }
            )

    if len(rows) != 300:
        raise SystemExit(f"Expected 300 course rows, got {len(rows)}")

    # Teachers: one per logical course; clones share
    logical_keys = []
    seen = set()
    for r in rows:
        if r["logical_key"] not in seen:
            seen.add(r["logical_key"])
            logical_keys.append(r["logical_key"])
    teachers = make_teacher_rows(len(logical_keys), rng)
    teacher_by_key = {k: teachers[i] for i, k in enumerate(logical_keys)}

    # Fixed-looking but random UUIDs via seeded rng (version-4 shaped)
    def gen_uuid() -> str:
        return str(
            __import__("uuid").UUID(bytes=bytes(rng.getrandbits(8) for _ in range(16)), version=4)
        )

    course_ids = {i: gen_uuid() for i in range(len(rows))}
    teacher_ids = {k: gen_uuid() for k in logical_keys}

    # title -> foundation course id (first row for that title)
    title_to_id: dict[str, str] = {}
    for i, r in enumerate(rows):
        if r["title"] not in title_to_id:
            title_to_id[r["title"]] = course_ids[i]

    parts: list[str] = []
    parts.append(
        textwrap.dedent(
            """\
            -- test2 School — quarter-system seed with a realistic course catalog
            --
            -- School: test2 (Spider, Man). Rankings: 8 courses per quarter.
            -- 17 departments (uneven sizes), 300 course rows, quarter terms.
            --
            -- Demonstrates every term_options shape and prereq/coreq options shape
            -- at least twice, scattered through the catalog so variants do not
            -- read as an obvious repeating pattern.
            --
            -- Independent offerings (same title/signature, different single-quarter
            -- term_options) share a teacher so the app merges them into one card.
            --
            -- Re-running conflicts on fixed school/term/department primary keys;
            -- delete the test2 school first if you need a reset.

            BEGIN;
            """
        )
    )

    parts.append(
        textwrap.dedent(
            f"""\
            ----------------------------------------------------------------------
            -- 1. School
            ----------------------------------------------------------------------
            INSERT INTO schools (id, name, website, city, state, password, rankings)
            VALUES (
              '{SCHOOL}',
              'test2',
              'https://test2.example.edu',
              'Spider',
              'Man',
              'test2123',
              8
            );

            ----------------------------------------------------------------------
            -- 2. Terms
            ----------------------------------------------------------------------
            INSERT INTO terms (id, school_id, name, position) VALUES
              ('{Q[1]}', '{SCHOOL}', 'Quarter 1', 1),
              ('{Q[2]}', '{SCHOOL}', 'Quarter 2', 2),
              ('{Q[3]}', '{SCHOOL}', 'Quarter 3', 3),
              ('{Q[4]}', '{SCHOOL}', 'Quarter 4', 4);

            ----------------------------------------------------------------------
            -- 3. Departments
            ----------------------------------------------------------------------
            INSERT INTO departments (id, school_id, name, code, graduation_requirement, subtitle) VALUES
            """
        )
    )
    dept_lines = []
    for name, code, grad, subtitle, did in DEPT_META:
        dept_lines.append(
            f"  ('{did}', '{SCHOOL}', {sql_str(name)}, {sql_str(code)}, {sql_str(grad)}, {sql_str(subtitle)})"
        )
    parts.append(",\n".join(dept_lines) + ";\n")

    parts.append(
        textwrap.dedent(
            """\
            ----------------------------------------------------------------------
            -- 4. Teachers (one per logical course; shared by independent offerings)
            ----------------------------------------------------------------------
            INSERT INTO teachers (id, school_id, first_name, last_name, email, department) VALUES
            """
        )
    )
    tlines = []
    for key in logical_keys:
        fn, ln, email = teacher_by_key[key]
        dept = by_title[key]["department"]
        tid = teacher_ids[key]
        tlines.append(
            f"  ('{tid}', '{SCHOOL}', {sql_str(fn)}, {sql_str(ln)}, {sql_str(email)}, {sql_str(dept)})"
        )
    parts.append(",\n".join(tlines) + ";\n")

    parts.append(
        textwrap.dedent(
            """\
            ----------------------------------------------------------------------
            -- 5. Courses
            ----------------------------------------------------------------------
            INSERT INTO courses (
              id, title, short_description, long_description, grade, term, subject,
              school_id, teacher_id, department_id, retakeable, prereq_options,
              coreq_options, max_student_count, term_options
            ) VALUES
            """
        )
    )

    clines = []
    for i, r in enumerate(rows):
        pre, core = req_map.get(r["title"], (None, None))
        # Clones must share signature with primary (including prereq/coreq)
        if r["is_clone"]:
            # find primary row's requirements via title
            pre, core = req_map.get(r["title"], (None, None))
        pre_sql = sql_text2d(resolve_tokens(pre, title_to_id))
        core_sql = sql_text2d(resolve_tokens(core, title_to_id))
        tid = teacher_ids[r["logical_key"]]
        clines.append(
            "("
            + ", ".join(
                [
                    f"'{course_ids[i]}'",
                    sql_str(r["title"]),
                    sql_str(r["short"]),
                    sql_str(r["long"]),
                    sql_grades(r["grades"]),
                    "''",
                    sql_str(r["department"]),
                    f"'{SCHOOL}'",
                    f"'{tid}'",
                    f"'{r['department_id']}'",
                    "true" if r["retakeable"] else "false",
                    pre_sql,
                    core_sql,
                    str(int(r["max_students"])),
                    sql_uuid_array(r["term_quarters"]),
                ]
            )
            + ")"
        )
    parts.append(",\n".join(clines) + ";\n")

    # Graduation requirements on foundations
    parts.append(
        textwrap.dedent(
            """\
            ----------------------------------------------------------------------
            -- 6. Graduation requirements (core foundations)
            ----------------------------------------------------------------------
            INSERT INTO graduation_requirements (
              school_id, course_id, must_complete_by_grade, must_complete_before_graduation, recommended_grade
            ) VALUES
            """
        )
    )
    grad_titles = [
        ("Algebra I", 10, 9),
        ("English 9", 9, 9),
        ("Biology", 10, 9),
        ("World History", 10, 9),
        ("Geometry", 11, 10),
        ("English 10", 10, 10),
    ]
    glines = []
    for title, by_grade, rec in grad_titles:
        glines.append(
            f"  ('{SCHOOL}', '{title_to_id[title]}', {by_grade}, true, {rec})"
        )
    parts.append(",\n".join(glines) + ";\n")

    parts.append(
        textwrap.dedent(
            f"""\
            ----------------------------------------------------------------------
            -- 7. Verification
            ----------------------------------------------------------------------
            SELECT
              (SELECT COUNT(*) FROM terms WHERE school_id = '{SCHOOL}') AS terms,
              (SELECT COUNT(*) FROM departments WHERE school_id = '{SCHOOL}') AS departments,
              (SELECT COUNT(*) FROM teachers WHERE school_id = '{SCHOOL}') AS teachers,
              (SELECT COUNT(*) FROM courses WHERE school_id = '{SCHOOL}') AS courses,
              (SELECT rankings FROM schools WHERE id = '{SCHOOL}') AS rankings;

            SELECT d.name, COUNT(c.id) AS course_count
            FROM departments d
            LEFT JOIN courses c ON c.department_id = d.id
            WHERE d.school_id = '{SCHOOL}'
            GROUP BY d.name
            ORDER BY course_count DESC;

            SELECT term_options, COUNT(*) AS n
            FROM courses
            WHERE school_id = '{SCHOOL}'
            GROUP BY term_options
            ORDER BY n DESC;

            COMMIT;
            """
        )
    )

    OUT.write_text("\n".join(parts))
    print(f"Wrote {OUT} ({len(rows)} courses, {len(logical_keys)} teachers)")


if __name__ == "__main__":
    main()
