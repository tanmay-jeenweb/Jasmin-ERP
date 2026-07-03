import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import { updateProfile } from "../api/authApi";

export default function Profile() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    mob_no: "",
  });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    if (user.email) {
      setForm({
        name: user.name || "",
        email: user.email || "",
        mob_no: user.mob_no || "",
      });
    }
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const response = await updateProfile(form);
      const updatedUser = response.data.user;

      // Update local storage so navbar and other components reflect the change
      localStorage.setItem("user", JSON.stringify(updatedUser));

      toast.success("Profile updated successfully");

      // Redirect based on role
      if (updatedUser.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/user/home");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
      console.error(error);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 font-sans text-slate-900">
      <Navbar title="Update Profile" />

      <main className="mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Your Profile</h2>
            <p className="text-slate-500 mt-1">
              Update your personal information.
            </p>
          </div>

          <form onSubmit={handleUpdate} className="space-y-6">
            <div>
              <label
                className="block text-sm font-medium text-slate-700 mb-1"
                htmlFor="name"
              >
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6804a1] focus:border-[#6804a1] sm:text-sm transition-colors duration-200"
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-slate-700 mb-1"
                htmlFor="email"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6804a1] focus:border-[#6804a1] sm:text-sm transition-colors duration-200"
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-slate-700 mb-1"
                htmlFor="mob_no"
              >
                Mobile Number
              </label>
              <input
                id="mob_no"
                type="text"
                value={form.mob_no}
                onChange={(e) => setForm({ ...form, mob_no: e.target.value })}
                className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6804a1] focus:border-[#6804a1] sm:text-sm transition-colors duration-200"
              />
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="mr-4 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6804a1] transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-[#6804a1] border border-transparent rounded-lg hover:bg-[#52037e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6804a1] transition-colors duration-200 shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
