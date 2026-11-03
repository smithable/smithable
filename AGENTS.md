# For every coding agent

The rules for working in this repository are in [CLAUDE.md](CLAUDE.md): the commands, the gate, the
twelve rules, the commit trailers. They apply to every agent and every tool, whatever reads this
file. On the development machine, `~/repos/CLAUDE.md` holds the rules shared by all sessions there.

In short: `smithable.yml` is authoritative and every change to it goes through the operation layer;
generated apps never depend on Smithable packages; generation is deterministic; engine packages run
in the browser too; no construct without ARCHITECTURE §2.4's five questions; concise code, no
abstraction before a second use; every change can be undone; findings are never suppressed. Every
commit ends with the Signed-off-by and Co-Authored-By trailers. Commit finished work often, in
small commits named after the item they finish.
