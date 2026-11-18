import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ALLOWED_ADVISORIES = new Map([
  [
    "https://github.com/advisories/GHSA-fc5q-39xc-vjpf",
    "picomatch ReDoS: no patched release exists; Gwero OS does not accept user-supplied glob patterns",
  ],
]);

const BLOCKING_SEVERITIES = new Set(["high", "critical"]);

export function classifyAuditReport(report) {
  const vulnerabilities = report?.vulnerabilities ?? {};
  const decisions = new Map();

  function isAllowed(name, ancestry = new Set()) {
    if (decisions.has(name)) return decisions.get(name);
    if (ancestry.has(name)) return false;

    const vulnerability = vulnerabilities[name];
    if (!vulnerability || !BLOCKING_SEVERITIES.has(vulnerability.severity)) {
      decisions.set(name, true);
      return true;
    }

    const nextAncestry = new Set(ancestry).add(name);
    const allowed = vulnerability.via.every((cause) => {
      if (typeof cause === "string") return isAllowed(cause, nextAncestry);
      return name === "picomatch" && ALLOWED_ADVISORIES.has(cause.url);
    });

    decisions.set(name, allowed);
    return allowed;
  }

  const blocking = [];
  const allowed = [];
  for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
    if (!BLOCKING_SEVERITIES.has(vulnerability.severity)) continue;
    (isAllowed(name) ? allowed : blocking).push(name);
  }

  return { allowed: allowed.sort(), blocking: blocking.sort() };
}

function runAudit() {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("npm_execpath is unavailable; run this script through npm");

  const extraArguments = process.argv.slice(2);
  const auditArguments = [npmCli, "audit", "--json", "--omit=dev", ...extraArguments];
  const result = spawnSync(process.execPath, auditArguments, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    process.stderr.write(result.stderr || result.stdout || "npm audit returned no output\n");
    process.exit(1);
  }

  if (report.error) {
    process.stderr.write(`${report.message ?? "npm audit failed"}\n`);
    process.exit(1);
  }

  const findings = classifyAuditReport(report);
  if (findings.blocking.length > 0) {
    process.stderr.write(
      `Blocking high/critical vulnerabilities: ${findings.blocking.join(", ")}\n`,
    );
    process.exit(1);
  }

  if (findings.allowed.length > 0) {
    const reason = ALLOWED_ADVISORIES.values().next().value;
    process.stdout.write(
      `Allowed known upstream advisory (${reason}). Affected dependency paths: ${findings.allowed.join(", ")}\n`,
    );
  }

  process.stdout.write("No unapproved high or critical production vulnerabilities found.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAudit();
}
