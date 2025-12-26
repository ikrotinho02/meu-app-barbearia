
import React from 'react';
import { AuthPage } from './pages/AuthPage';
import { ClientDashboard } from './pages/ClientDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { CustomerBooking } from './pages/CustomerBooking'; 
import { ClientProvider } from './contexts/ClientContext';
import { ProfessionalProvider } from './contexts/ProfessionalContext';
import { ServiceProvider } from './contexts/ServiceContext'; 
import { ProductProvider } from './contexts/ProductContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CashProvider } from './contexts/CashContext';
import { MarketingProvider } from './contexts/MarketingContext';
import { AppointmentProvider } from './contexts/AppointmentContext';

const AppContent: React.FC = () => {
  const { user, role, loading, signOut } = useAuth();
  
  // Simple router check for public booking page
  const isPublicBooking = window.location.search.includes('shop=');

  if (isPublicBooking) {
    return (
      <ServiceProvider>
        <ProfessionalProvider>
          <AppointmentProvider>
             <CustomerBooking />
          </AppointmentProvider>
        </ProfessionalProvider>
      </ServiceProvider>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  // Route based on Role
  if (role === 'professional') {
    return (
      <ProfessionalProvider>
        <ClientProvider>
          <ServiceProvider>
            <ProductProvider>
              <SubscriptionProvider>
                <CashProvider>
                  <AppointmentProvider>
                    <MarketingProvider>
                      <AdminDashboard onLogout={signOut} />
                    </MarketingProvider>
                  </AppointmentProvider>
                </CashProvider>
              </SubscriptionProvider>
            </ProductProvider>
          </ServiceProvider>
        </ClientProvider>
      </ProfessionalProvider>
    );
  }

  // Client Dashboard
  return (
    <ProfessionalProvider>
        <ClientProvider>
            <SubscriptionProvider>
                <MarketingProvider>
                    <ServiceProvider>
                        <AppointmentProvider>
                            <ClientDashboard onLogout={signOut} />
                        </AppointmentProvider>
                    </ServiceProvider>
                </MarketingProvider>
            </SubscriptionProvider>
        </ClientProvider>
    </ProfessionalProvider>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
