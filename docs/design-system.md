# SpecScope design reference

The reference is design-reference.png, generated for this project from the approved light workspace direction. It is a design reference, not a screenshot of working software.

- Canvas: warm paper #f6f4ef; panels: white with a hairline shadow; text: ink navy #141c33; primary: cobalt #2443b8 (deep #142f8f for active text and totals); selected backgrounds: pale cobalt #eaeefc; borders: warm gray #e3dfd6. The original deep-teal direction was retired in favour of cobalt.
- Interaction: buttons step on hover and press 1px on click, linked project cards lift 2px, links draw their underline, fields take a cobalt focus ring, the utility header stays pinned with a translucent backdrop. All motion rests under reduced motion.
- Type: locally bundled Geist Variable, 14px controls, 15px body, 32px primary page titles, restrained weight and tracking.
- Shell: 232px desktop sidebar, 60px utility header, persistent demo banner, 36px content gutters. On phones the sidebar becomes a menu, gutters shrink to 20px, and comparison panels stack.
- Primary screen: project context strip, two adjacent bordered panels, scope on the left, request and human decision on the right. Fine borders and 8px corners; no heavy shadows or decorative charts.
- Components: official shadcn base-nova primitives, customized through semantic theme tokens; Lucide outline icons at consistent stroke weight.
- Copy: “A clearer scope. A better conversation.”, “Your decision. No automatic classification.”, “Save draft”, “Preview quote”.
- Forms: clear labels, linked errors, visible focus, explicit saves, and truthful unsaved/committed states.
- Reports: quiet document typography, exact fee breakdown, unbroken totals, and print-specific A4/Letter margins.

The project overview, history, settings, and mobile views extend this same system. The demo uses synthetic October 2026 records; incidental generated dates in the reference are not product requirements.
