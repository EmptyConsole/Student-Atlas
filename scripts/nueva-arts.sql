-- The Nueva School — 2026–2027 Arts import (Performing Arts + Visual Arts)
--
-- Arts-only companion to scripts/nueva-school.sql. It (re)builds just the Arts
-- side of the catalog so the sidebar bookmarks/subjects match the app:
--   Arts (umbrella tab), Performing Arts, Visual Arts
--
-- A course appears under a sidebar tab when its `subject` text equals a
-- `departments.name` (see src/hooks/useSubjects.ts + src/components/Sidebar.tsx),
-- so every art course is filed under "Performing Arts" or "Visual Arts". The
-- Fine Arts Teaching Fellowship lives under "Visual Arts" (not a standalone tab).
--
-- Mapping:
--   Term:  "Fall & Spring" -> both | "Fall Only" -> fall | "Spring Only" -> spring | "Yearlong" -> all-year
--   Grade: "9th-12th" -> {9,10,11,12}, "11th-12th" -> {11,12}, ...
--   Repeatable: Yes/No -> courses.retakeable
--   teacher_id: NULL (no instructors listed in the catalog)
--   Prerequisites: best-effort links to catalog courses; non-course requirements
--     (e.g. "must play an instrument", "any 2 full visual art courses") stay in
--     the description only and unmatched rows are silently skipped.
--
-- Assumes "The Nueva School" already exists (from scripts/nueva-school.sql).
-- Idempotent for the Arts subset: it deletes existing Nueva arts courses (and
-- their prerequisite/corequisite links) before re-inserting, so it is safe to
-- re-run and it also cleans up the miscategorized arts rows from the first import.
-- Wrapped in a single transaction.

BEGIN;

----------------------------------------------------------------------
-- 1. Departments (create the arts tabs if missing; leave others untouched)
----------------------------------------------------------------------
INSERT INTO departments (school_id, name, code, graduation_requirement)
SELECT s.id, v.name, v.code, v.graduation_requirement
FROM schools s
CROSS JOIN (
  VALUES
    ($c$Arts$c$, $c$ARTS$c$, $c$One year of arts: two semesters of any two Performing Arts electives, OR two semesters (Intro & Advanced) in the same Visual Arts medium.$c$),
    ($c$Performing Arts$c$, $c$PERF$c$, $c$Two semesters of any two Performing Arts courses.$c$),
    ($c$Visual Arts$c$, $c$VART$c$, $c$Two semesters—Intro & Advanced—in the same visual arts medium.$c$)
) AS v(name, code, graduation_requirement)
WHERE s.name = $c$The Nueva School$c$
  AND NOT EXISTS (
    SELECT 1 FROM departments d
    WHERE d.school_id = s.id AND d.name = v.name
  );

----------------------------------------------------------------------
-- 2. Clean up any existing Nueva arts courses (and their links) so this
--    file can be re-run and supersedes the arts rows from nueva-school.sql
----------------------------------------------------------------------
DELETE FROM course_prerequisites cp
USING courses c
JOIN schools s ON s.id = c.school_id
WHERE cp.course_id = c.id
  AND s.name = $c$The Nueva School$c$
  AND c.subject IN ($c$Arts$c$, $c$Performing Arts$c$, $c$Visual Arts$c$);

DELETE FROM course_prerequisites cp
USING courses p
JOIN schools s ON s.id = p.school_id
WHERE cp.prerequisite_course_id = p.id
  AND s.name = $c$The Nueva School$c$
  AND p.subject IN ($c$Arts$c$, $c$Performing Arts$c$, $c$Visual Arts$c$);

DELETE FROM course_corequisites cc
USING courses c
JOIN schools s ON s.id = c.school_id
WHERE cc.course_id = c.id
  AND s.name = $c$The Nueva School$c$
  AND c.subject IN ($c$Arts$c$, $c$Performing Arts$c$, $c$Visual Arts$c$);

DELETE FROM course_corequisites cc
USING courses co
JOIN schools s ON s.id = co.school_id
WHERE cc.corequisite_course_id = co.id
  AND s.name = $c$The Nueva School$c$
  AND co.subject IN ($c$Arts$c$, $c$Performing Arts$c$, $c$Visual Arts$c$);

