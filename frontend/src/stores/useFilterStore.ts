import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface BoardFilters {
  q?: string
  assigneeId?: string[]
  priority?: string[]
  type?: string[]
  labelId?: string[]
  sprintId?: string
  due?: string
  createdFrom?: string
  createdTo?: string
}

export interface ReportFilters {
  from?: string
  to?: string
  userId?: string
  sprintId?: string
  priority?: string[]
  type?: string[]
}

export interface ActivityFilters {
  userId?: string
  action?: string[]
  entityType?: string[]
  from?: string
  to?: string
}

interface FilterState {
  board: BoardFilters
  reports: ReportFilters
  activity: ActivityFilters
  setBoardFilter: (f: Partial<BoardFilters>) => void
  setReportFilter: (f: Partial<ReportFilters>) => void
  setActivityFilter: (f: Partial<ActivityFilters>) => void
  clearBoardFilters: () => void
  clearReportFilters: () => void
  clearActivityFilters: () => void
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      board: {},
      reports: {},
      activity: {},
      setBoardFilter: (f) => set((s) => ({ board: { ...s.board, ...f } })),
      setReportFilter: (f) => set((s) => ({ reports: { ...s.reports, ...f } })),
      setActivityFilter: (f) =>
        set((s) => ({ activity: { ...s.activity, ...f } })),
      clearBoardFilters: () => set({ board: {} }),
      clearReportFilters: () => set({ reports: {} }),
      clearActivityFilters: () => set({ activity: {} }),
    }),
    {
      name: 'filter-storage',
      partialize: (s) => ({ reports: s.reports }),
    },
  ),
)
