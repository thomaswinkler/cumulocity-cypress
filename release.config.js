// /* eslint-disable @typescript-eslint/no-var-requires */
// const { readFileSync } = require("fs");
// const { join } = require("path");

module.exports = {
  branches: [
    {
      name: "release/v+([0-9])?(.{+([0-9]),x}).x",
      prerelease: false,
      channel: "maintenance",
    },
    "main",
  ],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    // [
    //   {
    //     writerOpts: {
    //       commitPartial: readFileSync(
    //         join(__dirname, ".github/commit.hbs"),
    //         "utf-8"
    //       ),
    //     },
    //   },
    // ],
    "@semantic-release/changelog",
    [
      "@semantic-release/exec",
      {
        prepareCmd:
          "npm pkg set version=${nextRelease.version} && npm pkg set version=${nextRelease.version} --ws && npx copyfiles CHANGELOG.md ./dist",
      },
    ],
    [
      "@semantic-release/npm",
      {
        npmPublish: true,
        pkgRoot: "dist/",
        tarballDir: "./",
      },
    ],
    // [
    //   "@semantic-release/github",
    //   {
    //     assets: [{ path: "*.tgz", label: "Package (.tgz)" }],
    //   },
    // ],
    // [
    //   "@semantic-release/git",
    //   {
    //     assets: ["package.json", "packages/*/package.json", "CHANGELOG.md"],
    //     message:
    //       "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
    //   },
    // ],
  ],
};
