# cyber-shuttle.github.io

Documentation site for Cybershuttle, the ARTISAN group's software for running VS Code, Jupyter and batch work on the
compute nodes of Slurm clusters, published at https://cyber-shuttle.github.io/. Built with
[Docusaurus](https://docusaurus.io/).

| Command | Does |
|---|---|
| `npm ci` | Install dependencies |
| `npm start` | Serve with live reload at `http://localhost:3000/` |
| `npx tsc` | Type-check the config and theme |
| `npm run build` | Build the static site into `build/`; fails on a broken link |
| `npm run serve` | Serve the built site |

Pull requests run the type check and build (`.github/workflows/ci.yml`); a push to `main` builds and deploys to
GitHub Pages (`.github/workflows/pages.yml`).

## Layout

| Directory | Tab | Reader |
|---|---|---|
| `docs/overview` | Cybershuttle (the navbar logo) | Everyone; `::::researcher` and `::::provider` blocks split the text by audience |
| `docs/vscode`, `docs/jupyter`, `docs/batch` | VS Code, Jupyter, Batch | Researchers using the clients |
| `docs/planning`, `docs/setting-up`, `docs/operating` | Planning, Setting up, Operating | HPC centre staff: system administrators, security and allocation officers |

Every tab is a flat list of pages, set in `sidebars.ts`; a subject gets one page, not a folder of small ones. The
detailed pages of the researcher tabs (interfaces, architecture, development, Linkspan) are listed after the guides
and shown only with the Power user switch on; providers always see them. Detailed pages state the facts of one source
repository at the commit recorded in `docs/operating/compatibility.md`; update both when a service changes.

The look and behaviour live in `theme/`, a Docusaurus theme on top of the classic one: `theme.css` (colour tokens and
layout), `lib/controls.tsx` (audience toggle, Power user switch, panel headers), `components/` (the classic components
it overrides), `settings.js` (reader settings applied before first paint) and `remark.js`. Pages stay Markdown; the
only additions are these directives:

| Markdown | Effect |
|---|---|
| `::::researcher` … `::::`, `::::provider` … `::::` | Shown to one audience; the navbar item classes `nav--researcher` and `nav--provider` do the same for tabs |
| `:::advanced` … `:::`, or `:advanced` at the start of a table row | Power-user material, shown when the switch is on and always to providers |
| `:status[available]`, `:status[development]`, `:status[planned]` | Status badge |
| `![alt](/img/screenshots/<name>-light.png)` and `![alt](/img/screenshots/<name>-dark.png)` | A UI screenshot captured at 2x, shown at half its pixel size in the variant matching the colour mode |

Headings inside these blocks get ids prefixed `r-`, `p-` or `a-` automatically, so the page outline follows the same
switches.

## Naming

A page's title, first heading, sidebar entry and URL use the same words: the file name is the title in lowercase
kebab-case (`Sessions and runs` → `sessions-and-runs.md`). Titles and navbar labels are in sentence case except for
product names. A section's landing page is its `index.md`, listed as "Overview". Routes are flat: each navbar tab is one top-level
route, and the audience selector only chooses which tabs and blocks are shown.
The same kind of page has the same name in every section, for example "Sessions and runs", "User interface",
"HTTP API", "Deployment".

## Writing pages

Every page serves one reader at one level and is one kind of page:

| Kind | Purpose | Shape |
|---|---|---|
| Tutorial | Take a newcomer through a first success | Numbered steps, each with its visible result |
| How-to | Complete one task | Prerequisites, steps, how to confirm it worked |
| Explanation | Build understanding of how and why | Concepts first, one diagram or example, consequences |
| Reference | Look up exact facts | Tables and code; complete; no narrative |

Rules:

- Open with what the page covers and what the reader will know or be able to do; state prerequisites.
- Define a term at first use or link the [Glossary](docs/overview/glossary.md).
- Every sentence carries a fact, a step or a reason. No marketing words, no filler openers ("In this section"), no
  restating, no rhetorical questions.
- State limitations and status plainly: **Available**, **Ongoing**, **Planned**.
- Use the second person and the imperative for steps; the third person elsewhere.
- Prefer a table row or an example over a paragraph. Commands, paths, settings and identifiers go in code formatting.
- End with where to go next when the reader has one.
- Give a section a heading only if a reader would navigate to it or scan for it; a one-paragraph or one-table point
  stays under its parent. Use H2 for a page's main parts, H3 only when an H2 has two or more substantial parts, never
  H4. Titles are short, parallel noun or task phrases; no questions, and no "Overview", "Introduction" or "Notes".
- Claims about behaviour must match the source repository; cite a file path in in-depth pages when it helps.

## Contributing

Open an issue or a pull request against `main`. Run `npm run build` before submitting; it fails on broken links and
MDX errors.

License: Apache-2.0.
