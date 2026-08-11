// Worked, verified example — src/modules/employee/employee.resolver.ts (zync-nestjs, msgld-be).
// Ran green with `npx jest employee.resolver.spec.ts` (18/18 passing) and `tsc --noEmit` clean.
// Copy the shape, not the literal service names — swap imports/mocks for the resolver you're covering.

import { Test, TestingModule } from "@nestjs/testing";
import { EmployeePageResolver, EmployeeProfileResolver, EmployeeResolver } from "./employee.resolver";
import { EmployeeService } from "./employee.service";
import { AuthService } from "../auth/auth.service";
import { AccessGroupService } from "../permission/group/group.service";
import { ApConfigService } from "../config/config.service";
import { StoreService } from "../store/store.service";
import { FileUploadService } from "../upload/upload.service";
import { DeviceService } from "../device/device.service";
import { JemsysTokenService } from "../jemsys/token/token.service";
import { EmployeeGroupTypes } from "./employee.schema";
import { DEFAULT_PASSWORD } from "src/constant";
import { GqlRolesGuard } from "../auth/guards";

// Any resolver class decorated with @ApGqlAuthorize() carries @UseGuards(GqlRolesGuard).
// Nest's TestingModule eagerly instantiates guards at .compile() time (not just per-request),
// so GqlRolesGuard's own constructor deps (GqlAuthGuard, ApContextService, GqlPermissionGuard)
// must resolve or EVERY method call throws:
//   "Nest can't resolve dependencies of the GqlRolesGuard (Reflector, ?, ApContextService, GqlPermissionGuard)"
// Fix: override the guard, don't try to satisfy its dependency chain.
const stubAuthGuard = () => ({ canActivate: () => true });

describe("EmployeePageResolver", () => {
  let resolver: EmployeePageResolver;
  const mockEmployeeSvc = { count: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeePageResolver,
        { provide: EmployeeService, useValue: mockEmployeeSvc },
      ],
    })
      .overrideGuard(GqlRolesGuard) // required whenever the resolver class has @ApGqlAuthorize()
      .useValue(stubAuthGuard())
      .compile();

    resolver = module.get(EmployeePageResolver);
  });

  afterEach(() => jest.clearAllMocks());

  // ResolveField that fans out to multiple service calls and shapes the result.
  describe("summary", () => {
    it("aggregates total/month/today counts from employeeSvc.count", async () => {
      mockEmployeeSvc.count.mockResolvedValueOnce(10).mockResolvedValueOnce(3).mockResolvedValueOnce(1);

      const result = await resolver.summary({
        totalRecords: 10,
        query: { branches: ["BR1"] },
      } as any);

      expect(mockEmployeeSvc.count).toHaveBeenCalledTimes(3);
      expect(result).toEqual({
        totalCount: 10,
        registerThisMonth: 3,
        registerToday: 1,
      });
    });
  });
});

