<p align="center">
    <img alt="InoxTools" width="350px" src="https://github.com/Fryuni/inox-tools/blob/main/assets/shield.png?raw=true"/>
</p>

# Every Astro

Find the Astro commit that introduced a regression in your project.

Every Astro clones the Astro repository, builds selected revisions, runs your project's development
server against each one, and asks whether the bug is present. It checks the latest revision in the
installed Astro major and the inclusive first release of that major before starting `git bisect`. When
clone HEAD's Astro package has the installed major, HEAD is the latest revision; otherwise Every Astro
uses the highest stable release tag in that major. This can show that the bug is already fixed or already
present at the selected range's first release.

## Requirements

- Node.js 22.12.0 or newer
- Git and the project's package manager available on your `PATH`
- An Astro project with dependencies already installed
- A `dev` script that starts the project and keeps running
- On Windows, a direct foreground Astro dev command such as `"dev": "astro dev"`; wrapper, background, and shell-composed scripts are rejected.
- A pnpm, npm, Yarn, or Bun lockfile

Both Yarn Classic and Yarn Berry, including Plug'n'Play projects, are supported. In a monorepo, run the
command from the Astro project's directory; Every Astro searches parent directories for the package
manager configuration and lockfile.

## Usage

Run the CLI from the Astro project where you can reproduce the bug:

```sh
npx @inox-tools/every-astro
```

For each revision, wait for the development server to be ready, reproduce the bug, and answer the
prompt with `y` or `n`. The answer must describe the same behavior every time for `git bisect` to find a
reliable result.

The CLI only searches within the installed Astro major. It reports one of these outcomes:

- The bug is fixed in the latest revision in the installed major.
- The bug is already present in `v<major>.0.0`; its introduction is outside the selected major range.
- The exact first bad Astro commit.

Every Astro uses the package manager declared in the nearest `package.json`, or detects it from the
nearest `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `bun.lockb`, `package-lock.json`, or
`npm-shrinkwrap.json`. It builds every tested Astro revision and substitutes all `astro` and
`@astrojs/*` packages from that revision that are used by the project, so a run can take significant
time and disk space.

## Cleanup

On success, failure, `SIGINT`, or `SIGTERM`, Every Astro stops the development server, restores the
project manifests, lockfile, installed dependencies, and original dependency links, resets the cloned
repository's bisect state, and removes the temporary clone. If cleanup cannot complete, the command
fails instead of reporting a successful result. Cleanup also runs when the command is interrupted.

## License

Every Astro is available under the MIT license.
