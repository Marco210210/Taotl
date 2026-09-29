# Authorized scope: Taotl source snapshot

Review the provided Taotl source snapshot and run reproducible, non-destructive
tests in the sandbox. You may install dependencies and start local test servers.
The snapshot is disposable: propose fixes there and report exact files and tests.

Focus on backend authorization, cross-account access, game and leaderboard
integrity, administrative frontend separation, credentials, SQL injection, XSS,
upload handling and session/password-reset logic. Review existing fixes critically.
Distinguish confirmed reproduction from hypotheses and dependency advisories.

External addresses, email accounts, databases and Telegram integrations appearing
in the source are production services, not authorized live targets for this run.
Do not contact them or send notifications. Use local mocks or disposable fixtures
for dynamic tests; report flows that require an isolated database for confirmation.
Do not seek credentials outside the snapshot. Do not clone repository history.
Do not attempt denial of service, brute force, persistence or destructive tests.

Finish with an actionable report of confirmed issues, evidence, suggested fixes,
coverage and any tests that could not be performed.
