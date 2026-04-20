CREATE INDEX "auth_sessions_expires_idx" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_sessions_revoked_idx" ON "auth_sessions" USING btree ("revoked_at");