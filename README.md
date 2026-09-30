# Dover AFB Rapid Communication Framework

A drafting tool for 436th Airlift Wing Public Affairs. Pick the situation, pick the command decision, and the app builds every product (base-wide email, AtHOC alert, Dashboard and Facebook post, Base Line script, holding statement) from one set of facts. Facts nobody has supplied stay highlighted as gaps and copy out as `[[REPORT TIME]]`. The app never invents them.

> Demo content only. Everything in `content/demo-library.js` is sample language, not approved for release.

## How it works

1. **Situation.** What is happening: weather, severe weather, security, public health, media response.
2. **Decision.** What command decided: delayed reporting, closure, early release, all clear, and so on.
3. **Build.** Every fact has an owning office (Command, CP, WX, SF, CES, CPO, MDG, FSS, PA, plus any the office library adds). The inputs board shows which offices are still out. **Insert standard language** fills every empty field that has one approved wording; fields with several approved options show a link for each. Products fill in live as facts arrive. **Draft RFI** writes the request for the missing facts, grouped by the office that owns them.
4. **Record.** One-click time stamps: decision received, RFI sent, information received, draft ready, sent for approval, approved, released. The record states the total time and how much of it was spent waiting on other offices. Export it as text or CSV.

Design rules:

- Command decides. Owning offices supply facts. PA shapes and releases.
- The template is the approved structure. Facts are inserted, never assumed.
- One set of facts, many products. Public products use AP style (10 a.m., Sept. 30). Internal products use military time and dates (1000, 30 Sep 2026).
- Follow-on events (delay, then closure, then all clear) carry the facts forward so nobody retypes them.
- The record shows when information reached PA.

## Run it

No install and no build step. Open `index.html` in Microsoft Edge or Google Chrome.

- **Local or shared drive.** Copy the folder and open `index.html`. It works offline.
- **GitHub Pages.** On a GitHub Free account, Pages works only from a public repository. On paid plans, a Pages site built from a private repository is still a public website unless the owner is an organization on GitHub Enterprise Cloud. Keep this repository private and use the folder method unless you decide the engine and demo content can be public.

Time fields accept 0930, 930, 09:30, 0930L and 9:30 pm.

## Data handling

- No server, no accounts, no analytics. The page's Content Security Policy blocks every network request (`connect-src 'none'`), so the page cannot send anything anywhere, even by mistake.
- Events and remembered content packs are saved in the browser's local storage on that computer only. Clearing browser data erases them.
- The event record becomes an official record only when you export it and file it with the office's records.
- Real 436 AW language never goes in this repository. It lives in `content/local/` (ignored by git) or in a JSON content pack kept on a government share and loaded through **Library**, then **Load content pack**.

**Warning:** `.gitignore` protects you only when you commit with git. The GitHub web upload page commits whatever you drag into it. Never drag `content/local/` or a content pack into a browser upload.

## Repository layout

```
index.html                      entry page (open this)
assets/engine.js                registry, template rendering, AP and military formatting, validation
assets/app.js                   interface
assets/app.css                  styles (system fonts only)
content/demo-library.js         demo owners, fields and eight sample messages
content/local/                  real content, ignored by git (see its README)
docs/TEMPLATE-GUIDE.md          how to turn a released message into a template
docs/example-content-pack.json  content pack format with one sample message
```

## Adding the office's messages

See [docs/TEMPLATE-GUIDE.md](docs/TEMPLATE-GUIDE.md). Short version: take a released message, mark every fact that could change, give each fact an owning office, and write the message once with `{{placeholders}}`.

## Status

Version 0.2.0: working engine, interface and demo library, with support for an office library built from released messaging continuity. In any category where the office library has messages, the demo messages are hidden unless **Library** is set to show them.

Not an official U.S. Air Force product.
