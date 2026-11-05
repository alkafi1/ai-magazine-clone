# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private reporting instead:
**Security tab → Report a vulnerability** on this repository. Include what you found, how to reproduce it, and
the impact. You will get an answer as soon as possible.

## What is in scope

The code in this repository: the API, the admin panel, authentication and roles, file upload, the scraper's request
handling, and the Docker/nginx configuration.

## Before you deploy

- Set strong, unique `JWT_SECRET` and `REVALIDATE_SECRET` values (32+ random characters). The API refuses to start in
  production otherwise.
- Never commit `.env`. Only `.env.example` belongs in git.
- Keep MongoDB unreachable from the internet (the compose file does not publish its port).
- Review [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), especially the go-live checklist.
