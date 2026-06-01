import { useState, useEffect } from "react";
import { useEmployees } from "../../contexts/EmployeeContext";

export function EmployeeList({ onSelect }) {
  const { getAllEmployees } = useEmployees();
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getAllEmployees().then((all) => {
      setEmployees(all || []);
    });
  }, [getAllEmployees]);

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <input
        type="text"
        placeholder="Search employees..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 mb-3"
      />
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {filtered.map((emp) => (
          <div
            key={emp.id}
            onClick={() => onSelect(emp)}
            className="p-3 border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
          >
            <p className="font-medium text-sm">{emp.name} <span className="text-xs text-blue-600 font-mono">{emp.id}</span></p>
            <p className="text-xs text-gray-500">{emp.email} &middot; {emp.designation || "N/A"} &middot; Joined {emp.doj || "N/A"}</p>
            {emp.projectTag && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                {emp.projectTag}
              </span>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No employees found</p>
        )}
      </div>
    </div>
  );
}
