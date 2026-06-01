import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useEmployees } from "../../contexts/EmployeeContext";
import { Button } from "../common/Button";

export function ProjectTagging() {
  const { user } = useAuth();
  const { getAllEmployees, setProjectTag } = useEmployees();
  const [members, setMembers] = useState([]);
  const [tagInput, setTagInput] = useState({});

  useEffect(() => {
    getAllEmployees().then((all) => setMembers(all.filter((e) => e.managerId === user?.id)));
  }, [user, getAllEmployees]);

  const handleTag = async (id) => {
    const name = tagInput[id]?.trim();
    if (!name) return;
    const res = await setProjectTag(id, name);
    if (res.success) {
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, projectTag: res.employee.projectTag } : m)));
      setTagInput((prev) => ({ ...prev, [id]: "" }));
    }
  };

  const handleUntag = async (id) => {
    const res = await setProjectTag(id, null);
    if (res.success) {
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, projectTag: null } : m)));
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">Project Tagging</h3>
        <p className="text-xs text-gray-500 mt-0.5">Tagged employees cannot auto-approve leaves. All their leaves require your approval.</p>
      </div>
      <div className="divide-y divide-gray-50">
        {members.map((m) => (
          <div key={m.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{m.name} <span className="text-xs text-blue-600 font-mono">{m.id}</span></p>
                <p className="text-xs text-gray-500">{m.email}</p>
                {m.projectTag && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {m.projectTag}
                  </span>
                )}
              </div>
              {m.projectTag ? (
                <Button variant="danger" className="text-xs !px-3 !py-1.5" onClick={() => handleUntag(m.id)}>
                  Untag
                </Button>
              ) : (
                <div className="flex gap-2 items-center">
                  <input
                    value={tagInput[m.id] || ""}
                    onChange={(e) => setTagInput((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    placeholder="Project name"
                    className="w-32 p-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button
                    variant="outline"
                    className="text-xs !px-3 !py-1.5"
                    onClick={() => handleTag(m.id)}
                    disabled={!tagInput[m.id]?.trim()}
                  >
                    Tag
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
