import { NavLink, Route, Routes } from "react-router-dom";
import { SdkSwitcher } from "./components/SdkSwitcher";
import { CatalogPage } from "./pages/Catalog";
import { ProductDetailPage } from "./pages/ProductDetail";
import { CartPage } from "./pages/Cart";
import { CheckoutPage } from "./pages/Checkout";
import { OrdersPage } from "./pages/Orders";
import { ReviewsPage } from "./pages/Reviews";
import { SellersPage } from "./pages/Sellers";
import { SellerDetailPage } from "./pages/SellerDetail";
import { VectorSearchPage } from "./pages/VectorSearch";
import { AdminPage } from "./pages/Admin";
import { WorkloadsPage } from "./pages/Workloads";

const navItems = [
  { to: "/", label: "Catalog", end: true },
  { to: "/sellers", label: "Sellers" },
  { to: "/cart", label: "Cart" },
  { to: "/checkout", label: "Checkout" },
  { to: "/orders", label: "Orders" },
  { to: "/reviews", label: "Reviews" },
  { to: "/vector", label: "Vector Search" },
  { to: "/workloads", label: "Workloads" },
  { to: "/admin", label: "Admin" }
];

export default function App() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
          <NavLink to="/" className="text-lg font-bold tracking-tight text-brand-700">
            ⌚ ChronoMart
          </NavLink>
          <nav className="flex items-center gap-3 text-sm">
            {navItems.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-md px-2 py-1 ${isActive ? "bg-brand-50 text-brand-700 font-semibold" : "text-slate-600 hover:text-slate-900"}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto"><SdkSwitcher /></div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/products/:sellerId/:id" element={<ProductDetailPage />} />
          <Route path="/sellers" element={<SellersPage />} />
          <Route path="/sellers/:id" element={<SellerDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/vector" element={<VectorSearchPage />} />
          <Route path="/workloads" element={<WorkloadsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-3 text-xs text-slate-500">
          ChronoMart — multi-SDK Cosmos DB testing harness · Phase 0
        </div>
      </footer>
    </div>
  );
}
