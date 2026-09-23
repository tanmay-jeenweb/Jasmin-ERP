import { useEffect, useState, useMemo, useRef } from "react";
import Navbar from "../../components/Navbar";
import {
  getSubTicketTypes,
  getTicketAssignees,
  createSubTicketType,
  updateSubTicketType,
  deleteSubTicketType
} from "../../api/subTicketTypeApi";
import { getTicketTypes } from "../../api/ticketTypeApi";
import DataTable from "../../components/DataTable";
import toast from "react-hot-toast";
import { usePermission } from "../../context/PermissionContext";

// ─── Searchable Multi-Select User Dropdown ───────────────────────────────────
function SearchableUserMultiSelect({ assignees, values, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Selected values as set of strings for fast lookup
  const selectedSet = useMemo(() => {
    return new Set((values || []).map(String));
  }, [values]);

  const selectedUsers = useMemo(() => {
    return assignees.filter((u) => selectedSet.has(String(u.id)));
  }, [assignees, selectedSet]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm("");
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return assignees;
    const term = searchTerm.toLowerCase().trim();
    return assignees.filter((u) => {
      const name = (u.name || "").toLowerCase();
      const username = (u.username || "").toLowerCase();
      const role = (u.role_name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      return (
        name.includes(term) ||
        username.includes(term) ||
        role.includes(term) ||
        email.includes(term)
      );
    });
  }, [assignees, searchTerm]);

  const toggleUser = (userId) => {
    const strId = String(userId);
    const newValues = selectedSet.has(strId)
      ? (values || []).filter((id) => String(id) !== strId)
      : [...(values || []), parseInt(strId, 10)];
    onChange(newValues);
  };

  const handleSelectAll = () => {
    const allFilteredIds = filtered.map((u) => u.id);
    const combined = Array.from(new Set([...(values || []).map(Number), ...allFilteredIds]));
    onChange(combined);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Box / Toggle Button */}
      <div
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full border-[1.5px] rounded-[9px] px-3.5 py-[9px] min-h-[46px] flex items-center justify-between text-left transition-all bg-white cursor-pointer ${
          isOpen
            ? "border-indigo-600 ring-2 ring-indigo-100"
            : "border-slate-300 hover:border-slate-400"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-slate-50" : ""}`}
      >
        <div className="flex-1 pr-2">
          {selectedUsers.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 items-center max-h-24 overflow-y-auto">
              {selectedUsers.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80"
                >
                  <span>{u.name}</span>
                  <span className="text-[10px] text-indigo-500 font-normal">
                    ({u.role_name || u.username})
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleUser(u.id);
                    }}
                    className="hover:bg-indigo-200 text-indigo-600 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[10px] cursor-pointer"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-slate-400 text-[15px]">-- Select One or More Assignees --</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {selectedUsers.length > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
              {selectedUsers.length}
            </span>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-indigo-600" : ""
            }`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      {/* Dropdown Popover (Opens Upward) */}
      {isOpen && (
        <div className="absolute left-0 right-0 bottom-full mb-1.5 z-[1100] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search Header */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50">
            <div className="relative flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search user by name, role, username..."
                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-7 py-2 text-sm outline-none text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 text-xs text-slate-400 hover:text-slate-600 w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-200"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Actions (Select All / Clear All) */}
            <div className="flex items-center justify-between mt-2 px-1 text-xs">
              <span className="text-slate-500 font-medium">
                {selectedUsers.length} of {assignees.length} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>

          {/* Users List with Checkboxes */}
          <div className="max-h-52 overflow-y-auto p-1 divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">
                No users found matching &ldquo;{searchTerm}&rdquo;
              </div>
            ) : (
              filtered.map((user) => {
                const isSelected = selectedSet.has(String(user.id));
                return (
                  <div
                    key={user.id}
                    onClick={() => toggleUser(user.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-indigo-50/90 text-indigo-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Handled by parent div onClick
                        className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer pointer-events-none"
                      />
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">{user.name}</span>
                        <span className="text-[12px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span className="font-medium text-indigo-600">
                            {user.role_name || user.role}
                          </span>
                          {user.username && (
                            <span className="text-slate-400">• @{user.username}</span>
                          )}
                          {user.email && (
                            <span className="text-slate-400">• {user.email}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub Ticket Type Modal (Handles both Create and Edit) ─────────────────────
function SubTicketTypeModal({ isOpen, row, ticketTypes, assignees, onClose, onSave, saving }) {
  const [ticketTypeId, setTicketTypeId] = useState("");
  const [name, setName] = useState("");
  const [assignedTo, setAssignedTo] = useState([]);

  useEffect(() => {
    if (row) {
      setTicketTypeId(row.ticket_type_id ? String(row.ticket_type_id) : "");
      setName(row.name || "");
      const currentAssigned = Array.isArray(row.assigned_to)
        ? row.assigned_to
        : row.assigned_to
        ? [row.assigned_to]
        : [];
      setAssignedTo(currentAssigned.map(Number));
    } else {
      setTicketTypeId("");
      setName("");
      setAssignedTo([]);
    }
  }, [row, isOpen]);

  if (!isOpen) return null;

  const isEdit = !!row;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!ticketTypeId) {
      toast.error("Please select a ticket type");
      return;
    }
    if (!name.trim()) {
      toast.error("Please enter a subticket name");
      return;
    }
    if (!assignedTo || assignedTo.length === 0) {
      toast.error("Please select at least one person to assign this ticket to");
      return;
    }

    onSave(
      isEdit ? row.id : null,
      parseInt(ticketTypeId, 10),
      name.trim(),
      assignedTo
    );
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[18px] w-full max-w-[540px] mx-auto shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-t-[18px]">
          <div>
            <h2 className="m-0 text-lg font-bold text-white">
              {isEdit ? "Edit Sub Ticket Type" : "Create Sub Ticket Type"}
            </h2>
            <p className="mt-1 text-[13px] text-indigo-100">
              {isEdit ? "Update subticket configuration and assigned team members" : "Configure a new sub ticket type and assignees"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="bg-white/15 border-none rounded-lg w-[34px] h-[34px] cursor-pointer flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[18px] h-[18px]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-7 py-6 space-y-4">
            {/* 1. Ticket Type Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Ticket Type <span className="text-rose-600">*</span>
              </label>
              <select
                value={ticketTypeId}
                onChange={(e) => setTicketTypeId(e.target.value)}
                required
                className="w-full border-[1.5px] border-slate-300 rounded-[9px] px-3.5 py-[11px] text-[15px] outline-none text-slate-800 focus:border-indigo-600 transition-colors bg-white cursor-pointer"
              >
                <option value="">-- Select Ticket Type --</option>
                {ticketTypes.map((tt) => (
                  <option key={tt.id} value={tt.id}>
                    {tt.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Subticket Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Subticket Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Screen Replacement, Server Down, EMI Failure"
                className="w-full border-[1.5px] border-slate-300 rounded-[9px] px-3.5 py-[11px] text-[15px] outline-none text-slate-800 focus:border-indigo-600 transition-colors"
              />
            </div>

            {/* 3. Persons to Assign Multi-Select Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Persons To Assign (Multiple) <span className="text-rose-600">*</span>
              </label>
              <SearchableUserMultiSelect
                assignees={assignees}
                values={assignedTo}
                onChange={setAssignedTo}
                disabled={saving}
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Select one or more team members who will handle tickets under this subticket type.
              </p>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-7 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-[18px]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2 rounded-lg border-[1.5px] border-slate-300 text-slate-600 bg-white font-semibold text-[13px] cursor-pointer hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !ticketTypeId || !name.trim() || !assignedTo || assignedTo.length === 0}
              className="px-6 py-2 rounded-lg border-none text-white font-bold text-[13px] transition-all bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-[0_2px_8px_rgba(79,70,229,0.35)] cursor-pointer disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none hover:opacity-95"
            >
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Sub Ticket Type"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SubTicketTypeMaster() {
  const [subTicketTypes, setSubTicketTypes] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  const { hasPermission } = usePermission();

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [subRes, ttRes, assigneesRes] = await Promise.all([
        getSubTicketTypes(),
        getTicketTypes(),
        getTicketAssignees()
      ]);

      setSubTicketTypes(subRes.data.data || []);
      setTicketTypes(ttRes.data.data || []);
      setAssignees(assigneesRes.data.data || []);
    } catch (err) {
      console.error("Failed to load sub ticket types data", err);
      setError("Unable to load sub ticket types. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (id, ticketTypeId, name, assignedTo) => {
    setSaving(true);
    try {
      if (id) {
        await updateSubTicketType(id, {
          ticket_type_id: ticketTypeId,
          name,
          assigned_to: assignedTo
        });
        toast.success("Sub ticket type updated successfully");
      } else {
        await createSubTicketType({
          ticket_type_id: ticketTypeId,
          name,
          assigned_to: assignedTo
        });
        toast.success("Sub ticket type created successfully");
      }
      setIsModalOpen(false);
      setSelectedRow(null);
      await loadData();
    } catch (err) {
      console.error("Failed to save sub ticket type", err);
      toast.error(err?.response?.data?.message || "Unable to save sub ticket type. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this sub ticket type?")) return;
    setSaving(true);
    try {
      await deleteSubTicketType(id);
      toast.success("Sub ticket type deleted successfully");
      await loadData();
    } catch (err) {
      console.error("Failed to delete sub ticket type", err);
      toast.error(err?.response?.data?.message || "Unable to delete sub ticket type.");
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(() => {
    const cols = [
      { key: "id", label: "ID", minWidth: "70px" },
      {
        key: "ticket_type_name",
        label: "Ticket Type",
        minWidth: "160px",
        render: (row) => (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            {row.ticket_type_name}
          </span>
        )
      },
      {
        key: "name",
        label: "Subticket Name",
        minWidth: "180px",
        render: (row) => <span className="font-semibold text-slate-900">{row.name}</span>
      },
      {
        key: "assigned_to_name",
        label: "Assigned People",
        minWidth: "260px",
        render: (row) => {
          const users = row.assigned_users || [];
          if (users.length === 0) {
            return <span className="text-slate-400 text-xs italic">Unassigned</span>;
          }
          return (
            <div className="flex flex-wrap gap-1.5 py-1">
              {users.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
                  title={`${u.name} (${u.role_name || u.role || 'Staff'})`}
                >
                  {u.name}
                </span>
              ))}
            </div>
          );
        }
      }
    ];

    const canUpdate = hasPermission("sub_ticket_type_master", "update");
    const canDelete = hasPermission("sub_ticket_type_master", "delete");

    if (canUpdate || canDelete) {
      cols.push({
        key: "actions",
        label: "Actions",
        sortable: false,
        minWidth: "120px",
        render: (row) => (
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                onClick={() => {
                  setSelectedRow(row);
                  setIsModalOpen(true);
                }}
                className="flex w-8 h-8 items-center justify-center rounded-lg border border-purple-200 bg-purple-50 text-indigo-650 cursor-pointer hover:bg-purple-100 transition-colors"
                title="Edit"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-[15px] h-[15px]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931Z" />
                </svg>
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => handleDelete(row.id)}
                className="flex w-8 h-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 cursor-pointer hover:bg-rose-100 transition-colors"
                title="Delete"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-[15px] h-[15px]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.5h12m-1.5 0-.563 12.375A2.25 2.25 0 0113.693 21H10.307a2.25 2.25 0 01-2.244-2.125L7.5 7.5m3-3h3A1.5 1.5 0 0115 6v1.5H9V6a1.5 1.5 0 011.5-1.5Z" />
                </svg>
              </button>
            )}
          </div>
        )
      });
    }

    return cols;
  }, [saving, hasPermission]);

  return (
    <div className="flex flex-col flex-1 bg-slate-50 font-sans min-h-screen">
      <Navbar title="ERP Admin" />

      <SubTicketTypeModal
        isOpen={isModalOpen}
        row={selectedRow}
        ticketTypes={ticketTypes}
        assignees={assignees}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedRow(null);
        }}
        onSave={handleSave}
        saving={saving}
      />

      <main className="flex-1 flex flex-col w-full mx-auto px-[30px] py-8">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg mb-5 text-sm font-medium">
            {error}
          </div>
        )}
        <DataTable
          tableId="sub_ticket_type_master"
          title="Sub Ticket Type Master"
          data={subTicketTypes}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search sub ticket types..."
          actionButton={
            hasPermission("sub_ticket_type_master", "write") ? (
              <button
                onClick={() => {
                  setSelectedRow(null);
                  setIsModalOpen(true);
                }}
                className="flex w-10 h-10 items-center justify-center rounded-[9px] bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border-none cursor-pointer shadow-[0_2px_8px_rgba(79,70,229,0.35)] hover:opacity-95 transition-opacity"
                title="Create Sub Ticket Type"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-[18px] h-[18px]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            ) : null
          }
        />
      </main>
    </div>
  );
}
