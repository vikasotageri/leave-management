import { createContext, useContext, useCallback } from "react";
import { api } from "../services/api";

const EmployeeContext = createContext();

export function EmployeeProvider({ children }) {
  const addEmployee = useCallback(async (data) => {
    return api.createEmployee(data);
  }, []);

  const getAllEmployees = useCallback(async () => {
    return api.getAllEmployees();
  }, []);

  const setProjectTag = useCallback(async (employeeId, projectName) => {
    return api.setProjectTag(employeeId, projectName);
  }, []);

  const deleteEmployee = useCallback(async (employeeId) => {
    return api.deleteEmployee(employeeId);
  }, []);

  return (
    <EmployeeContext.Provider value={{ addEmployee, getAllEmployees, setProjectTag, deleteEmployee }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export const useEmployees = () => useContext(EmployeeContext);
