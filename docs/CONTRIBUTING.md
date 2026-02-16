# Contributing to Snipe-IT MCP Server

**Thank you for your interest in contributing!**

---

## Overview

We welcome contributions of all kinds:
- Bug reports
- Feature requests
- Documentation improvements
- Code contributions
- Test improvements

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Making Changes](#making-changes)
4. [Pull Request Process](#pull-request-process)
5. [Coding Standards](#coding-standards)
6. [Testing](#testing)
7. [Documentation](#documentation)
8. [Community](#community)

---

## Getting Started

### Before Contributing

1. **Check existing issues:** Someone might already be working on it
2. **Read the docs:** Familiarize yourself with the project
3. **Review security guidelines:** See [SECURITY.md](SECURITY.md)

### Ways to Contribute

**No coding required:**
- Report bugs you encounter
- Suggest new features
- Improve documentation
- Share usage examples
- Help others in discussions

**Coding contributions:**
- Fix bugs
- Add features
- Improve performance
- Add tests
- Refactor code

---

## Development Setup

### Prerequisites

```bash
# Required
- Node.js 18+
- npm 9+
- Git
- Code editor (VS Code recommended)

# Optional but helpful
- Docker (for testing)
- Postman (for API testing)
```

### Clone and Setup

```bash
# Fork the repository on GitHub first
# Then clone your fork

git clone https://github.com/YOUR_ORG/snipe-it_mcp_prod.git
cd snipe-it_mcp_prod/mcp-server

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.development

# Edit with test credentials
nano .env.development
```

### Development Environment

```bash
# Start in development mode with watch
npm run watch

# In another terminal, run tests
npm test

# Or run specific test
npm test -- --grep "InputValidator"
```

---

## Making Changes

### 1. Create a Branch

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Or bug fix branch
git checkout -b fix/issue-123

# Or documentation branch
git checkout -b docs/improve-readme
```

**Branch naming:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `test/` - Test improvements
- `refactor/` - Code refactoring
- `security/` - Security fixes

---

### 2. Make Your Changes

**Guidelines:**
- Keep changes focused (one feature/fix per PR)
- Follow existing code style
- Add tests for new features
- Update documentation
- Don't break existing functionality

---

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/validators.test.ts

# Run linter
npm run lint

# Build both versions
npm run build:all

# Test stdio version
npm run start

# Test HTTP version
npm run start:http
curl http://localhost:3000/health
```

---

### 4. Commit Changes

**Use conventional commits:**

```bash
# Format: <type>(<scope>): <subject>

# Examples:
git commit -m "feat(api): add support for custom fields"
git commit -m "fix(validation): handle negative asset IDs correctly"
git commit -m "docs(readme): add installation troubleshooting"
git commit -m "test(validators): add tests for date validation"
git commit -m "refactor(error-handler): simplify error messages"
git commit -m "security(auth): fix token exposure in logs"
```

**Commit types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `test`: Tests
- `refactor`: Code refactoring
- `security`: Security fix
- `perf`: Performance improvement
- `chore`: Build/tooling changes

---

### 5. Push Changes

```bash
# Push to your fork
git push origin feature/your-feature-name
```

---

## Pull Request Process

### 1. Create Pull Request

**On GitHub:**
1. Go to your fork
2. Click "New Pull Request"
3. Select your branch
4. Fill out PR template

**PR Title Format:**
```
[Type] Brief description

Examples:
[Feature] Add custom fields support
[Fix] Handle negative asset IDs
[Docs] Improve installation guide
```

---

### 2. PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally
- [ ] Added/updated tests
- [ ] All tests passing

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No new warnings
- [ ] Added tests
- [ ] Tests pass locally

## Related Issues
Fixes #123
Closes #456

## Screenshots (if applicable)
[Add screenshots]

## Additional Notes
[Any additional context]
```

---

### 3. Code Review

**What to expect:**
- Maintainers will review within 1 week
- May request changes
- Discussion in PR comments
- Automated checks must pass

**Responding to feedback:**
```bash
# Make requested changes
# Commit to same branch
git add .
git commit -m "fix: address review feedback"
git push origin feature/your-feature-name

# PR automatically updates
```

---

### 4. Merging

**After approval:**
- Maintainer will merge PR
- Branch can be deleted
- Changes will be in next release

---

## Coding Standards

### TypeScript Style

**General:**
```typescript
// Use TypeScript types
function getAsset(id: number): Promise<Asset> {
  // ...
}

// Not
function getAsset(id) {
  // ...
}

// Use async/await
async function fetchData() {
  const result = await api.call();
  return result;
}

// Not
function fetchData() {
  return api.call().then(result => result);
}
```

**Naming:**
```typescript
// Classes: PascalCase
class InputValidator { }

// Functions/methods: camelCase
function validateInput() { }

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;

// Interfaces/Types: PascalCase
interface AssetData { }
type UserId = number;
```

**File Organization:**
```typescript
// 1. Imports
import { Server } from '@modelcontextprotocol/sdk';

// 2. Constants
const DEFAULT_TIMEOUT = 30000;

// 3. Types/Interfaces
interface Config {
  url: string;
  token: string;
}

// 4. Classes
class SnipeITClient {
  // ...
}

// 5. Functions
function main() {
  // ...
}

// 6. Exports
export { SnipeITClient };
```

---

### Code Quality

**Validation:**
```typescript
// Good: Validate all inputs
function getAsset(id: number) {
  if (!Number.isInteger(id) || id < 1) {
    throw new Error('ID must be a positive integer');
  }
  // ...
}

// Bad: No validation
function getAsset(id) {
  return api.getAsset(id);
}
```

**Error Handling:**
```typescript
// Good: Sanitized errors
try {
  await api.call();
} catch (error) {
  const message = ErrorHandler.sanitize(error);
  return { error: message };
}

// Bad: Expose internal errors
try {
  await api.call();
} catch (error) {
  return { error: error.message };
}
```

**Security:**
```typescript
// Good: HTTPS only
if (!url.startsWith('https://')) {
  throw new Error('Must use HTTPS');
}

// Bad: Allow HTTP
// No validation
```

---

### Documentation

**JSDoc Comments:**
```typescript
/**
 * Validates an asset ID
 * @param id - The asset ID to validate
 * @param fieldName - Name of the field (for error messages)
 * @returns Validated ID as number
 * @throws Error if ID is invalid
 */
function validateId(id: any, fieldName: string = 'id'): number {
  // ...
}
```

**Inline Comments:**
```typescript
// Comment complex logic
// Calculate 95th percentile response time
const p95 = calculatePercentile(responseTimes, 0.95);

// Not obvious things
// Retry with exponential backoff
await retry(operation, { maxRetries: 3, backoff: 'exponential' });
```

---

## Testing

### Writing Tests

**Test Structure:**
```typescript
describe('InputValidator', () => {
  describe('validateId', () => {
    it('should accept positive integers', () => {
      expect(InputValidator.validateId(123)).toBe(123);
    });

    it('should reject negative numbers', () => {
      expect(() => InputValidator.validateId(-1))
        .toThrow('must be a positive integer');
    });

    it('should reject zero', () => {
      expect(() => InputValidator.validateId(0))
        .toThrow('must be a positive integer');
    });

    it('should reject non-integers', () => {
      expect(() => InputValidator.validateId(1.5))
        .toThrow('must be a positive integer');
    });
  });
});
```

**Test Coverage:**
- Aim for >80% coverage
- Test happy path
- Test error cases
- Test edge cases
- Test security controls

**Running Tests:**
```bash
# All tests
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch

# Specific file
npm test validators.test.ts
```

---

## Documentation

### When to Update Docs

**Always update when:**
- Adding new features
- Changing existing behavior
- Adding new configuration options
- Fixing bugs that users might encounter

**Which docs to update:**
- README.md - For major changes
- API docs - For API changes
- Security docs - For security changes
- Troubleshooting - For new issues/fixes

---

### Documentation Style

**Be Clear:**
```markdown
Good:
"Set the SNIPEIT_URL environment variable to your Snipe-IT instance URL.
Must use HTTPS (not HTTP). Example: https://snipeit.company.com"

Bad:
"Configure URL"
```

**Use Examples:**
```markdown
Good:
Example configuration:
```typescript
{
  url: "https://snipeit.example.com",
  token: "abc123..."
}
```

Bad:
"Set the configuration object"
```

**Be Helpful:**
```markdown
Good:
"If you see 'ECONNREFUSED', check that:
1. Snipe-IT URL is correct
2. Snipe-IT is accessible
3. Firewall allows connections"

Bad:
"Fix connection errors"
```

---

## Reporting Bugs

### Before Reporting

1. **Check existing issues:** Bug might be known
2. **Try latest version:** Bug might be fixed
3. **Check docs:** Might be user error

---

### Bug Report Template

```markdown
**Describe the bug**
Clear description of what the bug is

**To Reproduce**
Steps to reproduce:
1. Start server with '...'
2. Call tool '...'
3. See error

**Expected behavior**
What should happen

**Actual behavior**
What actually happens

**Error messages**
```
Full error message here
```

**Environment**
- OS: [e.g., Ubuntu 22.04]
- Node.js version: [e.g., 20.11.0]
- Project version: [e.g., 1.0.0]

**Configuration** (redact secrets!)
```
SNIPEIT_URL=https://snipeit.example.com
SNIPEIT_API_TOKEN=***REDACTED***
```

**Additional context**
Any other relevant information
```

---

## Requesting Features

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
Clear description of the problem

**Describe the solution you'd like**
What should the feature do?

**Describe alternatives you've considered**
Other ways to solve this

**Additional context**
Mockups, examples, etc.

**Would you be willing to contribute this feature?**
- [ ] Yes, I can implement this
- [ ] Yes, with guidance
- [ ] No, but would test
- [ ] No
```

---

## Community

### Communication

**GitHub Discussions:**
- Questions
- Ideas
- Showcases

**GitHub Issues:**
- Bug reports
- Feature requests

**Code of Conduct:**
- Be respectful
- Be professional
- Be helpful
- No harassment
- No spam

---

## Recognition

**Contributors will be:**
- Listed in CHANGELOG.md
- Mentioned in release notes
- Added to contributors list

**Types of contributions recognized:**
- Code
- Documentation
- Bug reports
- Feature ideas
- Help others
- Reviews

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## Questions?

**Need help?**
- Check [FAQ.md](FAQ.md)
- Search existing issues
- Ask in GitHub Discussions

**Found a security issue?**
- See [SECURITY.md](SECURITY.md)
- Don't open public issue
- Email security contact

---

**Thank you for contributing!**

---

**Last Updated:** 2025-02-13
**Version:** 1.0.0
**Maintainers:** See CONTRIBUTORS.md