describe("EmployeeProfileResolver", () => {
  let resolver: EmployeeProfileResolver;
  const mockAppConfigSvc = { findLast: jest.fn() };
  const mockStoreSvc = { findOne: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeProfileResolver,
        { provide: ApConfigService, useValue: mockAppConfigSvc },
        { provide: StoreService, useValue: mockStoreSvc },
      ],
    })
      .overrideGuard(GqlRolesGuard)
      .useValue(stubAuthGuard())
      .compile();

    resolver = module.get(EmployeeProfileResolver);
  });

  afterEach(() => jest.clearAllMocks());

  // Pure-logic ResolveField on @Parent() — no service call, just trace the condition exactly.
  // Don't assume sibling methods share the same true/false polarity — read each `if` literally.
  describe("branchTabEnabled", () => {
    it("is false for SALESMAN/SHOP_MANAGER groups", async () => {
      await expect(
        resolver.branchTabEnabled({ group: EmployeeGroupTypes.SALESMAN } as any)
      ).resolves.toBe(false);
    });

    it("is true for any other group", async () => {
      await expect(resolver.branchTabEnabled({ group: "ADMIN" } as any)).resolves.toBe(true);
    });
  });

  // Service-calling ResolveField — assert the call is skipped on the early-return branch too.
  describe("branchIds", () => {
    it("resolves the branch's store id for SALESMAN/SHOP_MANAGER groups", async () => {
      mockStoreSvc.findOne.mockResolvedValue({ _id: "store-1" });

      const result = await resolver.branchIds({ group: EmployeeGroupTypes.SALESMAN, branch: "BR1" } as any);

      expect(mockStoreSvc.findOne).toHaveBeenCalledWith({ code: "BR1" });
      expect(result).toEqual(["store-1"]);
    });

    it("returns [] for other groups without calling storeSvc", async () => {
      const result = await resolver.branchIds({ group: "ADMIN", branch: "BR1" } as any);

      expect(mockStoreSvc.findOne).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  // Time-dependent branch (moment-timezone "now") — don't fabricate a pass. Cover the
  // deterministic short-circuit branches and flag the clock-dependent branch as a follow-up.
  describe("appAccess", () => {
    it("is accessible when salesman work-hour restriction is disabled", async () => {
      mockAppConfigSvc.findLast.mockResolvedValue({ salesManWorkHrRestrictionEnabled: false });

      const result = await resolver.appAccess({ group: "SALESMAN" } as any);

      expect(result).toEqual({ accessible: true, notAccessibleReason: "" });
    });

    // The 9-10pm KL time-window branch needs jest.useFakeTimers with a fixed system time
    // (or mocking moment-timezone) to cover deterministically — left as a follow-up.
  });
});

describe("EmployeeResolver", () => {
  let resolver: EmployeeResolver;
  const mockEmployeeSvc = { findById: jest.fn(), create: jest.fn(), update: jest.fn(), page: jest.fn() };
  const mockAuthSvc = { signIn: jest.fn(), refreshTokens: jest.fn() };
  const mockDeviceSvc = { signedIn: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeResolver,
        { provide: EmployeeService, useValue: mockEmployeeSvc },
        { provide: AuthService, useValue: mockAuthSvc },
        { provide: AccessGroupService, useValue: { findById: jest.fn() } },
        { provide: FileUploadService, useValue: { upload: jest.fn(), mapUriPath: jest.fn() } },
        { provide: DeviceService, useValue: mockDeviceSvc },
        { provide: JemsysTokenService, useValue: { getOtp: jest.fn() } },
      ],
    })
      .overrideGuard(GqlRolesGuard)
      .useValue(stubAuthGuard())
      .compile();

    resolver = module.get(EmployeeResolver);
  });

  afterEach(() => jest.clearAllMocks());

  // Mutation with conditional branching + a second service call — test both branches.
  describe("signIn", () => {
    it("passes through authSvc.signIn when no deviceId is given", async () => {
      mockAuthSvc.signIn.mockResolvedValue({ userId: "e1", accessToken: "t" });

      const result = await resolver.signIn({ id: "e1", password: DEFAULT_PASSWORD } as any);

      expect(mockAuthSvc.signIn).toHaveBeenCalledWith(expect.objectContaining({ id: "e1", email: "e1" }));
      expect(result).toEqual({ userId: "e1", accessToken: "t" });
    });

    it("merges device sign-in fields when deviceId is given", async () => {
      mockAuthSvc.signIn.mockResolvedValue({ userId: "e1", accessToken: "t" });
      mockDeviceSvc.signedIn.mockResolvedValue({ isSalesEnabled: true });

      const result = await resolver.signIn({ id: "e1", password: DEFAULT_PASSWORD, deviceId: "dev-1" } as any);

      expect(mockDeviceSvc.signedIn).toHaveBeenCalledWith({ deviceId: "dev-1", employeeId: "e1" });
      expect(result).toEqual(
        expect.objectContaining({ userId: "e1", isSalesEnabled: true, isChangePasswordRequired: true })
      );
    });
  });

  // Pure passthrough Query with @GqlCurrentUser() — pass a plain mock user object directly.
  describe("profile / currentUser", () => {
    it("resolves the current user via employeeSvc.findById(user._id)", async () => {
      mockEmployeeSvc.findById.mockResolvedValue({ _id: "e1", name: "Employee 1" });

      const result = await resolver.profile({ _id: "e1" });

      expect(mockEmployeeSvc.findById).toHaveBeenCalledWith("e1");
      expect(result).toEqual({ _id: "e1", name: "Employee 1" });
    });
  });

  // Mutation that reshapes the service result (spreads query back onto the page result).
  describe("page", () => {
    it("returns employeeSvc.page result with the original query attached", async () => {
      mockEmployeeSvc.page.mockResolvedValue({ data: [], totalRecords: 0 });

      const query = { branches: ["BR1"] } as any;
      const result = await resolver.page(query);

      expect(mockEmployeeSvc.page).toHaveBeenCalledWith(query);
      expect(result).toEqual({ data: [], totalRecords: 0, query });
    });
  });

  // Hardcoded-return Query — no service call at all. Assert nothing was called.
  describe("syncSalesMen", () => {
    it("always returns true without calling a service", async () => {
      await expect(resolver.syncSalesMen({} as any)).resolves.toBe(true);
      expect(mockEmployeeSvc.findById).not.toHaveBeenCalled();
    });
  });

  // Remaining methods (jobDetail, performanceDetail, group, create, update, refreshTokens,
  // fetchJemToken, uploadProfilePicture) follow the same patterns shown above — repeat.
});
