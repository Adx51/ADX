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

import AdminPage from './pages/admin/AdminPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OfflineProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route element={<PrivateRoute />}>
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/parcelles" replace />} />

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
                <Route path="/vendange/new"            element={<CampagneForm />} />
                <Route path="/vendange/parcelle/:id"   element={<VendangeDetail />} />
                <Route path="/vendange/parcelle/:id/chargement/new"         element={<ChargementForm />} />
                <Route path="/vendange/parcelle/:vendangeId/chargement/:id/edit" element={<ChargementForm />} />
                <Route path="/vendange/:annee"         element={<CampagneDetail />} />
                <Route path="/vendange/:annee/edit"    element={<CampagneForm />} />

                {/* Admin */}
                <Route path="/admin" element={<AdminPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/parcelles" replace />} />
          </Routes>
        </OfflineProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
