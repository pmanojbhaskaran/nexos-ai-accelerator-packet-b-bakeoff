// tenant-provisioning.service.ts ΓÇö Phase A: Full tenant sign-up flow
// Flow: Sign up -> Create Org -> Create Admin User -> Assign TENANT_ADMIN role -> Create Subscription -> Default Config
import { MVP_MILESTONE_CODES } from '../../modules/saas-platform/saas-platform.contract';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';

@Injectable()
export class TenantProvisioningService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}

  // Full sign-up flow ΓÇö creates everything a new tenant needs
  async provisionTenant(dto: { orgName: string; adminEmail: string; adminName: string; password: string; planCode?: string; mobileNumber?: string }) {
    if (!dto.orgName?.trim() || !dto.adminEmail?.trim() || !dto.adminName?.trim() || !dto.password) {
      throw new HttpException({ errors: [{ code: 'PROV_INVALID_INPUT', message: 'orgName, adminEmail, adminName, and password are required' }] }, HttpStatus.BAD_REQUEST);
    }

    const provCode = 'PROV-' + Date.now().toString(36).toUpperCase();
    const steps: Record<string, string> = {};

    // Create provisioning record to track progress
    const prov = await (this.prisma as any).tenantProvisioningRecord.create({
      data: { provisionCode: provCode, orgName: dto.orgName.trim(), adminEmail: dto.adminEmail.toLowerCase().trim(), adminName: dto.adminName.trim(), planCode: dto.planCode || 'STARTER', status: 'IN_PROGRESS' },
    });

    try {
      // Step 1: Create Organization
      const tenantCode = 'T-' + Date.now().toString(36).toUpperCase();
      const org = await (this.prisma as any).organization.create({
        data: { name: dto.orgName.trim(), slug: tenantCode.toLowerCase(), tenantCode, billingEmail: dto.adminEmail.toLowerCase().trim(), status: 'ACTIVE' },
      });
      steps['1_org_created'] = org.id;

      // Step 2: Register admin user
      const authResult = await this.auth.register({ tenantCode, email: dto.adminEmail.toLowerCase().trim(), password: dto.password, displayName: dto.adminName.trim(), mobileNumber: dto.mobileNumber });
      steps['2_admin_user_created'] = authResult.user.id;

      // Step 3: Assign TENANT_ADMIN role
      await (this.prisma as any).userRoleAssignment.create({
        data: { tenantCode, userId: authResult.user.id, roleCode: 'TENANT_ADMIN', assignedBy: 'SYSTEM', assignedAt: new Date() },
      });
      steps['3_admin_role_assigned'] = 'TENANT_ADMIN';

      // Step 4: Create UserMembership
      await (this.prisma as any).userMembership.create({
        data: { userId: authResult.user.id, organizationId: org.id, role: 'OWNER', status: 'ACTIVE' },
      });
      steps['4_membership_created'] = 'OWNER';

      // Step 5: Create default Plan + Subscription (if plan models exist)
      try {
        const plan = await (this.prisma as any).plan.findFirst({ where: { code: dto.planCode || 'STARTER', status: 'ACTIVE' } });
        if (plan) {
          const sub = await (this.prisma as any).subscription.create({
            data: { organizationId: org.id, planId: plan.id, status: 'ACTIVE', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000) },
          });
          steps['5_subscription_created'] = sub.id;
        } else {
          steps['5_subscription_created'] = 'SKIPPED_NO_PLAN';
        }
      } catch { steps['5_subscription_created'] = 'SKIPPED_ERROR'; }

      // Step 6: Create default ActivationMilestones (from single source of truth)
      try {
        for (const m of MVP_MILESTONE_CODES) {
          const isAutoAchieved = m.code === 'ORG_CREATED';
          await (this.prisma as any).activationMilestone.upsert({
            where: { tenantId_milestoneCode: { tenantId: tenantCode, milestoneCode: m.code } },
            update: {},
            create: { tenantId: tenantCode, milestoneCode: m.code, milestoneName: m.name, status: isAutoAchieved ? 'ACHIEVED' : 'PENDING', achievedAt: isAutoAchieved ? new Date() : null },
          });
        }
        steps['6_activation_milestones'] = MVP_MILESTONE_CODES.length.toString();
      } catch { steps['6_activation_milestones'] = 'SKIPPED_ERROR'; }

      // Update provisioning record ΓÇö SUCCESS
      await (this.prisma as any).tenantProvisioningRecord.update({
        where: { id: prov.id },
        data: { organizationId: org.id, adminUserId: authResult.user.id, stepsCompleted: steps, status: 'COMPLETED', completedAt: new Date() },
      });

      return {
        provisionCode: provCode,
        status: 'COMPLETED',
        organization: { id: org.id, name: org.name, tenantCode },
        adminUser: { id: authResult.user.id, email: authResult.user.email, displayName: authResult.user.displayName },
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
        steps,
        nextSteps: ['Configure facilities', 'Add lanes', 'Add first customer', 'Create first shipment'],
      };
    } catch (err: any) {
      await (this.prisma as any).tenantProvisioningRecord.update({
        where: { id: prov.id },
        data: { stepsCompleted: steps, status: 'FAILED', errorMessage: err.message },
      });
      throw err;
    }
  }

  // Get provisioning status
  async getProvisioningStatus(provisionCode: string) {
    const p = await (this.prisma as any).tenantProvisioningRecord.findUnique({ where: { provisionCode } });
    if (!p) throw new HttpException({ errors: [{ code: 'PROV_NOT_FOUND', message: 'Provisioning record not found' }] }, HttpStatus.NOT_FOUND);
    return p;
  }

  // List all provisioning records (platform admin)
  async listProvisionings(status?: string) {
    const w: any = {};
    if (status) w.status = status;
    return (this.prisma as any).tenantProvisioningRecord.findMany({ where: w, orderBy: { createdAt: 'desc' }, take: 50 });
  }
}
