module.exports = {
  branches: ["main", "release/v+([0-9])?(.{+([0-9]),x})"],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
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
      },
    ],
    [
      "@semantic-release/github",
      {
        assets: [{ path: "*.tgz", label: "Package" }],
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: ["package.json", "packages/*/package.json", "CHANGELOG.md"],
        message:
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
};
