# 🥑 Joe's Keto

A React-based meal planning and workout tracking app for keto lifestyle management. Track meals, plan your week, manage workouts, and generate shopping lists automatically.

## Features

- 🍽️ **Meal Management**: Create and manage keto recipes with ingredients and instructions
- 📅 **Weekly Planner**: Visual calendar to plan meals by day and time
- 💪 **Workout Tracker**: Create workout templates and schedule training sessions
- 🛒 **Smart Shopping List**: Auto-generates shopping lists from your meal plan
- 💾 **Local Storage**: All data persists in your browser (no backend required)
- 🎨 **Clean UI**: Simple, intuitive interface

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone https://github.com/laidbacknet/joes-keto.git
cd joes-keto

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

## Tech Stack

- **React 19** with TypeScript
- **Vite 7** for fast development and building
- **React Router** for navigation
- **localStorage** for data persistence

## Project Structure

```
src/
├── app/              # App layout and routing
├── domain/           # TypeScript types
├── storage/          # Data layer (localStorage)
├── features/
│   ├── Dashboard.tsx      # Today's plan overview
│   ├── meals/            # Meal CRUD
│   ├── plan/             # Weekly meal planner
│   ├── workouts/         # Workout CRUD
│   └── shopping/         # Shopping list
```

## Seed Data

On first run, the app loads with example data:
- 3 keto meal recipes (Pizza, Taco Bowl, Salmon Salad)
- 2 workout templates (Full Body A/B split)

## Development

```bash
# Run dev server
npm run dev

# Build
npm run build

# Lint
npm run lint
```

## License

MIT

