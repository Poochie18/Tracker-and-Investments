import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthGuard } from '@/lib/auth/auth-guard'
import { AppLayout } from '@/components/AppLayout'

import { LoginScreen } from '@/features/auth/components/LoginScreen'
import { AuthCallback } from '@/features/auth/components/AuthCallback'
import { OverviewScreen } from '@/features/transactions/components/OverviewScreen'
import { AddTransactionScreen } from '@/features/transactions/components/AddTransactionScreen'
import { TransactionsListScreen } from '@/features/transactions/components/TransactionsListScreen'
import { SettingsScreen } from '@/features/settings/components/SettingsScreen'
import { ManageAccountsScreen } from '@/features/settings/components/ManageAccountsScreen'
import { ManageCategoriesScreen } from '@/features/settings/components/ManageCategoriesScreen'
import { ManageInvestmentVisibilityScreen } from '@/features/settings/components/ManageInvestmentVisibilityScreen'
import { BackupScreen } from '@/features/settings/components/BackupScreen'
import { ExcelImportScreen } from '@/features/settings/components/ExcelImportScreen'
import { InvestmentsScreen } from '@/features/investments/components/InvestmentsScreen'
import { AddInvestmentScreen } from '@/features/investments/components/AddInvestmentScreen'
import { InvestmentDetailScreen } from '@/features/investments/components/InvestmentDetailScreen'
import { ChartsScreen } from '@/features/transactions/components/ChartsScreen'
import { RecurringPaymentsScreen } from '@/features/transactions/components/RecurringPaymentsScreen'
import { useUIStore } from '@/stores/ui-store'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60,
      // Дані читаються з локального Dexie (IndexedDB), а не напряму з
      // мережі — тож запити мають виконуватись і в офлайні. За замовчуванням
      // React Query ('online') просто зависає в паузі, поки navigator.onLine
      // === false, і застосунок лишається порожнім навіть з локальними
      // даними на диску.
      networkMode: 'always',
    },
    mutations: {
      // Аналогічно — запис у Dexie теж локальна операція, синхронізація з
      // Supabase відбувається окремо через SyncEngine.
      networkMode: 'always',
    },
  },
})

export default function App() {
  const setIsOnline = useUIStore((s) => s.setIsOnline)

  // Відстежуємо стан мережі глобально — UI реагуватиме на офлайн
  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [setIsOnline])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          {/* Публічні маршрути — доступні без авторизації */}
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/*
            Захищені маршрути:
            AuthGuard → перевіряє сесію, запускає first-login setup
            AppLayout → додає Bottom Navigation
          */}
          <Route element={<AuthGuard />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<OverviewScreen />} />
              <Route path="/add" element={<AddTransactionScreen />} />
              <Route path="/transactions/:id/edit" element={<AddTransactionScreen />} />
              <Route path="/list" element={<TransactionsListScreen />} />
              <Route path="/charts" element={<ChartsScreen />} />
              <Route path="/recurring" element={<RecurringPaymentsScreen />} />
              <Route path="/investments" element={<InvestmentsScreen />} />
              <Route path="/investments/add" element={<AddInvestmentScreen />} />
              <Route path="/investments/:id/edit" element={<AddInvestmentScreen />} />
              <Route path="/investments/type/:assetType" element={<InvestmentsScreen />} />
              <Route path="/investments/:id" element={<InvestmentDetailScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="/settings/accounts" element={<ManageAccountsScreen />} />
              <Route path="/settings/categories" element={<ManageCategoriesScreen />} />
              <Route path="/settings/investment-visibility" element={<ManageInvestmentVisibilityScreen />} />
              <Route path="/settings/backup" element={<BackupScreen />} />
              <Route path="/settings/backup/import-excel" element={<ExcelImportScreen />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
