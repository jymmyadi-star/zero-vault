import { create } from 'zustand';

type MissionType = 'none' | 'first_login';

interface SentinelState {
  isActive: boolean;
  currentStepIndex: number;
  mission: MissionType;
  activateMission: (mission: MissionType) => void;
  advanceStep: () => void;
  setStep: (index: number) => void;
  completeMission: () => void;
}

export const useSentinelStore = create<SentinelState>((set) => ({
  isActive: false,
  currentStepIndex: 0,
  mission: 'none',
  
  activateMission: (mission) => set({ 
    isActive: true, 
    mission, 
    currentStepIndex: 0 
  }),
  
  advanceStep: () => set((state) => ({ 
    currentStepIndex: state.currentStepIndex + 1 
  })),
  
  setStep: (index) => set({ 
    currentStepIndex: index 
  }),
  
  completeMission: () => set({ 
    isActive: false, 
    mission: 'none', 
    currentStepIndex: 0 
  }),
}));
