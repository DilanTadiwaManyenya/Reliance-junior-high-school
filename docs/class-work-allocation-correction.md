# Class Work allocation correction

Class Work is for the teacher's class-teacher allocations only. Subject Work uses subject allocations independently. For Mr Gopito, Class Work must show only Form 3 Blue, while his whole-form Form 3 and sixth-form subjects remain available in Subject Work.

Removed the union of class and subject assignments from the top-bar class options. The existing single-class badge now displays instead of an incorrect four-class dropdown. The overview/roster also filters against class-teacher assignments before applying the active class filter: an old saved subject-form choice cannot expand the roster, and no class assignment yields no Class Work learners.

Regression coverage uses one class assignment, three subject allocations, a subject-only learner, another-stream learner, and a stale stored sixth-form selection. It checks a single assigned-class badge, exclusion from the roster, independent subject allocations and the no-class-assignment case. Existing navigation checks cover 320–1440px. Production build and focused lint passed. No database role or allocation records changed.
