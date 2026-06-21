# Jobber v0 — project briefing

*A plain-language source for learning. Written for a smart but non-technical reader, and suitable for uploading to NotebookLM (or any AI study tool) as a grounding source.*

---

## What it is

Jobber v0 is a small web application with one job: to write a résumé tailored to a specific job opening. The user supplies the raw material about their career once, and from then on the app can produce a fresh, job-specific résumé on demand. The user does not write the résumé from scratch; an AI does the writing, using only the user's real documents as source material.

## The core idea

Think of it as a tailor for your résumé. There are two inputs — (1) your career documents and (2) a specific job posting — and one output: a résumé cut to fit that job. The app never invents experience; it only uses what the user uploaded.

## The step-by-step journey

1. **Upload career documents.** The user uploads their existing résumé, LinkedIn export, case studies, etc. These become the "source of truth."
2. **Point at a target job.** The user pastes in the job description for the role they want.
3. **Gather the background.** The app bundles all the uploaded documents into one organized package of context.
4. **The AI writes the résumé.** The app hands that package plus the job description to Claude (an AI), which drafts a résumé aimed at that specific job.
5. **Save automatically.** Each result is kept as an "artifact" — a saved item the user can return to later. Nothing is lost.
6. **Reopen, preview, export.** The user can reopen any saved résumé, view a formatted version, and download it as a clean PDF.

## The parts under the hood (with everyday analogies)

- **The screen the user clicks on — "the storefront."** The only part the user sees.
- **The engine behind it — "the kitchen."** Coordinates the work out of sight.
- **The storage — "the filing cabinet."** Remembers uploaded documents and every résumé made.
- **The AI (Claude) — "the ghostwriter."** Does the actual writing.
- **The PDF maker — "the print shop."** Turns the finished résumé into a downloadable PDF.

## Recent work and why it mattered

*(This stretch was cleanup and reliability, not new features.)*

- **Removed a half-built feature.** Early on, a more elaborate "knowledge base" system was sketched out but never finished or switched on. It sat in the code as dead weight. The team removed it cleanly — like tearing up blueprints for a room that was never built — and confirmed the working résumé flow was unaffected.
- **Fixed a false alarm.** After a PDF exported successfully, the system would log a scary "timeout" warning about 30 seconds later, even though nothing had gone wrong — like a smoke detector beeping long after the toast was already done. The team fixed the timer so the warning only appears if a PDF genuinely stalls.
- **Wrote a state snapshot.** A plain-language checkpoint document was added so anyone can see what the app does and what condition it's in.

## Why it is trustworthy right now

- 76 automated tests all pass.
- The app builds cleanly.
- The entire start-to-PDF journey was tested end to end and confirmed working (this test used one real AI generation).
- All of this work is saved and published.

## A few honest notes

- Older saved data may still contain a leftover, unused "knowledge base" table. It is harmless because no part of the app reads or writes it.
- One internal address is still historically named "kb" (knowledge base) even though it now serves the plain résumé content. It's a naming leftover, not a behavior issue.

## What's next

The foundation is done and dependable. The next planned phase is polishing how the app looks and feels to use — clearer buttons, better loading and success messages, friendlier empty screens — rather than more behind-the-scenes plumbing.
