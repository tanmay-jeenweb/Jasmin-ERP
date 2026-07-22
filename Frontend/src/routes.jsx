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
import LandingTypeMaster from "./pages/admin/LandingTypeMaster";
import SupportMaster from "./pages/admin/SupportMaster";
import ProductTypeMaster from "./pages/admin/ProductTypeMaster";
import ItemModelMaster from "./pages/admin/ItemModelMaster";
import ModelGroupMaster from "./pages/admin/ModelGroupMaster";
import BranchMaster from "./pages/admin/BranchMaster";
import UserBranchMappingMaster from "./pages/admin/UserBranchMappingMaster";
import CreateBranch from "./pages/admin/CreateBranch";
import BranchFinanceCode from "./pages/admin/BranchFinanceCode";
import ActivityReport from "./pages/admin/ActivityReport";
import Offers from "./pages/admin/Offers";
import Home from "./pages/admin/Home";
import OfferForm from "./pages/admin/OfferForm";
import TargetVsAchievement from "./pages/admin/TargetVsAchievement";
import ABMWiseTvAReport from "./pages/admin/ABMWiseTvAReport";
import StockVsCashDepositReport from "./pages/admin/StockVsCashDepositReport";
import FinanceBrandMappingList from "./pages/admin/FinanceBrandMappingList";
import FinanceBrandMappingDetail from "./pages/admin/FinanceBrandMappingDetail";
import FinanceBrandReport from "./pages/admin/FinanceBrandReport";
import Profile from "./pages/Profile";
import ProtectedRoute from "./components/ProtectedRoute";
import AlertMaster from "./pages/admin/AlertMaster";
import PricingFormulaMasterList from "./pages/admin/PricingFormulaMasterList";
import PricingFormulaForm from "./pages/admin/PricingFormulaForm";
import PriceListData from "./pages/admin/PriceListData";
import PriceListReport from "./pages/admin/PriceListReport";


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
                    path="/admin/home"
                    element={<Home />}
                />
                <Route
                    path="/admin/offers"
                    element={<Offers showExpired={false} />}
                />
                <Route
                    path="/admin/offers/expired"
                    element={<Offers showExpired={true} />}
                />
                <Route
                    path="/admin/offers/create"
                    element={<OfferForm />}
                />
                <Route
                    path="/admin/offers/edit/:id"
                    element={<OfferForm />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="alert_master" requiredAction="read" />}>
                <Route
                    path="/admin/alerts"
                    element={<AlertMaster />}
                />
            </Route>

            <Route element={<ProtectedRoute requiredMaster="target_vs_achievement" requiredAction="read" />}>
                <Route
                    path="/admin/target-vs-achievement"
                    element={<TargetVsAchievement />}
                />
                <Route
                    path="/admin/abm-wise-tva"
                    element={<ABMWiseTvAReport />}
                />
            </Route>

            <Route element={<ProtectedRoute requiredMaster="stock_vs_cash_deposit" requiredAction="read" />}>
                <Route
                    path="/admin/stock-vs-cash-deposit"
                    element={<StockVsCashDepositReport />}
                />
            </Route>

            <Route element={<ProtectedRoute />}>
                <Route
                    path="/admin/report"
                    element={<ActivityReport />}
                />
                <Route
                    path="/admin/finance-brand-report"
                    element={<FinanceBrandReport />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" />}>
                <Route
                    path="/admin/finance-brand-mapping"
                    element={<FinanceBrandMappingList />}
                />
                <Route
                    path="/admin/finance-brand-mapping/:branchId"
                    element={<FinanceBrandMappingDetail />}
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

            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="landing_type_master" requiredAction="read" />}>
                <Route
                    path="/admin/landing-types"
                    element={<LandingTypeMaster />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="support_master" requiredAction="read" />}>
                <Route
                    path="/admin/support"
                    element={<SupportMaster />}
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

            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="branch_master" requiredAction="read" />}>
                <Route
                    path="/admin/branches"
                    element={<BranchMaster />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="user_branch_mapping" requiredAction="read" />}>
                <Route
                    path="/admin/user-branch-mapping"
                    element={<UserBranchMappingMaster />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="branch_master" requiredAction="write" />}>
                <Route
                    path="/admin/branches/create"
                    element={<CreateBranch />}
                />
            </Route>


            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="branch_master" requiredAction="write" />}>
                <Route
                    path="/admin/branches/code/:id"
                    element={<BranchFinanceCode />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="variation_master" requiredAction="read" />}>
                <Route
                    path="/admin/pricing-formulas"
                    element={<PricingFormulaMasterList />}
                />
                <Route
                    path="/admin/variations"
                    element={<Navigate to="/admin/pricing-formulas" replace />}
                />
                <Route
                    path="/admin/price-list/:variationId"
                    element={<PriceListData />}
                />
                <Route
                    path="/admin/price-list-report/:variationId"
                    element={<PriceListReport />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="variation_master" requiredAction="write" />}>
                <Route
                    path="/admin/pricing-formulas/add"
                    element={<PricingFormulaForm />}
                />
                <Route
                    path="/admin/pricing-formulas/edit/:id"
                    element={<PricingFormulaForm />}
                />
                <Route
                    path="/admin/variations/add"
                    element={<Navigate to="/admin/pricing-formulas/add" replace />}
                />
            </Route>


        </Routes>
    );
}