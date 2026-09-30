# content/local

The office's real message library goes here. Git ignores everything in this folder except this README.

The app loads `content/local/local-library.js` automatically when the file exists. It uses the same format as `content/demo-library.js`:

```js
RCF.registerLibrary({
  id: '436aw',
  name: '436 AW messages',
  version: '1.0.0',
  office: '436th Airlift Wing Public Affairs',
  categories: [],
  fields: {},
  templates: []
});
```

Keep this folder on government systems: the office shared drive, or the copy of the app you run from it.

**Never upload this folder to GitHub.** `.gitignore` only protects you when you commit with git. The GitHub web upload page commits whatever you drag into it.
