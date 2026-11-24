---
name: perkos-hallmark
description: Use the installed Hallmark skill to design a page or check it for AI design patterns on a PerkOS seat.
---

Before designing or auditing, read the project's design documentation. Look for `design.md` or `DESIGN.md` at the project root, `.hallmark/brand-spec.md`, and any design system or brand guidelines linked by the project. Read the current tokens and styles when they exist. Cite the files that inform the pre-flight and carry their constraints into the work.

Load the installed Hallmark skill for the current seat and follow its workflow with these PerkOS defaults:

- Skip the Together AI comp step and requests to Together AI unless the person explicitly opts in for this run and has configured credentials. An inherited key does not authorize the step.
- Ignore Inspo MCP during discovery and design unless the person explicitly opts in for this run and has configured the server. A visible server does not authorize its use.

For a static slop check, run the plugin's `slop-check` command with the page file or directory as its target. For the full workflow, follow the installed skill's browser checks when Chrome and Puppeteer are available.
