# Security Policy

## Supported Versions

Currently, the following versions of **Lumina (简思)** are supported for security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Lumina seriously. If you believe you have found a security vulnerability, please do **not** open a public issue. Instead, please report it privately through one of the following methods:

1.  **GitHub Private Vulnerability Reporting**: If available, please use the "Report a vulnerability" button on the security tab of this repository.
2.  **Email**: Send an email to the project maintainer at yunmucoder@163.com.

When reporting a vulnerability, please include as much information as possible, such as:
- A description of the vulnerability.
- Steps to reproduce it (POC).
- Any potential impact it may have.

We will acknowledge your report within 48 hours and work with you to resolve the issue before a public announcement.

## Scope

This security policy applies to all components in the Lumina monorepo:
- `@my-app/backend`
- `@my-app/frontend`
- `@my-app/shared`
- Wails / Capacitor wrappers

## Security Best Practices

We encourage users to:
- Always keep their installation up to date.
- Use strong, unique passwords and enable Passkey where possible.
- Avoid exposing the backend database or Redis instance to the public internet.
