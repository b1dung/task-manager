import { apiClient } from './client'

export interface Invite {
  id: string
  email: string
  roleId: string | null
  roleName: string | null
  expiresAt: string
  createdAt: string
}

export interface CreatedInvite extends Invite {
  /** Full register link with the raw token — shown once at creation. */
  link: string
}

export interface InviteValidation {
  email: string
  roleName: string | null
}

export const invitesApi = {
  create: (dto: { email: string; roleId?: string }) =>
    apiClient
      .post<{ success: true; data: CreatedInvite }>('/invites', dto)
      .then((r) => r.data.data),

  listPending: () =>
    apiClient
      .get<{ success: true; data: Invite[] }>('/invites')
      .then((r) => r.data.data),

  revoke: (id: string) => apiClient.delete(`/invites/${id}`),

  /** Public — validate a token from the register link. Throws on invalid/expired. */
  validate: (token: string) =>
    apiClient
      .get<{ success: true; data: InviteValidation }>('/invites/validate', {
        params: { token },
      })
      .then((r) => r.data.data),
}
