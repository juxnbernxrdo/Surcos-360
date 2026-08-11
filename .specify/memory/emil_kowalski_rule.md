# Rule: Mandatory Emil Kowalski Skills for Frontend SDD Workflow

Any task or subtask involving **frontend, UI, UX, interaction, motion, visual design, or component development** in Surcos 360 MUST strictly adhere to the **Emil Kowalski Skills Gate**.

## 1. Obligatory Skills Reference
The relevant Emil Kowalski skills MUST be applied during the SDD workflow:
- `emil-design-eng`: Principles of interaction design, layout, hierarchy, and motion quality.
- `animate`: Creation and explicit specification of keyframe/spring animations.
- `review-animations`: Rigorous audit of existing motion (timing, curves, purpose, necessity).
- `improve-animations`: Auditing and eliminating unnecessary or jarring motion.
- `find-animation-opportunities`: Identifying strategic UI micro-interactions while flagging elements that MUST NOT be animated.
- `prototype`: Exploring and evaluating multiple distinct component/layout variations before code implementation.
- `animation-vocabulary`: Precise technical description of animation intent (easing, duration, delay, properties).
- `apple-design`: Interface clarity, depth, visual hierarchy, fluid continuity, and state transitions.
- `pick-ui-library`: Evaluating existing component libraries or design systems before creating custom components from scratch.

## 2. SDD Integration Rules
1. **Specify & Clarify**: Identify frontend touchpoints and declare applicable Emil Kowalski skills in `spec.md`.
2. **Plan**: Section `Frontend Design & Motion System` in `plan.md` must cite the specific Emil Kowalski skills chosen.
3. **Tasks**: Every frontend task in `tasks.md` must list its mandatory Emil Kowalski skill tags (e.g. `[Frontend/UX - emil-design-eng, animate]`).
4. **Analyze**: `analyze.md` must verify that frontend tasks have assigned Emil Kowalski skills.
5. **Implement**: Apply skills *before* and *during* frontend coding, not as an afterthought.
6. **Converge**: `converge.md` must audit the UI against the Emil Kowalski Frontend Gate checklist.

## 3. Mandatory Frontend Gate Checklist
A frontend task CANNOT be marked as **Done** unless:
- [ ] Emil Kowalski skills relevant to the task were identified and applied.
- [ ] Visual hierarchy, typography, whitespace, and color system match high-craft standards (`emil-design-eng`, `apple-design`).
- [ ] No unnecessary or decorative motion was introduced.
- [ ] Animations have explicit duration, easing, direction, and purpose (`animation-vocabulary`, `animate`).
- [ ] Full support for `prefers-reduced-motion` is implemented.
- [ ] Accessibility (WCAG AA), keyboard navigation, focus states, and touch targets are verified.
- [ ] Complete states are built: Loading (skeletons), Error, Empty, Success.
- [ ] Responsive design (mobile, tablet, desktop) has no horizontal overflow.
- [ ] No redundant third-party libraries or custom duplicate components were added (`pick-ui-library`).
