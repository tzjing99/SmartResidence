# Security policy

## Supported versions

SmartResidence is pre-1.0. We backport security fixes to the latest minor
release only. Once we reach 1.0, this policy will expand.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | Yes (alpha)        |
| < 0.1   | No                 |

## Reporting a vulnerability

Please **do not** open a public GitHub issue.

Use GitHub's private vulnerability reporting:

https://github.com/tzjing99/SmartResidence/security/advisories/new

Please include:

- A description of the issue
- Steps to reproduce
- The affected version / commit
- Any suggested fix

We aim to acknowledge within 48 hours and provide a fix or mitigation within
14 days for high-severity issues. We will credit you in the release notes
unless you ask us not to.

## Out of scope

- Self-hosted misconfigurations (weak DB passwords, exposed admin endpoints)
- Vulnerabilities in third-party services (Stripe, Twilio, etc.)
- Denial-of-service attacks
