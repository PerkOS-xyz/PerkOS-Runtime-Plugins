# Hallmark

Hallmark provides `design.page` through the `perkos-hallmark` skill and `design.slop-check` through the static `slop-check` command. Use the PerkOS skill to design a page or request an audit. Its pre-flight reads the project's design and brand docs before choosing a direction or assessing a page.

Install Node.js 18 or later and run `npx skills add nutlope/hallmark -g` for your seat. Omit `-g` for a project install. Detection checks the project and then the home directory in `.agents/skills` and `.claude/skills`. It reads the installed skill version and checks for its lint script. The standalone command takes a `target` file or directory. Hallmark's browser checks require Chrome and Puppeteer Core. See the [upstream installation guide](https://github.com/Nutlope/hallmark#install).

The Runtime applies `PERKOS_HALLMARK_TOGETHER_COMP=off`, `PERKOS_HALLMARK_INSPO_MCP=off`, and an empty `TOGETHER_API_KEY` to plugin commands. The PerkOS skill skips both integrations unless you explicitly opt in for that run and have configured the integration on your seat. Hallmark's theme and capture scripts are used through the installed workflow.

Install Hallmark separately. Its MIT license permits bundling with the copyright and license notice. See the [upstream license](https://github.com/Nutlope/hallmark/blob/main/LICENSE).
