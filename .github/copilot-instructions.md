# Co-Pilot Instructions

# Svelte and SvelteKit

- we use svelte in version v4. for reasons we do not upgrade to v5 yet
- some code is not really written according to svelte. if you notice a chance to be more idiomatic, please suggest it
- we use SvelteKit as our full-stack framework for routing, SSR, and build tooling
- follow SvelteKit conventions for file-based routing in src/routes/
- use SvelteKit's load functions for data fetching when appropriate
- prefer SvelteKit's built-in features over external libraries when possible
- organize API routes under src/routes/api/ (e.g., src/routes/api/merchants/+server.ts)
- use load functions for initial page data, API routes for client-side requests
- use form actions for mutations and form submissions

# tailwindcss

- we use taiwindcss in version v3. for reasons we do not upgrade to v4 yet
- use tailwindcss classes for styling components
- prefer utility-first classes over custom CSS when possible
- use tailwindcss for responsive design and theming

# TypeScript

- we use TypeScript for type safety and better developer experience
- we would like to avoid `any` types. but i.e. some api results are not typed yet. you can suggest to create a type together with the user to establish a type-safe codebase

# html / a11y

- use semantic HTML elements (e.g., <header>, <main>, <footer>, <nav>)
- ensure accessibility (a11y) by using appropriate ARIA roles and attributes
- if you see a potential accessibility issue, suggest improvements
- if you see a potential in valid html, suggest improvements
