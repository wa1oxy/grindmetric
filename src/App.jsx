import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AppProvider } from './contexts/AppContext'
import { getSession, logout, onAuthChange } from './lib/auth'
import { getSupabaseClient, db } from './lib/supabase'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import Workout from './pages/Workout'
import Nutrition from './pages/Nutrition'
import Analytics from './pages/Analytics'
import Progress from './pages/Progress'
import Settings from './pages/Settings'
import Onboarding from './pages/Onboarding'
import Admin from './pages/Admin'

const TABS = ['dashboard', 'workout', 'nutrition', 'analytics', 'progress', 'settings']
const pages = { dashboard: Dashboard, workout: Workout, nutrition: Nutrition, analytics: Analytics, progress: Progress, settings: Settings }

const pageVariants = {
  enter: (dir) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
}

function AppInner({ user, onLogout }) {
  const [tab, setTab] = useState('dashboard')
  const [showAdmin, setShowAdmin] = useState(false)
  const prevTabRef = useRef('dashboard')
  const Page = pages[tab]
  const direction = TABS.indexOf(tab) > TABS.indexOf(prevTabRef.current) ? 1 : -1

  const handleTabChange = (next) => { prevTabRef.current = tab; setTab(next) }

  return (
    <div className="min-h-screen bg-[#030712] overflow-hidden">
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div key={tab} custom={direction} variants={pageVariants}
          initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}>
          <Page onNavigate={handleTabChange} onLogout={onLogout} onOpenAdmin={() => setShowAdmin(true)} />
        </motion.div>
      </AnimatePresence>
      <BottomNav active={tab} onChange={handleTabChange} />
      <AnimatePresence>
        {showAdmin && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.25 }} className="fixed inset-0 z-[100] bg-[#030712] overflow-y-auto">
            <Admin onBack={() => setShowAdmin(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Initial session check
    getSession().then(u => { setUser(u); setLoading(false) })

    // Listen for auth state changes (email verification redirect, sign out, etc.)
    const unsub = onAuthChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        const row = await db.getUser(session.user.id)
        let profile = {}
        if (row?.profile_json) { try { profile = JSON.parse(row.profile_json) } catch {} }
        setUser({ id: session.user.id, email: session.user.email, name: row?.name || session.user.user_metadata?.name || '', profile })
        setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setLoading(false)
      }
    })
    return unsub
  }, [])

  const handleLogout = async () => { await logout(); setUser(null) }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <motion.div key={i} className="w-2 h-2 bg-green-500 rounded-full"
                animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
            ))}
          </div>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Onboarding onComplete={setUser} />

  return (
    <AppProvider user={user}>
      <AppInner user={user} onLogout={handleLogout} />
    </AppProvider>
  )
}
