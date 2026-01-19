# NEXUS Bot Control Dashboard

## Overview

This is a Discord bot management dashboard with a cyberpunk/gaming aesthetic. The application provides a web interface to monitor bot status, view system logs, and configure bot settings. It features a React frontend with a dark neon-themed UI and an Express backend that integrates with Discord.js for bot functionality.

The system tracks workouts, deadlines, and sends motivational quotes/training suggestions through Discord, making it suitable for fitness-focused Discord communities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state with automatic polling
- **Styling**: Tailwind CSS with custom cyberpunk theme (neon purple/green/pink accents, dark backgrounds)
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Animations**: Framer Motion for page transitions and card animations
- **Fonts**: Orbitron (display/headers) and Rajdhani (body text) for sci-fi aesthetic

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Bot Integration**: Discord.js for Discord bot functionality
- **API Design**: RESTful endpoints defined in `shared/routes.ts` with Zod validation
- **Build System**: Vite for frontend, esbuild for server bundling
- **Development**: Vite dev server with HMR proxied through Express

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Tables**: logs, settings, workouts, deadlines
- **Migrations**: Managed via `drizzle-kit push`

### Key Design Patterns
- **Shared Types**: Schema and route definitions in `shared/` directory are consumed by both frontend and backend
- **Type-Safe API**: Zod schemas validate both request inputs and response outputs
- **Polling Strategy**: Bot status polls every 5 seconds, logs every 10 seconds for real-time updates
- **Component Architecture**: Reusable UI components in `client/src/components/ui/`, page components in `client/src/pages/`

### Project Structure
```
client/           # React frontend
  src/
    components/   # Reusable components including shadcn/ui
    pages/        # Page components (Dashboard, Logs, Settings)
    hooks/        # Custom React hooks for data fetching
    lib/          # Utilities and query client setup
server/           # Express backend
  bot.ts          # Discord bot service
  db.ts           # Database connection
  routes.ts       # API route handlers
  storage.ts      # Data access layer
shared/           # Shared code between frontend and backend
  schema.ts       # Drizzle database schema
  routes.ts       # API route definitions with Zod validation
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### Discord Integration
- **Discord.js**: Bot framework for Discord API
- **DISCORD_TOKEN**: Environment variable required for bot authentication

### UI Framework Dependencies
- **Radix UI**: Accessible component primitives (dialogs, dropdowns, tooltips, etc.)
- **shadcn/ui**: Pre-built component library configured in `components.json`
- **Tailwind CSS**: Utility-first CSS framework with custom theme configuration

### Build & Development
- **Vite**: Frontend build tool with React plugin
- **esbuild**: Server bundling for production
- **TypeScript**: Full type coverage across the stack

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `DISCORD_TOKEN`: Discord bot authentication token