import { useEffect, useState, useMemo } from "react";
import Navbar from "../../components/Navbar";
import { getAlerts, createAlert, updateAlert, deleteAlert, toggleAlertActive } from "../../api/alertApi";
import DataTable from "../../components/DataTable";
import toast from "react-hot-toast";

// ─── Alert Modal (Handles both Create and Edit) ───────────────────────────────────
function AlertModal({ isOpen, row, onClose, onSave, saving }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [clearImage, setClearImage] = useState(false);

  useEffect(() => {
    if (row) {
      setTitle(row.title || "");
      setDescription(row.description || "");
      setImagePreview(row.image_url || "");
      setImageFile(null);
      setClearImage(false);
    } else {
      setTitle("");
      setDescription("");
      setImageFile(null);
      setImagePreview("");
      setClearImage(false);
    }
  }, [row, isOpen]);

  if (!isOpen) return null;

  const isEdit = !!row;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setClearImage(false);
    }
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImagePreview("");
    setClearImage(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    if (imageFile) {
      formData.append("image", imageFile);
    }
    formData.append("clearImage", clearImage);
    if (isEdit) {
      formData.append("active", row.active);
    }

    onSave(isEdit ? row.id : null, formData);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[18px] w-full max-w-[550px] mx-auto shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-br from-indigo-650 to-indigo-750 text-white shrink-0">
          <div>
            <h2 className="m-0 text-lg font-bold text-white">{isEdit ? "Edit Alert" : "Create Alert"}</h2>
            <p className="mt-1 text-[13px] text-indigo-100">{isEdit ? "Update announcement alert details" : "Add a new login notification alert"}</p>
          </div>
          <button onClick={onClose} className="bg-white/15 border-none rounded-lg w-[34px] h-[34px] cursor-pointer flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[18px] h-[18px]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-grow overflow-y-auto">
          <div className="px-7 py-6 flex-grow space-y-5">
            {/* Title Field */}
            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-2">
                Alert Title <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Server Maintenance Notice"
                className="w-full border-[1.5px] border-slate-300 rounded-[9px] px-3.5 py-[11px] text-[15px] outline-none text-slate-800 focus:border-indigo-650 transition-colors"
              />
            </div>

            {/* Description Field */}
            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-2">
                Description <span className="text-rose-600">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={4}
                placeholder="Enter alert content details here..."
                className="w-full border-[1.5px] border-slate-300 rounded-[9px] px-3.5 py-[11px] text-[15px] outline-none text-slate-800 focus:border-indigo-650 transition-colors resize-none"
              />
            </div>

            {/* Image Upload Field */}
            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-2">
                Image Attachment
              </label>
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="relative border-2 border-dashed border-slate-300 rounded-xl px-4 py-6 text-center hover:border-indigo-500 transition-colors bg-slate-50 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mx-auto text-slate-400 mb-2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375 0 11-.75 0 .375 0 01.75 0z" />
                    </svg>
                    <span className="text-xs font-semibold text-slate-600 block">
                      {imageFile ? imageFile.name : "Click to upload an image"}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1 block">PNG, JPG, GIF up to 10MB</span>
                  </div>
                </div>

                {imagePreview && (
                  <div className="relative shrink-0 w-24 h-24 border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center group">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 shadow transition-colors border-none cursor-pointer"
                      title="Remove image"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-7 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 shrink-0">
            <button type="button" onClick={onClose} disabled={saving}
              className="px-5 py-2 rounded-lg border-[1.5px] border-slate-300 text-slate-600 bg-white font-semibold text-[13px] cursor-pointer hover:bg-slate-100 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !description.trim()}
              className="px-6 py-2 rounded-lg border-none text-white font-bold text-[13px] transition-all bg-gradient-to-br from-indigo-600 to-indigo-750 shadow-[0_2px_8px_rgba(104,4,161,0.35)] cursor-pointer disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none hover:opacity-95">
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Alert"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AlertMaster() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  const loadAlerts = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getAlerts();
      setAlerts(response.data.data || []);
    } catch (err) {
      console.error("Failed to load alerts", err);
      setError("Unable to load alerts list. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleSave = async (id, formData) => {
    setSaving(true);
    try {
      if (id) {
        // Edit Mode
        await updateAlert(id, formData);
        toast.success("Alert updated successfully");
      } else {
        // Create Mode
        await createAlert(formData);
        toast.success("Alert created successfully");
      }
      setIsModalOpen(false);
      setSelectedRow(null);
      await loadAlerts();
    } catch (err) {
      console.error("Failed to save alert", err);
      toast.error(err?.response?.data?.message || "Failed to save alert.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this alert?")) return;
    setDeleting(true);
    try {
      await deleteAlert(id);
      toast.success("Alert deleted successfully");
      await loadAlerts();
    } catch (err) {
      console.error("Failed to delete alert:", err);
      toast.error(err?.response?.data?.message || "Unable to delete alert.");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (id, newActiveState) => {
    try {
      await toggleAlertActive(id, newActiveState);
      toast.success(`Alert ${newActiveState ? "activated" : "deactivated"}`);
      // Optimistic/Local state update
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: newActiveState } : a));
    } catch (err) {
      console.error("Failed to toggle alert status:", err);
      toast.error(err?.response?.data?.message || "Unable to change status.");
    }
  };

  const columns = useMemo(() => {
    return [
      {
        key: "id",
        label: "ID",
        minWidth: "60px",
        render: (row) => <span className="font-semibold text-slate-500">{row.id}</span>
      },
      {
        key: "image_url",
        label: "Image",
        minWidth: "100px",
        render: (row) => row.image_url ? (
          <img src={row.image_url} alt={row.title} className="w-12 h-12 object-cover rounded-lg shadow-sm border border-slate-100" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase select-none">No Img</div>
        )
      },
      {
        key: "title",
        label: "Title",
        minWidth: "160px",
        render: (row) => <span className="font-bold text-slate-900">{row.title}</span>
      },
      {
        key: "description",
        label: "Description",
        minWidth: "260px",
        render: (row) => (
          <span className="text-slate-600 block max-w-[280px] truncate whitespace-normal break-words" title={row.description}>
            {row.description}
          </span>
        )
      },
      {
        key: "active",
        label: "Status",
        minWidth: "100px",
        render: (row) => (
          <button
            onClick={() => handleToggleActive(row.id, !row.active)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${row.active ? "bg-indigo-650" : "bg-slate-200"}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${row.active ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
        )
      },
      {
        key: "actions",
        label: "Actions",
        minWidth: "120px",
        render: (row) => (
          <div className="flex items-center gap-2">
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
            <button
              onClick={() => handleDelete(row.id)}
              disabled={deleting}
              className="flex w-8 h-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 cursor-pointer hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-[15px] h-[15px]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.5h12m-1.5 0-.563 12.375A2.25 2.25 0 0113.693 21H10.307a2.25 2.25 0 01-2.244-2.125L7.5 7.5m3-3h3A1.5 1.5 0 0115 6v1.5H9V6a1.5 1.5 0 011.5-1.5Z" />
              </svg>
            </button>
          </div>
        )
      }
    ];
  }, [deleting]);

  const createAlertButton = (
    <button
      onClick={() => {
        setSelectedRow(null);
        setIsModalOpen(true);
      }}
      className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-[#6804a1] hover:bg-[#520380] text-white text-sm font-semibold shadow-md transition-all duration-200 cursor-pointer border-none focus:outline-none"
      title="Create new login alert popup"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      <span>Create Alert</span>
    </button>
  );

  return (
    <div className="flex flex-col flex-1 bg-slate-50 font-sans text-slate-900">
      <Navbar title="ERP Admin" />

      <main className="flex-1 flex flex-col w-full mx-auto px-[30px] py-8">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg mb-5 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex-1 flex flex-col">
          <DataTable
            tableId="alerts_management_dashboard"
            title="Alert Notifications Master"
            data={alerts}
            columns={columns}
            loading={loading}
            actionButton={createAlertButton}
            searchPlaceholder="Search alerts by title or description..."
          />
        </div>
      </main>

      <AlertModal
        isOpen={isModalOpen}
        row={selectedRow}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedRow(null);
        }}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}
