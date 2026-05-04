// Conventional Commits per Build Guide §14.4 — types pinned, scopes free-form for S1.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'perf', 'test', 'chore', 'docs', 'ci', 'build'],
    ],
    'subject-case': [0],
  },
};
