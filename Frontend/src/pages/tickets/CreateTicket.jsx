import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getTicketFormOptions, createTicket } from "../../api/ticketApi";
import toast from "react-hot-toast";

export default function CreateTicket() {
    const navigate = useNavigate();

    // Form data states
    const [ticketTypes, setTicketTypes] = useState([]);
    const [allSubTicketTypes, setAllSubTicketTypes] = useState([]);
    const [selectedTicketType, setSelectedTicketType] = useState("");
    const [selectedSubTicketType, setSelectedSubTicketType] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [remarks, setRemarks] = useState("");
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [filePreviews, setFilePreviews] = useState([]);

    // UI states
    const [loadingOptions, setLoadingOptions] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef(null);

    // Fetch active ticket types and sub ticket types
    useEffect(() => {
        const fetchOptions = async () => {
            setLoadingOptions(true);
            try {
                const res = await getTicketFormOptions();
                if (res.data?.success) {
                    setTicketTypes(res.data.data.ticket_types || []);
                    setAllSubTicketTypes(res.data.data.sub_ticket_types || []);
                }
            } catch (err) {
                console.error("Failed to load ticket options:", err);
                toast.error("Failed to load ticket categories. Please refresh.");
            } finally {
                setLoadingOptions(false);
            }
        };
        fetchOptions();
    }, []);

    // Filter sub ticket types by selected ticket type
    const filteredSubTicketTypes = useMemo(() => {
        if (!selectedTicketType) return [];
        return allSubTicketTypes.filter(
            (st) => String(st.ticket_type_id) === String(selectedTicketType)
        );
    }, [allSubTicketTypes, selectedTicketType]);

    // Active sub-ticket assignee preview
    const selectedSubTicketMeta = useMemo(() => {
        if (!selectedSubTicketType) return null;
        return allSubTicketTypes.find(
            (st) => String(st.id) === String(selectedSubTicketType)
        );
    }, [allSubTicketTypes, selectedSubTicketType]);

    // Handle ticket type change (resets sub ticket type)
    const handleTicketTypeChange = (e) => {
        const val = e.target.value;
        setSelectedTicketType(val);
        setSelectedSubTicketType("");
    };

    // Handle adding files (validates max 5 images & image file types)
    const processFiles = (newFiles) => {
        const imageFiles = Array.from(newFiles).filter((f) =>
            f.type.startsWith("image/")
        );

        if (imageFiles.length !== newFiles.length) {
            toast.error("Only image files (JPG, PNG, WEBP, etc.) are allowed.");
        }

        const totalCount = selectedFiles.length + imageFiles.length;
        if (totalCount > 5) {
            toast.error(`Maximum 5 images allowed. You can only add ${5 - selectedFiles.length} more.`);
            return;
        }

        const updatedFiles = [...selectedFiles, ...imageFiles].slice(0, 5);
        setSelectedFiles(updatedFiles);

        // Generate object URLs for preview
        const previews = updatedFiles.map((file) => ({
            name: file.name,
            size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
            url: URL.createObjectURL(file)
        }));
        setFilePreviews(previews);
    };

    const handleFileInput = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            processFiles(e.target.files);
        }
    };

    const handleRemoveFile = (index) => {
        const updatedFiles = selectedFiles.filter((_, i) => i !== index);
        setSelectedFiles(updatedFiles);

        // Revoke the old preview URL to prevent memory leaks
        if (filePreviews[index]?.url) {
            URL.revokeObjectURL(filePreviews[index].url);
        }
        const updatedPreviews = filePreviews.filter((_, i) => i !== index);
        setFilePreviews(updatedPreviews);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation checks
        if (!selectedTicketType) {
            toast.error("Please select a Ticket Type.");
            return;
        }
        if (!selectedSubTicketType) {
            toast.error("Please select a Sub Ticket Type.");
            return;
        }
        if (!title.trim()) {
            toast.error("Please provide a Title for the ticket.");
            return;
        }
        if (!description.trim()) {
            toast.error("The Description field is compulsory. Please describe the issue.");
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("ticket_type_id", selectedTicketType);
            formData.append("sub_ticket_type_id", selectedSubTicketType);
            formData.append("title", title.trim());
            formData.append("description", description.trim());
            if (remarks.trim()) {
                formData.append("remarks", remarks.trim());
            }

            selectedFiles.forEach((file) => {
                formData.append("images", file);
            });

            const res = await createTicket(formData);
            if (res.data?.success) {
                toast.success(res.data.message || "Ticket created successfully!");
                navigate("/tickets");
            } else {
                toast.error(res.data?.message || "Failed to create ticket.");
            }
        } catch (err) {
            console.error("Failed to create ticket:", err);
            const msg = err.response?.data?.message || "Something went wrong while submitting the ticket.";
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleReset = () => {
        if (window.confirm("Are you sure you want to clear this form?")) {
            setSelectedTicketType("");
            setSelectedSubTicketType("");
            setTitle("");
            setDescription("");
            setRemarks("");
            setSelectedFiles([]);
            filePreviews.forEach((p) => URL.revokeObjectURL(p.url));
            setFilePreviews([]);
        }
    };

    return (
        <div className="flex flex-col flex-1 bg-slate-50 font-sans min-h-screen text-slate-800">
            <Navbar />

            <main className="flex-1 flex flex-col w-full mx-auto px-4 sm:px-6 lg:px-[30px] py-8">
                {/* Header & Back Button */}
                <div className="flex items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                            Raise a Support Ticket
                        </h1>
                    </div>

                    <button
                        type="button"
                        onClick={() => navigate("/tickets")}
                        className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-all shadow-sm cursor-pointer"
                    >
                        Tickets List
                    </button>
                </div>

                {/* Form Card */}
                <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                        <h2 className="text-base font-bold text-slate-800">Ticket Details</h2>
                        <span className="text-xs text-slate-400 font-medium">
                            <span className="text-rose-600 font-bold">*</span> Indicates mandatory field
                        </span>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
                        {/* Row 1: Ticket Type & Sub Ticket Type */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Ticket Type */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                    Ticket Type <span className="text-rose-600">*</span>
                                </label>
                                <select
                                    value={selectedTicketType}
                                    onChange={handleTicketTypeChange}
                                    required
                                    disabled={loadingOptions || submitting}
                                    className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-300 rounded-xl text-sm outline-none text-slate-800 bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer font-medium disabled:bg-slate-50 disabled:opacity-60"
                                >
                                    <option value="">-- Select Ticket Type --</option>
                                    {ticketTypes.map((tt) => (
                                        <option key={tt.id} value={tt.id}>
                                            {tt.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Sub Ticket Type */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                    Sub Ticket Type <span className="text-rose-600">*</span>
                                </label>
                                <select
                                    value={selectedSubTicketType}
                                    onChange={(e) => setSelectedSubTicketType(e.target.value)}
                                    required
                                    disabled={!selectedTicketType || loadingOptions || submitting}
                                    className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-300 rounded-xl text-sm outline-none text-slate-800 bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer font-medium disabled:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <option value="">
                                        {selectedTicketType
                                            ? "-- Select Sub Ticket Type --"
                                            : "-- Select Ticket Type First --"}
                                    </option>
                                    {filteredSubTicketTypes.map((st) => (
                                        <option key={st.id} value={st.id}>
                                            {st.name}
                                        </option>
                                    ))}
                                </select>
                                {selectedSubTicketMeta && (
                                    <p className="text-[12px] text-indigo-600 font-medium mt-1.5">
                                        Assigned Team: {selectedSubTicketMeta.assigned_names || "Assigned Resolvers"}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Row 2: Title */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                Title <span className="text-rose-600">*</span>
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                                maxLength={255}
                                disabled={submitting}
                                placeholder="Brief summary of the issue (e.g. POS Billing Screen Frozen at Branch #04)"
                                className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-300 rounded-xl text-sm outline-none text-slate-800 bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all font-medium placeholder:text-slate-400"
                            />
                        </div>

                        {/* Row 3: Describe the Issue (Compulsory) */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                Describe the Issue <span className="text-rose-600">*</span>
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                required
                                rows={5}
                                disabled={submitting}
                                placeholder="Explain what happened, error messages seen, steps to reproduce, or any relevant order/device IDs..."
                                className="w-full p-3.5 border-[1.5px] border-slate-300 rounded-xl text-sm outline-none text-slate-800 bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all font-normal placeholder:text-slate-400 resize-y leading-relaxed"
                            />
                        </div>

                        {/* Row 4: Images (Multiple, Max 5) */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Attach Images <span className="text-slate-400 font-normal">(Multiple, Max 5)</span>
                                </label>
                                <span className={`text-xs font-semibold ${selectedFiles.length >= 5 ? "text-amber-600 font-bold" : "text-slate-500"}`}>
                                    {selectedFiles.length} of 5 attached
                                </span>
                            </div>

                            {/* Drag & Drop Upload Zone */}
                            {selectedFiles.length < 5 && (
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                                        isDragOver
                                            ? "border-indigo-600 bg-indigo-50/50 scale-[0.99]"
                                            : "border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-slate-50"
                                    }`}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileInput}
                                        multiple
                                        accept="image/png, image/jpeg, image/jpg, image/webp"
                                        className="hidden"
                                    />
                                    <p className="text-sm font-semibold text-slate-700">
                                        <span className="text-indigo-600 underline">Click to upload</span> or drag and drop images here
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        PNG, JPG, JPEG or WEBP (Max 5 images, up to 10MB each)
                                    </p>
                                </div>
                            )}

                            {/* Image Previews Grid */}
                            {filePreviews.length > 0 && (
                                <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                    {filePreviews.map((preview, idx) => (
                                        <div
                                            key={idx}
                                            className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm aspect-square flex flex-col justify-between"
                                        >
                                            <img
                                                src={preview.url}
                                                alt={preview.name}
                                                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                                            />
                                            {/* Hover overlay with details & delete button */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRemoveFile(idx);
                                                    }}
                                                    title="Remove image"
                                                    className="self-end w-6 h-6 rounded-full bg-rose-600 text-white text-xs flex items-center justify-center hover:bg-rose-700 shadow-md cursor-pointer transition-transform hover:scale-110"
                                                >
                                                    ✕
                                                </button>
                                                <div className="text-[10px] text-white truncate font-medium">
                                                    <p className="truncate">{preview.name}</p>
                                                    <p className="text-slate-300">{preview.size}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Row 5: Remarks (Optional) */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                Remarks <span className="text-slate-400 font-normal">(Optional)</span>
                            </label>
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                rows={2}
                                disabled={submitting}
                                placeholder="Any additional context or urgency notes (e.g. Customer waiting in store, pending replacement unit)..."
                                className="w-full p-3.5 border-[1.5px] border-slate-300 rounded-xl text-sm outline-none text-slate-800 bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all font-normal placeholder:text-slate-400"
                            />
                        </div>

                        {/* Form Actions Footer */}
                        <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleReset}
                                disabled={submitting}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 font-semibold text-sm transition-all cursor-pointer disabled:opacity-50"
                            >
                                Clear Form
                            </button>
                            <button
                                type="submit"
                                disabled={submitting || !selectedTicketType || !selectedSubTicketType || !title.trim() || !description.trim()}
                                className="w-full sm:w-auto px-8 py-2.5 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-indigo-600 to-[#6804a1] hover:from-indigo-700 hover:to-[#570387] shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95 cursor-pointer disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100 flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <span>Creating Ticket...</span>
                                ) : (
                                    <span>Submit Ticket</span>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
