import { describe, it, expect, beforeEach } from 'vitest'
import { useFilterStore } from '@/stores/useFilterStore'

beforeEach(() => {
  useFilterStore.setState({ board: {}, reports: {}, activity: {} })
})

describe('useFilterStore', () => {
  describe('board filters', () => {
    it('starts with empty filters', () => {
      expect(useFilterStore.getState().board).toEqual({})
    })

    it('merges partial filter updates', () => {
      useFilterStore.getState().setBoardFilter({ priority: ['high', 'urgent'] })
      useFilterStore.getState().setBoardFilter({ q: 'login' })
      const { board } = useFilterStore.getState()
      expect(board.priority).toEqual(['high', 'urgent'])
      expect(board.q).toBe('login')
    })

    it('clears all board filters', () => {
      useFilterStore.getState().setBoardFilter({ priority: ['high'], q: 'test' })
      useFilterStore.getState().clearBoardFilters()
      expect(useFilterStore.getState().board).toEqual({})
    })

    it('allows overwriting a filter key', () => {
      useFilterStore.getState().setBoardFilter({ priority: ['high'] })
      useFilterStore.getState().setBoardFilter({ priority: ['low'] })
      expect(useFilterStore.getState().board.priority).toEqual(['low'])
    })
  })

  describe('report filters', () => {
    it('sets and clears report filters', () => {
      useFilterStore.getState().setReportFilter({ from: '2026-01-01', userId: 'u1' })
      expect(useFilterStore.getState().reports.from).toBe('2026-01-01')
      useFilterStore.getState().clearReportFilters()
      expect(useFilterStore.getState().reports).toEqual({})
    })
  })

  describe('activity filters', () => {
    it('sets multi-value action filters', () => {
      useFilterStore.getState().setActivityFilter({ action: ['created', 'deleted'] })
      expect(useFilterStore.getState().activity.action).toEqual(['created', 'deleted'])
    })
  })
})