DELETE FROM courses c
USING schools s
WHERE c.school_id = s.id
  AND s.name = $c$The Nueva School$c$
  AND c.subject IN ($c$Arts$c$, $c$Performing Arts$c$, $c$Visual Arts$c$);

----------------------------------------------------------------------
-- 3. Courses (subject == department name so cards land under the right tab)
----------------------------------------------------------------------
INSERT INTO courses (school_id, department_id, term_id, title, subject, term, grade, retakeable, short_description, long_description, teacher_id)
SELECT s.id, d.id, t.id, x.title, x.subject, x.season, x.grade, x.retakeable, x.short_description, x.long_description, NULL
FROM (
  VALUES
  -- ============================= PERFORMING ARTS =============================
  ($c$Dance$c$, $c$Performing Arts$c$, $c$Performing Arts$c$, $c$both$c$, $c${9,10,11,12}$c$::int[], true,
   $c$An energetic, physically active exploration of dance across jazz, ballet, and a class-chosen style, culminating in a performance.$c$,
   $c$This course is an energetic exploration of dance. Divided into three parts over the course of the semester, students will immerse themselves in three different styles of dance: jazz, ballet and a style chosen by the class (tap, hip hop, contemporary, musical theatre, modern, or any other popular requests from students). We will explore the historical background of each style of dance, watch and learn from performances and notable performers and then learn the technique of each style. This elective is physically active and students will be encouraged to explore creativity with movement. Each class will involve a warm up, a focus on dance technique and learning choreography in each style. We will end the semester in a culmination performance of at least one of our dances. Students will receive PE credit for the full year for taking this elective.$c$),

  ($c$Fall Production$c$, $c$Performing Arts$c$, $c$Performing Arts$c$, $c$fall$c$, $c${9,10,11,12}$c$::int[], true,
   $c$Rehearse, stage, and present a full-length play, with roles for actors, tech crew, and design teams.$c$,
   $c$Fall Production is open to all students and will offer the opportunity to rehearse, stage, and present a full-length play. Students are encouraged to contribute in ways beyond just acting, and there will be opportunities available during the rehearsal and production process for people of diverse talents and interests, including tech crew and design teams. We will begin by workshopping two different scripts and students will vote on which play we produce and perform. We will then move into academic and dramaturgical work, transitioning to the creative processes of interpretation, blocking, staging, and performance as we ready the play to be presented to the wider community. Rehearsals will be held during class time, with 2-3 after-school sessions per week, culminating in an immersive Tech Week. Any time we have left in the semester after our production will be spent doing theatrical workshops, additional acting scenes, or other opportunities to work on scripts. NOTE: All performances and technical rehearsals, which take place after school, are mandatory.$c$),

  ($c$Groove Workshop$c$, $c$Performing Arts$c$, $c$Performing Arts$c$, $c$both$c$, $c${9,10,11,12}$c$::int[], true,
   $c$A music performance workshop on how to form and maintain a band, covering song structure, rehearsal, and performance.$c$,
   $c$Groove Workshop is a music performance workshop designed to teach students how to form and maintain a band — in other words, how to rock! Areas covered will include analysis of song form and structure, rehearsal methods, chart writing, equipment setup, and performance tips and tricks. A big part of being in a successful band is having the ability to communicate and be open to the ideas of others. Making music is a great way to create bonds and build teamwork. This class gives students that opportunity. Goals: master the songs we choose to learn, develop proficiency as musicians through playing challenging music, learn to play well as a band, and perform both at Nueva and in the community. As this is considered an advanced group, students are expected to be proficient at all their individual parts for each song we learn. NOTE: Any and all outside school performances are mandatory. Prerequisites: None, but some musical experience is encouraged.$c$),

  ($c$Hit Harmonics: Studio Recording from Idea to Record$c$, $c$Performing Arts$c$, $c$Performing Arts$c$, $c$both$c$, $c${9,10,11,12}$c$::int[], true,
   $c$A studio-based course exploring how songs are built and why they resonate, through analysis, ear training, and hands-on production.$c$,
   $c$Hit Harmonics is a studio-based music course exploring how songs are built and why they resonate. Through close listening, song analysis, ear training, lyric study, and hands-on production, students examine the rhythmic, harmonic, lyrical, melodic, and structural choices that shape emotional impact. Using the full capabilities of the Upper School recording studio, students analyze influential recordings and apply those insights through original compositions, creative reinterpretations, and the collaborative production of a class-built track. Throughout the semester, students contribute to a shared class sound library, developing a curated collection of grooves, harmonies, textures, and recorded material that becomes a living resource for composition. By semester's end, students will have produced finished works, including a collaborative class song, and developed a deeper understanding of how musical decisions shape the listener's experience.$c$),

  ($c$Intro to Music Production$c$, $c$Performing Arts$c$, $c$Performing Arts$c$, $c$both$c$, $c${9,10,11,12}$c$::int[], true,
   $c$Learn the fundamentals of music production using Ableton Live, from MIDI programming to recording and sound design.$c$,
   $c$Students will learn how to create any type of music that they can dream of, using imagination and the program Ableton Live. Students will learn the fundamental concepts of music production, covering everything from programming electronic compositions using MIDI to recording live instruments and vocals to designing, engineering, and automating their own sounds. Students use musical examples from the industry to understand certain concepts in digital production and learn how to design and produce music using their own sounds and patches. Course assignments include creating musical compositions or designing sounds and patches for future productions using Ableton and are flexible in regard to genre and style (electronic vs. live). The course will model a workshop environment, as we will listen to and discuss student projects as a group. At the end of the course, students produce a final original song at full length.$c$),

  ($c$Jazz Ensemble$c$, $c$Performing Arts$c$, $c$Performing Arts$c$, $c$both$c$, $c${9,10,11,12}$c$::int[], true,
   $c$Study and perform jazz styles including blues, swing, Latin, and Brazilian, with an emphasis on improvisation. Students must play an instrument.$c$,
   $c$Jazz Ensemble will study and perform various jazz stylings, including blues, swing, Latin, Brazilian, and calypso. Each style will be explored historically, theoretically, and in performance. Emphasis will be on the basic concepts of each style as well as improvisation. Students will be exposed to "standards," the classic compositions that are an integral part of any jazz musician's vocabulary. In addition to performing at the upper school arts culmination in December, we will look for other opportunities to perform at open houses and informal lunch concerts and morning meetings. Grading will be based on attendance and participation in class. The Jazz Ensemble is designed to increase a student's musical proficiency, rhythmic vocabulary, ability to improvise, knowledge of theory, and understanding of that uniquely American art form — jazz. NOTE: Any and all outside school performances are mandatory. Prerequisite: Student must play an instrument.$c$),

  ($c$Musical Theater$c$, $c$Performing Arts$c$, $c$Performing Arts$c$, $c$spring$c$, $c${9,10,11,12}$c$::int[], true,
   $c$Core rehearsal for the spring musical, exploring acting, voice, movement, and characterization, with tech-team options.$c$,
   $c$This elective is open to anyone interested in performing in the spring musical; it is also open to students with a strong interest in the production end of things (e.g., stage managing, tech, etc.). We will begin by workshopping two different scripts and students will vote on which musical we end up producing and performing. While the class serves as core rehearsal time, it also explores key components of acting, including voice work (breathing, articulation, projection, vocal blending, and musicality), stage movement (choreography, blocking, stage picture, and physicality of character) and characterization (focus and concentration, improvisation, open scene work, subtext, motivation, emotional range). Each student also has the opportunity to be a part of a tech team (costumes, props, assistant directing, sound, set design, etc) to help our show come to life. Note: students in this elective will receive 2 units of P.E. credit. NOTE: There will be two after school rehearsals per week for the first part of the semester, moving to three closer to the show, culminating in an immersive tech week and a performance weekend. All performances and technical rehearsals are mandatory.$c$),

  ($c$Sound Experience$c$, $c$Performing Arts$c$, $c$Performing Arts$c$, $c$both$c$, $c${9,10,11,12}$c$::int[], true,
   $c$Explore how sound works, from the physics of vibration to digital audio production, field recording, and sound design.$c$,
   $c$In this course, students will explore how sound works—from the physics of vibration and waveforms to the emotional impact of music and auditory storytelling. We will cover a wide range of topics, including psychoacoustics, digital audio production, field recording, and sound design. One primary focus will be studying and creating sounds for video—from sound effects (Foley) to film scores. Students will gain hands-on experience working with a Digital Audio Workstation (DAW), microphones, and recording gear as they learn how to shape sound for different artistic and communicative purposes. The course will culminate in a final project where students create an original audio experience or research-based presentation. Students who play instruments will be encouraged to incorporate their musical abilities into their work.$c$),

  ($c$Steel Drum Band$c$, $c$Performing Arts$c$, $c$Performing Arts$c$, $c$both$c$, $c${9,10,11,12}$c$::int[], true,
   $c$Develop an advanced steel drum ensemble playing complex arrangements across a variety of musical styles.$c$,
   $c$The steel band will explore a variety of music styles, potentially learning compositions by Trinidadian steel drum virtuoso Robert Greenidge. In addition to learning the calypso stylings of Robert's music, we will most likely do several Santana tunes as well as music by Sting and Bill Withers. While the exact composers and compositions may vary by semester, the rhythms of each style present different challenges for each section of the band. The goal of the class is to develop an advanced steel drum ensemble for the high school that will play complex arrangements in a variety of musical styles. The ensemble will perform at school and in the community throughout the year, including the upper school arts culmination in early December. Students will also research the history of the instrument, its cultural significance, its pioneers, and its greatest composers and performers. NOTE: Any and all outside school performances are mandatory.$c$),

  -- ============================= VISUAL ARTS =============================
  ($c$Intro to Art & Fabrication$c$, $c$Visual Arts$c$, $c$Visual Arts$c$, $c$fall$c$, $c${9,10,11,12}$c$::int[], true,
   $c$A semester course combining visual art and fabrication, using hand tools, power tools, and varied materials.$c$,
   $c$This semester-long course combines the fields of visual art and fabrication. Students in this course work in a variety of media to create projects that demonstrate understanding and consideration of craftsmanship and the elements and principles of visual art, including space, form, balance, light, and contrast. Students gain firsthand knowledge and experience with construction by using a variety of hand tools, power tools, and materials, such as the hand drill, chop saw, band saw, belt and orbital sanders, wire, foam, wood, and sheet metal. Emphasis is placed on appropriate use of tools and safety. Students create work that can range from representational to abstract; it might be inspired by historical or contemporary artists and art movements. Through readings, slide presentations, and visiting artists, students consider the context in which they are creating art. Students participate in critiques as a means to develop critical thinking skills and to further understand the meaning in their work.$c$),

  ($c$Intro to Clay Sculpture$c$, $c$Visual Arts$c$, $c$Visual Arts$c$, $c$fall$c$, $c${9,10,11,12}$c$::int[], true,
   $c$A studio class exploring three-dimensional thinking with clay as the primary medium, for beginners and experienced students alike.$c$,
   $c$Intro to Sculpture is a studio class that explores ways of thinking three-dimensionally, with clay as the primary medium. It serves the needs of beginners and experienced students of art. In addition to sculpture techniques, the elements of the three-dimensional art and design will be studied as they apply to the projects at hand. Students work in both subtractive and additive manners, incorporating basic aesthetic concepts such as line, texture, composition, balance, mass, space, rhythm, tension, movement, light, and density. Students explore the relationship between form and content in materials through hand-building techniques in clay. Projects investigate representation (people and things), abstraction, and architecturally inspired design/installation. Students are encouraged to think about the conceptual possibilities of sculpture and expressing a personal point of view. Students participate in a culminating upper school gallery showing, presentations, and critiques.$c$),

  ($c$Intro to Drawing$c$, $c$Visual Arts$c$, $c$Visual Arts$c$, $c$fall$c$, $c${9,10,11,12}$c$::int[], true,
   $c$A studio course focused on technical drawing skill and mark-making across a variety of media.$c$,
   $c$Drawing considers our perception, observation, and knowing of the world around us. It is a method of recording and expression in a visual language all its own. This studio course focuses on technical skill as well as mark-making as a form of creative exploration. Students will examine their interests and ideas through visual representation, working both technically and intuitively. Though class time will include lessons and discussions, students will typically be working on projects using a variety of drawing media, including (but not limited to) graphite, charcoal, and colored pencil. Studio time encourages a quiet focus and provides the necessary hours to build and refine the connection between the hand and eye. We will explore historically significant and contemporary artists, along with concepts in visual and critical studies. Students are strongly encouraged to participate in a culminating art show at the end of the semester.$c$),

  ($c$Intro to Film & Video$c$, $c$Visual Arts$c$, $c$Visual Arts$c$, $c$fall$c$, $c${9,10,11,12}$c$::int[], true,
   $c$Investigate the moving image as artistic and conceptual exploration through experimental techniques and short projects.$c$,
   $c$This course introduces students to the moving image as a form of artistic and conceptual exploration. Rather than focusing on traditional narrative storytelling, students will investigate how meaning is created through time, rhythm, framing, and editing. Working with digital cameras and editing software, students will learn the technical foundations of video production alongside experimental approaches to image-making. Through a series of short projects, students will explore techniques such as looping, sequencing, duration, and montage, while engaging with both contemporary and historical examples of film and video art. Students will be introduced to artists who use video as a primary medium, considering how moving images can function beyond conventional cinema. Emphasis is placed on creative risk-taking, visual literacy, and the development of an intentional relationship to the camera and editing process.$c$),

  ($c$Mixed Media$c$, $c$Visual Arts$c$, $c$Visual Arts$c$, $c$both$c$, $c${9,10,11,12}$c$::int[], true,
   $c$A studio course exploring 2D processes including drawing, painting, collage, and digital media.$c$,
   $c$Mixed Media is a studio course that explores a range of 2D processes including (but not limited to) drawing, painting, collage, and digital media. Throughout the semester, students will utilize different surfaces and materials in both traditional and alternative methods. Working with representation and abstraction, students will be encouraged to experiment within the framework and assignments of the class. Course content will address our daily visual experiences, whether through the screens on our devices or actual objects. More specifically, we will examine texture and dimension as illusion on a flat surface through the act of art making. We will consider these modes of seeing through juxtaposing and combining digital and other 2D media. This class seeks to develop the student's sense of visual literacy and personal art practice, building technical skill and fostering independent and creative thought. Students are strongly encouraged to participate in a culminating art show at the end of the semester.$c$),

  ($c$Intro to Painting$c$, $c$Visual Arts$c$, $c$Visual Arts$c$, $c$fall$c$, $c${9,10,11,12}$c$::int[], true,
   $c$A studio class working with gouache and acrylic to explore color, light, space, and the handling of paint.$c$,
   $c$Intro to Painting is a studio class that teaches students about working with paint and exploring a range of applications. The course covers color, light, space, and the handling of paint (gouache and acrylic) in addition to exploring the beauty of forms and color. Students will be painting people, places, and things while simultaneously exploring ideas about abstraction, representation, and expression. Students are encouraged to reflect on their own lives, experiences, interests, and hobbies as inspiration for their work while building their painting skills. Aside from studio work, there will be critiques, sketchbook homework, some reading, and writing. The ultimate goal is for each student to develop an individual visual vocabulary and to transform an assignment into a quest that demonstrates curiosity, commitment, and craft.$c$),

  ($c$Intro to Photography$c$, $c$Visual Arts$c$, $c$Visual Arts$c$, $c$fall$c$, $c${9,10,11,12}$c$::int[], true,
   $c$A digital studio class on making images and the fundamentals of art and design as they pertain to photography.$c$,
   $c$This studio class will focus on making images and the fundamentals of art and design as they pertain to photography. As a digital class we will work with DSLRs to complete six bodies of work. Students will spend a lot of time making the images and honing skills around composition. In addition to photographic composition, students will learn other technical skills such as camera Raw, Photoshop and digital printing. In addition to making the images, we will build skills around visual literacy, and work on communicating through the images we make. Through readings, slide presentations, and visiting artists, students will consider the context in which they are creating photographs. Students will participate in critiques to develop critical thinking skills and gain a deeper understanding of their work. At the end of the term, students will participate in a school wide art exhibition. This beginning class will be a prerequisite to the Advanced Photography class using the darkroom.$c$),

  ($c$Adv. Art & Fabrication$c$, $c$Visual Arts$c$, $c$Visual Arts$c$, $c$spring$c$, $c${9,10,11,12}$c$::int[], true,
   $c$Builds on Intro to Art & Fabrication, deepening shop skills and artistic practice to create robust 3D art.$c$,
   $c$Advanced Art and Fabrication will build on skills introduced in the first semester of Art and Fabrication. Students in this course work in a variety of media to create projects that demonstrate understanding and consideration of craftsmanship and the elements and principles of visual art, including space, form, balance, texture, and contrast. Students gain firsthand knowledge and experience with construction by using a variety of hand tools, power tools, and materials, such as the hand drill, chop saw, band saw, belt and orbital sanders, wire, foam, wood, and sheet metal. Emphasis is placed on appropriate use of tools and safety. The course aims to empower artists with fundamental shop skills to create physical objects, and to introduce more mechanically-inclined students to artistic and creative processes. All students, regardless of former capabilities, will grow their knowledge of and skills in both art and fabrication by applying each in the context of the other. Students are strongly encouraged to participate in a culminating art show at the end of the semester.$c$),

  ($c$Adv. Clay Sculpture$c$, $c$Visual Arts$c$, $c$Visual Arts$c$, $c$spring$c$, $c${9,10,11,12}$c$::int[], true,
   $c$Builds on Intro to Clay Sculpture, continuing to explore three-dimensional thinking with a range of clay bodies.$c$,
   $c$Advanced Sculpture is a studio class that builds on the foundations of the Introduction to Sculpture class. Students continue to explore making sculpture with a range of clay bodies as the primary medium and ways of thinking three-dimensionally. This class serves the needs of beginners and experienced students for art. In addition to sculpture techniques, the elements of the three-dimensional art and design will be studied as they apply to the projects at hand. Students work in both subtractive and additive manners, incorporating basic aesthetic concepts such as line, texture, composition, balance, form, mass, space, rhythm, tension, movement, light, and density. Students explore the relationship between form and content in materials through hand building techniques in clay. Projects investigate representation (people and things), abstraction, and architecturally inspired design/installation. Students are encouraged to think about the conceptual possibilities of sculpture and expressing a personal point of view.$c$),

  ($c$Adv. Drawing$c$, $c$Visual Arts$c$, $c$Visual Arts$c$, $c$spring$c$, $c${9,10,11,12}$c$::int[], true,
   $c$Builds on Intro to Drawing with advanced techniques such as one-, two-, and three-point perspective.$c$,
   $c$Advanced Drawing builds on drawing skills introduced in the first semester of Drawing. This studio course focuses on technical skill as well as mark-making as a form of creative exploration. Students will examine their interests and ideas through visual representation, working both technically and intuitively. Though class time will include lessons and discussions, students will typically be working on projects using a variety of drawing media, including (but not limited to) graphite, charcoal, and colored pencil. Studio time encourages a quiet focus and provides the necessary hours to build and refine the connection between the hand and eye. We will explore historically significant and contemporary artists, along with concepts in visual and critical studies. We will learn techniques such as, but not limited to, one, two, and three-point perspective, as well as experimenting with the alternative stylus.$c$),

  ($c$Adv. Film & Video$c$, $c$Visual Arts$c$, $c$Visual Arts$c$, $c$spring$c$, $c${9,10,11,12}$c$::int[], true,
   $c$Builds on Intro to Film & Video, developing an individual artistic voice through sustained time-based projects.$c$,
   $c$This course builds on foundational skills in moving image-making and focuses on the development of an individual artistic voice. Students will work with digital video and editing software to create sustained projects that explore personal, social, or conceptual ideas through time-based media. Expanding on approaches introduced in the introductory course, students will deepen their understanding of duration, sequencing, and structure, while exploring a range of strategies including observational, constructed, and hybrid forms. Emphasis is placed on intentionality, experimentation, and the refinement of ideas through iterative making. Students will engage with contemporary artists working in film and video, situating their work within broader artistic and cultural contexts. Through critique, reflection, and revision, students will develop a cohesive body of work that demonstrates a more advanced ability to shape meaning through image, sound, and time.$c$),

  ($c$Adv. Painting$c$, $c$Visual Arts$c$, $c$Visual Arts$c$, $c$spring$c$, $c${9,10,11,12}$c$::int[], true,
   $c$Builds on Intro to Painting, continuing work with acrylic and oil across color, light, space, and paint handling.$c$,
   $c$Advanced Painting is a studio class that builds on the Introduction to Painting curriculum and is a continuation in working with paint and exploring a range of applications. The course covers color, light, space and the handling of paint (acrylic and oil) in addition to exploring the beauty of forms and color. Projects in class range from painting people, places and things while simultaneously exploring ideas about abstraction, representation and expression. Students are encouraged to reflect on their own lives, experiences, interests and hobbies as inspiration for their work while building their painting skills. Aside from studio work, there will be critiques, sketchbook homework, some reading, and writing.$c$),

  ($c$Adv. Photography$c$, $c$Visual Arts$c$, $c$Visual Arts$c$, $c$spring$c$, $c${9,10,11,12}$c$::int[], true,
   $c$A second-level studio class exploring creative photographic techniques with a focus on making images.$c$,
   $c$In this second level studio class, we will explore creative techniques in photography with a focus on the act of making images. In most of our classes we will be talking together as a class rather than having the instructor talk at the students. Students will complete several collections of photos or photo essays. In this class, we will examine the decisions involved in taking a picture. You will learn the technical skills (camera, RAW/Lightroom/Photoshop, digital printing) needed to produce "good" photographs. Short readings, slide shows, artist documentaries and class discussions will add theoretical grounding to a series of independent shooting assignments. We will critique assignments as a group and develop a practice of constructive peer review.$c$),

  ($c$Adv. Studio Art$c$, $c$Visual Arts$c$, $c$Visual Arts$c$, $c$all-year$c$, $c${11,12}$c$::int[], true,
   $c$A yearlong upper-division studio class for students building a cohesive art portfolio across mediums. Prereq: any two full visual art courses (Intro & Advanced).$c$,
   $c$Advanced Studio Art is a class for students who want to continue making art and are interested in building a portfolio. Students in this upper division class will have taken an art class before and will drive their own exploration and art making. Students will have the opportunity to work in a community of other students who are committed to making and discussing art. Over the course of the semester, students will choose artistic research interests and make work based on those interests. This studio class will be focused on critique of student work in addition to making work; discussions and readings will provide a frame for the critiques. An emphasis will also be placed on larger portfolio goals, and students will work toward achieving a cohesive portfolio with depth in addition to breadth. Students will work across mediums, according to their interest and portfolio needs. Advanced Studio Art students will be expected to participate in the arts culmination at the end of the semester. Prerequisites: Any 2 full visual art courses (Intro & Advanced).$c$),

  ($c$Fine Arts Teaching Fellowship$c$, $c$Visual Arts$c$, $c$Visual Arts$c$, $c$both$c$, $c${11,12}$c$::int[], false,
   $c$A teaching fellowship for students who have successfully completed the desired arts course. Application per the Teaching Fellow Program Overview.$c$,
   $c$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$c$)

) AS x(title, subject, dept, season, grade, retakeable, short_description, long_description)
CROSS JOIN schools s
JOIN departments d ON d.school_id = s.id AND d.name = x.dept
JOIN terms t ON t.school_id = s.id AND t.season = x.season
WHERE s.name = $c$The Nueva School$c$;

----------------------------------------------------------------------
-- 4. Prerequisites (best-effort; each Advanced medium requires its Intro)
----------------------------------------------------------------------
INSERT INTO course_prerequisites (course_id, prerequisite_course_id)
SELECT c.id, p.id
FROM (
  VALUES
    ($c$Adv. Art & Fabrication$c$, $c$Intro to Art & Fabrication$c$),
    ($c$Adv. Clay Sculpture$c$, $c$Intro to Clay Sculpture$c$),
    ($c$Adv. Drawing$c$, $c$Intro to Drawing$c$),
    ($c$Adv. Film & Video$c$, $c$Intro to Film & Video$c$),
    ($c$Adv. Painting$c$, $c$Intro to Painting$c$),
    ($c$Adv. Photography$c$, $c$Intro to Photography$c$)
) AS pre(course_title, prereq_title)
CROSS JOIN schools s
JOIN courses c ON c.school_id = s.id AND c.title = pre.course_title
JOIN courses p ON p.school_id = s.id AND p.title = pre.prereq_title
WHERE s.name = $c$The Nueva School$c$;

COMMIT;
