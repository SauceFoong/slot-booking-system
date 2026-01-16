## 1. AI Tools Used

- **Cursor IDE** – used as the primary development tool, the primary AI model I used the most is `claude-4.5-opus-high`
- **ChatGPT** – used for code refactoring, documentation writing, and design discussions

---

## 2. Prompts and Requests

I used AI to assist with planning, scaffolding and accelerating development. I mainly use Cursor: `Plan` / `Ask` / `Agent` features to finish this project. 

`Plan`: To draft the execution plan before the implementation started.

`Ask`: Ask any questions to clear up my doubts

`Agent`: To write codes, test cases, and updating the readme or drafting diagram.



The prompts included:

- Scaffolding the initial project structure based on the chosen tech stack  
  (Node.js, TypeScript, Prisma ORM, PostgreSQL)
- Generating unit test cases to validate that functional requirements were met
- Adding seed data and extending it based on evolving requirements
- Implementing new features and enhancements, for example:
  - Rate limiting the booking endpoint using Redis with a sliding window strategy
- Generating supporting documentation and visuals, such as:
  - System design diagrams
  - ERD diagrams

---

## 3. Accepted vs. Rejected Outputs

I accepted AI-generated codes only after reviewing and testing it. Any output that did not meet quality or design expectations was rejected or modified.

Examples:
- I removed AI-generated code with poor readability or redundant logic.
- When prompted to add Swagger documentation, the coding agent introduced custom CSS styling that reduced readability of the docs. I removed the styling and kept the documentation simple and clear.
- I removed an unnecessary unique constraint that tied the slot ID to the booking ID, as it would prevent a slot from being booked again after a cancellation.

---

## 4. Evaluation and Supervision Process

I actively supervised all AI-generated output by:

1. Reviewing every file modified by the coding agent
2. Deciding whether to keep, update, or remove the changes
3. Re-running the full unit test suite to ensure no regressions were introduced
4. Performing manual testing on the affected features to validate correctness and behavior

This process ensures that all AI-assisted changes meet code quality, correctness, and maintainability standards.
