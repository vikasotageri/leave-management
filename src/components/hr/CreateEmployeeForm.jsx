import { useState, useEffect } from "react";
import { useEmployees } from "../../contexts/EmployeeContext";
import { Button } from "../common/Button";

const nationalities = [
  "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan", "Antiguan", "Argentine", "Armenian", "Australian",
  "Austrian", "Azerbaijani", "Bahamian", "Bahraini", "Bangladeshi", "Barbadian", "Belarusian", "Belgian", "Belizean",
  "Beninese", "Bhutanese", "Bolivian", "Bosnian", "Botswanan", "Brazilian", "British", "Bruneian", "Bulgarian",
  "Burkinabe", "Burmese", "Burundian", "Cambodian", "Cameroonian", "Canadian", "Cape Verdean", "Central African",
  "Chadian", "Chilean", "Chinese", "Colombian", "Comoran", "Congolese", "Costa Rican", "Croatian", "Cuban", "Cypriot",
  "Czech", "Danish", "Djiboutian", "Dominican", "Dutch", "Ecuadorean", "Egyptian", "Emirati", "Equatorial Guinean",
  "Eritrean", "Estonian", "Ethiopian", "Fijian", "Finnish", "French", "Gabonese", "Gambian", "Georgian", "German",
  "Ghanaian", "Greek", "Grenadian", "Guatemalan", "Guinean", "Guyanese", "Haitian", "Honduran", "Hungarian", "Icelander",
  "Indian", "Indonesian", "Iranian", "Iraqi", "Irish", "Israeli", "Italian", "Ivorian", "Jamaican", "Japanese",
  "Jordanian", "Kazakh", "Kenyan", "Kiribati", "Kuwaiti", "Kyrgyz", "Lao", "Latvian", "Lebanese", "Liberian", "Libyan",
  "Liechtensteiner", "Lithuanian", "Luxembourger", "Malagasy", "Malawian", "Malaysian", "Maldivan", "Malian", "Maltese",
  "Marshallese", "Mauritanian", "Mauritian", "Mexican", "Micronesian", "Moldovan", "Monacan", "Mongolian", "Montenegrin",
  "Moroccan", "Mozambican", "Namibian", "Nauruan", "Nepalese", "New Zealander", "Nicaraguan", "Nigerien", "Nigerian",
  "North Korean", "Northern Irish", "Norwegian", "Omani", "Pakistani", "Palauan", "Palestinian", "Panamanian",
  "Papua New Guinean", "Paraguayan", "Peruvian", "Philippine", "Polish", "Portuguese", "Qatari", "Romanian", "Russian",
  "Rwandan", "Saint Lucian", "Salvadoran", "Samoan", "San Marinese", "Sao Tomean", "Saudi", "Scottish", "Senegalese",
  "Serbian", "Seychellois", "Sierra Leonean", "Singaporean", "Slovak", "Slovenian", "Solomon Islander", "Somali",
  "South African", "South Korean", "Spanish", "Sri Lankan", "Sudanese", "Surinamese", "Swazi", "Swedish", "Swiss",
  "Syrian", "Taiwanese", "Tajik", "Tanzanian", "Thai", "Togolese", "Tongan", "Trinidadian", "Tunisian", "Turkish",
  "Turkmen", "Tuvaluan", "Ugandan", "Ukrainian", "Uruguayan", "Uzbek", "Vanuatuan", "Venezuelan", "Vietnamese",
  "Welsh", "Yemeni", "Zambian", "Zimbabwean",
];

const countryCodes = [
  { code: "+1", label: "US (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+91", label: "IN (+91)" },
  { code: "+61", label: "AU (+61)" },
  { code: "+81", label: "JP (+81)" },
  { code: "+86", label: "CN (+86)" },
  { code: "+49", label: "DE (+49)" },
  { code: "+33", label: "FR (+33)" },
  { code: "+971", label: "AE (+971)" },
  { code: "+65", label: "SG (+65)" },
  { code: "+55", label: "BR (+55)" },
  { code: "+7", label: "RU (+7)" },
];

