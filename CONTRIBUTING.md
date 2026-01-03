# 🤝 Contributing to Auvia

First off, thank you for considering contributing to Auvia! It's people like you that make Auvia such a great tool for music lovers.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Coding Standards](#coding-standards)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Code of Conduct

This project and everyone participating in it is governed by our commitment to providing a welcoming and inclusive environment. Please be respectful and constructive in all interactions.

---

## Getting Started

### Types of Contributions

We welcome many types of contributions:

- 🐛 **Bug fixes** - Found a bug? We'd love a fix!
- ✨ **New features** - Have an idea? Let's discuss it!
- 📖 **Documentation** - Help others understand Auvia
- 🎨 **UI/UX improvements** - Make Auvia more beautiful
- ⚡ **Performance** - Make Auvia faster
- 🧪 **Tests** - Improve code reliability

### What We're Looking For

- Clean, readable code
- Well-documented changes
- Tests for new functionality
- Backwards compatibility when possible

---

## Development Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker and Docker Compose
- Git

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub

2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Auvia.git
   cd Auvia
   ```

3. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/neilyboy/Auvia.git
   ```

4. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

5. **Start development services:**
   ```bash
   docker compose up -d db redis
   ```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173` with hot-reload.

### Backend Development

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start development server
uvicorn app.main:app --reload --port 8001
```

The backend API will be available at `http://localhost:8001`.

### Running Full Stack in Development

```bash
# Start all services in development mode
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

---

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-playlist-support`
- `fix/audio-playback-stutter`
- `docs/update-installation-guide`
- `refactor/improve-search-performance`

### Creating a Branch

```bash
# Ensure you're up to date
git checkout main
git pull upstream main

# Create your branch
git checkout -b feature/your-feature-name
```

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting, no code change
- `refactor` - Code restructuring
- `test` - Adding tests
- `chore` - Maintenance

**Examples:**
```
feat(player): add shuffle mode support

fix(download): resolve timeout on large albums

docs(readme): update installation instructions
```

---

## Coding Standards

### Frontend (JavaScript/React)

- Use functional components with hooks
- Follow React best practices
- Use Tailwind CSS for styling
- Use ESLint configuration provided

```javascript
// Good
const TrackItem = ({ track, onPlay }) => {
  const handleClick = () => {
    onPlay(track);
  };

  return (
    <div onClick={handleClick} className="p-4 hover:bg-gray-800">
      {track.title}
    </div>
  );
};

// Avoid
class TrackItem extends React.Component {
  // ...
}
```

### Backend (Python/FastAPI)

- Follow PEP 8 style guide
- Use type hints
- Use async/await for I/O operations
- Document functions with docstrings

```python
# Good
async def get_album(album_id: int, db: AsyncSession) -> Album:
    """
    Retrieve an album by ID.
    
    Args:
        album_id: The album's database ID
        db: Database session
        
    Returns:
        Album object or None if not found
    """
    result = await db.execute(
        select(Album).where(Album.id == album_id)
    )
    return result.scalar_one_or_none()
```

### Database

- Use SQLAlchemy models
- Write migrations for schema changes
- Index frequently queried columns

### Testing

- Write tests for new features
- Ensure existing tests pass
- Aim for meaningful coverage

```bash
# Run backend tests
cd backend
pytest

# Run frontend tests
cd frontend
npm test
```

---

## Submitting Changes

### Before Submitting

1. **Update your branch:**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run tests:**
   ```bash
   # Backend
   cd backend && pytest
   
   # Frontend
   cd frontend && npm test
   ```

3. **Check linting:**
   ```bash
   # Frontend
   cd frontend && npm run lint
   ```

4. **Test manually:**
   - Verify your changes work
   - Check on different browsers/devices
   - Test edge cases

### Creating a Pull Request

1. Push your branch:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Go to GitHub and create a Pull Request

3. Fill out the PR template:
   - Describe what changes you made
   - Link any related issues
   - Include screenshots for UI changes
   - List testing performed

4. Request review from maintainers

### PR Review Process

1. Maintainers will review your code
2. Address any feedback
3. Once approved, your PR will be merged

---

## Reporting Bugs

### Before Reporting

1. Check existing issues for duplicates
2. Try the latest version
3. Check the troubleshooting guide

### Creating a Bug Report

Use the bug report template and include:

1. **Description** - Clear description of the bug
2. **Steps to Reproduce** - How to trigger the bug
3. **Expected Behavior** - What should happen
4. **Actual Behavior** - What actually happens
5. **Environment** - OS, browser, Docker version
6. **Logs** - Relevant log output (sanitized)
7. **Screenshots** - If applicable

### Example Bug Report

```markdown
## Bug Description
Audio playback stops after 30 seconds on mobile Safari.

## Steps to Reproduce
1. Open Auvia on iPhone Safari
2. Search for any album
3. Click play
4. Wait 30 seconds

## Expected Behavior
Music continues playing

## Actual Behavior
Playback stops, no error shown

## Environment
- iOS 17.1
- Safari
- Auvia v1.0.0

## Logs
[Console output here]
```

---

## Requesting Features

### Before Requesting

1. Check existing feature requests
2. Consider if it fits the project scope
3. Think about implementation complexity

### Creating a Feature Request

Include:

1. **Problem** - What problem does this solve?
2. **Solution** - Your proposed solution
3. **Alternatives** - Other solutions considered
4. **Additional Context** - Screenshots, mockups, etc.

### Example Feature Request

```markdown
## Problem
I want to create playlists but there's no playlist feature.

## Proposed Solution
Add ability to create, edit, and delete custom playlists.

## Features Needed
- Create playlist with name
- Add/remove tracks from playlist
- Reorder tracks in playlist
- Delete playlist

## Mockup
[Attach mockup image]
```

---

## Questions?

- Open a GitHub Discussion for questions
- Check existing discussions first
- Be specific and provide context

---

## Thank You! 🎉

Your contributions make Auvia better for everyone. We appreciate your time and effort!

---

[← Back to README](README.md)
