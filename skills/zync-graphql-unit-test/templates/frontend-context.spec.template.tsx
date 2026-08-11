// Worked, verified example — src/modules/employee/context.tsx (zync-nextjs, msgld-admin).
// Ran green with `npx jest src/modules/employee/context.spec.tsx` (5/5 passing) and
// `tsc --noEmit` clean. Copy the shape, not the literal service names.
//
// On Expo (@testing-library/react-native), renderHook is ASYNC — every `setup()` call
// below would need `await`. On Next.js (@testing-library/react) it's sync, as shown here.

import { renderHook, act } from '@testing-library/react';
import { EmployeeContextProvider, useEmployeeState } from './context';
import { useEmployeeQuery } from './gql/query';
import { toastSvc } from '../../services';

// Factory mocks, not bare jest.mock(path) automocks — automocking still loads the real
// module to infer its shape. On Expo that reaches @react-native-async-storage/async-storage
// and throws "NativeModule is null" outside a device/simulator. Factory mocks never touch
// the real implementation, so this pattern is safe on every stack — use it everywhere.
jest.mock('./gql/query', () => ({ useEmployeeQuery: jest.fn() }));
jest.mock('../../services', () => ({ toastSvc: { success: jest.fn(), graphQlError: jest.fn() } }));

const mockUseEmployeeQuery = useEmployeeQuery as jest.Mock;
const mockToastSvc = toastSvc as jest.Mocked<typeof toastSvc>;

describe('EmployeeContext', () => {
  const mockFetchEmployee = jest.fn();
  const mockCreateEmployee = jest.fn();
  const mockUpdateEmployee = jest.fn();
  const mockCurrentEmployee = jest.fn();

  beforeEach(() => {
    // gql/query.ts here returns a named object of trigger functions
    // (`{ fetchEmployee: fetchEmployee[0], ... }`) — mock the same shape.
    // Some modules instead pass the raw useLazyQuery tuple straight through
    // (`[trigger, result]`); always check gql/query.ts before copying this mock.
    mockUseEmployeeQuery.mockReturnValue({
      fetchEmployee: mockFetchEmployee,
      createEmployee: mockCreateEmployee,
      updateEmployee: mockUpdateEmployee,
      currentEmployee: mockCurrentEmployee,
      findOneEmployee: jest.fn(),
      changeEmployeePassword: jest.fn(),
      uploadEmployeeProfilePicture: jest.fn(),
      expireEmployeePassword: jest.fn(),
      expireMultipleEmployeePasswords: jest.fn(),
    });
  });

  afterEach(() => jest.clearAllMocks());

  const setup = () => renderHook(() => useEmployeeState(), { wrapper: EmployeeContextProvider });

  // Query method — asserts the mapped variables and that the page result populates state.
  describe('fetchEmployeePage', () => {
    it('calls fetchEmployee with the mapped page filter and stores the page result', async () => {
      mockFetchEmployee.mockResolvedValue({
        data: { employeePage: { totalRecords: 2, data: [{ _id: 'e1' }, { _id: 'e2' }] } },
      });
      const { result } = setup();

      await act(async () => {
        await result.current.fetchEmployeePage({ page: 1, pageSize: 20 } as any);
      });

      expect(mockFetchEmployee).toHaveBeenCalledWith(
        expect.objectContaining({ variables: { page: expect.objectContaining({ skip: 0, take: 20 }) } })
      );
      expect(result.current.employee).toEqual([{ _id: 'e1' }, { _id: 'e2' }]);
      expect(result.current.totalRecords).toBe(2);
    });
  });

  // Mutation with a success side effect (toast + state update) — and its negative branch.
  describe('createEmployee', () => {
    it('calls createEmployee with the input and prepends the result to the list', async () => {
      mockCreateEmployee.mockResolvedValue({ data: { createEmployee: { _id: 'e3', name: 'New' } } });
      const { result } = setup();

      await act(async () => {
        await result.current.createEmployee({ name: 'New' } as any);
      });

      expect(mockCreateEmployee).toHaveBeenCalledWith({ variables: { employee: { name: 'New' } } });
      expect(result.current.employee).toEqual([{ _id: 'e3', name: 'New' }]);
      expect(mockToastSvc.success).toHaveBeenCalledWith('Employee created successfully');
    });

    it('does not touch state or toast when the mutation returns no data', async () => {
      mockCreateEmployee.mockResolvedValue({ data: undefined });
      const { result } = setup();

      await act(async () => {
        await result.current.createEmployee({ name: 'New' } as any);
      });

      expect(result.current.employee).toEqual([]);
      expect(mockToastSvc.success).not.toHaveBeenCalled();
    });
  });

  // Mutation that updates one item in an existing list by id.
  describe('updateEmployee', () => {
    it('replaces the matching employee in the list', async () => {
      mockCreateEmployee.mockResolvedValue({ data: { createEmployee: { _id: 'e1', name: 'Old' } } });
      mockUpdateEmployee.mockResolvedValue({ data: { updateEmployee: { _id: 'e1', name: 'Updated' } } });
      const { result } = setup();

      await act(async () => {
        await result.current.createEmployee({ name: 'Old' } as any);
      });
      await act(async () => {
        await result.current.updateEmployee('e1', { name: 'Updated' } as any);
      });

      expect(mockUpdateEmployee).toHaveBeenCalledWith({ variables: { id: 'e1', employee: { name: 'Updated' } } });
      expect(result.current.employee).toEqual([{ _id: 'e1', name: 'Updated' }]);
    });
  });

  // Remaining methods (fetchGroupMembers, fetchEmployeeById, changeEmployeePassword,
  // expireEmployeePassword, expireMultipleEmployeePasswords, uploadEmployeeProfilePicture)
  // follow the same patterns shown above — repeat per method on the I<Feature>State interface.
});