export function CreateEmployeeForm({ onClose, onCreated }) {
  const { addEmployee } = useEmployees();
  const [form, setForm] = useState({
    firstName: "", middleName: "", lastName: "", email: "",
    countryCode: "+91", phone: "", dob: "", nationality: "",
    doj: "", address: "", projectTag: "", designation: "", document: "",
  });
  const [createdEmp, setCreatedEmp] = useState(null);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("error");

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setForm({ ...form, document: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setMsg("First Name and Last Name are required.");
      return;
    }
    if (!form.email.trim()) {
      setMsg("Email is required.");
      return;
    }
    if (!form.dob) {
      setMsg("Date of Birth is required.");
      return;
    }
    if (!form.nationality.trim()) {
      setMsg("Nationality is required.");
      return;
    }
    if (!form.doj) {
      setMsg("Date of Joining is required.");
      return;
    }
    if (!form.phone.trim()) {
      setMsg("Phone number is required.");
      return;
    }
    if (!form.designation.trim()) {
      setMsg("Designation is required.");
      return;
    }
    if (!form.address.trim()) {
      setMsg("Address is required.");
      return;
    }

    const fullPhone = form.countryCode + form.phone;

    const name = [form.firstName, form.middleName, form.lastName].filter(Boolean).join(" ");
    const res = await addEmployee({
      name,
      firstName: form.firstName,
      middleName: form.middleName || "",
      lastName: form.lastName,
      email: form.email,
      phone: fullPhone,
      dob: form.dob,
      nationality: form.nationality,
      doj: form.doj,
      designation: form.designation,
      address: form.address,
      projectTag: form.projectTag || null,
      document: form.document || null,
    });

    if (res.success) {
      setCreatedEmp(res.employee);
      if (onCreated) onCreated(res.employee);
    }
  };

  const copyCredentials = () => {
    const text = `ID: ${createdEmp.id}\nEmail: ${createdEmp.email}\nPassword: ${createdEmp.password}`;
    navigator.clipboard?.writeText(text);
    setMsg("Copied!");
    setMsgType("success");
    setTimeout(() => setMsg(""), 2000);
  };

  const resetForm = () => {
    setCreatedEmp(null);
    setForm({
      firstName: "", middleName: "", lastName: "", email: "",
      countryCode: "+91", phone: "", dob: "", nationality: "",
      doj: "", address: "", projectTag: "", designation: "", document: "",
    });
    setMsg("");
  };

  if (createdEmp) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <h3 className="text-xl font-bold text-green-800">Welcome to the Team!</h3>
          <p className="text-green-600 mt-1">{createdEmp.name} has been onboarded successfully.</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
          <h4 className="font-semibold text-gray-700 mb-3">Employee Credentials</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between p-2 bg-white rounded-lg">
              <span className="text-gray-500">Employee ID</span>
              <span className="font-medium text-blue-600">{createdEmp.id}</span>
            </div>
            <div className="flex justify-between p-2 bg-white rounded-lg">
              <span className="text-gray-500">Name</span>
              <span className="font-medium">{createdEmp.name}</span>
            </div>
            <div className="flex justify-between p-2 bg-white rounded-lg">
              <span className="text-gray-500">Email</span>
              <span className="font-medium">{createdEmp.email}</span>
            </div>
            <div className="flex justify-between p-2 bg-white rounded-lg">
              <span className="text-gray-500">Phone</span>
              <span className="font-medium">{createdEmp.phone}</span>
            </div>
            <div className="flex justify-between p-2 bg-white rounded-lg">
              <span className="text-gray-500">Nationality</span>
              <span className="font-medium">{createdEmp.nationality}</span>
            </div>
            <div className="flex justify-between p-2 bg-white rounded-lg">
              <span className="text-gray-500">Designation</span>
              <span className="font-medium">{createdEmp.designation}</span>
            </div>
            <div className="flex justify-between p-2 bg-white rounded-lg">
              <span className="text-gray-500">Project Tag</span>
              <span className="font-medium">{createdEmp.projectTag || "—"}</span>
            </div>
            <div className="flex justify-between p-2 bg-yellow-50 rounded-lg border border-yellow-200">
              <span className="text-gray-500">Password</span>
              <span className="font-mono font-bold text-yellow-700">{createdEmp.password}</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200 text-sm text-purple-700">
            Leave credits accrued: <strong>{createdEmp.leaveBalance.totalAccrued} days</strong> (2 days/month since {createdEmp.doj})
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-700">
            Real email sent to <strong>{createdEmp.email}</strong> with ID, email &amp; password. Check inbox/spam.
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={copyCredentials} className="flex-1">
            {msg || "Copy Credentials"}
          </Button>
          <Button variant="secondary" onClick={resetForm}>
            + Add New Employee
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msgType === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
          <input name="firstName" value={form.firstName} onChange={handleChange}
            className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
          <input name="middleName" value={form.middleName} onChange={handleChange}
            className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
          <input name="lastName" value={form.lastName} onChange={handleChange}
            className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input name="email" type="email" value={form.email} onChange={handleChange}
            className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
          <div className="flex gap-2">
            <select name="countryCode" value={form.countryCode} onChange={handleChange}
              className="p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm w-28 shrink-0">
              {countryCodes.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <input name="phone" value={form.phone} onChange={handleChange} placeholder="Phone number"
              className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
          <input name="dob" type="date" value={form.dob} onChange={handleChange}
            className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nationality *</label>
          <select name="nationality" value={form.nationality} onChange={handleChange}
            className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">Select nationality</option>
            {nationalities.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining *</label>
          <input name="doj" type="date" value={form.doj} onChange={handleChange}
            className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Designation *</label>
          <input name="designation" value={form.designation} onChange={handleChange} placeholder="e.g. Software Engineer"
            className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project Tag</label>
          <input name="projectTag" value={form.projectTag} onChange={handleChange} placeholder="e.g. Project Alpha"
            className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
        <textarea name="address" value={form.address} onChange={handleChange} rows={2}
          className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Document (optional)</label>
        <input type="file" onChange={handleFileChange}
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
        {form.document && <p className="text-xs text-green-600 mt-1">Selected: {form.document}</p>}
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit">Create Employee</Button>
      </div>
    </form>
  );
}
