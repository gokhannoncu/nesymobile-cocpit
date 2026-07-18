/** Must match apps/api field-courier-login-orchestrator SYSTEM_WORKFLOW_SLUG. */
export const FIELD_COURIER_LOGIN_WORKFLOW_SLUG = 'field-courier-login'

export function isHiddenSystemWorkflow(slug: string | null | undefined): boolean {
  return slug === FIELD_COURIER_LOGIN_WORKFLOW_SLUG
}
