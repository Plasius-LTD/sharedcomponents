# ADR-0003: Base Package Boundary for Shared Components

- Date: 2026-02-11
- Status: Accepted

## Context

`@plasius/sharedcomponents` is intended to be a foundational UI package, but it
previously imported auth/profile/entity dependencies directly. That made the
package unsuitable as a true base layer and forced unnecessary transitive
dependencies in consumers.

## Decision

Constrain `@plasius/sharedcomponents` to dependency-light, product-agnostic UI:

- Remove direct auth/profile/entity/environment dependencies.
- Keep components configurable via props and callback hooks only.
- Keep optional user-profile UI as a shell that receives behavior from the host app.
- Keep routing concerns outside core components.

## Consequences

- Consumers can adopt base components without inheriting product logic.
- Bundle and dependency surface is smaller and easier to govern.
- Product teams must wire auth/profile behavior in host applications.
