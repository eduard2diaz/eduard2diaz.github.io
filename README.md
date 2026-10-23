# eduard2diaz.github.io

Filterable list of my projects: https://eduard2diaz.github.io

Filter by tag (GitHub topic), organization, or free-text search. Filters are kept in the URL so they can be
shared, for example <https://eduard2diaz.github.io/#tag=machine-learning> or
<https://eduard2diaz.github.io/#tag=devops&org=SeijoProduce&q=tracing>.

## How it works

- `projects.json` lists the accounts and organizations to show, repos to exclude, and optional `overrides`
  (description and topics) for repos GitHub does not let me edit, such as archived ones.
- `scripts/update_repos.py` reads the public repositories through the GitHub API and writes `repos.json`.
  The tags are the repositories' **topics**, so adding a topic to a repo is all it takes to tag it.
- `.github/workflows/update.yml` regenerates `repos.json` daily and whenever the config changes.
- `index.html`, `style.css` and `app.js` are a static page with no dependencies that reads `repos.json`.

To preview locally: `python scripts/update_repos.py && python -m http.server`.
