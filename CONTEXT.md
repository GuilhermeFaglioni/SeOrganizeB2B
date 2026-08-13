# SeOrganize+

SeOrganize+ is a workspace for digital service providers that combines delivery (tasks, projects, calendar, documents) with the commercial/financial cycle (proposals, contracts, clients, receivables). This glossary pins the language used in issues, refactors, and tests.

## Language

**Prestador digital (Digital Service Provider)**:
The business that runs on SeOrganize+ — a freelancer, consultancy, small agency, or dev/PM selling their own services. Operates solo or with a team of members.
_Avoid_: B2B team, account

**Cliente (Client)**:
The end customer who buys services from the prestador digital. Distinct from the prestador and its members.
_Avoid_: account, user, customer

## UI Terminology (pt-BR → en / code model)

| pt-BR UI | en UI | Code model / identifier |
|---|---|---|
| Empresa | Company | `Workspace` |
| Permissões | Permissions | `Role` |
| Filtros salvos | Saved filters | `SavedView` |
| Painel | Dashboard | cockpit/executive cockpit |

Rules:
- UI strings (i18n, labels, headings) use the pt-BR/en columns.
- Code identifiers (Prisma models, API routes, function names) keep the code column unchanged.
- When translating "workspace" in user-facing copy, prefer "empresa" (pt-BR) / "company" (en).
