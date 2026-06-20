import { create } from 'zustand'
import type { Task } from '@/api/tasks'

interface TaskStore {
  tasks: Record<string, Task>
  setTasks: (tasks: Task[]) => void
  updateTask: (taskId: string, update: Partial<Task>) => void
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: {},
  setTasks: (tasks) =>
    set({ tasks: Object.fromEntries(tasks.map((t) => [t.id, t])) }),
  updateTask: (taskId, update) =>
    set((state) => {
      if (!state.tasks[taskId]) return state
      return {
        tasks: {
          ...state.tasks,
          [taskId]: { ...state.tasks[taskId], ...update },
        },
      }
    }),
}))
