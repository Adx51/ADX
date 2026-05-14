import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { OfflineProvider } from './contexts/OfflineContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

import ParcellesList from './pages/parcelles/ParcellesList'
import ParcelleDetail from './pages/parcelles/ParcelleDetail'
import ParcelleForm from './pages/parcelles/ParcelleForm'

import TachesList from './pages/taches/TachesList'
import TacheForm from './pages/taches/TacheForm'

import CampagnesList from './pages/vendange/CampagnesList'
import CampagneDetail from './pages/vendange/CampagneDetail'
import CampagneForm from './pages/vendange/CampagneForm'
import VendangeDetail from './pages/vendange/VendangeDetail'
import ChargementForm from './pages/vendange/ChargementForm'

import DashboardPage from './pages/dashboard/DashboardPage'

// Lazy-loaded pages (reduce initial bundle)
const StatsGlobales           = lazy(() => import('./pages/vendange/StatsGlobales'))
const CampagneExport          = lazy(() => import('./pages/vendange/CampagneExport'))
const CampagneExportJournalier = lazy(() => import('./pages/vendange/CampagneExportJournalier'))
const AdminPage               = lazy(() => import('./pages/admin/AdminPage'))
const ReglagesPage            = lazy(() => import('./pages/reglages/ReglagesPage'))
const PhytoPage               = lazy(() => import('./pages/phyto/PhytoPage'))
const PhytoImportPage         = lazy(() => import('./pages/phyto/PhytoImportPage'))
const PhytoForm               = lazy(() => import('./pages/phyto/PhytoForm'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="w-6 h-6 border-2 border-vigne-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OfflineProvider>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route element={<PrivateRoute />}>
              <Route element={<Layout />}>
                <Route index element={<DashboardPage />} />

                {/* Parcelles */}
                <Route path="/parcelles" element={<ParcellesList />} />
                <Route path="/parcelles/new" element={<ParcelleForm />} />
                <Route path="/parcelles/:id" element={<ParcelleDetail />} />
                <Route path="/parcelles/:id/edit" element={<ParcelleForm />} />

                {/* Tâches */}
                <Route path="/taches" element={<TachesList />} />
                <Route path="/taches/new" element={<TacheForm />} />
                <Route path="/taches/:id/edit" element={<TacheForm />} />

                {/* Vendange — campagnes annuelles */}
                <Route path="/vendange"                element={<CampagnesList />} />
                <Route path="/vendange/stats"          element={<StatsGlobales />} />
                <Route path="/vendange/new"            element={<CampagneForm />} />
                <Route path="/vendange/parcelle/:id"   element={<VendangeDetail />} />
                <Route path="/vendange/parcelle/:id/chargement/new"         element={<ChargementForm />} />
                <Route path="/vendange/parcelle/:vendangeId/chargement/:id/edit" element={<ChargementForm />} />
                <Route path="/vendange/:annee"         element={<CampagneDetail />} />
                <Route path="/vendange/:annee/edit"    element={<CampagneForm />} />
                <Route path="/vendange/:annee/export"  element={<CampagneExport />} />
                <Route path="/vendange/:annee/export-journalier" element={<CampagneExportJournalier />} />

                {/* Phyto */}
                <Route path="/phyto" element={<PhytoPage />} />
                <Route path="/phyto/import" element={<PhytoImportPage />} />
                <Route path="/phyto/new" element={<PhytoForm />} />
                <Route path="/phyto/:id/edit" element={<PhytoForm />} />

                {/* Admin & Réglages */}
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/reglages" element={<ReglagesPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/parcelles" replace />} />
          </Routes>
          </Suspense>
        </OfflineProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
