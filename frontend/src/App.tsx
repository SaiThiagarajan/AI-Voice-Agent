import { Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { DashboardPage } from "./pages/DashboardPage";
import { CartProvider } from "./context/CartContext";
import { LanguageProvider } from "./context/LanguageContext";
import { VoiceAssistantProvider } from "./context/VoiceAssistantContext";
import { AmbientBackground } from "./components/AmbientBackground";

export default function App() {
  return (
    <LanguageProvider>
      <CartProvider>
        <VoiceAssistantProvider>
          <AmbientBackground />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </VoiceAssistantProvider>
      </CartProvider>
    </LanguageProvider>
  );
}
