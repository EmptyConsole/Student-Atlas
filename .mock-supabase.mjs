import http from "node:http";

const S = "11111111-1111-4111-8111-111111111111";
const T1 = "22222222-2222-4222-8222-222222222221";
const T2 = "22222222-2222-4222-8222-222222222222";
const id = (n) => `33333333-3333-4333-8333-${String(n).padStart(12, "0")}`;
const now = "2026-01-01T00:00:00Z";

const schools = [
  {
    id: S, name: "Demo High School", city: "Springfield", state: "IL", website: "",
    created_at: now, electives_assigned: 2, rankings: 3,
    grade: { 9: { rankings: "3", assigned: "2" }, 10: { rankings: "3", assigned: "2" }, 11: { rankings: "3", assigned: "2" }, 12: { rankings: "3", assigned: "2" } },
  },
];
const terms = [
  { id: T1, name: "Fall", position: 1, created_at: now, school_id: S },
  { id: T2, name: "Spring", position: 2, created_at: now, school_id: S },
];
const departments = [
  ["Computer Science", "Code, data, and digital making", "1 credit of computer science"],
  ["Visual Arts", "Studio, design, and media courses", "1 credit of fine arts"],
  ["English", "Reading, writing, and speaking", "4 credits of English"],
  ["Science", "Lab sciences and research", null],
].map(([name, subtitle, graduation_requirement], i) => ({
  id: `44444444-4444-4444-8444-00000000000${i}`, name, subtitle, graduation_requirement,
  school_id: S, code: null, created_at: `2026-01-0${i + 1}T00:00:00Z`,
}));

const c = (n, subject, title, grade, term_options, extra = {}) => ({
  id: id(n), subject, title, grade, term_options, school_id: S, created_at: now,
  short_description: `A practical ${title.toLowerCase()} course for students who want hands-on work.`,
  long_description: `In ${title}, students build real projects, work in small teams, and present their results. The course covers core ideas step by step and ends with a final showcase.`,
  max_student_count: 24, retakeable: false, teacher_id: null, prereq_options: null, coreq_options: null,
  schedule: null, department_id: null, custom_coreq: null, custom_prereq: null, or_coreq: false, or_prereq: false, term: "", term_id: null,
  ...extra,
});
const courses = [
  c(1, "Computer Science", "Intro to Programming", [9, 10, 11, 12], [T1]),
  c(2, "Computer Science", "Web Design", [10, 11, 12], [T2], { prereq_options: [[id(1)]] }),
  c(3, "Computer Science", "AP Computer Science A", [11, 12], [T1, T2], { prereq_options: [[id(1)]] }),
  c(4, "Computer Science", "Robotics", [9, 10, 11, 12], [T1]),
  c(5, "Visual Arts", "Drawing and Painting", [9, 10, 11, 12], [T1]),
  c(6, "Visual Arts", "Digital Photography", [10, 11, 12], [T2], { retakeable: true }),
  c(7, "Visual Arts", "Ceramics", [9, 10, 11, 12], [T2]),
  c(8, "English", "Creative Writing", [10, 11, 12], [T1]),
  c(9, "English", "Journalism", [9, 10, 11, 12], [T2]),
  c(10, "Science", "Marine Biology", [11, 12], [T1]),
  c(11, "Science", "Forensic Science", [10, 11, 12], [T2], { coreq_options: [["Biology"]] }),
];
const tables = { schools, terms, departments, courses, teachers: [] };

http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Content-Range");
    if (req.method === "OPTIONS") return res.end();
    const url = new URL(req.url, "http://x");
    const table = url.pathname.replace("/rest/v1/", "");
    let rows = tables[table] ?? [];
    const idFilter = url.searchParams.get("id");
    if (idFilter?.startsWith("eq.")) rows = rows.filter((r) => r.id === idFilter.slice(3));
    res.setHeader("Content-Type", "application/json");
    const single = (req.headers.accept ?? "").includes("vnd.pgrst.object");
    res.end(JSON.stringify(single ? rows[0] ?? null : rows));
  })
  .listen(54399, () => console.log("mock supabase on 54399"));
