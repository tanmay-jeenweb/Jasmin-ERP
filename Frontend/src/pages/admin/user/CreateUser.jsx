import { useState, useEffect } from "react";
import Navbar from "../../../components/Navbar";
import { createUserByAdmin } from "../../../api/authApi";
import { getUserTypes } from "../../../api/userTypeMasterApi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function CreateUser() {
    const navigate = useNavigate();
    const [userTypes, setUserTypes] = useState([]);

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

    const loadUserTypes = async () => {
        try {
            const res = await getUserTypes();
            setUserTypes(res.data.data || []);
        } catch (error) {
            console.error("Error loading user types:", error);
            toast.error("Failed to load user type options.");
        }
    };

    useEffect(() => {
        loadUserTypes();
    }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreatingUser(true);
        try {
            await createUserByAdmin(newUserForm);
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
            <Navbar title="CRM Admin" />

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

