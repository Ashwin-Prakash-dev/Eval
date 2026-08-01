export interface AuditLogOut {
  id: number;
  user_id: number | null;
  email: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: Record<string, unknown>;
  created_at: string;
}
