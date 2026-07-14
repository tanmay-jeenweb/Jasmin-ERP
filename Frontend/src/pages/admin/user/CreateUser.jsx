import { useState, useEffect } from "react";
import Navbar from "../../../components/Navbar";
import { createUserByAdmin } from "../../../api/authApi";
import { getUserTypes } from "../../../api/userTypeMasterApi";
import { getStates } from "../../../api/stateApi";
import { getBranches } from "../../../api/branchApi";
import { getProductTypes } from "../../../api/productTypeApi";
import { getMobileBrands } from "../../../api/mobileBrandApi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function CreateUser() {
    const navigate = useNavigate();
    const [userTypes, setUserTypes] = useState([]);
    
    // Master lists options
    const [statesList, setStatesList] = useState([]);
    const [productTypesList, setProductTypesList] = useState([]);
    const [brandsList, setBrandsList] = useState([]);

    // Dropdown visibility states
    const [isStateDropdownOpen, setIsStateDropdownOpen] = useState(false);
    const [isProductTypeDropdownOpen, setIsProductTypeDropdownOpen] = useState(false);
    const [isLandingTypeDropdownOpen, setIsLandingTypeDropdownOpen] = useState(false);
    const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);

    // Selected multiple values
    const [selectedStates, setSelectedStates] = useState([]);
    const [selectedProductTypes, setSelectedProductTypes] = useState([]);
    const [selectedLandingTypes, setSelectedLandingTypes] = useState([]);
    const [selectedBrands, setSelectedBrands] = useState([]);
    const [city, setCity] = useState("");

    // Search query states
    const [stateSearch, setStateSearch] = useState("");
    const [productTypeSearch, setProductTypeSearch] = useState("");
    const [landingTypeSearch, setLandingTypeSearch] = useState("");
    const [brandSearch, setBrandSearch] = useState("");

    const landingTypesOptions = ["GST DP", "net LANDING", "MANAGER LANDING", "JASMIN LANDING"];

    const filteredStates = statesList.filter(s => s.name.toLowerCase().includes(stateSearch.toLowerCase()));
    const filteredProductTypes = productTypesList.filter(pt => pt.product_type_name.toLowerCase().includes(productTypeSearch.toLowerCase()));
    const filteredLandingTypes = landingTypesOptions.filter(opt => opt.toLowerCase().includes(landingTypeSearch.toLowerCase()));
    const filteredBrands = brandsList.filter(b => b.mobile_brand.toLowerCase().includes(brandSearch.toLowerCase()));

    const [newUserForm, setNewUserForm] = useState({
        name: "",
        username: "",
        email: "",
        password: "",
        userTypeId: "",
        mobNo: "",
        dateOfJoin: "",
        deviceVerificationRequired: true,
        role: "user"
    });
    const [creatingUser, setCreatingUser] = useState(false);

    const loadFormData = async () => {
        try {
            const [utRes, stateRes, ptRes, brandRes] = await Promise.all([
                getUserTypes(),
                getStates(),
                getProductTypes(),
                getMobileBrands()
            ]);
            setUserTypes(utRes.data.data || []);
            setStatesList((stateRes.data.data || []).filter(s => s.live === "Yes"));
            setProductTypesList(ptRes.data.data || []);
            setBrandsList(brandRes.data.data || []);
        } catch (error) {
            console.error("Error loading form data:", error);
            toast.error("Failed to load options for user registration.");
        }
    };

    useEffect(() => {
        loadFormData();

        // Close dropdowns on clicking outside
        const handleClickOutside = (event) => {
            if (!event.target.closest(".relative")) {
                setIsStateDropdownOpen(false);
                setIsProductTypeDropdownOpen(false);
                setIsLandingTypeDropdownOpen(false);
                setIsBrandDropdownOpen(false);
                setStateSearch("");
                setProductTypeSearch("");
                setLandingTypeSearch("");
                setBrandSearch("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleToggleState = (name) => {
        let updated = [...selectedStates];
        if (name === "All") {
            const allFiltered = filteredStates.map(s => s.name);
            const isAllFilteredSelected = allFiltered.every(item => updated.includes(item));
            if (isAllFilteredSelected) {
                updated = updated.filter(val => !allFiltered.includes(val) && val !== "All");
            } else {
                allFiltered.forEach(item => {
                    if (!updated.includes(item)) updated.push(item);
                });
                if (statesList.every(s => updated.includes(s.name))) {
                    updated.push("All");
                }
            }
        } else {
            if (updated.includes(name)) {
                updated = updated.filter(val => val !== name && val !== "All");
            } else {
                updated.push(name);
                if (statesList.every(s => updated.includes(s.name))) {
                    updated.push("All");
                }
            }
        }
        setSelectedStates(updated);
    };



    const handleToggleProductType = (name) => {
        let updated = [...selectedProductTypes];
        if (name === "All") {
            const allFiltered = filteredProductTypes.map(pt => pt.product_type_name);
            const isAllFilteredSelected = allFiltered.every(item => updated.includes(item));
            if (isAllFilteredSelected) {
                updated = updated.filter(val => !allFiltered.includes(val) && val !== "All");
            } else {
                allFiltered.forEach(item => {
                    if (!updated.includes(item)) updated.push(item);
                });
                if (productTypesList.every(pt => updated.includes(pt.product_type_name))) {
                    updated.push("All");
                }
            }
        } else {
            if (updated.includes(name)) {
                updated = updated.filter(val => val !== name && val !== "All");
            } else {
                updated.push(name);
                if (productTypesList.every(pt => updated.includes(pt.product_type_name))) {
                    updated.push("All");
                }
            }
        }
        setSelectedProductTypes(updated);
    };

    const handleToggleLandingType = (name) => {
        let updated = [...selectedLandingTypes];
        if (name === "All") {
            const allFiltered = filteredLandingTypes;
            const isAllFilteredSelected = allFiltered.every(item => updated.includes(item));
            if (isAllFilteredSelected) {
                updated = updated.filter(val => !allFiltered.includes(val) && val !== "All");
            } else {
                allFiltered.forEach(item => {
                    if (!updated.includes(item)) updated.push(item);
                });
                if (landingTypesOptions.every(opt => updated.includes(opt))) {
                    updated.push("All");
                }
            }
        } else {
            if (updated.includes(name)) {
                updated = updated.filter(val => val !== name && val !== "All");
            } else {
                updated.push(name);
                if (landingTypesOptions.every(opt => updated.includes(opt))) {
                    updated.push("All");
                }
            }
        }
        setSelectedLandingTypes(updated);
    };

    const handleToggleBrand = (name) => {
        let updated = [...selectedBrands];
        if (name === "All") {
            const allFiltered = filteredBrands.map(b => b.mobile_brand);
            const isAllFilteredSelected = allFiltered.every(item => updated.includes(item));
            if (isAllFilteredSelected) {
                updated = updated.filter(val => !allFiltered.includes(val) && val !== "All");
            } else {
                allFiltered.forEach(item => {
                    if (!updated.includes(item)) updated.push(item);
                });
                if (brandsList.every(b => updated.includes(b.mobile_brand))) {
                    updated.push("All");
                }
            }
        } else {
            if (updated.includes(name)) {
                updated = updated.filter(val => val !== name && val !== "All");
            } else {
                updated.push(name);
                if (brandsList.every(b => updated.includes(b.mobile_brand))) {
                    updated.push("All");
                }
            }
        }
        setSelectedBrands(updated);
    };

    const getStateLabel = () => {
        if (selectedStates.includes("All")) return "All";
        if (selectedStates.length === 0) return "Select States";
        if (selectedStates.length <= 2) return selectedStates.join(", ");
        return `${selectedStates.length} States Selected`;
    };



    const getProductTypeLabel = () => {
        if (selectedProductTypes.includes("All")) return "All";
        if (selectedProductTypes.length === 0) return "Select Product Types";
        if (selectedProductTypes.length <= 2) return selectedProductTypes.join(", ");
        return `${selectedProductTypes.length} Types Selected`;
    };

    const getLandingTypeLabel = () => {
        if (selectedLandingTypes.includes("All")) return "All";
        if (selectedLandingTypes.length === 0) return "Select Landing Types";
        if (selectedLandingTypes.length <= 2) return selectedLandingTypes.join(", ");
        return `${selectedLandingTypes.length} Types Selected`;
    };

    const getBrandLabel = () => {
        if (selectedBrands.includes("All")) return "All";
        if (selectedBrands.length === 0) return "Select Brands";
        if (selectedBrands.length <= 2) return selectedBrands.join(", ");
        return `${selectedBrands.length} Brands Selected`;
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreatingUser(true);
        try {
            const payload = {
                ...newUserForm,
                state: selectedStates,
                city,
                branch: null,
                productType: selectedProductTypes,
                landingType: selectedLandingTypes,
                brand: selectedBrands
            };
            await createUserByAdmin(payload);
            toast.success("User created successfully");
            setNewUserForm({
                name: "",
                username: "",
                email: "",
                password: "",
                userTypeId: "",
                mobNo: "",
                dateOfJoin: "",
                deviceVerificationRequired: true,
                role: "user"
            });
            setSelectedStates([]);
            setCity("");
            setSelectedProductTypes([]);
            setSelectedLandingTypes([]);
            setSelectedBrands([]);
            setTimeout(() => {
                navigate("/admin/dashboard");
            }, 1000);
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to create user");
        } finally {
            setCreatingUser(false);
        }
    };

    return (
        <div className="flex-1 bg-slate-50 font-sans text-slate-900">
            <Navbar title="ERP Admin" />

            <main className=" mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Create New User</h1>
                        <p className="text-slate-500 mt-1">Add a new user to the system.</p>
                    </div>
                    <button
                        onClick={() => navigate("/admin/dashboard")}
                        className="text-slate-500 hover:text-slate-700 font-medium text-sm flex items-center gap-1 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                        Back to User list
                    </button>
                </div>

                <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                    <form onSubmit={handleCreateUser} className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newUserForm.name}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="Enter Full Name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                                <input
                                    type="text"
                                    required
                                    value={newUserForm.username}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="Enter Username"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={newUserForm.email}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="Enter Email Address"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                                <input
                                    type="password"
                                    required
                                    value={newUserForm.password}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="Enter Password"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">User Type</label>
                                <select
                                    value={newUserForm.userTypeId}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, userTypeId: e.target.value })}
                                    className="block w-full px-3 py-2 border border-slate-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                >
                                    <option value="">Select user type</option>
                                    {userTypes.map((type) => (
                                        <option key={type.id} value={type.id}>
                                            {type.type_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">User Group (Role)</label>
                                <select
                                    value={newUserForm.role}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                                    className="block w-full px-3 py-2 border border-slate-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                >
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number</label>
                                <input
                                    type="tel"
                                    required
                                    value={newUserForm.mobNo}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, mobNo: e.target.value })}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="Enter mobile number"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Date of Join</label>
                                <input
                                    type="date"
                                    value={newUserForm.dateOfJoin}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, dateOfJoin: e.target.value })}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>

                             {/* State Multiple Selection Dropdown */}
                             <div className="relative">
                                 <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                                 <div
                                     className="w-full min-h-[38px] px-3 py-2 border border-slate-300 rounded-lg bg-white sm:text-sm cursor-pointer flex justify-between items-center"
                                     onClick={() => {
                                         setIsStateDropdownOpen(!isStateDropdownOpen);
                                         setIsBranchDropdownOpen(false);
                                         setIsProductTypeDropdownOpen(false);
                                         setIsLandingTypeDropdownOpen(false);
                                         setBranchSearch("");
                                         setProductTypeSearch("");
                                         setLandingTypeSearch("");
                                         if (isStateDropdownOpen) setStateSearch("");
                                     }}
                                 >
                                     <span className="truncate text-slate-700">{getStateLabel()}</span>
                                     <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                     </svg>
                                 </div>
                                 {isStateDropdownOpen && (
                                     <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto p-2 space-y-1">
                                         <div className="px-1 py-1 sticky top-0 bg-white z-10">
                                             <input
                                                 type="text"
                                                 placeholder="Search State..."
                                                 value={stateSearch}
                                                 onChange={(e) => setStateSearch(e.target.value)}
                                                 className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#6804a1] focus:border-[#6804a1]"
                                                 onClick={(e) => e.stopPropagation()}
                                             />
                                         </div>
                                         <label className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer text-sm font-medium text-slate-700">
                                             <input
                                                 type="checkbox"
                                                 checked={filteredStates.length > 0 && filteredStates.every(s => selectedStates.includes(s.name))}
                                                 onChange={() => handleToggleState("All")}
                                                 className="h-4 w-4 text-[#6804a1] border-slate-300 rounded focus:ring-[#6804a1]"
                                             />
                                             All
                                         </label>
                                         {filteredStates.length === 0 ? (
                                             <div className="text-xs text-slate-400 p-1.5">No states found</div>
                                         ) : (
                                             filteredStates.map(s => (
                                                 <label key={s.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer text-sm text-slate-700">
                                                     <input
                                                         type="checkbox"
                                                         checked={selectedStates.includes(s.name)}
                                                         onChange={() => handleToggleState(s.name)}
                                                         className="h-4 w-4 text-[#6804a1] border-slate-300 rounded focus:ring-[#6804a1]"
                                                     />
                                                     {s.name}
                                                 </label>
                                             ))
                                         )}
                                     </div>
                                 )}
                             </div>
 
                             {/* City User Input */}
                             <div>
                                 <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                                 <input
                                     type="text"
                                     value={city}
                                     onChange={(e) => setCity(e.target.value)}
                                     className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                     placeholder="Enter City"
                                 />
                             </div>
 
                             {/* Product Type Multiple Selection Dropdown */}
                             <div className="relative">
                                 <label className="block text-sm font-medium text-slate-700 mb-1">Product Type</label>
                                 <div
                                     className="w-full min-h-[38px] px-3 py-2 border border-slate-300 rounded-lg bg-white sm:text-sm cursor-pointer flex justify-between items-center"
                                     onClick={() => {
                                         setIsProductTypeDropdownOpen(!isProductTypeDropdownOpen);
                                         setIsStateDropdownOpen(false);
                                         setIsBranchDropdownOpen(false);
                                         setIsLandingTypeDropdownOpen(false);
                                         setStateSearch("");
                                         setBranchSearch("");
                                         setLandingTypeSearch("");
                                         if (isProductTypeDropdownOpen) setProductTypeSearch("");
                                     }}
                                 >
                                     <span className="truncate text-slate-700">{getProductTypeLabel()}</span>
                                     <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                     </svg>
                                 </div>
                                 {isProductTypeDropdownOpen && (
                                     <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto p-2 space-y-1">
                                         <div className="px-1 py-1 sticky top-0 bg-white z-10">
                                             <input
                                                 type="text"
                                                 placeholder="Search Product Type..."
                                                 value={productTypeSearch}
                                                 onChange={(e) => setProductTypeSearch(e.target.value)}
                                                 className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#6804a1] focus:border-[#6804a1]"
                                                 onClick={(e) => e.stopPropagation()}
                                             />
                                         </div>
                                         <label className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer text-sm font-medium text-slate-700">
                                             <input
                                                 type="checkbox"
                                                 checked={filteredProductTypes.length > 0 && filteredProductTypes.every(pt => selectedProductTypes.includes(pt.product_type_name))}
                                                 onChange={() => handleToggleProductType("All")}
                                                 className="h-4 w-4 text-[#6804a1] border-slate-300 rounded focus:ring-[#6804a1]"
                                             />
                                             All
                                         </label>
                                         {filteredProductTypes.length === 0 ? (
                                             <div className="text-xs text-slate-400 p-1.5">No product types found</div>
                                         ) : (
                                             filteredProductTypes.map(pt => (
                                                 <label key={pt.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer text-sm text-slate-700">
                                                     <input
                                                         type="checkbox"
                                                         checked={selectedProductTypes.includes(pt.product_type_name)}
                                                         onChange={() => handleToggleProductType(pt.product_type_name)}
                                                         className="h-4 w-4 text-[#6804a1] border-slate-300 rounded focus:ring-[#6804a1]"
                                                     />
                                                     {pt.product_type_name}
                                                 </label>
                                             ))
                                         )}
                                     </div>
                                 )}
                             </div>
 
                             {/* Landing Type Multiple Selection Dropdown */}
                             <div className="relative">
                                 <label className="block text-sm font-medium text-slate-700 mb-1">Landing Type</label>
                                 <div
                                     className="w-full min-h-[38px] px-3 py-2 border border-slate-300 rounded-lg bg-white sm:text-sm cursor-pointer flex justify-between items-center"
                                     onClick={() => {
                                         setIsLandingTypeDropdownOpen(!isLandingTypeDropdownOpen);
                                         setIsStateDropdownOpen(false);
                                         setIsBranchDropdownOpen(false);
                                         setIsProductTypeDropdownOpen(false);
                                         setIsBrandDropdownOpen(false);
                                         setStateSearch("");
                                         setBranchSearch("");
                                         setProductTypeSearch("");
                                         setBrandSearch("");
                                         if (isLandingTypeDropdownOpen) setLandingTypeSearch("");
                                     }}
                                 >
                                     <span className="truncate text-slate-700">{getLandingTypeLabel()}</span>
                                     <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                     </svg>
                                 </div>
                                 {isLandingTypeDropdownOpen && (
                                     <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto p-2 space-y-1">
                                         <div className="px-1 py-1 sticky top-0 bg-white z-10">
                                             <input
                                                 type="text"
                                                 placeholder="Search Landing Type..."
                                                 value={landingTypeSearch}
                                                 onChange={(e) => setLandingTypeSearch(e.target.value)}
                                                 className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#6804a1] focus:border-[#6804a1]"
                                                 onClick={(e) => e.stopPropagation()}
                                             />
                                         </div>
                                         <label className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer text-sm font-medium text-slate-700">
                                             <input
                                                 type="checkbox"
                                                 checked={filteredLandingTypes.length > 0 && filteredLandingTypes.every(opt => selectedLandingTypes.includes(opt))}
                                                 onChange={() => handleToggleLandingType("All")}
                                                 className="h-4 w-4 text-[#6804a1] border-slate-300 rounded focus:ring-[#6804a1]"
                                             />
                                             All
                                         </label>
                                         {filteredLandingTypes.length === 0 ? (
                                             <div className="text-xs text-slate-400 p-1.5">No landing types found</div>
                                         ) : (
                                             filteredLandingTypes.map(opt => (
                                                 <label key={opt} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer text-sm text-slate-700">
                                                     <input
                                                         type="checkbox"
                                                         checked={selectedLandingTypes.includes(opt)}
                                                         onChange={() => handleToggleLandingType(opt)}
                                                         className="h-4 w-4 text-[#6804a1] border-slate-300 rounded focus:ring-[#6804a1]"
                                                     />
                                                     {opt}
                                                 </label>
                                             ))
                                         )}
                                     </div>
                                 )}
                             </div>

                             {/* Brand Multiple Selection Dropdown */}
                             <div className="relative">
                                 <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
                                 <div
                                     className="w-full min-h-[38px] px-3 py-2 border border-slate-300 rounded-lg bg-white sm:text-sm cursor-pointer flex justify-between items-center"
                                     onClick={() => {
                                         setIsBrandDropdownOpen(!isBrandDropdownOpen);
                                         setIsStateDropdownOpen(false);
                                         setIsBranchDropdownOpen(false);
                                         setIsProductTypeDropdownOpen(false);
                                         setIsLandingTypeDropdownOpen(false);
                                         setStateSearch("");
                                         setBranchSearch("");
                                         setProductTypeSearch("");
                                         setLandingTypeSearch("");
                                         if (isBrandDropdownOpen) setBrandSearch("");
                                     }}
                                 >
                                     <span className="truncate text-slate-700">{getBrandLabel()}</span>
                                     <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                     </svg>
                                 </div>
                                 {isBrandDropdownOpen && (
                                     <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto p-2 space-y-1">
                                         <div className="px-1 py-1 sticky top-0 bg-white z-10">
                                             <input
                                                 type="text"
                                                 placeholder="Search Brand..."
                                                 value={brandSearch}
                                                 onChange={(e) => setBrandSearch(e.target.value)}
                                                 className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#6804a1] focus:border-[#6804a1]"
                                                 onClick={(e) => e.stopPropagation()}
                                             />
                                         </div>
                                         <label className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer text-sm font-medium text-slate-700">
                                             <input
                                                 type="checkbox"
                                                 checked={filteredBrands.length > 0 && filteredBrands.every(b => selectedBrands.includes(b.mobile_brand))}
                                                 onChange={() => handleToggleBrand("All")}
                                                 className="h-4 w-4 text-[#6804a1] border-slate-300 rounded focus:ring-[#6804a1]"
                                             />
                                             All
                                         </label>
                                         {filteredBrands.length === 0 ? (
                                             <div className="text-xs text-slate-400 p-1.5">No brands found</div>
                                         ) : (
                                             filteredBrands.map(b => (
                                                 <label key={b.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer text-sm text-slate-700">
                                                     <input
                                                         type="checkbox"
                                                         checked={selectedBrands.includes(b.mobile_brand)}
                                                         onChange={() => handleToggleBrand(b.mobile_brand)}
                                                         className="h-4 w-4 text-[#6804a1] border-slate-300 rounded focus:ring-[#6804a1]"
                                                     />
                                                     {b.mobile_brand}
                                                 </label>
                                             ))
                                         )}
                                     </div>
                                 )}
                             </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <input
                                id="deviceVerification"
                                type="checkbox"
                                checked={newUserForm.deviceVerificationRequired}
                                onChange={(e) => setNewUserForm({ ...newUserForm, deviceVerificationRequired: e.target.checked })}
                                className="h-4 w-4 text-[#6804a1] border-slate-300 rounded focus:ring-[#6804a1]"
                            />
                            <label htmlFor="deviceVerification" className="text-sm font-medium text-slate-700">
                                Require device verification for this user
                            </label>
                        </div>
                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={creatingUser}
                                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-[#6804a1] hover:bg-[#52037e] focus:ring-2 focus:ring-offset-2 focus:ring-[#6804a1] disabled:opacity-50 transition-colors"
                            >
                                {creatingUser ? "Creating..." : "Create User Account"}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}

