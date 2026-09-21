import { Header } from "../components/Header";
import { Dashboard } from "../components/Dashboard/Dashboard";
import { CartDrawer } from "../components/CartDrawer";

export function DashboardPage() {
  return (
    <div className="min-h-screen bg-transparent">
      <Header />
      <Dashboard />
      <CartDrawer />
    </div>
  );
}
