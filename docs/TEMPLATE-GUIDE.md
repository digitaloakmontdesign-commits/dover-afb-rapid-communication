# Template guide

How to turn a message the office has already released into a template the app can build from.

## The method

1. **Start from a released message.** Pick the best version the office has sent for that situation.
2. **Mark every fact that could change.** Dates, times, who is affected, gate status, road conditions, the hazard, the next update. Each one becomes a field.
3. **Give each field an owning office.** The office that is the authority for that fact: CP for report times, SF for gates, CPO for civilian guidance, MDG for clinic status. The owner is who the RFI goes to.
4. **Decide required or optional.** Required means PA cannot release without it. Optional means the sentence appears only when the fact is supplied.
5. **Write each product once, with placeholders.** Keep the approved wording. Replace each fact with `{{field}}`. Wrap optional facts in `{{#if field}}...{{/if}}`.
6. **Check it in the app.** Open **Library**. Authoring warnings list anything the app cannot resolve, such as a misspelled field.

### Worked example

Released message:

> Due to icy roads, Dover AFB will operate on a delayed reporting schedule Thursday, Jan. 8. Non-mission-essential personnel should report at 10 a.m. The Child Development Center opens at 9:30 a.m.

Template text:

```
Due to {{hazard}}, Dover Air Force Base will operate on a delayed reporting schedule {{effective_date|apday}}. {{affected|list|cap}} should report at {{report_time}}.
{{#if cdc_status}}{{cdc_status|sentence}}{{/if}}
```

Fields: `hazard` (WX, required), `effective_date` (CP, required), `affected` (CP, required), `report_time` (CP, required), `cdc_status` (FSS, optional).

## Where content goes

| Where | Loads | In git? | Use for |
|---|---|---|---|
| `content/demo-library.js` | always | yes | sample language only |
| `content/local/local-library.js` | automatically, when the file exists | no (ignored) | the office's library, in the copy on the shared drive |
| JSON content pack | Library, then Load content pack | no | sharing a library as a single file |

A JavaScript library file starts with `RCF.registerLibrary({` and ends with `});`. A JSON pack is the same object without that wrapper, with every key and string in double quotes and line breaks written as `\n`. See `docs/example-content-pack.json`.

When two libraries define the same template `id`, the one loaded last wins. Give the office's library its own `id`, such as `436aw`.

## Library structure

```js
RCF.registerLibrary({
  id: '436aw',                                   // unique; loading it again replaces it
  name: '436 AW messages',
  version: '1.0.0',
  office: '436th Airlift Wing Public Affairs',   // used in RFIs and records
  owners: { CP: 'Command Post', SF: 'Security Forces' },
  categories: [{ id: 'weather', name: 'Weather', summary: 'Delays and closures' }],
  fields: { report_time: { label: 'Report time', owner: 'CP', type: 'time' } },
  templates: [ /* see below */ ]
});
```

Owners, fields and categories merge across libraries, so the office's library can reuse the demo fields and add its own. An office library sets the order of the inputs board for the owners it lists. Demo content never overrides an owner, category or field the office library defines. A category with `tone: 'urgent'` gets a red rule on the situation screen.

### Fields

| Key | Meaning |
|---|---|
| `label` | Shown on the form, in RFIs and inside the gap highlight. Write it as a noun: "Report time", not "Report at". |
| `owner` | Owning office code, such as `CP`. |
| `type` | `text`, `textarea`, `date`, `time`, `select` or `multiselect`. |
| `help` | One line under the input. |
| `options` | Choices for `select` and `multiselect`. Write them to read inside a sentence, in lowercase. |
| `suggestions` | Typing suggestions for `text` fields. |
| `standard` | Approved wording. A single string shows an **Insert standard language** link, and the **Insert standard language** button above the products fills every empty field of that kind at once. A list of options, such as `[{ label: 'Closed', text: '...' }, { label: 'Normal', text: '...' }]`, shows one link per option and is never filled by the button, because someone has to pick. Standard text can hold placeholders such as `[[COUNTIES]]`; they count as gaps until someone replaces them. |

### Templates

| Key | Meaning |
|---|---|
| `id` | Unique, for example `weather-delay`. |
| `category` | A category `id`. |
| `title`, `summary` | Shown when choosing the decision. |
| `posture` | `active` (default) or `rtq` for response to query only. |
| `approval` | Release authority, shown on the build screen. |
| `required`, `optional` | Lists of field ids. |
| `products` | List of `{ id, label, audience, limit, text }`. `audience` is `public` or `internal`. `limit` adds a character counter, such as 160 for text alerts. |
| `basis` | Which released message the template came from. Shown under the title. |
| `draft` | `true` marks a message with no released example. It shows a Draft badge until someone approves the wording and removes the flag. |

## Placeholder syntax

| Syntax | Result |
|---|---|
| `{{report_time}}` | The value in its default format. A missing value shows as a highlighted gap and copies as `[[REPORT TIME]]`. Double brackets keep subject tags like `[INFO]` from counting as gaps. |
| `{{field\|format}}` | A formatted value. Formats chain left to right: `{{affected\|list\|cap}}`. |
| `{{#if field}}...{{/if}}` | Included only when the field has a value. |
| `{{#if field}}...{{else}}...{{/if}}` | One branch or the other. |
| `{{#if !field}}...{{/if}}` | Included only when the field is empty. |
| `{{#if a or b or c}}...{{/if}}` | Included when any of the fields has a value. It does not guard the fields inside it, so give each optional field its own `{{#if}}` too. |
| `{{today}}` | The date the text is built. Takes date formats: `{{today\|milyy}}` gives 23 Jan 26. |

A line that holds nothing but an omitted `{{#if}}` block disappears, so each optional fact can sit on its own line. Spaces left at the start of a line by an omitted block are removed. Optional fields must sit inside an `{{#if}}` for themselves, or they show as gaps; the Library warnings flag this.

### Formats

| Format | Works on | Example |
|---|---|---|
| none | date | Sept. 30 |
| none | time | 10 a.m. |
| `apday` | date | Wednesday, Sept. 30 |
| `day` | date | Wednesday |
| `mil` | date | 30 Sep 2026 |
| `milshort` | date | 30 Sep |
| `milyy` | date | 30 Sep 26 |
| `mil` | time | 1000 |
| `list` | multiselect | civilian employees and contractors |
| `cap` | any | Capitalizes the first letter |
| `lower`, `upper` | any | Changes case |
| `sentence` | any | Adds a period when the text has no closing punctuation |

AP rules built in: no serial comma in lists, noon and midnight spelled out, the year shown only when it is not the current year, and no second period after a sentence that ends in "a.m." or "p.m."
