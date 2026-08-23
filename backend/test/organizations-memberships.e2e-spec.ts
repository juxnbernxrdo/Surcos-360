/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupabaseAuthService } from '../src/auth/services/supabase-auth.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import {
  UserType,
  InstitutionStatus,
  OrganizationRole,
  OrganizationStatus,
  MembershipStatus,
  TokenStatus,
} from '@prisma/client';

describe('Organizations & Memberships Multi-Tenant Architecture (e2e)', () => {
  let app: INestApplication;
  let currentAuthUser: any = null;

  const mockDb = {
    organizations: new Map<string, any>(),
    persons: new Map<string, any>(),
    memberships: new Map<string, any>(),
    invitations: new Map<string, any>(),
    auditLogs: [] as any[],
  };

  const mockPrismaService: any = {
    organization: {
      findUnique: jest.fn(({ where }) => {
        if (where.id) return Promise.resolve(mockDb.organizations.get(where.id) || null);
        if (where.code) {
          const org = Array.from(mockDb.organizations.values()).find(
            (o) => o.code.toUpperCase() === where.code.toUpperCase(),
          );
          return Promise.resolve(org || null);
        }
        return Promise.resolve(null);
      }),
      findFirst: jest.fn(({ where }) => {
        if (where.OR) {
          const matched = Array.from(mockDb.organizations.values()).find((o) =>
            where.OR.some((cond: any) => cond.id === o.id || cond.code === o.code),
          );
          return Promise.resolve(matched || null);
        }
        if (where.code) {
          const org = Array.from(mockDb.organizations.values()).find(
            (o) => o.code === where.code,
          );
          return Promise.resolve(org || null);
        }
        return Promise.resolve(null);
      }),
      findMany: jest.fn(() => Promise.resolve(Array.from(mockDb.organizations.values()))),
      count: jest.fn(() => Promise.resolve(mockDb.organizations.size)),
      create: jest.fn(({ data }) => {
        const record = {
          id: data.id || `org-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          status: OrganizationStatus.ACTIVE,
          isPyme: true,
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        mockDb.organizations.set(record.id, record);
        return Promise.resolve(record);
      }),
      update: jest.fn(({ where, data }) => {
        const existing = mockDb.organizations.get(where.id);
        if (!existing) return Promise.resolve(null);
        const updated = { ...existing, ...data, updatedAt: new Date() };
        mockDb.organizations.set(where.id, updated);
        return Promise.resolve(updated);
      }),
    },
    institutionalPerson: {
      findUnique: jest.fn(({ where }) => {
        if (where.id) return Promise.resolve(mockDb.persons.get(where.id) || null);
        if (where.email) {
          const p = Array.from(mockDb.persons.values()).find(
            (x) => x.email.toLowerCase() === where.email.toLowerCase(),
          );
          return Promise.resolve(p || null);
        }
        return Promise.resolve(null);
      }),
      create: jest.fn(({ data }) => {
        const record = {
          id: data.id || `person-${Date.now()}`,
          status: InstitutionStatus.ACTIVE,
          userType: UserType.TEACHER,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        mockDb.persons.set(record.id, record);
        return Promise.resolve(record);
      }),
    },
    membership: {
      findUnique: jest.fn(({ where }) => {
        if (where.id) return Promise.resolve(mockDb.memberships.get(where.id) || null);
        if (where.institutionalPersonId_organizationId) {
          const { institutionalPersonId, organizationId } =
            where.institutionalPersonId_organizationId;
          const found = Array.from(mockDb.memberships.values()).find(
            (m) =>
              m.institutionalPersonId === institutionalPersonId &&
              m.organizationId === organizationId,
          );
          return Promise.resolve(found || null);
        }
        return Promise.resolve(null);
      }),
      findFirst: jest.fn(({ where }) => {
        const all = Array.from(mockDb.memberships.values());
        const found = all.find((m) => {
          if (where.organizationId && m.organizationId !== where.organizationId)
            return false;
          if (
            where.institutionalPersonId &&
            m.institutionalPersonId !== where.institutionalPersonId
          )
            return false;
          if (where.role && m.role !== where.role) return false;
          if (where.status && m.status !== where.status) return false;
          if (where.id?.not && m.id === where.id.not) return false;
          return true;
        });
        return Promise.resolve(found || null);
      }),
      findMany: jest.fn(({ where }) => {
        let list = Array.from(mockDb.memberships.values());
        if (where?.organizationId) {
          list = list.filter((m) => m.organizationId === where.organizationId);
        }
        if (where?.institutionalPersonId) {
          list = list.filter(
            (m) => m.institutionalPersonId === where.institutionalPersonId,
          );
        }
        if (where?.role) {
          list = list.filter((m) => m.role === where.role);
        }
        if (where?.status) {
          list = list.filter((m) => m.status === where.status);
        }
        return Promise.resolve(
          list.map((m) => ({
            ...m,
            organization: mockDb.organizations.get(m.organizationId),
            institutionalPerson: mockDb.persons.get(m.institutionalPersonId),
          })),
        );
      }),
      count: jest.fn(() => Promise.resolve(mockDb.memberships.size)),
      create: jest.fn(({ data }) => {
        const record = {
          id: data.id || `mem-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          status: MembershipStatus.ACTIVE,
          permissions: [],
          role: OrganizationRole.USER,
          joinedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        mockDb.memberships.set(record.id, record);
        return Promise.resolve({
          ...record,
          organization: mockDb.organizations.get(record.organizationId),
          institutionalPerson: mockDb.persons.get(record.institutionalPersonId),
        });
      }),
      update: jest.fn(({ where, data }) => {
        const existing = mockDb.memberships.get(where.id);
        if (!existing) return Promise.resolve(null);
        const updated = { ...existing, ...data, updatedAt: new Date() };
        mockDb.memberships.set(where.id, updated);
        return Promise.resolve({
          ...updated,
          organization: mockDb.organizations.get(updated.organizationId),
          institutionalPerson: mockDb.persons.get(updated.institutionalPersonId),
        });
      }),
      delete: jest.fn(({ where }) => {
        const existing = mockDb.memberships.get(where.id);
        mockDb.memberships.delete(where.id);
        return Promise.resolve(existing);
      }),
    },
    organizationInvitation: {
      findUnique: jest.fn(({ where }) => {
        if (where.id) return Promise.resolve(mockDb.invitations.get(where.id) || null);
        if (where.tokenHash) {
          const inv = Array.from(mockDb.invitations.values()).find(
            (i) => i.tokenHash === where.tokenHash,
          );
          if (!inv) return Promise.resolve(null);
          return Promise.resolve({
            ...inv,
            organization: mockDb.organizations.get(inv.organizationId),
            inviter: mockDb.persons.get(inv.invitedBy) || {
              firstName: 'Admin',
              lastName: 'User',
              email: 'admin@colegiosurcos.edu.ec',
            },
          });
        }
        return Promise.resolve(null);
      }),
      findMany: jest.fn(({ where }) => {
        let list = Array.from(mockDb.invitations.values());
        if (where?.organizationId) {
          list = list.filter((i) => i.organizationId === where.organizationId);
        }
        return Promise.resolve(list);
      }),
      create: jest.fn(({ data }) => {
        const record = {
          id: data.id || `inv-${Date.now()}`,
          status: TokenStatus.ACTIVE,
          maxUses: 1,
          usesCount: 0,
          permissions: [],
          role: OrganizationRole.USER,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        mockDb.invitations.set(record.id, record);
        return Promise.resolve({
          ...record,
          organization: mockDb.organizations.get(record.organizationId),
          inviter: mockDb.persons.get(record.invitedBy) || {
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@colegiosurcos.edu.ec',
          },
        });
      }),
      update: jest.fn(({ where, data }) => {
        const existing = mockDb.invitations.get(where.id);
        if (!existing) return Promise.resolve(null);
        const updated = { ...existing, ...data, updatedAt: new Date() };
        mockDb.invitations.set(where.id, updated);
        return Promise.resolve(updated);
      }),
      updateMany: jest.fn(({ where, data }) => {
        let count = 0;
        for (const [id, inv] of mockDb.invitations.entries()) {
          if (
            inv.organizationId === where.organizationId &&
            inv.email === where.email &&
            inv.status === where.status
          ) {
            mockDb.invitations.set(id, { ...inv, ...data });
            count++;
          }
        }
        return Promise.resolve({ count });
      }),
    },
    auditLog: {
      create: jest.fn(({ data }) => {
        const log = { id: `audit-${Date.now()}`, createdAt: new Date(), ...data };
        mockDb.auditLogs.push(log);
        return Promise.resolve(log);
      }),
    },
    ledgerAccount: {
      upsert: jest.fn(({ create }) =>
        Promise.resolve({
          id: `acc-${create.code}`,
          organizationId: create.organizationId,
          code: create.code,
          name: create.name,
          type: create.type,
        }),
      ),
      findUnique: jest.fn(() => Promise.resolve(null)),
      findFirst: jest.fn(() => Promise.resolve(null)),
      findMany: jest.fn(() => Promise.resolve([])),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  beforeAll(async () => {
    // Seed initial test domain data
    const orgAgroRed = {
      id: 'org-agrored-id',
      name: 'AgroRed',
      code: 'AGRORED',
      isPyme: true,
      status: OrganizationStatus.ACTIVE,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const orgFit = {
      id: 'org-fit-id',
      name: 'Surcos Fit',
      code: 'FIT',
      isPyme: true,
      status: OrganizationStatus.ACTIVE,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDb.organizations.set(orgAgroRed.id, orgAgroRed);
    mockDb.organizations.set(orgFit.id, orgFit);

    const personAuthority = {
      id: 'person-authority-id',
      email: 'rector@colegiosurcos.edu.ec',
      firstName: 'Rector',
      lastName: 'Surcos',
      userType: UserType.AUTHORITY,
      status: InstitutionStatus.ACTIVE,
    };
    const personAdminAgro = {
      id: 'person-admin-agro-id',
      email: 'admin.agro@colegiosurcos.edu.ec',
      firstName: 'Admin',
      lastName: 'AgroRed',
      userType: UserType.TEACHER,
      status: InstitutionStatus.ACTIVE,
    };
    const personUserAgro = {
      id: 'person-user-agro-id',
      email: 'user.agro@colegiosurcos.edu.ec',
      firstName: 'Operador',
      lastName: 'AgroRed',
      userType: UserType.TEACHER,
      status: InstitutionStatus.ACTIVE,
    };
    const personStudent = {
      id: 'person-student-id',
      email: 'juan.perez_est@colegiosurcos.edu.ec',
      firstName: 'Juan',
      lastName: 'Pérez',
      userType: UserType.STUDENT,
      status: InstitutionStatus.ACTIVE,
    };

    mockDb.persons.set(personAuthority.id, personAuthority);
    mockDb.persons.set(personAdminAgro.id, personAdminAgro);
    mockDb.persons.set(personUserAgro.id, personUserAgro);
    mockDb.persons.set(personStudent.id, personStudent);

    // Memberships: Admin of AgroRed, User of AgroRed (with inventory permissions)
    const memAdminAgro = {
      id: 'mem-admin-agro-id',
      organizationId: orgAgroRed.id,
      institutionalPersonId: personAdminAgro.id,
      role: OrganizationRole.ADMIN,
      permissions: [],
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
    };
    const memUserAgro = {
      id: 'mem-user-agro-id',
      organizationId: orgAgroRed.id,
      institutionalPersonId: personUserAgro.id,
      role: OrganizationRole.USER,
      permissions: ['inventory.read', 'inventory.create', 'members.read'],
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
    };
    mockDb.memberships.set(memAdminAgro.id, memAdminAgro);
    mockDb.memberships.set(memUserAgro.id, memUserAgro);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          if (!currentAuthUser) return false;
          req.user = {
            id: currentAuthUser.id,
            userId: currentAuthUser.id,
            institutionalPerson: currentAuthUser,
            memberships: Array.from(mockDb.memberships.values()).filter(
              (m) => m.institutionalPersonId === currentAuthUser.id,
            ),
          };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('1. Organization Lifecycle & Authority Governance (§4 PRD v1.0)', () => {
    it('should allow Platform AUTHORITY to create a new organization', async () => {
      currentAuthUser = mockDb.persons.get('person-authority-id');

      const res = await request(app.getHttpServer())
        .post('/organizations')
        .send({
          name: 'Surcasino',
          code: 'SURCASINO',
          description: 'PYME de juegos de mesa y material lúdico',
          isPyme: true,
        })
        .expect(201);

      expect(res.body.code).toBe('SURCASINO');
      expect(res.body.status).toBe(OrganizationStatus.ACTIVE);
    });

    it('should reject non-authority users from creating organizations (403 Forbidden)', async () => {
      currentAuthUser = mockDb.persons.get('person-student-id');

      await request(app.getHttpServer())
        .post('/organizations')
        .send({
          name: 'Unauthorized Org',
          code: 'UNAUTH',
        })
        .expect(403);
    });

    it('should list all organizations with query parameters', async () => {
      currentAuthUser = mockDb.persons.get('person-user-agro-id');

      const res = await request(app.getHttpServer())
        .get('/organizations')
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should retrieve single organization by code or ID', async () => {
      currentAuthUser = mockDb.persons.get('person-user-agro-id');

      const res = await request(app.getHttpServer())
        .get('/organizations/AGRORED')
        .expect(200);

      expect(res.body.name).toBe('AgroRed');
    });
  });

  describe('2. Multi-Tenant Isolation & Cross-Tenant Defense (§13, §14 PRD v1.0)', () => {
    it('should reject a user with membership in AgroRed attempting to access Surcos Fit (403 Forbidden)', async () => {
      currentAuthUser = mockDb.persons.get('person-user-agro-id');

      const res = await request(app.getHttpServer())
        .get('/organizations/org-fit-id/members')
        .expect(403);

      expect(res.body.message).toContain('Access denied');
    });

    it('should reject student without membership attempting to access member list (403 Forbidden)', async () => {
      currentAuthUser = mockDb.persons.get('person-student-id');

      await request(app.getHttpServer())
        .get('/organizations/org-agrored-id/members')
        .expect(403);
    });

    it('should allow user with required permission (members.read) to list members of their organization', async () => {
      currentAuthUser = mockDb.persons.get('person-user-agro-id');

      const res = await request(app.getHttpServer())
        .get('/organizations/org-agrored-id/members')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('3. Single ADMIN Rule & Admin Leadership Protection (§4.2, §19 PRD v1.0)', () => {
    it('should reject adding a second ADMIN to an organization that already has an ADMIN', async () => {
      currentAuthUser = mockDb.persons.get('person-admin-agro-id');

      const res = await request(app.getHttpServer())
        .post('/organizations/org-agrored-id/members')
        .send({
          institutionalPersonId: 'person-student-id',
          role: OrganizationRole.ADMIN,
        })
        .expect(400);

      expect(res.body.message).toContain('Solo se permite un ADMIN por organización');
    });

    it('should reject suspending the sole active ADMIN of an organization', async () => {
      currentAuthUser = mockDb.persons.get('person-admin-agro-id');

      const res = await request(app.getHttpServer())
        .patch('/memberships/mem-admin-agro-id/status')
        .send({
          status: MembershipStatus.SUSPENDED,
        })
        .expect(400);

      expect(res.body.message).toContain('No se puede suspender ni revocar al Administrador (ADMIN)');
    });

    it('should reject removing/deleting the sole active ADMIN of an organization', async () => {
      currentAuthUser = mockDb.persons.get('person-admin-agro-id');

      const res = await request(app.getHttpServer())
        .delete('/memberships/mem-admin-agro-id')
        .expect(400);

      expect(res.body.message).toContain('No se puede eliminar la membresía del Administrador');
    });

    it('should atomically transfer ADMIN role from current admin to another member', async () => {
      currentAuthUser = mockDb.persons.get('person-admin-agro-id');

      const res = await request(app.getHttpServer())
        .post('/organizations/org-agrored-id/transfer-admin')
        .send({
          newAdminPersonId: 'person-user-agro-id',
          reason: 'Promoted to lead operator',
        })
        .expect(201);

      expect(res.body.message).toContain('transferida exitosamente');
    });
  });

  describe('4. Cryptographic Organization Invitations Lifecycle (§9, §10, §11 PRD v1.0)', () => {
    let generatedToken: string;

    it('should allow ADMIN to generate a secure invitation token', async () => {
      currentAuthUser = mockDb.persons.get('person-user-agro-id'); // Now the new ADMIN of AgroRed

      const res = await request(app.getHttpServer())
        .post('/organizations/org-agrored-id/invitations')
        .send({
          email: 'invited.teacher@colegiosurcos.edu.ec',
          role: OrganizationRole.USER,
          permissions: ['inventory.read', 'sales.create'],
          expiresInDays: 7,
        })
        .expect(201);

      expect(res.body.plaintextToken).toBeDefined();
      expect(res.body.plaintextToken).toMatch(/^org_inv_[0-9a-f]{64}$/);
      expect(res.body.invitation.status).toBe(TokenStatus.ACTIVE);

      generatedToken = res.body.plaintextToken;
    });

    it('should allow public verification of invitation token', async () => {
      const res = await request(app.getHttpServer())
        .post('/memberships/invitations/verify')
        .send({ token: generatedToken })
        .expect(200);

      expect(res.body.organizationName).toBe('AgroRed');
      expect(res.body.role).toBe(OrganizationRole.USER);
    });

    it('should allow an authenticated user to claim the invitation and create active membership', async () => {
      // Student claims the invitation to join AgroRed
      currentAuthUser = mockDb.persons.get('person-student-id');

      const res = await request(app.getHttpServer())
        .post('/memberships/invitations/claim')
        .send({ token: generatedToken })
        .expect(200);

      expect(res.body.message).toContain('Membresía creada');
      expect(res.body.membership.organizationId).toBe('org-agrored-id');
      expect(res.body.membership.status).toBe(MembershipStatus.ACTIVE);
    });

    it('should prevent replay of consumed invitation token (400 Bad Request)', async () => {
      currentAuthUser = mockDb.persons.get('person-student-id');

      const res = await request(app.getHttpServer())
        .post('/memberships/invitations/claim')
        .send({ token: generatedToken })
        .expect(400);

      expect(res.body.message).toContain('no se encuentra activa');
    });
  });

  describe('5. Member Removal Preserves Global User Identity (§18 PRD v1.0)', () => {
    it('should remove membership without deleting institutional person or user from Surcos 360', async () => {
      currentAuthUser = mockDb.persons.get('person-user-agro-id'); // ADMIN

      // Find student's membership in AgroRed
      const studentMembership = Array.from(mockDb.memberships.values()).find(
        (m) =>
          m.institutionalPersonId === 'person-student-id' &&
          m.organizationId === 'org-agrored-id',
      );

      expect(studentMembership).toBeDefined();

      const res = await request(app.getHttpServer())
        .delete(`/memberships/${studentMembership.id}`)
        .expect(200);

      expect(res.body.message).toContain('permanece intacta en Surcos 360');

      // Verify the person still exists in DB
      expect(mockDb.persons.has('person-student-id')).toBe(true);
    });
  });
});
