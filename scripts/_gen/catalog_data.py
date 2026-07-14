"""Complete high-school course catalog used by the Student Atlas seed scripts."""

from __future__ import annotations

import hashlib


def _h(title: str, salt: str = "") -> int:
    return int(hashlib.sha1(f"{salt}:{title}".encode()).hexdigest(), 16)


def _course(
    title: str,
    focus: str,
    grade_digits: str,
    max_students: int,
    retakeable: bool = False,
    *,
    department: str,
) -> dict:
    """Build a course record with catalog-style short/long copy (no sequential templates)."""
    grades = [grade for grade in range(9, 13) if str(grade) in grade_digits]
    f = focus
    a = f[0].upper() + f[1:] if f else f
    h = _h(title)
    h2 = _h(title, department)

    # Short blurbs: real catalog tone; title usually omitted so cards don't sound generated.
    shorts = [
        f"{a}.",
        f"Covers {f}.",
        f"An elective built around {f}.",
        f"Lab- and project-driven work on {f}.",
        f"Core work includes {f}.",
        f"A practical look at {f}.",
        f"Seminar and studio approaches to {f}.",
        f"Emphasis on {f}.",
        f"Skills and concepts in {f}.",
        f"Year-round / term work on {f}." if "AP" in title else f"Term work on {f}.",
        f"For students ready to take on {f}.",
        f"Builds from fundamentals of {f}.",
        f"College-prep attention to {f}." if title.startswith("AP") or "Honors" in title else f"Attention to {f}.",
        f"Hands-on experience with {f}.",
        f"Reading, writing, and analysis focused on {f}." if department in {"English", "History", "Philosophy"} else f"Practice with {f}.",
        f"Performance-centered study of {f}." if department in {"Music", "Theater", "Debate"} else f"Applied study of {f}.",
    ]
    short = shorts[h % len(shorts)]
    # Keep short blurbs roughly sentence-length, not huge.
    if len(short) > 140:
        short = f"{a}."

    # Long blurbs: department-flavored openings/middles/closings mixed by hash so
    # neighboring courses in a department do not share openings.
    openings = [
        f"Students spend most of class deeply engaged with {f}, moving between explanation, practice, and critique.",
        f"The term opens with concrete problems tied to {f}, then widens toward independent work.",
        f"Rather than racing through a checklist, the class returns repeatedly to {f} until ideas feel usable.",
        f"Expect a mix of short drills and longer investigations organized around {f}.",
        f"Teachers model professional habits while students pursue {f} in pairs and on their own.",
        f"What looks like a narrow topic—{f}—becomes a route into bigger questions about evidence and craft.",
        f"Workshops, mini-lectures, and critiques rotate so that {f} never stays only on a worksheet.",
        f"This offering is sequenced for the grades it serves, with {f} as the spine of major assignments.",
        f"Field-adjacent examples keep {f} connected to situations students recognize outside school.",
        f"Early assessments check fluency; later ones ask students to combine ideas related to {f}.",
        f"Discussion norms matter here: peers must press on each other's reasoning about {f}.",
        f"Materials range from classic sources to current tools, all oriented around {f}.",
        f"Students who enroll should be ready for sustained attention to {f} and for revising unfinished work.",
        f"The syllabus is deliberately uneven in pace—some weeks dig deep into {f}, others synthesize.",
        f"Guest voices (recordings, articles, or local practitioners) periodically reframe how {f} is used.",
        f"Capstone planning begins early so students can shape personal angles on {f}.",
    ]
    if department == "Science":
        openings += [
            f"Labs are not add-ons: most weeks reserve time for designing, measuring, or analyzing work tied to {f}.",
            f"Safety, data notebooks, and uncertainty estimates sit alongside conceptual study of {f}.",
        ]
    if department == "Mathematics":
        openings += [
            f"Problem sets reward multiple solution paths, especially when wrestling with {f}.",
            f"Graphing tools and written justification are both expected when students present work on {f}.",
        ]
    if department in {"Arts", "Music", "Theater"}:
        openings += [
            f"Studio / rehearsal time dominates; reflection journals document decisions related to {f}.",
            f"Public-facing sharings give practice presenting {f} to audiences beyond the classroom.",
        ]
    if department == "Physical Education":
        openings += [
            f"Active class periods emphasize skill cues, conditioning, and sportsmanship around {f}.",
            f"Students track personal goals while practicing {f} in progressive stations or small-sided games.",
        ]
    if department == "Computer Science":
        openings += [
            f"Most days end with running code: debugging sessions make {f} concrete rather than abstract.",
            f"Version control, readability, and testing habits are graded alongside correctness in {f}.",
        ]

    middles = [
        "Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint.",
        "Collaborative days alternate with quiet independent stretches so everyone gets both voices and focus time.",
        "Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well.",
        "Support structures include office hours, peer tutors, and optional extension problems for those who want more.",
        "Assessments mix short quizzes with performance tasks that look more like real work than trap questions.",
        "Students annotate their own errors and resubmit selected pieces after feedback.",
        "Reading loads stay manageable; the heavier lift is interpreting and producing original work.",
        "Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter.",
        "The teacher conferences mid-term to adjust challenge level without watering down standards.",
        "Group roles rotate so no one is permanently the scribe or the spokesperson.",
        "Cross-course connections (when schedules allow) show how the same idea travels across disciplines.",
        "Optional enrichment is posted weekly for students aiming at contests, auditions, or portfolios.",
    ]

    closings = [
        f"By the end, students should explain key ideas in {f} clearly and apply them without a scripted worksheet.",
        f"A final project or exam asks students to integrate what they learned about {f} under modest time pressure.",
        f"Students leave with notes and graded work that document progress on {f}.",
        f"Later courses in the department will assume familiarity with {f}.",
        f"The last stretch of the term prioritizes revision over packing in brand-new material.",
        f"Credit depends on both the summative assessment and consistent participation during class meetings.",
    ]
    if department in {"Arts", "Music", "Theater"}:
        closings = [
            f"A public or classroom showcase makes student work on {f} visible beyond the studio.",
            f"Portfolios and rehearsal notes become the lasting record of progress with {f}.",
            f"Students finish able to describe artistic choices related to {f} with specific language.",
        ] + closings[:2]
    if department == "Physical Education":
        closings = [
            f"Fitness logs and skill checklists show measurable improvement related to {f}.",
            f"Students leave with personal routines they can continue outside class involving {f}.",
        ] + closings[:2]
    if department == "Computer Science":
        closings = [
            f"A working program or project demo anchors the final weeks' focus on {f}.",
            f"Code reviews and write-ups show how students reasoned through problems in {f}.",
        ] + closings[:2]
    if department == "Science":
        closings = [
            f"A lab practical or investigation write-up demonstrates command of {f}.",
            f"Notebooks should show clean data practices alongside conceptual grasp of {f}.",
        ] + closings[:2]

    # Avoid obvious cycling: pick independently with different salts.
    o = openings[h % len(openings)]
    m = middles[h2 % len(middles)]
    c = closings[_h(title, "end") % len(closings)]
    # Occasionally drop the middle for shorter entries (feels more editorial).
    if h % 7 == 0:
        long = f"{o} {c}"
    elif h % 11 == 0:
        long = f"{o} {m}"
    else:
        long = f"{o} {m} {c}"

    # Soften a few short forms that sound meta / templated.
    if short.startswith("Year-round"):
        short = f"{a}."
    if short.startswith("Seminar and studio") and department == "Mathematics":
        short = f"{a}."

    return {
        "title": title,
        "short": short,
        "long": long,
        "grades": grades,
        "max_students": max_students,
        "retakeable": retakeable,
    }


