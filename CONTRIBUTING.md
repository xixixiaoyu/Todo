# Contributing to Lumina (简思)

First off, thank you for considering contributing to Lumina! It's people like you who make the open-source community such an amazing place to learn, inspire, and create.

## 🌈 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and professional in all interactions.

## 🛠️ Development Setup

Lumina is a monorepo built with **NestJS**, **Vue 3**, **pnpm**, and **Turborepo**.

### Prerequisites

- **Node.js**: >= 20.19.0
- **pnpm**: >= 9.15.0
- **Docker**: For running infrastructure (PostgreSQL, Redis)
- **Go**: >= 1.21 (Only for Desktop development)

### Getting Started

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/xixixiaoyu/lumina.git
    cd lumina
    ```

2.  **Install dependencies**:
    ```bash
    pnpm install
    ```

3.  **Setup Environment Variables**:
    Copy `.env.example` to `.env` and fill in the required values (e.g., Database credentials, AI API keys).

4.  **Start Infrastructure**:
    ```bash
    docker compose up -d
    ```

5.  **Run Migrations**:
    ```bash
    pnpm db:push
    ```

6.  **Start Development Mode**:
    ```bash
    pnpm dev
    ```

## 🧪 Quality Standards

We maintain high standards for code quality and testing.

- **Linting**: Run `pnpm lint` to check for style issues.
- **Testing**: Run `pnpm test` to execute all tests.
- **Type Checking**: Run `pnpm type-check` to ensure type safety.

**Note**: All Pull Requests must pass these checks before being considered for merge.

## 📦 Project Structure

- `apps/backend/`: NestJS business logic, AI integration, and API.
- `apps/frontend/`: Vue 3 web interface and shared UI components.
- `apps/wails/`: Go-based desktop shell.
- `packages/shared/`: Shared Zod schemas and utility functions.

## 🤝 Pull Request Process

1.  Create a new branch from `main`.
2.  Make your changes and ensure tests are passing.
3.  Commit your changes using [Conventional Commits](https://www.conventionalcommits.org/).
4.  Open a Pull Request with a clear description of your changes.
5.  Wait for review and address any feedback.

## 📜 License

By contributing to Lumina, you agree that your contributions will be licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

---

Happy coding! 🚀
