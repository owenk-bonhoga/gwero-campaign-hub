# GWERO OS review remediation, 19 November 2026

The owner requested the security, reliability, performance and usability repairs and production deployment. Navigation and ordinary saves must keep the current document and shared interface mounted. Network requests cannot be instantaneous; cached screens render immediately and new requests show progress without clearing existing records.

## Implemented

- F01: generic document and mailbox access is closed. Documents use the owner/grant checks in the dedicated workspace. Replies are scoped to accessible mailboxes.
- F02 and F03: SMTP uses Nodemailer with mandatory verified TLS, connection deadlines and explicit envelopes. MIME header fields reject injected control characters.
- F04: the legacy campaign sender is disabled. Metadata/sequence edits clear approval. Only approvers may disable approval, and queue claims check current campaign status and approval.
- F05: queue execution is serialized with a database lease. Retryable failures keep a campaign open. Interrupted dispatches are quarantined until a provider delivery review; task creation is idempotent. Uncertain deliveries count against the daily allowance.
- F06: recipient links load independently of staff sign-in and retain the recipient token/OTP checks. Redirects and OAuth callbacks use the configured canonical origin.
- F07: dashboard counts use complete server aggregates, respect each module's permissions, isolate failed widgets and use posted finance transactions grouped by currency.
- F08: new mailbox secrets use authenticated encryption and the persistent encryption key. Existing secrets are encrypted explicitly after the compatible runtime is live, with a transaction and verified backup.
- F09: clients and prospects use server pagination/search. Only the current prospects' contact summaries are returned. Generic module lists use server search and pagination; selected columns are honoured and related records load in batches.
- F10: the app frame persists across routes, auth/branding data is cached, and heavy spreadsheet/document code loads on demand. Navigation and ordinary edits use client routing and query updates. Background jobs leave the page lifecycle. Client/prospect directory navigation prefetches on intent. Empty sticky-note pages poll once per minute, with slower active-note polling and no background-tab polling.
- F11: failed requests have visible retry feedback, loading records have progress states and existing data remains visible during refresh. Help opens usable guidance.
- F12: mobile uses a navigation drawer, global search is available at narrow widths, directories wrap/scroll within the page, shared form controls have accessible names and brand fonts include system fallbacks.
- F13: database statement/acquisition, provider HTTP and mail socket operations have bounded deadlines. Slow trickles cannot renew a response deadline and timed-out socket waiters are removed.
- F14: release verification checks the exact commit, database health and the recipient route. Error capture is scoped to each concurrent request. Database regression tests run in CI, and prior hashed browser assets survive one release so open tabs can navigate after deployment.
- F15: account login quotas cannot consume a shared all-user lockout bucket.
- F16: password resets/suspension revoke sessions transactionally. Ordinary sign-in supports multiple devices.
- F17: note/comment operations check the underlying page and document permissions. Mentions and notification email check recipient access before displaying or sending content.
- F18: 115 server inputs have generated, checked runtime contracts with bounded structure and explicit allowed types. Shared origin, crypto, deadline, access and directory logic is extracted from feature modules.

## Verification

Node.js 22: 51 unit/security tests and 8 database integration tests pass. Tests include a fake SMTP server, malicious MIME headers, encrypted credential round trips, concurrent error isolation, document/note access denial, complete directory counts, bounded pagination/projection, login quota isolation, interrupted-send quarantine, manual delivery reconciliation and database pool deadlines.

Browser checks on the local production build: successful sign-in, client creation and task creation, no Document requests during navigation or saves, a 390px mobile viewport without page overflow, navigation drawer and Help. Spreadsheet parsing and document viewer are separate chunks.

A private production backup was taken before release. Its SHA-256 hashes match after download. An isolated restore passed checks on 97 tables, including 217 attachments totalling 78,435,894 bytes. Production data was not used for outbound test messages.

## Operations and remaining external configuration

Hostinger native Git deployment continues to watch the canonical main branch. A private scheduled runner calls the existing authenticated background-job endpoint. Mailbox encryption is applied only once the new release is verified, using the existing stable key. Keep backups and the key outside the repository.

For a normal rollback, revert via a verified pull request. To use a pre-remediation runtime in an emergency, first pause the background runner and run the review migration with `--decrypt-mailboxes` against the current database using the stable key. Then switch to the retained runtime. This reverses only the mailbox encoding; it does not restore an old database or overwrite subsequent customer records. Re-encrypt when the compatible runtime is restored. Both transformations are transactional and idempotent.

The existing Google OAuth configuration was encrypted in September with an unavailable historical key. This repair does not overwrite those values or rotate the current key. All three production sending accounts use SMTP. Historical project files and hosting directories were checked; Google credential recovery remains separate from the working SMTP service until a valid source credential or historical key is recovered.