# Each tuple is: title, editorial focus, eligible grades, enrollment cap, retakeable.
_SPECS = {
    "Mathematics": [
        ("Algebra I", "linear equations, functions, and algebraic modeling", "9", 28, False),
        ("Geometry", "deductive proof, spatial reasoning, and geometric measurement", "910", 26, False),
        ("Algebra II", "quadratics, polynomials, exponentials, and logarithms", "1011", 27, False),
        ("Pre-Calculus", "advanced functions, trigonometry, and analytic geometry", "1112", 24, False),
        ("AP Calculus AB", "limits, derivatives, integrals, and their applications", "1112", 22, False),
        ("AP Calculus BC", "series, parametric curves, polar coordinates, and vector functions", "1112", 18, False),
        ("AP Statistics", "data analysis, experimental design, probability, and inference", "1112", 24, False),
        ("Honors Algebra I", "accelerated algebraic reasoning and multi-step function problems", "9", 22, False),
        ("Honors Geometry", "rigorous proof writing, constructions, and geometric transformations", "910", 20, False),
        ("Honors Algebra II", "complex numbers, rational functions, and advanced modeling", "1011", 22, False),
        ("Honors Pre-Calculus", "intensive trigonometry, vectors, sequences, and limits", "1112", 20, False),
        ("Statistics", "descriptive statistics, regression, probability, and basic inference", "1112", 28, False),
        ("Trigonometry", "circular functions, identities, and triangle applications", "1011", 24, False),
        ("Number Theory", "primes, divisibility, modular arithmetic, and cryptography", "1112", 16, False),
        ("Discrete Mathematics", "combinatorics, graph theory, logic, and recurrence", "1112", 18, False),
        ("Multivariable Calculus", "partial derivatives, multiple integrals, and vector calculus", "12", 14, False),
        ("Linear Algebra", "matrices, vector spaces, transformations, and eigenvalues", "12", 16, False),
        ("Differential Equations", "dynamic systems, slope fields, and numerical solution methods", "12", 14, False),
        ("Mathematical Modeling", "iterative models for scientific, civic, and policy questions", "1112", 20, False),
        ("Math Analysis", "function behavior, inverse relationships, sequences, and limits", "11", 22, False),
        ("Finite Mathematics", "linear programming, matrices, Markov chains, and finance", "1112", 26, False),
        ("Financial Mathematics", "interest, annuities, amortization, risk, and investment", "1112", 28, False),
        ("Probability and Statistics", "random variables, simulation, distributions, and inference", "1112", 24, False),
        ("College Algebra", "college-paced polynomial, rational, exponential, and logarithmic functions", "12", 30, False),
        ("Integrated Math I", "an integrated foundation in algebra, geometry, and data", "9", 26, False),
        ("Integrated Math II", "quadratics, similarity, right-triangle trigonometry, and probability", "10", 26, False),
        ("Integrated Math III", "polynomial functions, trigonometry, and statistical reasoning", "11", 24, False),
        ("Precalculus with Trigonometry", "function analysis reinforced by sustained trigonometric practice", "1112", 22, False),
        ("Calculus I", "college-level limits, derivatives, optimization, and curve analysis", "12", 20, False),
        ("Calculus II", "integration techniques, volumes, arc length, and sequences", "12", 16, False),
        ("Graph Theory", "paths, trees, networks, coloring, and graph algorithms", "1112", 16, False),
        ("Game Theory", "payoff matrices, strategic behavior, and equilibrium", "1112", 18, False),
        ("Combinatorics", "advanced counting, inclusion-exclusion, and generating functions", "1112", 16, False),
        ("Mathematical Logic", "propositions, predicates, quantifiers, and proof structures", "1112", 18, False),
        ("Quantitative Reasoning", "data literacy, risk, voting systems, and fair division", "12", 30, False),
        ("Math for Data Science", "vectors, matrices, regression, and computational data analysis", "1112", 20, False),
        ("Competition Math", "creative contest strategies across algebra, geometry, and counting", "9101112", 18, True),
        ("Advanced Problem Solving", "olympiad-style reasoning, elegant proofs, and solution critique", "101112", 12, True),
        ("SAT Math Prep", "timed mathematical reasoning, test strategy, and error analysis", "1112", 32, True),
        ("Geometry and Construction", "compass-and-straightedge constructions supported by proof", "1011", 20, False),
        ("Polynomial Functions", "factoring, complex roots, end behavior, and graph structure", "1011", 22, False),
        ("Exponential and Logarithmic Functions", "growth, decay, logarithmic equations, and applied models", "1112", 24, False),
        ("Matrix Algebra", "row reduction, matrix operations, systems, and transformations", "1112", 20, False),
        ("Real Analysis Seminar", "rigorous limits, continuity, convergence, and epsilon-delta reasoning", "12", 12, False),
        ("Topology for Explorers", "surfaces, continuity, invariants, and rubber-sheet geometry", "12", 14, False),
        ("History of Mathematics", "the development of mathematical notation, proof, and major ideas", "1112", 24, False),
        ("Applied Calculus", "rates of change and accumulation in business and life sciences", "12", 26, False),
        ("Mathematics Research Seminar", "independent conjecture, literature review, proof, and exposition", "12", 12, False),
    ],
    "English": [
        ("English 9", "close reading, analytical paragraphs, grammar, and research foundations", "9", 28, False),
        ("English 10", "world literature, rhetorical analysis, and sustained academic writing", "10", 28, False),
        ("Honors English 9", "accelerated literary analysis, seminar discussion, and polished prose", "9", 22, False),
        ("Honors English 10", "comparative world literature and advanced evidence-based argument", "10", 22, False),
        ("American Literature", "American voices, literary movements, and national identity", "1011", 26, False),
        ("British Literature", "British literary traditions from epic poetry to contemporary fiction", "1112", 24, False),
        ("World Literature", "translated literature, cultural context, and comparative interpretation", "101112", 26, False),
        ("AP English Language and Composition", "rhetorical analysis, argument, synthesis, and nonfiction style", "1112", 22, False),
        ("AP English Literature and Composition", "college-level literary interpretation and timed analytical writing", "1112", 22, False),
        ("Creative Writing Workshop", "fiction, poetry, creative nonfiction, peer critique, and revision", "101112", 18, True),
        ("Journalism", "news judgment, reporting, interviewing, and ethical publication", "9101112", 22, False),
        ("Journalism Lab", "collaborative reporting, editing, layout, and deadline-driven publication", "101112", 16, True),
        ("Shakespeare", "dramatic language, performance choices, history, and close reading", "1112", 20, False),
        ("Modern Drama", "twentieth-century plays, staging, dialogue, and social conflict", "1112", 20, False),
        ("Contemporary Fiction", "recent novels, diverse narrators, form, and cultural debate", "1112", 22, False),
        ("Poetry and Poetics", "poetic form, sound, imagery, interpretation, and original composition", "101112", 18, False),
        ("The Short Story", "compressed narrative, character, point of view, and literary craft", "101112", 22, False),
        ("Mythology and Epic", "heroic traditions, archetypes, oral storytelling, and adaptation", "910", 24, False),
        ("Gothic Literature", "suspense, the uncanny, social anxiety, and Gothic conventions", "1112", 20, False),
        ("Science Fiction and Society", "speculative worlds, technology, power, and social imagination", "101112", 22, False),
        ("Graphic Novels", "sequential art, visual rhetoric, panel design, and literary interpretation", "101112", 20, False),
        ("Literature of the African Diaspora", "diasporic identity, memory, resistance, and literary innovation", "1112", 20, False),
        ("Asian American Literature", "migration, belonging, family, language, and literary form", "1112", 20, False),
        ("Latinx Literature", "bilingual expression, community, history, and narrative voice", "1112", 20, False),
        ("Native American Literature", "Indigenous storytelling, sovereignty, place, and contemporary writing", "1112", 20, False),
        ("Women's Literature", "gender, authorship, literary canon, and intersectional perspectives", "1112", 22, False),
        ("Queer Literature", "identity, community, genre, and LGBTQ+ literary histories", "1112", 18, False),
        ("Literature and the Environment", "place writing, ecological imagination, and environmental justice", "101112", 22, False),
        ("Literature and Film", "adaptation, cinematic language, narrative structure, and interpretation", "1112", 22, False),
        ("Memoir and Personal Essay", "memory, voice, scene, reflection, and ethical life writing", "101112", 18, False),
        ("Public Speaking", "speech organization, delivery, audience analysis, and confidence", "9101112", 20, True),
        ("Argument and Persuasion", "logical claims, credible evidence, counterargument, and civic rhetoric", "101112", 22, False),
        ("Research Writing", "inquiry design, source evaluation, citation, and extended academic prose", "1112", 20, False),
        ("Advanced Composition", "style, structure, revision, and writing for varied audiences", "1112", 18, False),
        ("Grammar and Style", "sentence craft, usage, punctuation, clarity, and rhetorical effect", "910101112", 24, False),
        ("Young Adult Literature", "adolescent identity, genre conventions, readership, and critical response", "101112", 24, False),
        ("Detective Fiction", "mystery structure, clues, deduction, justice, and genre history", "101112", 22, False),
        ("Satire and Comedy", "irony, parody, comic form, cultural criticism, and performance", "1112", 20, False),
        ("Digital Storytelling", "multimodal narrative, audio, image, script, and online publication", "101112", 18, True),
        ("Literary Magazine", "editorial selection, copyediting, design, and creative publication", "101112", 16, True),
    ],
    "Science": [
        ("Biology", "cell biology, genetics, evolution, ecology, and laboratory investigation", "910", 28, False),
        ("Chemistry", "matter, bonding, reactions, stoichiometry, and experimental measurement", "1011", 26, False),
        ("Physics", "motion, forces, energy, waves, electricity, and quantitative experiments", "1112", 24, False),
        ("Honors Biology", "accelerated molecular biology, genetics, evolution, and inquiry labs", "910", 22, False),
        ("Honors Chemistry", "advanced atomic theory, equilibrium, thermochemistry, and quantitative labs", "1011", 22, False),
        ("Honors Physics", "calculus-ready mechanics, electricity, waves, and experimental modeling", "1112", 20, False),
        ("AP Biology", "college-level cellular processes, heredity, evolution, and ecology", "1112", 22, False),
        ("AP Chemistry", "college-level reactions, kinetics, equilibrium, thermodynamics, and analysis", "1112", 20, False),
        ("AP Physics 1", "algebra-based mechanics, energy, momentum, rotation, and waves", "101112", 22, False),
        ("AP Physics 2", "fluids, thermodynamics, electricity, magnetism, optics, and modern physics", "1112", 20, False),
        ("AP Physics C: Mechanics", "calculus-based kinematics, forces, energy, momentum, and rotation", "1112", 18, False),
        ("AP Environmental Science", "ecosystems, resources, pollution, climate, and environmental policy", "101112", 24, False),
        ("Earth Science", "geology, weather, oceans, planetary systems, and field observation", "910", 28, False),
        ("Environmental Science", "ecology, human impacts, conservation, and local field research", "910101112", 26, False),
        ("Anatomy and Physiology", "human body systems, structure, function, and clinical case studies", "1112", 22, False),
        ("Astronomy", "stars, planets, galaxies, cosmology, and observational methods", "101112", 24, False),
        ("Marine Biology", "ocean ecosystems, marine organisms, conservation, and water analysis", "101112", 22, False),
        ("Microbiology", "microbial diversity, culturing, immunity, disease, and biotechnology", "1112", 18, False),
        ("Genetics", "inheritance, gene expression, genomics, variation, and bioethics", "1112", 20, False),
        ("Ecology", "populations, communities, ecosystems, field sampling, and conservation", "101112", 22, False),
        ("Forensic Science", "evidence collection, trace analysis, toxicology, and scientific testimony", "1112", 20, False),
        ("Organic Chemistry", "carbon compounds, functional groups, mechanisms, and synthesis", "12", 16, False),
        ("Biochemistry", "proteins, enzymes, metabolism, molecular structure, and laboratory analysis", "12", 16, False),
        ("Geology", "minerals, rocks, plate tectonics, deep time, and landscape processes", "101112", 24, False),
        ("Meteorology", "atmospheric structure, forecasting, storms, climate, and weather data", "101112", 24, False),
        ("Oceanography", "ocean circulation, seafloor geology, chemistry, and climate connections", "1112", 22, False),
        ("Botany", "plant anatomy, physiology, classification, ecology, and cultivation", "101112", 20, False),
        ("Zoology", "animal diversity, anatomy, behavior, evolution, and classification", "101112", 22, False),
        ("Neuroscience", "neural communication, brain systems, behavior, and research methods", "1112", 18, False),
        ("Epidemiology", "disease patterns, study design, public-health data, and intervention", "1112", 20, False),
        ("Climate Science", "Earth's energy balance, climate records, modeling, and solutions", "101112", 22, False),
        ("Renewable Energy Science", "solar, wind, storage, efficiency, and energy-system tradeoffs", "101112", 22, False),
        ("Science Research Seminar", "experimental design, literature review, data analysis, and scientific communication", "1112", 14, True),
        ("Laboratory Techniques", "measurement, instrumentation, safety, documentation, and quality control", "101112", 18, False),
        ("Paleontology", "fossils, evolution, ancient environments, and geological interpretation", "101112", 20, False),
    ],
    "Computer Science": [
        ("Intro to Computer Science", "algorithms, programming fundamentals, data, and responsible computing", "910101112", 24, False),
        ("AP Computer Science Principles", "creative computing, data, networks, algorithms, and digital impact", "910101112", 24, False),
        ("AP Computer Science A", "object-oriented Java, algorithms, data structures, and program design", "101112", 22, False),
        ("Python Programming", "Python syntax, functions, collections, testing, and small applications", "910101112", 22, False),
        ("Java Programming", "Java classes, control flow, collections, debugging, and application design", "101112", 22, False),
        ("Web Development I", "semantic HTML, modern CSS, JavaScript, accessibility, and deployment", "910101112", 22, False),
        ("Web Development II", "component interfaces, APIs, state management, testing, and performance", "101112", 20, False),
        ("Data Structures and Algorithms", "lists, trees, graphs, complexity, searching, and sorting", "1112", 18, False),
        ("Mobile App Development", "interface design, device APIs, persistence, testing, and release workflows", "101112", 20, False),
        ("Game Programming", "game loops, physics, input, animation, and iterative level design", "101112", 20, True),
        ("Cybersecurity Fundamentals", "threat models, secure systems, cryptography, networks, and ethics", "101112", 20, False),
        ("Advanced Cybersecurity", "penetration testing, incident response, forensics, and defensive engineering", "1112", 16, True),
        ("Artificial Intelligence", "search, classification, neural networks, evaluation, and AI ethics", "1112", 18, False),
        ("Machine Learning", "feature design, supervised learning, validation, and model interpretation", "1112", 16, False),
        ("Data Science", "data cleaning, visualization, statistics, coding, and reproducible analysis", "101112", 20, False),
        ("Database Design", "relational modeling, SQL, normalization, transactions, and application data", "101112", 20, False),
        ("Computer Graphics", "raster images, vectors, transformations, rendering, and visual simulation", "1112", 18, False),
        ("Robotics Programming", "sensors, actuators, feedback, autonomous behavior, and team integration", "910101112", 18, True),
        ("Embedded Systems", "microcontrollers, digital signals, device interfaces, and real-time code", "1112", 16, False),
        ("Computer Networks", "protocols, routing, addressing, distributed communication, and network security", "1112", 18, False),
        ("Operating Systems", "processes, memory, filesystems, concurrency, and system interfaces", "12", 16, False),
        ("Functional Programming", "pure functions, recursion, immutable data, types, and compositional design", "1112", 16, False),
        ("Competitive Programming", "efficient algorithms, timed problem solving, testing, and code review", "101112", 16, True),
        ("Open Source Software", "version control, issue triage, collaborative development, and community norms", "101112", 18, True),
        ("Human-Computer Interaction", "user research, prototyping, accessibility, usability, and interface evaluation", "101112", 20, False),
        ("Cloud Computing", "virtual infrastructure, containers, services, reliability, and deployment", "1112", 18, False),
        ("Software Engineering", "requirements, architecture, teamwork, testing, documentation, and maintenance", "1112", 18, False),
        ("Computer Science Capstone", "independent software planning, implementation, evaluation, and presentation", "12", 14, True),
    ],
    "History": [
        ("World History", "global civilizations, exchange, conflict, and change across eras", "910", 28, False),
        ("United States History", "American political, social, economic, and cultural development", "1011", 28, False),
        ("AP United States History", "college-level American history, primary sources, argument, and historical synthesis", "1112", 24, False),
        ("AP World History: Modern", "global developments, comparison, causation, and document analysis since 1200", "101112", 24, False),
        ("AP European History", "European political, social, intellectual, and economic change since 1450", "1112", 22, False),
        ("Ancient Civilizations", "early societies, belief systems, governance, trade, and archaeology", "910", 26, False),
        ("Medieval History", "feudal societies, religion, trade, migration, and cultural exchange", "101112", 24, False),
        ("Modern European History", "revolution, industrialization, nationalism, empire, and integration", "101112", 24, False),
        ("African History", "African states, trade networks, colonialism, independence, and contemporary change", "101112", 22, False),
        ("East Asian History", "Chinese, Japanese, and Korean states, cultures, exchanges, and transformations", "101112", 22, False),
        ("Latin American History", "Indigenous societies, conquest, independence, inequality, and social movements", "101112", 22, False),
        ("Middle Eastern History", "empires, religions, colonial borders, nationalism, and modern states", "101112", 22, False),
        ("History of South Asia", "empires, religions, colonialism, partition, democracy, and regional change", "101112", 22, False),
        ("History of the Americas", "comparative Indigenous, colonial, revolutionary, and national histories", "101112", 24, False),
        ("The Civil War and Reconstruction", "slavery, secession, warfare, emancipation, and contested reunion", "1112", 20, False),
        ("The Cold War", "ideology, diplomacy, proxy conflict, decolonization, and nuclear risk", "1112", 22, False),
        ("History of Immigration", "migration, law, labor, identity, exclusion, and community formation", "101112", 22, False),
        ("Women's History", "women's work, activism, family life, citizenship, and historical agency", "101112", 22, False),
        ("African American History", "Black life, resistance, institution building, culture, and political struggle", "101112", 22, False),
        ("LGBTQ+ History", "identity, community, law, activism, culture, and historical memory", "1112", 18, False),
        ("Military History", "strategy, technology, logistics, leadership, and the human costs of war", "1112", 22, False),
        ("History Through Film", "historical interpretation, cinematic evidence, memory, and representation", "101112", 24, False),
        ("Oral History Workshop", "interviewing, archival context, transcription, ethics, and public storytelling", "101112", 16, True),
        ("Local History Research", "archives, maps, material culture, community memory, and public history", "101112", 18, True),
    ],
    "World Languages": [
        ("Spanish I", "foundational Spanish conversation, listening, reading, writing, and culture", "910101112", 24, False),
        ("Spanish II", "expanding Spanish communication, narration, grammar, and cultural knowledge", "910101112", 24, False),
        ("Spanish III", "intermediate Spanish fluency, authentic texts, and extended conversation", "101112", 22, False),
        ("Spanish IV", "advanced Spanish discussion, composition, literature, and cultural analysis", "1112", 20, False),
        ("AP Spanish Language and Culture", "college-level Spanish communication, cultural comparison, and persuasive writing", "1112", 18, False),
        ("French I", "foundational French communication, pronunciation, literacy, and Francophone cultures", "910101112", 24, False),
        ("French II", "developing French narration, listening, grammar, and cultural understanding", "910101112", 24, False),
        ("French III", "intermediate French conversation, authentic media, and sustained writing", "101112", 22, False),
        ("French IV", "advanced French expression, literature, film, and cultural inquiry", "1112", 20, False),
        ("AP French Language and Culture", "college-level French communication, interpretation, and cultural comparison", "1112", 18, False),
        ("Mandarin Chinese I", "foundational Mandarin speaking, listening, characters, and cultural practices", "910101112", 22, False),
        ("Mandarin Chinese II", "developing Mandarin conversation, character literacy, and everyday communication", "910101112", 22, False),
        ("Mandarin Chinese III", "intermediate Mandarin fluency, authentic texts, and cultural discussion", "101112", 20, False),
        ("AP Chinese Language and Culture", "advanced Mandarin communication, interpretation, and cultural knowledge", "1112", 18, False),
        ("Latin I", "classical vocabulary, grammar, translation, mythology, and Roman culture", "910101112", 24, False),
        ("Latin II", "intermediate Latin syntax, translation strategies, history, and literature", "910101112", 22, False),
        ("Latin III", "advanced Latin prose and poetry, rhetoric, and historical context", "101112", 20, False),
        ("Japanese I", "foundational Japanese conversation, kana, introductory kanji, and culture", "910101112", 22, False),
        ("Japanese II", "developing Japanese communication, kanji, grammar, and cultural fluency", "101112", 20, False),
        ("American Sign Language I", "foundational signing, receptive skills, Deaf culture, and visual grammar", "910101112", 20, False),
    ],
    "Arts": [
        ("Studio Art I", "drawing, painting, composition, observation, and creative process", "910101112", 20, True),
        ("Studio Art II", "advanced studio techniques, personal voice, critique, and portfolio development", "101112", 18, True),
        ("AP Studio Art: Drawing", "sustained drawing inquiry, experimentation, revision, and portfolio curation", "1112", 16, False),
        ("Ceramics Studio", "hand-building, wheel throwing, glazing, firing, and ceramic design", "910101112", 16, True),
        ("Sculpture", "three-dimensional form, construction, carving, casting, and installation", "101112", 16, True),
        ("Painting", "color, surface, composition, materials, and expressive visual language", "101112", 18, True),
        ("Drawing and Illustration", "observational drawing, visual storytelling, media, and illustration techniques", "910101112", 20, True),
        ("Printmaking", "relief, intaglio, screen printing, editions, and graphic composition", "101112", 16, True),
        ("Digital Photography", "camera controls, composition, lighting, editing, and visual narrative", "910101112", 18, True),
        ("Film Photography", "manual exposure, darkroom printing, composition, and photographic history", "101112", 14, True),
        ("Graphic Design", "typography, layout, branding, hierarchy, and visual communication", "101112", 18, False),
        ("Digital Art", "raster and vector tools, digital painting, collage, and creative workflow", "910101112", 20, True),
        ("Art History", "global visual traditions, formal analysis, context, and museum interpretation", "101112", 24, False),
        ("Fashion Design", "textiles, garment concepts, sketching, construction, and sustainable design", "101112", 16, True),
        ("Portfolio Development", "personal artistic direction, advanced revision, documentation, and presentation", "1112", 14, True),
    ],
    "Physical Education": [
        ("Physical Education Foundations", "fitness principles, movement skills, teamwork, and lifelong activity", "9", 30, False),
        ("Strength Training", "safe resistance technique, program design, mobility, and progressive training", "910101112", 24, True),
        ("Yoga Fitness", "posture, mobility, breath, balance, and mindful conditioning", "910101112", 24, True),
        ("Team Sports", "rules, strategy, communication, sportsmanship, and varied team games", "910101112", 30, True),
        ("Individual Sports", "self-paced skill development in racquet, target, and lifetime activities", "910101112", 28, True),
        ("Basketball Skills", "ball handling, shooting, defense, tactics, and cooperative play", "910101112", 24, True),
        ("Soccer Skills", "touch, passing, movement, defending, tactics, and match play", "910101112", 26, True),
        ("Swimming and Water Safety", "stroke technique, endurance, rescue awareness, and aquatic confidence", "910101112", 20, True),
        ("Outdoor Education", "navigation, low-impact travel, risk management, and environmental stewardship", "101112", 20, True),
        ("Dance Fitness", "rhythm, coordination, cardiovascular conditioning, and movement sequences", "910101112", 24, True),
        ("Personal Fitness", "goal setting, fitness assessment, training principles, and healthy routines", "101112", 24, True),
        ("Sports Performance", "speed, agility, power, recovery, and sport-specific conditioning", "101112", 20, True),
        ("Lifetime Recreation", "accessible recreational activities, wellness planning, and active leisure", "1112", 28, True),
    ],
    "Social Sciences": [
        ("AP Psychology", "behavior, cognition, development, research methods, and psychological science", "1112", 24, False),
        ("Psychology", "human thought, emotion, behavior, development, and research literacy", "101112", 26, False),
        ("Sociology", "social institutions, culture, inequality, groups, and sociological research", "101112", 26, False),
        ("AP Human Geography", "spatial patterns, population, culture, cities, and development", "910101112", 26, False),
        ("Cultural Anthropology", "culture, kinship, belief, language, fieldwork, and human diversity", "101112", 22, False),
        ("Economics", "markets, incentives, public policy, personal choice, and economic evidence", "1112", 28, False),
        ("AP Macroeconomics", "national output, inflation, unemployment, fiscal policy, and monetary policy", "1112", 24, False),
        ("AP Microeconomics", "consumer choice, firms, market structures, efficiency, and government intervention", "1112", 24, False),
        ("Political Science", "institutions, power, ideology, participation, and comparative government", "101112", 24, False),
        ("Criminology", "crime theories, justice institutions, evidence, policy, and social context", "1112", 22, False),
        ("Human Development", "physical, cognitive, emotional, and social change across the lifespan", "101112", 24, False),
        ("Social Justice Studies", "inequality, identity, institutions, movements, and community-based inquiry", "101112", 22, False),
        ("Urban Studies", "cities, housing, transportation, public space, inequality, and planning", "1112", 20, False),
        ("Global Studies", "interdependence, development, migration, conflict, and international cooperation", "101112", 24, False),
    ],
    "Engineering": [
        ("Introduction to Engineering Design", "design process, technical sketching, prototyping, testing, and documentation", "910101112", 22, False),
        ("Principles of Engineering", "mechanics, energy, systems, materials, controls, and design analysis", "101112", 20, False),
        ("Mechanical Engineering", "forces, mechanisms, machine elements, fabrication, and iterative testing", "101112", 18, False),
        ("Electrical Engineering", "circuits, sensors, signals, measurement, and electronic prototyping", "101112", 18, False),
        ("Civil Engineering and Architecture", "structures, sites, materials, drafting, and sustainable built environments", "101112", 20, False),
        ("Aerospace Engineering", "aerodynamics, propulsion, flight stability, orbital systems, and testing", "1112", 18, False),
        ("Biomedical Engineering", "human-centered devices, biomechanics, biomaterials, and design ethics", "1112", 18, False),
        ("Environmental Engineering", "water, waste, air quality, remediation, and sustainable systems", "101112", 20, False),
        ("Robotics Engineering", "mechanical design, electronics, controls, fabrication, and team competition", "910101112", 18, True),
        ("Computer-Aided Design", "parametric modeling, technical drawings, assemblies, and design communication", "910101112", 20, True),
        ("Materials Science and Engineering", "material structure, properties, selection, failure, and testing", "1112", 18, False),
        ("Engineering Capstone", "client-centered design, project management, prototyping, validation, and presentation", "12", 14, True),
    ],
    "Music": [
        ("Concert Choir", "ensemble singing, vocal technique, sight-reading, and varied choral repertoire", "910101112", 30, True),
        ("Concert Band", "wind ensemble performance, tone, musicianship, rehearsal, and concert repertoire", "910101112", 36, True),
        ("String Orchestra", "orchestral strings, ensemble balance, technique, interpretation, and performance", "910101112", 36, True),
        ("Jazz Ensemble", "improvisation, swing, ensemble style, transcription, and performance", "101112", 24, True),
        ("Music Theory", "notation, harmony, ear training, analysis, and composition", "101112", 20, False),
        ("AP Music Theory", "college-level harmony, part writing, aural skills, analysis, and sight-singing", "1112", 18, False),
        ("Songwriting", "lyrics, melody, harmony, arrangement, demo production, and peer feedback", "101112", 16, True),
        ("Music Production", "recording, editing, mixing, acoustics, arrangement, and studio workflow", "101112", 16, True),
    ],
    "Theater": [
        ("Theater Arts I", "acting foundations, ensemble practice, script analysis, and stage vocabulary", "910101112", 22, True),
        ("Acting Studio", "character, objective, voice, movement, scene study, and rehearsal discipline", "101112", 18, True),
        ("Technical Theater", "scenery, lighting, sound, costumes, safety, and production teamwork", "910101112", 18, True),
        ("Musical Theater", "integrated acting, singing, movement, audition skills, and performance", "101112", 20, True),
        ("Directing", "script interpretation, staging, actor communication, rehearsal planning, and leadership", "1112", 16, False),
        ("Playwriting", "dramatic structure, dialogue, character, workshop feedback, and revision", "101112", 16, True),
        ("Theater Production", "full-production rehearsal, design collaboration, stage management, and public performance", "101112", 24, True),
    ],
    "Business": [
        ("Introduction to Business", "business functions, ownership, markets, operations, and workplace decision making", "910101112", 28, False),
        ("Entrepreneurship", "opportunity discovery, customer research, business models, pitching, and iteration", "101112", 22, True),
        ("Marketing", "audience research, positioning, brand strategy, promotion, and campaign measurement", "101112", 24, False),
        ("Accounting I", "financial statements, transactions, ledgers, controls, and business reporting", "101112", 24, False),
        ("Personal Finance", "budgeting, credit, taxes, insurance, investing, and financial decision making", "101112", 30, False),
        ("Business Law", "contracts, employment, consumer protection, business ethics, and legal reasoning", "1112", 24, False),
        ("Sports and Entertainment Management", "events, sponsorship, budgeting, promotion, operations, and audience experience", "101112", 24, True),
    ],
    "Media Studies": [
        ("Media Literacy", "source evaluation, representation, algorithms, persuasion, and responsible participation", "910101112", 26, False),
        ("Film Studies", "film language, genre, history, criticism, and cultural interpretation", "101112", 22, False),
        ("Podcasting and Audio Storytelling", "reporting, scripting, interviewing, sound design, editing, and distribution", "101112", 18, True),
        ("Documentary Production", "nonfiction research, ethics, cinematography, editing, and public screening", "1112", 16, True),
    ],
    "Philosophy": [
        ("Introduction to Philosophy", "fundamental questions, argument analysis, close reading, and philosophical dialogue", "101112", 22, False),
        ("Ethics", "moral theories, applied dilemmas, reasoned judgment, and respectful disagreement", "101112", 22, False),
        ("Logic and Critical Thinking", "argument structure, validity, fallacies, evidence, and precise reasoning", "910101112", 24, False),
        ("Philosophy of Mind", "consciousness, identity, perception, artificial intelligence, and personal agency", "1112", 18, False),
        ("Political Philosophy", "justice, liberty, equality, authority, rights, and civic obligation", "1112", 20, False),
    ],
    "Health": [
        ("Health Education", "physical, mental, social, and community dimensions of lifelong wellness", "9", 28, False),
        ("Nutrition and Wellness", "nutrients, food systems, energy balance, habits, and evidence-based choices", "910101112", 26, False),
        ("Mental Health and Wellbeing", "stress, resilience, relationships, help-seeking, and stigma reduction", "101112", 22, False),
        ("First Aid and CPR", "emergency assessment, injury response, CPR, AED use, and prevention", "910101112", 18, True),
        ("Public Health", "population health, prevention, disparities, epidemiology, and community intervention", "1112", 22, False),
    ],
    "Debate": [
        ("Introduction to Debate", "claim construction, evidence, refutation, delivery, and tournament formats", "910101112", 20, True),
        ("Policy Debate", "policy research, case construction, cross-examination, strategy, and competition", "101112", 16, True),
        ("Lincoln-Douglas Debate", "value conflict, philosophical frameworks, evidence, refutation, and competition", "101112", 16, True),
        ("Public Forum Debate", "current-events research, concise advocacy, teamwork, and audience adaptation", "910101112", 18, True),
        ("Speech and Debate Team", "competitive speaking events, debate preparation, peer coaching, and tournament reflection", "910101112", 20, True),
    ],
}


