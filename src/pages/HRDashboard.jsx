import { useState, useCallback } from "react";
import { EmployeeList } from "../components/hr/EmployeeList";
import { EmployeeProfileView } from "../components/hr/EmployeeProfileView";
import { CreateEmployeeForm } from "../components/hr/CreateEmployeeForm";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Modal } from "../components/common/Modal";
import { HRChatBot } from "../components/hr/HRChatBot";

export function HRDashboard() {
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const handleCreated = useCallback(() => {
    setSelectedEmployee(null);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">HR Dashboard</h1>
          <p className="text-gray-500">Manage employee records and view leave data</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Add New Employee</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Employees" className="lg:col-span-1">
          <EmployeeList onSelect={setSelectedEmployee} />
        </Card>

        <Card title={selectedEmployee ? "Employee Profile" : "Select an Employee"} className="lg:col-span-2">
          {selectedEmployee ? (
            <EmployeeProfileView employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} />
          ) : (
            <div className="text-center text-gray-400 py-12">
              <p className="text-4xl mb-2">👤</p>
              <p>Select an employee from the list to view their details</p>
            </div>
          )}
        </Card>
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add New Employee">
        <CreateEmployeeForm onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      </Modal>
      <HRChatBot />
    </div>
  );
}
