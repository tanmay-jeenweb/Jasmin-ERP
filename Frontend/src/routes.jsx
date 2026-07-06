import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import DeviceRegistration from "./pages/DeviceRegistration";
import PendingApproval from "./pages/PendingApproval";

import UserHome from "./pages/user/UserHome";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserGroupMaster from "./pages/admin/user/UserGroupMaster";
import CreateUser from "./pages/admin/user/CreateUser";
import CreateUserType from "./pages/admin/user/CreateUserType";
import MobileBrandMaster from "./pages/admin/MobileBrandMaster";
import BankMaster from "./pages/admin/BankMaster";
import FinanceMachineMaster from "./pages/admin/FinanceMachineMaster";
import StateMaster from "./pages/admin/StateMaster";
import ProductTypeMaster from "./pages/admin/ProductTypeMaster";
import ItemModelMaster from "./pages/admin/ItemModelMaster";
import ModelGroupMaster from "./pages/admin/ModelGroupMaster";
import ActivityReport from "./pages/admin/ActivityReport";
import Profile from "./pages/Profile";
import ProtectedRoute from "./components/ProtectedRoute";

export default function AppRoutes() {

    return (
        <Routes>

            <Route
                path="/"
                element={<Login />}
            />

            <Route
                path="/device-registration"
                element={<DeviceRegistration />}
            />

            <Route
                path="/pending-approval"
                element={<PendingApproval />}
            />

            <Route element={<ProtectedRoute />}>
                <Route
                    path="/user/home"
                    element={<UserHome />}
                />
                <Route
                    path="/profile"
                    element={<Profile />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" requiredMasters={["user_master", "device_approval"]} requiredAction="read" />}>
                <Route
                    path="/admin/dashboard"
                    element={<AdminDashboard />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" />}>
                <Route
                    path="/admin/report"
                    element={<ActivityReport />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="user_master" requiredAction="write" />}>
                <Route
                    path="/admin/users/create"
                    element={<CreateUser />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="user_type" requiredAction="read" />}>
                <Route
                    path="/admin/user-types"
                    element={<UserGroupMaster />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="user_type" requiredAction="write" />}>
                <Route
                    path="/admin/user-types/create"
                    element={<CreateUserType />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="mobile_brand_master" requiredAction="read" />}>
                <Route
                    path="/admin/mobile-brands"
                    element={<MobileBrandMaster />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="bank_master" requiredAction="read" />}>
                <Route
                    path="/admin/banks"
                    element={<BankMaster />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="finance_machine_master" requiredAction="read" />}>
                <Route
                    path="/admin/finance-machines"
                    element={<FinanceMachineMaster />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="state_master" requiredAction="read" />}>
                <Route
                    path="/admin/states"
                    element={<StateMaster />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="product_type_master" requiredAction="read" />}>
                <Route
                    path="/admin/product-types"
                    element={<ProductTypeMaster />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="item_model_master" requiredAction="read" />}>
                <Route
                    path="/admin/item-models"
                    element={<ItemModelMaster />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="model_group_master" requiredAction="read" />}>
                <Route
                    path="/admin/model-groups"
                    element={<ModelGroupMaster />}
                />
            </Route>

        </Routes>
    );
}