COURSES_BY_DEPT: dict[str, list[dict]] = {}
for _department, _entries in _SPECS.items():
    COURSES_BY_DEPT[_department] = []
    for _title, _focus, _grades, _cap, _retakeable in _entries:
        COURSES_BY_DEPT[_department].append(
            _course(
                _title,
                _focus,
                _grades,
                _cap,
                _retakeable,
                department=_department,
            )
        )


FOUNDATIONS = [
    "Algebra I",
    "Geometry",
    "English 9",
    "Biology",
    "World History",
    "Intro to Computer Science",
    "Spanish I",
    "Chemistry",
    "Algebra II",
    "English 10",
]

TEACHER_FIRST = [
    "Avery", "Maya", "Liam", "Sofia", "Noah", "Zoe", "Ethan", "Amara",
    "Lucas", "Nina", "Mateo", "Chloe", "Julian", "Priya", "Owen", "Layla",
    "Caleb", "Elena", "Miles", "Iris", "Henry", "Naomi", "Leo", "Camila",
    "Jonah", "Aisha", "Theo", "Mia", "Simon", "Ruby", "Adrian", "Leila",
    "Dylan", "Fatima", "Isaac", "Grace", "Nico", "Hana", "Samuel", "Eva",
]

TEACHER_LAST = [
    "Anderson", "Bennett", "Chen", "Diaz", "Edwards", "Foster", "Garcia", "Hughes",
    "Ibrahim", "Johnson", "Kim", "Lopez", "Mitchell", "Nguyen", "Owens", "Patel",
    "Quinn", "Rivera", "Singh", "Thompson", "Ueda", "Vasquez", "Williams", "Xu",
    "Young", "Zimmerman", "Brooks", "Campbell", "Desai", "Evans", "Flores", "Green",
    "Hernandez", "Ito", "Khan", "Lewis", "Morgan", "Nakamura", "Ortiz", "Price",
]

INDEPENDENT_OFFERINGS = [
    ("Studio Art I", [1, 2, 3]),
    ("Ceramics Studio", [2, 4]),
    ("Strength Training", [1, 3]),
    ("Yoga Fitness", [2, 4]),
    ("Concert Choir", [1, 2, 3]),
    ("Digital Photography", [1, 4]),
    ("Journalism Lab", [2, 3]),
    ("Technical Theater", [1, 2]),
]


del _department, _entries, _title, _focus, _grades, _cap, _retakeable
