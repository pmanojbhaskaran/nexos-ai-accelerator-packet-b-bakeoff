import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../../modules/auth/jwt-auth.guard";
import { ERR } from "../errors/codes";
import { badRequest } from "../errors/http";
import { parseBoundAuthPrincipal } from "../auth/auth-principal";
const jwt = require("jsonwebtoken");

@Injectable()
export class AuthPrincipalGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest();
    const authHeaderRaw = req?.headers?.authorization;
    const authHeader = typeof authHeaderRaw === "string" ? authHeaderRaw : undefined;

    /* Path 1: Mobile fallback ΓÇö x-auth-sub + x-tenant-id (no Authorization header) */
    if (!authHeader || authHeader.trim() === "") {
      const mobileAuthSub = req?.headers?.["x-auth-sub"];
      const mobileTenantId = req?.headers?.["x-tenant-id"];
      if (typeof mobileAuthSub === "string" && mobileAuthSub.trim() !== "" && typeof mobileTenantId === "string" && mobileTenantId.trim() !== "") {
        req.auth_sub = mobileAuthSub.trim();
        req.auth_tenant_id = mobileTenantId.trim();
        req.auth_principal = { sub: mobileAuthSub.trim(), tenantId: mobileTenantId.trim() };
        return true;
      }
      badRequest([{ code: ERR.AUTH_HEADER_MISSING, message: "authorization header is required" }]);
    }

    /* Path 2: HMAC bounded token (SEC-IMP-001) */
    const hmacSecret = process.env.AUTH_TENANT_BINDING_SECRET || "DEV_ONLY_TENANT_BINDING_SECRET";
    const principal = parseBoundAuthPrincipal(authHeader, hmacSecret);
    if (principal) {
      req.auth_principal = principal;
      req.auth_sub = principal.sub;
      req.auth_tenant_id = principal.tenantId;
      return true;
    }

    /* Path 3: Standard JWT (from auth.service login) */
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (bearerToken) {
      try {
        const jwtSecret = process.env.JWT_SECRET || "bos-jwt-secret-change-in-production";
        const decoded = jwt.verify(bearerToken, jwtSecret) as any;
        const sub = decoded?.sub || "";
        const tenantId = decoded?.tenantId || decoded?.tenantCode || req?.headers?.["x-tenant-id"] || "";
        if (sub) {
          req.auth_principal = { sub, tenantId: tenantId || "" };
          req.auth_sub = sub;
          req.auth_tenant_id = tenantId || "";
          return true;
        }
      } catch { /* JWT invalid ΓÇö fall through to error */ }
    }

    badRequest([{ code: ERR.AUTH_TOKEN_INVALID, message: "authorization token invalid for bounded tenant-binding seam" }]);
    return false;
  }
}
