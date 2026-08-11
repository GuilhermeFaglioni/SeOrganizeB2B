-- T-028: migrate Role.permissions from a string[] of "resource.action" keys
-- to the scoped object format [{ resource, action, scope }].
--
-- Legacy keys are split on the LAST dot so nested modules round-trip:
--   "tasks.view"                       -> { resource: "tasks", action: "view" }
--   "financial.contracts.view"         -> { resource: "financial.contracts", action: "view" }
--   "financial.contracts.lifecycle"    -> { resource: "financial.contracts", action: "lifecycle" }
--   "manage_roles"                     -> { resource: "", action: "manage_roles" }
-- Every migrated permission gets the widest scope: "all".
--
-- Only rows whose permissions array contains exclusively string elements are
-- converted, so already-migrated (object) rows are left untouched.

UPDATE roles
SET permissions = (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'resource',
        CASE
          WHEN position('.' in element) = 0 THEN ''
          ELSE left(element, length(element) - position('.' in reverse(element)))
        END,
        'action',
        CASE
          WHEN position('.' in element) = 0 THEN element
          ELSE right(element, position('.' in reverse(element)) - 1)
        END,
        'scope',
        'all'
      )
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements_text(permissions::jsonb) AS element
)
WHERE jsonb_typeof(permissions::jsonb) = 'array'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(permissions::jsonb) AS element_check
    WHERE jsonb_typeof(element_check) <> 'string'
  );